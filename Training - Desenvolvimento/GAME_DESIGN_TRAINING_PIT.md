# Training Pit — Game Design do Minijogo

> **Objetivo do jogo:** ser **simples, divertido e funcional**. "Funcional" significa uma coisa específica: o jogo precisa gerar **notas justas para cada jogador dos dois times**, porque é isso que o usuário usa para decidir titulares.
> **Status:** proposta de design (2026-10-11) — nada implementado além da montagem dos times. Plano geral: [`plano_de_desenvolvimento.md`](./plano_de_desenvolvimento.md).

---

## 1. Os três pilares

1. **Jogo curto e legível.** Dois tempos de 2:00 ou 2:30. Sem regras complexas. Cada partida cabe numa pausa.
2. **O elenco importa.** O `overall` e a posição do jogador mudam como ele joga (velocidade, passe, chute, marcação). Quem é bom no cadastro tende a ir bem — mas com variância, para haver surpresas.
3. **Nota explicável.** Dá para dizer "foi nota 8,1 porque fez 1 gol, 1 assistência e ganhou 4 desarmes". Nada de caixa-preta.

---

## 2. Visão geral do jogo

| Item | Proposta |
|---|---|
| Perspectiva | 2D vista de cima, **campo inteiro fixo na tela** (sem scroll de câmera) |
| Orientação | Horizontal, tela cheia. No celular em pé: tela "gire o aparelho" (Fullscreen API + `screen.orientation.lock` quando disponível) |
| Tecnologia | **`<canvas>` 2D** para o campo; React só para HUD, menus e resumo |
| Tempo | 2 tempos (2:00 ou 2:30), intervalo curto entre eles; tempo exibido é o **cronômetro real do treino** |
| Times | 5, 7 ou 11 por lado, na formação escolhida, uniformes 1 e 2 |
| Campo por formato | Proporcional ao formato (5x5 ≈ 40×22 m, 7x7 ≈ 60×40 m, 11x11 ≈ 105×68 m), sempre ocupando a tela inteira; tamanho do gol e áreas acompanham |
| Fim | Apito final → resumo → grava no histórico → aplica moral/lesões → (aberto) gera Pulse |

---

## 3. Arquitetura (motor separado da tela)

```
src/training/
  engine/        ← TypeScript puro, sem React nem canvas
    world.ts       estado: bola, jogadores, placar, relógio
    step.ts        avança 1 tick (ex.: 30 ou 60 Hz, passo fixo)
    ai.ts          comportamento dos jogadores controlados pela CPU
    rules.ts       gol, bola fora, reinício, intervalo
    stats.ts       registra eventos e contadores por jogador
    rating.ts      transforma estatísticas em nota
  render/        ← desenha o world no canvas
  input/         ← teclado + toque → "intenções" (mover, passar, chutar, correr)
  ui/            ← TrainingMatchScreen, HUD, pausa, resumo
```

Por que separar:
- **Simulação rápida:** o mesmo motor roda sem desenhar, acelerado, e devolve o resultado em milissegundos (botão "Simular rápido" e testes automatizados).
- **Balanceamento por números:** rodar 1000 partidas CPU×CPU e conferir se média de gols, distribuição de notas e fadiga fazem sentido — sem abrir tela.
- **Determinismo:** o motor usa um gerador pseudoaleatório com *seed*; qualquer partida pode ser reproduzida para depurar uma nota estranha.
- Passo fixo (não depende do FPS do aparelho), render com interpolação.

---

## 4. Atributos do jogador (implementado)

O `Player` só tem `overall`, posição, moral e personalidade. O motor deriva os atributos de jogo nesta ordem (`src/training/engine/attributes.ts`):

1. **Overall como base** — quanto maior, melhor em tudo.
2. **Perfil da posição** — cada posição puxa atributos para cima e para baixo (ex.: ST +6 finalização, −14 desarme; CB +6 desarme, −12 finalização; goleiro com atributo de goleiro próprio).
3. **Improviso** — jogar fora da função do slot reduz os atributos (até −14 pontos), usando `roleFit` das formações. Um zagueiro de ponta ou um atacante no gol rende bem menos.
4. **Moral** — de −5 a +5 pontos em todos os atributos (moral 60 = neutro, 100 = +5, 20 = −5).
5. **Personalidade** — pequenos ajustes por tipo; **sem personalidade = perfil neutro**.
6. **Ruído fixo por jogador** (±4, vem do id) — dois meias de 80 não são idênticos, e o mesmo jogador é igual entre treinos.

Atributos resultantes: velocidade (m/s), passe, finalização, desarme, drible, goleiro, resistência + três traços de comportamento: **agressividade** (desarmes), **volatilidade** (multiplica o erro de passe/chute) e **egoísmo** (tendência de chutar em vez de tocar).

| Personalidade | Efeito no treino |
|---|---|
| Líder | passe +2, desarme +2, resistência +2, menos erro |
| Veterano | passe +4, finalização +2, desarme +2, mas velocidade −4 e resistência −4; menos erro |
| Promessa | velocidade +3, drible +4, passe −2; mais erro (irregular) |
| Temperamental | finalização +2, desarme +2; mais agressivo e mais erro |
| Vaidoso | drible +4, finalização +3, passe −4; muito egoísta (chuta mais) |
| Ambicioso | resistência +4, velocidade/finalização +1; levemente egoísta |
| Reservado | passe +2, drible −2; menos egoísta |
| Disciplinado | desarme +4, passe +2, resistência +2; bem menos erro, menos agressivo |

As personalidades são as mesmas 8 que o Pulse já usa (`src/pulse/utils.ts`), definidas ao criar/contratar o atleta.

---

## 5. Mecânica de jogo

### 5.1. Movimento e bola
- Jogador: posição, velocidade, direção; aceleração/atrito simples; **energia** que cai ao correr e recupera andando.
- Bola: posição + velocidade, atrito constante; ao tocar a linha lateral/fundo sai de jogo.
- **Posse:** quem estiver a menos de um raio da bola e com bola abaixo de uma velocidade "domina" e conduz (bola colada à frente do pé).

### 5.2. Ações do jogador controlado (3 botões)
| Ação | Teclado (sugestão) | Toque | Efeito |
|---|---|---|---|
| Mover | WASD / setas | joystick à esquerda | direção |
| **Passe** | `J` / Espaço | botão A | passa para o companheiro mais bem posicionado na direção apontada (*assistência de mira*); segurar = passe mais forte/longo |
| **Chute** | `K` | botão B | segurar para dar força; mira na direção do movimento, com desvio conforme finalização |
| **Correr** | `L` / Shift | botão C | sprint gastando energia |
| Trocar jogador | `E` / Tab | toque no jogador | muda o controle para outro (por padrão, **automático**: assume o mais próximo da bola quando o time defende) |
| Pausa | Esc | botão no HUD | |

Defender: encostar no portador tenta **desarme** (resolvido por atributos, não por botão extra — mantém simples). Opcional: botão de "pressionar/carrinho" depois.

### 5.3. Regras mínimas (v1)
- **Sem impedimento. Sem faltas** na v1 (desarme falho = portador segue; desarme forte pode "derrubar" sem apitar).
- **Bola fora:** reinício rápido — lateral/escanteio/tiro de meta resolvidos automaticamente (jogador mais próximo recebe a bola na linha, ~1 s de atraso e uma setinha indicando).
- **Gol:** comemoração curta (1,5 s), reposição ao centro, tempo continua.
- **Goleiro:** posiciona-se na linha, defende conforme reflexo × qualidade do chute; pode repor com as mãos/pé.
- **Intervalo:** cronômetro congela, mostra placar parcial, retoma. Sem troca de lado na v1 (evita confusão de controle).
- **Empate no fim:** fica empatado (é treino).

### 5.4. IA da CPU (implementado — v2)

Cada jogador tem uma **posição-base** da formação e muda de comportamento conforme a situação. Tudo parametrizado pelos **traços do estilo tático** (os mesmos 5 traços de 1 a 5 de `tacticalStyles.ts`):

| Traço | O que muda no jogo |
|---|---|
| Mentalidade | quanto meias/atacantes sobem com a posse; vontade de finalizar |
| Ritmo | velocidade de decisão e preferência por passe vertical/longo (baixo = posse com passes curtos; alto = jogo direto / lançamentos) |
| Amplitude | largura do time (ala mais aberta ou time fechado) |
| Pressão | quantos jogadores pressionam a bola e de que distância |
| Linha | altura do bloco defensivo |

**Com a bola (sem ser o portador):**
- **Apoio curto:** os 2 meias/laterais mais próximos procuram um ponto livre perto do portador (maximiza espaço, linha de passe e evita se amontoar).
- **Atacantes:** correm para a linha do último defensor, abrem a faixa se o portador está no mesmo lado.
- **Meias:** infiltram na área quando a bola chega ao terço final (chegada de segunda linha).
- **Laterais:** apoiam por fora (ultrapassagem) quando a jogada vai pelo seu lado.
- **Zagueiros:** a linha sobe e desce com a bola.
- **Destinatário do passe** corre ao encontro da bola.

**Sem a bola:** bloco compacto, **marcação por zona** (zagueiros/volantes acompanham o adversário mais próximo, ficando do lado do gol) e pressão dentro do raio do estilo.

**Portador:** pontua cada companheiro (espaço, linha de passe livre, ganho de campo, distância ideal de 5–15 m, lançamento para quem corre em profundidade, passe para dentro da área) e decide entre **chutar**, **tocar para quem está em melhor posição** (gera assistência), **passar** ou **conduzir** quando há espaço. Meias e defensores chutam de mais longe; a chance de chutar depende de distância, linha livre, função, estilo e egoísmo.

---|---|
| Meu time **com a bola** | Portador decide: conduzir / passar / chutar (pontuação simples por espaço livre, distância ao gol, linha de passe). Companheiros **avançam** e abrem linhas de passe conforme a função (ATA ataca profundidade; MC oferece apoio). |
| **Adversário com a bola** | Os 1–2 mais próximos **pressionam**; o resto **recompõe** a formação deslocada em direção à bola (bloco sobe/desce com a bola); ZAG/VOL fecham o centro. |
| **Bola solta** | O mais próximo vai buscar; os demais mantêm posição. |
| Goleiro | Fica na linha acompanhando a bola; sai para cortar bola longa pelo ar se estiver perto. |

Tudo baseado em **posição-base + deslocamento pela bola + 3–4 regras de decisão** — nada de planejamento pesado. Dificuldade da CPU = ajustar tempo de reação e erro nas decisões (fácil/normal/difícil como opção futura).

---

## 6. Sistema de notas (o coração do "funcional")

### 6.1. Eventos registrados por jogador
`gols, assistências, chutes (no alvo / fora), passes certos / errados, passes-chave (pass. que gera chute), desarmes ganhos, interceptações, **cortes** (zagueiros: bola afastada do perigo), bolas perdidas, **defesas** (GK), gols sofridos (time), **sem sofrer gol** (goleiro e defensores), distância percorrida, tempo em campo.`

**Assistência:** último passe do mesmo time até 4 s antes do gol, sem toque adversário no meio.

### 6.2. Fórmula (proposta inicial — ajustar com simulações)

```
pontos = Σ (peso_evento × quantidade)     ← com pesos dependentes da posição
nota   = 6,0 + 4 × tanh(pontos / K)       ← suaviza e evita 0 ou 10 com pouca amostra
nota   = clamp(nota, 3,0 ; 10,0)  + ajuste de equipe (+0,3 vitória / −0,3 derrota)
```
`K` ≈ 6 (calibrar). Com `tanh`, uma atuação média fica perto de 6,0 e só uma atuação realmente excepcional chega a 9+.

| Evento | Atacante | Meia | Defensor | Goleiro |
|---|---|---|---|---|
| Gol | +3,0 | +3,0 | +3,5 | +3,5 |
| Assistência | +2,0 | +2,0 | +2,0 | +2,0 |
| Chute no alvo | +0,5 | +0,4 | +0,3 | — |
| Chute fora | −0,2 | −0,1 | −0,1 | — |
| Passe certo | +0,05 | +0,08 | +0,05 | +0,04 |
| Passe errado | −0,15 | −0,12 | −0,2 | −0,2 |
| Passe-chave | +0,8 | +0,8 | +0,6 | — |
| Desarme ganho | +0,3 | +0,5 | +0,8 | — |
| Interceptação | +0,2 | +0,5 | +0,8 | — |
| Corte (afasta o perigo) | — | +0,2 | +0,6 | +0,3 |
| Bola perdida (desarmado) | −0,3 | −0,3 | −0,5 | — |
| Defesa | — | — | — | +0,9 |
| Gol sofrido | — | −0,2 (cada) | −0,5 | −0,6 |
| Sem sofrer gol (clean sheet) | — | +0,3 | +1,0 | +1,5 |

Princípios:
- **Jogador sem lance fica perto de 6,0** (nem castigado, nem premiado).
- **Defensor e goleiro podem brilhar sem gol** (clean sheet, desarmes, defesas) — senão a nota viraria só "quem fez gol".
- **Erros pesam**: bola perdida e passe errado de defensor custam mais.
- **Time vencedor** recebe um empurrãozinho, mas a nota é principalmente individual.
- **Normalização por tempo em campo** (se houver substituição futura).

### 6.3. Garantindo que a nota seja uma informação *útil*
O risco: o usuário joga bem com um jogador fraco e distorce o "sinal". Mitigações:
1. **Execução por atributo:** a mira do usuário define a *intenção*; o resultado (precisão do passe/chute, ganho de duelo) passa pelo atributo do jogador. Jogador ruim erra mais, mesmo nas mãos de quem joga bem.
2. **Variância controlada:** ruído fixo por jogador + pequena aleatoriedade por jogada → surpresas existem, mas o craque tende a aparecer.
3. **Modo Assistir (CPU × CPU)** como a leitura mais "pura" do elenco; **Simular rápido** idem.
4. **Transparência:** resumo mostra os números que compõem a nota. Na aba Elenco, mostrar **média das últimas N notas** para suavizar um dia ruim.

### 6.4. Do resultado à moral
Tabela inicial (ajustar com `applyMatchMoraleToPlayers` como referência):

| Nota | Δ moral |
|---|---|
| ≥ 8,5 | +4 |
| 7,5 – 8,4 | +2 |
| 6,5 – 7,4 | +1 |
| 5,5 – 6,4 | 0 |
| 4,5 – 5,4 | −2 |
| < 4,5 | −4 |

- **Melhor em campo (MVP)**: +1 extra. **Pior nota**: −1 extra.
- **Treino aberto:** a notícia do Pulse multiplica o efeito para os destacados (melhores e piores): exposição pública pesa mais — +50% do delta, com teto.
- Lesão: probabilidade-base baixa (ex.: ~1,5% por jogador), aumenta com fadiga/baixa resistência e com mais tempo de jogo; dias de retorno via `rollInjuryDays` (limitar à faixa **leve/curta** em treino).

---

## 7. Modos de jogo (REVISADO — o usuário é o treinador)

> **Decisão de 2026-10-11:** o controle do jogador foi descartado. O usuário assiste, substitui e analisa notas e estatísticas. Os modos "Você x CPU" e "2 jogadores" abaixo ficaram só como histórico; o que vale é **Assistir** e **Simular rápido**.

| Modo | Descrição | Fase |
|---|---|---|
| **Você x CPU** | Escolhe qual time controlar (Flamengo A ou B); o outro é da CPU. | 4 |
| **CPU x CPU** | Assiste em tempo real, com aceleração (×2, ×4). | 3 |
| **2 jogadores** | Um controla cada time: teclado dividido (A: WASD+J/K/L · B: setas+numpad/;) ou toque, um joystick/botões em cada metade da tela. | 4 |
| *(extra)* **Simular rápido** | Roda o motor sem desenhar; resultado e notas na hora. Atalho para quem não quer jogar. | 2 |

---

## 8. Mobile (horizontal)
- **Joystick virtual** à esquerda (polegar), **3 botões** à direita (passe / chute / correr).
- **Troca de jogador automática** por padrão (senão 22 alvos são impossíveis de tocar).
- Botões grandes, posição ajustável; haptics curtos em gol e chute (se suportado).
- Tela "gire o aparelho" quando em pé; pausa automática ao sair do app.
- Sprite dos jogadores como **círculos coloridos com número** (leve, legível, cor do uniforme) — dispensa arte.

---

## 9. Visual e áudio (leve)
- Campo desenhado em código: grama listrada, linhas oficiais, áreas, círculo central, marca do pênalti, gols com rede.
- Jogadores: círculo com a cor do uniforme + número + anel (cor) no jogador controlado, goleiro em cor diferente (`gkShirtColor`).
- Bola branca com sombra; rastro curto no chute.
- HUD: `Time A  2 x 1  Time B` + cronômetro (`1T 01:12`), pausa, barra de energia do jogador controlado.
- Sons (fase 8): apito, chute, torcida (mais forte no treino aberto), gol.

---

## 10. Roteiro de validação do motor (antes da arte)
1. Simular **1000 partidas CPU×CPU** por formato. Metas: média de **gols/jogo entre 3 e 7** (partidas curtas devem ter gols), empates raros, nenhuma formação dominante absurda.
2. Distribuição de notas: **média ≈ 6,2**, desvio ≈ 0,9, <1% de notas ≥ 9,5 ou ≤ 3,5.
3. Correlação **overall × nota** positiva e moderada (≈ 0,3–0,5): bom jogador tende a ir melhor, sem determinismo.
4. Goleiro e defensores com notas comparáveis às dos atacantes.
5. Mesma seed → mesmo resultado.

---

## 11. Ideias para depois (backlog)
- Cartões (amarelo/vermelho) e impedimento.
- Substituições durante o treino; troca de lado no 2º tempo.
- Dificuldade da CPU; treino com **táticas** (estilo de jogo já existente em `tacticalStyles`) afetando a IA (posse, contra-ataque, pressão).
- Jogadores da base / externos no treino aberto.
- Lesão com evento visível em campo.
- Replays curtos de gol; mini-mapa; estatísticas ao vivo.
- Objetivos de treino (ex.: "marcar 3 gols na formação X") e treino temático (apenas bola parada, rondo).
- Modo 2 jogadores online.


---

## 12. Resultado da calibração do motor (Fase 2, 200 partidas por formato, 2:30 por tempo)

Rodar: `node scripts/trainingCalibration.ts 200 all` (Node 22.6+; o motor usa imports `.ts`).

| | 5x5 | 7x7 | 11x11 | Meta |
|---|---|---|---|---|
| Gols por jogo (total) | 4,0 | 6,2 | 4,9 | 3–7 ✅ |
| Empates | 19% | 18% | 16% | raros ✅ |
| Nota média | 6,07 | 6,03 | 6,14 | ≈ 6,2 ✅ |
| Desvio das notas | 1,49 | 1,57 | 1,19 | ≈ 0,9–1,5 ✅ |
| Notas ≥ 9,5 | 1,7% | 3,1% | 1,1% | < 1% ⚠️ (7x7 alto) |
| Notas ≤ 3,5 | 4,4% | 3,6% | 2,6% | < 1% ⚠️ |
| Correlação overall × nota (dentro da função) | 0,35 | 0,19 | 0,16 | 0,3–0,5 ⚠️ (11x11 e 7x7 baixos) |
| Nota média por função (GOL/DEF/MEI/ATA) | 6,1 | 6,0–6,1 | 6,1–6,2 | iguais ✅ |

**Como a nota funciona hoje:** `nota = 6 + 4·tanh((pontos − baseline[formato][função]) / K[formato]) ± 0,3` (resultado da equipe).
O *baseline* é a média de pontos de cada função em cada formato (calibrado por simulação), então goleiro, defensor, meia e atacante partem do mesmo patamar. `K` é maior nos campos pequenos (mais lances por jogador).

**Pendências de balanceamento (próximas rodadas):**
- Subir a correlação overall × nota no 7x7/11x11 (dar mais peso a atributos nos duelos e na velocidade).
- Reduzir a cauda de notas extremas nos campos pequenos.
- O baseline depende da formação usada na calibração (4-4-2 / 2-3-1 / 2-2); formações muito ofensivas ou defensivas deslocam a média da função. Avaliar baseline calculado por partida (combinado com o fixo) se isso incomodar.
- Interceptações ainda são frequentes em relação aos passes (11x11: ~24 por jogo para ~97 passes).


---

## 13. Rodada de melhorias (feedback do dono do projeto)

Pedido: jogadas mais naturais, passes curtos, movimentação sem bola dependente da tática, lançamentos melhores e gols que não fossem sempre do atacante.

**Resultado (200 partidas, 4-4-2 / 2-3-1 / 2-2 de teste):**

| | 5x5 | 7x7 | 11x11 |
|---|---|---|---|
| Gols por jogo | 3,2 | 3,9 | 3,9 |
| Nota média / desvio | 6,08 / 1,36 | 6,07 / 1,14 | 6,11 / 1,14 |
| Notas ≥ 9,5 / ≤ 3,5 | 1,1% / 1,7% | 0,5% / 0,4% | 0,8% / 1,4% |
| Correlação overall × nota (na função) | 0,31 | 0,26 | 0,19 |
| Gols: atacantes / meias | 100% / — | 47% / 52% | 86% / 14% |
| Assistências: atacantes / meias | 84% / — | 30% / 64% | 65% / 35% |

(No 5x5 só há atacantes e defensores em campo, por isso 100%.)

**Efeito dos estilos (11x11, 60 partidas):** Ultra-ofensivo x Retranca → 15,8 x 7,0 chutes e 2,5 x 1,1 gols. O estilo muda o jogo de forma clara.

**Ainda aquém:** no 11x11 os atacantes continuam com ~86% dos gols (num 4-4-2 só há 2 atacantes; alvo ≈ 65–70%). A correlação overall × nota no 11x11 (0,19) segue abaixo da meta (0,3–0,5). Próximas alavancas: cruzamentos de verdade (bola alta), mais rebotes e bolas paradas, e mais peso dos atributos nos duelos.

**Notas ao vivo:** o motor calcula a nota a qualquer momento (baseline e "sem sofrer gol" proporcionais ao tempo jogado), então a tela mostra a nota de cada atleta evoluindo, com seta de tendência.


---

## 14. Bola parada, cruzamentos e faltas (implementado)

Mecânica nova em `src/training/engine/setpieces.ts`:

| Lance | Como funciona |
|---|---|
| **Lateral (arremesso)** | A bola sai pela linha lateral → arremesso para o adversário de quem tocou por último. O cobrador espera ~1 s, escolhe um companheiro livre a até ~22 m e arremessa (mais lento e mais preciso que um chute). Ninguém desarma o cobrador antes. |
| **Subida do lateral** | Quando o jogo vai pelo corredor do lateral, ele sobe por fora (ultrapassagem), recebe a bola aberta (bônus de passe "saída pra lateral") e cruza. Meias abertos e pontas também cruzam. |
| **Cruzamento** | Bola alta para a área: voa sem atrito e sem interceptação e **cai** no ponto mirado (erro depende do passe do jogador). Na queda há **disputa aérea**: atacantes (finalização + impulsão) contra defensores (desarme), com acaso e proximidade. Atacante vencedor cabeceia/finaliza de primeira (com assistência para quem cruzou); defensor vencedor afasta (corte). O goleiro pode sair e encaixar. A bola desenhada fica maior e com a sombra afastada para dar ideia de altura. |
| **Escanteio** | Vem de bola que sai pela linha de fundo após toque do defensor, e também de defesa espalmada e chute bloqueado. O melhor passador cobra; os melhores finalizadores ocupam a área (1º pau, marca do pênalti, 2º pau, entrada da área) e os marcadores ficam do lado do gol; 1–2 jogadores ficam na sobra. Adversários mantêm 6 m. |
| **Falta** | Um desarme perdido pode virar falta (chance maior para jogadores agressivos e de pouco desarme). Dá tiro livre onde foi cometida; adversários recuam 8,5 m. |
| **Tiro livre** | Perto do gol: chute direto ou cruzamento; no ataque: cruzamento na área (mesma montagem do escanteio); no meio/defesa: toque curto. |
| **Pênalti** | Falta dentro da área. Todos saem da área, goleiro na linha, melhor finalizador cobra. Cobrança precisa (cantos); o goleiro defende bem menos que num chute normal (~25–30%). |
| **Tiro de meta** | Goleiro, com passe curto ou bola longa conforme o estilo. |

**Na nota:** falta cometida −0,4; falta sofrida +0,1/+0,2; cruzamento certo conta como passe e cabeceio é chute (com assistência). Notas recalibradas.

**Números (200–400 partidas):** gols 3,3–3,7 por jogo; faltas ~3 (11x11) a ~6 (5x5); pênaltis ~0,1–0,15 por jogo; ~1,8 cruzamentos e ~1,8 escanteios em 7x7; pênalti convertido ~80%.

**Aviso na tela:** faixas "PÊNALTI!", "Escanteio" e "Falta · jogador".

**Ainda não tem:** cartões, impedimento, barreira de jogadores no tiro livre, cobrança de lateral longo, goleiro saindo do gol em bola longa fora do cruzamento.


---

## 15. Rodada de realismo (goleiros, faltas, características)

### 15.1. Goleiros
- **Posicionamento:** entre a bola e o gol; quando um atacante com a bola chega perto, **avança pela reta gol → bola** para fechar o ângulo (mais ou menos conforme o atributo de saída).
- **Mergulho:** com um chute a caminho, desloca-se quase 2× mais rápido até o ponto previsto.
- **Saída da área:** em bola solta ou lançamento nas costas da defesa, sai para cortar se chega antes de qualquer atacante.
- **Defesa:** chance depende de reflexo, jogo de mãos, velocidade, **quão perto do canto** foi o chute e da **distância** (de longe é mais fácil, de perto é mais difícil). Resultado: encaixe (segura), rebote para o lado ou **espalmada para escanteio**.
- **Cruzamentos:** sai e encaixa conforme jogo aéreo e mãos.
- **Pênalti:** o goleiro escolhe um lado (acerta mais com o atributo de pênaltis); só defende se acertou o lado.
- **Distribuição:** passe curto, bola longa ou lançamento, conforme visão, estilo e característica.

### 15.2. Faltas e cartões
- Desarme perdido pode virar falta. Chance sobe com **agressividade**, entrada **por trás** e baixa qualidade de desarme; cai **dentro da área** (menos pênaltis) e em campos pequenos.
- **Cartões:** amarelo (mais provável por trás e em jogadores agressivos), segundo amarelo expulsa, vermelho direto raro. **Expulsão** deixa o time com um a menos. Goleiro não é expulso.
- **Tiro livre:** o cobrador **corre até a bola** durante a pausa (a pausa dura o tempo da corrida); perto do gol vira **chute com barreira** (1 a 4 defensores a ~9 m que bloqueiam bem mais) ou cruzamento; no meio-campo, toque curto.
- Nota: falta −0,4 · amarelo −0,5 · vermelho −2,5.

### 15.3. Características (por posição)
Cada jogador pode ter **uma** característica (sem ela, **Padrão** = perfil neutro). Mudam **atributos** (o quanto ele acerta) e **tendências** (o que ele tenta fazer).

| Posição | Características |
|---|---|
| Goleiro | Paredão · Goleiro-líbero · Dominador de área · Pegador de pênaltis |
| Zagueiro | Xerife · Zagueiro construtor · Zagueiro rápido · Zagueiro aéreo |
| Lateral | Lateral ofensivo · Lateral defensivo · Lateral construtor |
| Volante | Cão de guarda · Regista · Âncora |
| Meia | Box-to-box · Armador · Meia marcador · Meia de chegada |
| Meia-atacante | Armador clássico · Meia finalizador · Meia driblador |
| Ponta | Ponta driblador · Ponta cruzador · Ponta que corta pra dentro · Ponta velocista |
| Segundo atacante | Falso 9 · Articulador · Segundo atacante finalizador |
| Atacante | Artilheiro · Pivô · Velocista de profundidade · Cabeceador · Atacante completo |

Atributos novos no motor: **jogo aéreo, força, visão, cruzamento, movimentação sem bola** e, no goleiro, **reflexo, mãos, saída, distribuição e pênaltis**.
Tendências: vontade de chutar, chute de longe, cruzar, conduzir, toque seguro × vertical, corridas em profundidade, recuar para buscar o jogo, abrir ou fechar pela faixa e disposição para pressionar.

A característica é editada na aba **Elenco** do treino (campo `Player.trait`). A definição fica em `src/training/engine/traits.ts`.

### 15.4. Movimento
- **Separação:** jogadores não se empilham.
- **Transição:** quem recupera a bola sai em velocidade por ~4 s; quem perdeu recompõe o bloco.
- **Lançamentos:** passe por cima da marcação quando a linha de passe está fechada mas o companheiro está livre à frente.
- **Cobrador e posicionamento já na pausa:** área cheia no escanteio e barreira montadas enquanto o cobrador chega.

### 15.5. Números atuais (200 partidas por formato)
| | 5x5 | 7x7 | 11x11 |
|---|---|---|---|
| Gols por jogo | 4,5 | 3,4 | 3,9 |
| Nota média / desvio | 6,08 / 1,34 | 6,08 / 1,01 | 6,12 / 1,12 |
| Correlação overall × nota (na função) | 0,32 | 0,22 | 0,23 |
| Faltas por jogo | ~4 | ~5 | ~2,6 |
| Pênaltis por jogo | ~0,17 | ~0,02 | ~0,10 |
| Gols dos meias | — | 51% | 18% |

**Pendências:** impedimento; correlação overall × nota ainda abaixo de 0,3 no 7x7/11x11; atacantes seguem com ~80% dos gols no 11x11 (4-4-2); desempenho do motor ficou ~2,5× mais lento (≈0,2 s por partida simulada em 11x11).


---

## 16. Fase 6 — mais realismo

- **Impedimento:** vale no momento do passe (jogador na metade adversária, à frente da bola e do penúltimo adversário, com ~40 cm de tolerância). O passador evita tocar para quem está impedido (mas às vezes erra, ~15%); atacantes com pouca visão de jogo às vezes erram o tempo da corrida. O apito dá tiro livre para o adversário onde o jogador recebeu. Aviso na tela e linha "Impedimentos" nas estatísticas.
- **Dribles:** com um marcador logo à frente, o portador pode encarar o um contra um (quem tem característica de driblador tenta mais). Vencer dá arrancada de ~0,7 s e deixa o marcador atordoado; perder entrega a bola. ~50–60% de sucesso. Conta na nota (+0,2 a +0,35) e no resumo.
- **Cruzamento rasteiro (cutback):** perto da linha de fundo, o portador pode devolver para quem chega na meia-lua/marca do pênalti em vez de cruzar por cima.
- **Pressão por gatilho:** estilos de pressão alta (Pressão, Ultra-ofensivo, Posse) pressionam com mais gente e de mais longe quando o adversário **sai jogando** (goleiro/zagueiro com a bola) ou joga a bola na **linha lateral**.
- **Pênalti:** o cobrador pode tentar a **cavadinha** (raro; mais comum em jogadores egoístas).
- **Comemoração:** o autor do gol corre para a bandeirinha e os companheiros próximos vão atrás durante a pausa até o reinício.
- **Cobrança de falta/escanteio mais ágil:** o cobrador corre até a bola, a pausa dura só o tempo da corrida (≤ ~2 s) e a bola parada termina assim que ele decide jogar curto (antes o jogo ficava "travado" e o cobrador conduzia sem ser marcado).

**Números (200 partidas):** gols por jogo 5,0 / 4,7 / 4,1 (5x5 / 7x7 / 11x11); nota média ~6,1; correlação overall × nota 0,36 / **0,30** / 0,20; dribles ~7–13 por jogo; impedimentos ainda raros (~0–0,5 por jogo).



---

## 17. Fase 7 — calibração, regressão e menos gols de atacante

### 17.1. Teste de regressão
`npm run training:check` (ou `training:check:quick`, ~1 min) simula centenas de partidas e confere **76 metas** (todas passando): gols (2,8–7 por jogo), empates (<35%), chutes, defesas por chute no alvo, passes certos (70–92%), faltas, cartões, pênaltis, escanteios, dribles (40–70%), nota média (5,9–6,3), desvio (0,9–1,6), caudas (≥9,5 e ≤3,5), correlação overall × nota (≥0,15 no 11x11, ≥0,2 nos demais), **diferença de nota entre funções (≤0,35)**, **gols por função**, efeito dos estilos (Ultra-ofensivo x Retranca), efeito de característica (Artilheiro), **robustez** (traços, personalidades, moral, fadiga e improviso aleatórios + substituições no meio do jogo + expulsões: nenhum erro, todas as partidas terminam, notas e posições válidas) e **determinismo** (mesma seed = mesma partida).
Use sempre que mexer no motor. Para recalibrar a âncora absoluta das notas: `npm run training:calibrate`.

### 17.2. Por que os atacantes faziam quase tudo e o que mudou
Diagnóstico: quase todos os gols eram de jogada aberta, e **os meias esperavam na área em posição de impedimento** (o ponto de chegada ficava além da linha), então não recebiam passe. Mudanças:
- Meias que chegam à área e laterais em ultrapassagem **respeitam a linha de impedimento**.
- Passe vertical pesa menos; **toque para o companheiro livre** é mais provável (finalização mais distribuída); cruzamento rasteiro mais frequente.
- Atacantes chutam um pouco menos e **meias mais** (de mais longe e mais vezes); diferenças de finalização por posição mais enxutas.
- **Marcação mais colada** nos atacantes e **marcador colado atrapalha a pontaria** do chute.
- Bola parada: sobem os **melhores de cabeça** (zagueiros altos) e ficam atrás os defensores mais rápidos; o cabeceio usa jogo aéreo e finalização.

Resultado (120–200 partidas): **4-4-2: atacantes 68% dos gols (antes 79–84%)**; **4-3-3: 77% (antes 87%)**; no 7x7 o único atacante faz ~28% e os meias a maioria.

### 17.3. Notas independentes da formação
O baseline por função passou a ser **15% tabela fixa + 85% média da função na própria partida**, aplicado ao longo do jogo. Antes, trocar a formação (por ex. 4-3-3, com pontas contando como atacantes) deslocava a nota média de uma função em mais de 1 ponto; agora a diferença entre funções fica abaixo de 0,35 em todas as formações testadas. Consequência: a nota é relativa aos pares da mesma função naquela partida.

### 17.4. Gols de defensor e características (ajuste pós-fase 7)
**Gols de defensor ≈ 5%** (antes ~0–1%): vêm de bola parada.
- Os zagueiros altos **sobem** nos escanteios e faltas cruzadas (ficam atrás os defensores mais rápidos) e o cobrador **mira neles**.
- O escanteio **espera a área encher** (até ~3,8 s) e os jogadores correm mais forte até as posições — antes os zagueiros lentos ainda estavam no meio-campo quando a bola subia.
- Zagueiro que sobe na bola parada leva vantagem na disputa aérea; o **cabeceio** dentro da área é mais perigoso (pouco tempo de reação do goleiro) e usa jogo aéreo mais que finalização.
- Mais escanteios: parte maior das defesas espalmadas e chutes bloqueados viram escanteio (50%).
- Laterais e zagueiros chutam um pouco mais de fora (fator de finalização de defensor 0,25 → 0,6).
- Efeito colateral: o escanteio fica ~4 s parado em média (a área se monta), contra ~1,3 s da falta.

**Características mais marcantes:** pesam ×1,7 nos atributos e ×1,4 nas tendências, e agora também mudam **quem recebe a bola** (cruzador livre pelo corredor, finalizador bem posicionado na área). No teste, comparando o mesmo time com e sem características:
- 2 **Artilheiros**: +22–31% de chutes e +16–34% de gols.
- 2 **laterais ofensivos + 2 pontas cruzadores**: +33–45% de cruzamentos.
- **Goleiro Paredão**: +10–15% de defesas por chute no alvo.

Novas verificações no `training:check` (81 no total): gols de defensor entre 2,5% e 9% (11x11) e os três efeitos de característica acima.

### 17.5. Pendências
- Impedimentos seguem raros (mantido de propósito).
- Escanteio parado ~4 s: dá para encurtar se incomodar (custa zagueiros chegando à área).



---

## 18. Fase 8 — efeitos na carreira

Código: `src/training/effects.ts` (funções puras; o resultado fica gravado na sessão).

### 18.1. Moral
| Nota | Variação |
|---|---|
| ≥ 8,5 | +4 |
| 7,5 – 8,4 | +2 |
| 6,5 – 7,4 | +1 |
| 5,5 – 6,4 | 0 |
| 4,5 – 5,4 | −2 |
| < 4,5 | −4 |

- **Melhor em campo +1** extra; **pior nota −1** extra.
- Quem jogou menos de 30% da partida (reserva que entrou no fim) sente **metade**.
- O resultado do jogo (placar) **não** entra: o treino é entre dois times do mesmo clube.
- A moral fica entre 0 e 100; o que foi realmente aplicado (já com o teto) é o que vai para `moraleDelta`.
- No treino **aberto**, a repercussão no Pulse (fase 9) amplifica o efeito para melhores e piores.

### 18.2. Lesão (rara e leve)
- Sorteada **no fim** do treino, por jogador: base **0,7%** por partida inteira (11x11; ×0,85 no 7x7, ×0,7 no 5x5), proporcional aos **minutos jogados**, maior com **fadiga** (0,7× a 1,5×) e com **faltas sofridas** (+15% cada).
- Quem já estava lesionado/indisponível não se lesiona de novo.
- Duração **3 a 10 dias** (lesão de treino é leve). Vira `availability: lesionado` + `injuryDaysRemaining`, o mesmo fluxo das lesões de jogo (o LiveLife conta os dias).
- Média ≈ 0,1–0,15 lesão por treino.

### 18.3. Reversão ("Voltar dia")
A sessão grava `moraleDelta`, as lesões (com o estado anterior do atleta) e a fração jogada. Ao voltar o dia, o treino daquele dia sai do histórico, a moral volta e as lesões são desfeitas (só se o atleta ainda estiver com a mesma lesão). O teste de regressão confere que **aplicar e desfazer devolve o elenco exatamente ao estado original**.

### 18.4. Onde aparece
- Resumo do treino (Histórico e fim do jogo): ▲/▼ de moral ao lado da nota e "lesão (N dias)" por jogador; aviso de lesão na tela de fim de treino.
- Aba **Elenco** do treino e elenco do time: a moral já mostrada passa a refletir o treino.

### 18.5. Regressão
`training:check` ganhou 7 verificações: lesões por treino, moral dos 3 melhores (> 0) e dos 3 piores (< 0), moral média neutra, nenhuma lesão em quem já estava indisponível, duração 3–10 dias e reversão exata. Total: **88**.


---

## 19. Fase 9 — treino aberto no Pulse

Só **treino aberto** gera notícia (o fechado fica só com o efeito normal de moral). Código: `src/training/pulseNews.ts` (notícias) e `src/training/effects.ts` (amplificação da moral).

### 19.1. Notícias (entram no histórico do Pulse, no topo)
| Notícia | Categoria | Conteúdo |
|---|---|---|
| **Treino aberto: A x B — resultado** | Imprensa | Escalação completa dos dois times (titulares na ordem da formação + quem entrou) e o resultado. |
| **<Nome> é o destaque do treino aberto** (até 2) | Atleta | Nota e lances (gols, assistências, defesas, cortes). Só com nota ≥ 7,5. |
| **<Nome> decepciona no treino aberto** (até 2) | Imprensa | Nota e lances. Só com nota ≤ 5,2. |

Cada notícia lista o impacto (ex.: "Moral de Fulano +3"). São de 1 a 5 por treino (média ≈ 4,4 nos testes).

### 19.2. Moral amplificada
Os destacados (melhores e piores) levam **+50% no efeito da moral** (mínimo 1 ponto a mais): elogio e crítica públicos pesam mais que o treino fechado. Exemplo: nota 8,0 → +2 normal, **+3** no aberto (+1 do melhor em campo). No teste, o destaque do aberto ganha em média **+1,8 ponto** a mais que no fechado.

### 19.3. Reversão
As notícias ficam ligadas à sessão (`pulseIds`). "Voltar dia" remove as notícias do treino desfeito junto com a moral e as lesões.

### 19.4. Aviso na tela
Ao fim de um treino aberto: "a imprensa publicou as escalações e os destaques no Pulse".

### 19.5. Regressão
`training:check` ganhou 4 verificações (92 no total): média de notícias por treino aberto (1,2–5), nenhuma notícia em treino fechado, ids únicos e textos preenchidos, e a moral extra do destaque no aberto.

### 19.6. Possíveis evoluções
- Efeito no clima do clube (confiança da torcida/imprensa) quando o destacado é um craque.
- Treino aberto atrair mais gente (torcida) e risco de vazamento tático.


---

## 20. Fase 11 — vínculo, Data FIFA e uniformes

### 20.1. Treinamento dentro do app
- **Clube:** menu **Clube → Treinamento** (rota `/training`, dentro do layout com o menu lateral). O botão **Treinamento** abaixo de "Avançar Dia" no Dashboard continua e leva para a mesma aba. O antigo "em construção" (`/under/treinamento`) redireciona.
- O jogo em 2D (`/training/play`) continua em tela cheia, fora do layout.
- A tela se ajusta à área de conteúdo (sem o botão "← Dashboard").

### 20.2. Treinamento na Data FIFA (Seleção)
- Menu **Seleção → Treinamento** (`/national/training`; jogo em `/national/training/play`).
- **Mesma aba** (Partida / Histórico / Elenco) e **mesmo motor**, mas **sem limite**: pode treinar quantas vezes quiser, inclusive em dia de jogo, para testar times rapidamente.
- O elenco é o **banco de convocados** da Seleção (`talentPool`); sem overall cadastrado vale 70. Os times se chamam "<Seleção> A/B".
- **Sem efeitos** no jogo: não mexe em moral, lesão nem Pulse (o convocado não tem esses dados e o objetivo é testar). Os treinos ficam no histórico próprio da Seleção (`nationalTeam.training`).
- **Característica** editável na aba Elenco (`NationalPlayer.trait`).
- Implementação: `useTrainingScope('club' | 'national')` entrega ao restante da tela o elenco, o histórico, as regras (limite semanal ou não) e como registrar a sessão.

### 20.3. Uniformes (Diretoria → Identidade do clube → Uniformes)
- Os uniformes são **independentes das cores do clube** (que seguem no tema e no escudo). Cada um tem **cor base + desenho**.
- Quadrados do **Uniforme 1**, **Uniforme 2** e um **+** para adicionar o **Uniforme 3** (removível). Padrão: 1 = cor primária, 2 = cor secundária.
- Ao clicar num quadrado abre o editor:
  - Escolhe a **cor base** (preenche a camisa).
  - **Modelos prontos** (12): liso, listras verticais/horizontais/finas, faixa diagonal, listras diagonais, metades, quartos, xadrez, chevron, mangas, faixa no peito, degradê — escolhe a **cor secundária**.
  - **Personalizado:** tela de desenho com **pincel, borracha, linha, retângulo, círculo, balde de tinta**, cor, espessura, preenchido/vazado, **desfazer** e **limpar**; a silhueta da camisa aparece como guia. Salva como imagem e pode ser **editado de novo** quando quiser.
- Nos treinos: **Uniforme 1 = Time A (norte)** e **Uniforme 2 = Time B (sul)**. O desenho aparece nos jogadores do campo (recortado no círculo, com número contornado), no placar e no resumo. Treinos antigos continuam com a cor lisa.
- Ainda não usados: uniforme nas telas de Tática/partida (que seguem com a cor do clube) e o 3º uniforme na escolha do treino.
- Código: `src/types/Kit.ts`, `src/utils/kitRender.ts`, `src/components/KitEditor/*`.


---

## 21. Escolha de uniforme e subposições

### 21.1. Uniforme escolhido (não mais por casa/fora)
- **Treino:** cada time (A e B) escolhe um dos uniformes (1º, 2º ou 3º). Padrão: 1º no norte, 2º no sul. Aparece na aba Partida, abaixo das opções de formação/estilo de cada time.
- **Tática:** seletor "Uniforme da escalação" (fica salvo no clube: `Team.lineupKitId`).
- **Registro de partida:** seletor "Uniforme da partida"; sem escolha, usa o 1º em casa e o 2º fora. A escolha é gravada na escalação da partida (`MatchLineup.kitId`).
- **Terceiro uniforme** já pode ser usado em todos esses lugares.

### 21.2. Subposições
- Cada atleta pode ter **até 3 subposições** (posições alternativas), editadas no **Elenco do time** (ao editar o jogador, campo "Subposições").
- Escalado numa posição **exata** (a dele ou uma subposição) → **não perde nada**.
- Vale também fora do treino: a sugestão de melhor escalação, o remanejamento ao trocar de formação e os avisos de escalação consideram as subposições.

### 21.3. Anel na escalação
Nos quadradinhos da escalação (Tática, registro de partida e treino):
- **sem anel:** posição exata (própria ou subposição);
- **anel laranja:** não é a exata, mas é do **mesmo setor** (goleiro / defesa / meio / ataque) e ele não tem essa subposição;
- **anel vermelho:** fora do setor e sem subposição.

### 21.4. Efeito no treino
Atributos do jogador (a conta de improviso do motor): exata = sem perda; **laranja = perda pequena** (encaixe 0,82 ≈ −2,5 pontos); **vermelho = perda maior** (encaixe até 0,45, ≈ −7,7 pontos; goleiro improvisado perde o máximo).

### 21.5. Regressão
`training:check` ganhou 2 verificações (94 no total): 16 casos de encaixe (exata, mesmo setor, fora, com subposição) e o anel correto.
