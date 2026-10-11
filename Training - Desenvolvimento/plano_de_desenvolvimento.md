# ClubOS — Plano de Desenvolvimento: Training Update

> **Status (2026-10-11):** 🟡 **Fases 1 a 9 e 11 entregues (10 dispensada)** (estado/regra semanal/botão/abas; motor headless + Simular rápido; tela do jogo 2D em modo Assistir). Já existe em código (protótipo local, sem persistência): botão *Treinamento* no Dashboard, página `/training` ("Training Pit") com escolha de 5x5 / 7x7 / 11x11, formações por time, arrastar elenco para o campo, popup treino aberto/fechado. Também foi adicionado o 4-3-3 Ofensivo e feito um ajuste de coordenadas nas formações.
> **Documento irmão:** [`GAME_DESIGN_TRAINING_PIT.md`](./GAME_DESIGN_TRAINING_PIT.md) — como o minijogo 2D funciona (motor, controles, IA, sistema de notas).
> **Convenção:** mesmo formato dos planos de LiveLife / International Duty — fases incrementais, cada uma utilizável isoladamente.

> **Visão do dono do projeto:** o mais importante deste modo é **trazer realismo ao modo carreira**. O usuário vê quem foi bem no treino e quem foi mal, e usa isso para decidir titulares. Treino não é um sistema de evolução de atributos: é uma **fonte de informação e de moral**.

---

## 1. Regras de negócio (decididas)

### 1.1. Disponibilidade do treino
- Treino é **opcional**.
- **Um por semana de calendário** (segunda a domingo; renova na segunda).
- Botão no Dashboard, **logo abaixo de "Avançar Dia"**:
  - 🟡 **Amarelo** = há treino disponível.
  - ⚪ **Cinza (bloqueado)** = treino já feito nesta semana **ou** hoje é dia de jogo.
- Em dia de jogo o botão fica cinza sempre.

### 1.2. Estrutura da aba Treinamento (3 abas)
| Aba | Conteúdo |
|---|---|
| **Partida** | Montagem do treino (a tela que já existe) → Continuar → popup aberto/fechado → **jogo 2D em tela cheia**. |
| **Histórico** | Lista no estilo do registro de partidas: `Data · Time A x Time B · resultado · [Ver resumo]`. O resumo mostra **as notas de todos os jogadores dos dois lados**. |
| **Elenco** | Mesma tela do elenco do time, mas com colunas de treino: **gols no treino, assistências, nota (média/última), nº de treinos, moral**. |

### 1.3. Efeitos no jogo (carreira)
| Efeito | Regra |
|---|---|
| **Moral do jogador** | Bom treino → sobe; mau treino → desce. Intensidade proporcional à nota. |
| **Treino aberto → Pulse** | Gera notícia no Pulse sobre **escalação, melhores e piores jogadores**. A notícia também **sobe ou baixa a moral** (elogio/crítica pública). |
| **Treino fechado** | Sem notícia; só o efeito normal de moral. |
| **Lesão** | Pode ocorrer no treino; **chance baixa**, mas existe. Reaproveita o fluxo de lesões do clube. |

### 1.4. Tipo de treino = **um jogo**, não uma simulação
O treino é uma **partida jogável em 2D** (tela cheia, horizontal; celular pede para virar a tela):
- Campo inteiro visto de cima, gols nas duas pontas, linhas corretas.
- Placar no topo: **Time A  x  Time B** + cronômetro.
- Duração **de cada tempo**: opção de **2:00** ou **2:30**.
- As **notas** dos jogadores saem do que aconteceu na partida (ver game design).

---

## 2. O que já existe no código e será reaproveitado

| Necessidade | Já existe | Onde |
|---|---|---|
| Nota 0–10 por jogador numa partida | `PlayerMatchRating`, `playerRatings`, `motmPlayerId` | `src/types/Match.ts` |
| Moral após partida (papel, resultado, nota, gols) | `applyMatchMoraleToPlayers` | `src/utils/squadMorale.ts` |
| Lesão com dias de retorno | `applyMatchAvailability`, `rollInjuryDays`, `tickInjuries` | `src/livelife/*`, `src/types/Player.ts` |
| Jogador bloqueado (lesão, suspensão, serviço nacional) | `isPlayerBlockedFromLineup` | `src/types/Player.ts` |
| Pulse com eventos por contexto | motor de eventos extensível (`match_only`, `nationalEvents.ts`) | `src/pulse/*` |
| Tela de elenco com tabela | `Squad.tsx` | `src/pages/Squad` |
| Formações (11 jogadores) + funções por slot | `FORMATION_PRESETS`, `roleFit` | `src/utils/formations.ts` |
| Formações 5 e 7 | novo | `src/utils/trainingFormations.ts` (já criado) |
| Cores de uniforme | `kitColorForLocation` | `src/utils/clubColors.ts` |
| Voltar dia | `rewindDay` | `GameContext.tsx` |

**Já criado nesta fase:** `TrainingPit.tsx` (+ css), `trainingFormations.ts`, rota `/training`, botão no Dashboard.

---

## 3. Modelo de dados (proposta)

```ts
// src/types/Training.ts
interface TrainingState {
  history: TrainingSession[];
  settings: { halfDurationSec: 120 | 150 };
}

interface TrainingSession {
  id: string;
  date: string;                          // ISO do jogo (state.currentDate)
  season: number;
  open: boolean;
  mode: "vs-cpu" | "cpu-cpu" | "two-players";
  controlledSide?: "a" | "b";            // só em vs-cpu
  format: 5 | 7 | 11;
  halfDurationSec: number;
  teams: Record<'a' | 'b', {
    name: string;                        // "Time A" / editável
    kit: string;                         // cor do uniforme
    formationKey: string;
    lineup: { slot: number; playerId: string }[];
  }>;
  score: { a: number; b: number };
  events: TrainingEvent[];               // gol, assistência, defesa, lesão (com timestamp)
  playerStats: Record<string, TrainingPlayerStats>; // gols, assists, passes, desarmes, defesas...
  ratings: Record<string, number>;       // 0–10, calculada pelo motor de notas
  moraleDelta: Record<string, number>;   // para poder desfazer no "Voltar dia"
  injuries: { playerId: string; days: number }[];
  mvpId: string | null;
  pulseHeadlineId: string | null;
}
```

Princípios:
- **Elenco/aba de treino são derivados:** totais (gols, nota média, nº de treinos) são calculados a partir de `history`, não duplicados em `Player`. Evita dessincronização.
- `moraleDelta` e lesões ficam gravados na sessão para que **"Voltar dia"** consiga desfazer o treino do dia (ponto de atenção — ver §6).
- Entra no save (`storage.ts`, `backup.ts`) e na migração de saves antigos (`training` ausente → estado vazio).

---

## 4. Fases de desenvolvimento

| Fase | Entrega | Jogável sozinha? |
|---|---|---|
| **0** | Protótipo da montagem (feito) + documentos | ✅ montagem |
| **1** | **Estado + regra semanal + botão do Dashboard** (amarelo/cinza, dia de jogo), `TrainingState` no save/migração, abas Partida/Histórico/Elenco vazias | ✅ |
| **2** ✅ | **Motor do jogo (headless)** em `src/training/engine/`: física da bola, jogadores, IA por função, regras mínimas, placar, tempo, notas — testável sem tela. **Simular rápido** já registra treinos com placar, gols, notas e MVP. Calibração: `node scripts/trainingCalibration.ts` | ✅ |
| **3** ✅ | **Tela de jogo 2D** em `src/pages/TrainingMatch` (rota `/training/play`, tela cheia): canvas com campo e linhas por formato, placar + cronômetro regressivo por tempo, velocidade ×1/×2/×4, pausa (Espaço/P, auto ao sair da aba), aviso "gire o aparelho", tela cheia, banner de gol, fim de jogo com notas. Modo **CPU x CPU (Assistir)**. Sair antes do intervalo descarta; depois, simula o resto e registra | ✅ |
| **3b** ✅ | **Ajustes pós-teste:** campo gira 180° no 2º tempo (times trocam de lado), painel de **notas ao vivo** no rodapé (nota + seta de tendência de cada atleta), **estilo tático por time**, IA v2 (apoio curto, corridas sem bola, marcação por zona, lançamentos, meias na área) e atributos com **moral, personalidade e improviso fora de posição** | ✅ |
| **3c** ✅ | **Mecânica completa de bola parada:** cruzamentos (disputa aérea, cabeceio), subida do lateral, lateral/arremesso, escanteios com área cheia, faltas, tiro livre e pênaltis | ✅ |
| **3d** ✅ | **Banco e estatísticas:** botão Banco (pausa e troca qualquer jogador em campo por um reserva, com nota proporcional ao tempo jogado), bloco de estatísticas ligável (finalizações, posse, passes, escanteios, faltas), número/posição sempre visível nas bolinhas | ✅ |
| **4** ✅ | **Realismo do motor:** faltas com contexto (por trás, agressividade) e **cartões** (amarelo, 2º amarelo, vermelho com expulsão), **barreira** no tiro livre, cobrador que **corre até a bola** (sem teletransporte), **goleiros reescritos** (fecham o ângulo, saem da área, mergulham, encaixam/rebatem/espalmam, lógica própria de pênalti), lançamentos por cima, **transição** (contra-ataque e recomposição) e **separação** entre jogadores | ✅ |
| **5** ✅ | **Características:** perfil por posição (4 goleiro, 4 zagueiro, 3 lateral, 3 volante, 4 meia, 3 meia-atacante, 4 ponta, 3 segundo atacante, 5 atacante) que muda atributos **e** comportamento; "Padrão" = neutro; editável na aba Elenco | ✅ |
| **6** ✅ | **Mais realismo de jogo:** impedimento (apito, linha de impedimento, atacantes que erram o tempo), **dribles um contra um** (arrancada ao vencer, bola perdida ao falhar), **cruzamento rasteiro** (recuo para quem chega) e **pressão por gatilho** (saída de bola e linha lateral), cavadinha no pênalti, **comemoração** do gol; cobrança de falta bem mais rápida | ✅ |
| **7** ✅ | **Calibração e testes de regressão:** `npm run training:check` (completo, ~4 min) / `training:check:quick` (~1 min) roda 76 verificações (gols, faltas, cartões, pênaltis, escanteios, passes, dribles, notas e sua distribuição, correlação overall × nota, **gols por função**, estilos, características, robustez com substituições/expulsões/características aleatórias, determinismo). Notas com **baseline por partida** (formação-independente). **Gols de atacante reduzidos** | ✅ |
| **8** ✅ | **Efeitos no jogo:** a nota do treino mexe na **moral** do atleta (±4 + destaque do melhor/pior) e há **lesão rara e leve** (3–10 dias); tudo gravado na sessão e **desfeito pelo "Voltar dia"**; resumo mostra moral (▲/▼) e lesões | ✅ |
| **9** ✅ | **Treino aberto → Pulse:** a imprensa publica (1) as **escalações** dos dois times com o resultado, (2) os **destaques** (até 2) e (3) quem **decepcionou** (até 2), e a exposição pública **amplifica a moral** dos destacados; notícias removidas pelo "Voltar dia" | ✅ |
| **10** | ~~Polimento (sons, animações)~~ — **dispensada** por decisão do dono do projeto | — |
| **11** ✅ | **Vínculo com o app, Data FIFA e uniformes:** Treinamento vira aba do clube (menu **Clube → Treinamento**, mantendo o botão abaixo de Avançar Dia) e da Seleção (**Seleção → Treinamento**, treino **ilimitado**); **Editar uniformes** na Diretoria (1º, 2º e 3º, modelos prontos ou desenho livre) e uniformes usados nos treinos | ✅ |

> Recomendação de ordem: **Fase 2 antes da 3**. O motor sem tela deixa o balanceamento e as notas testáveis (rodar 1000 partidas e ver se as notas fazem sentido) antes de investir em arte.

---

## 5. Decisões já tomadas na conversa
1. Treino semanal opcional; botão cinza em dia de jogo.
2. Três abas: Partida / Histórico / Elenco.
3. Notas dos **dois lados** no resumo.
4. Treino aberto gera Pulse e mexe na moral; lesão possível porém rara.
5. O treino é um **jogo 2D jogável**, horizontal, tela cheia, tempo por tempo configurável (2:00 / 2:30).
6. Semana = semana de calendário (seg–dom).
7. Times se chamam "<Clube> A" e "<Clube> B" (ex.: Flamengo A x Flamengo B).
8. ~~Três modos de jogo~~ → **Decisão revisada (2026-10-11): o treino é de treinador. O usuário assiste, faz substituições e acompanha notas/estatísticas. Controle do jogador (teclado/toque) foi descartado.** O foco passa a ser a qualidade do jogo simulado.
9. **Características** por jogador, específicas da posição (Padrão = neutro), definidas na aba Elenco.

## 6. Pontos em aberto (precisam de decisão)

| # | Pergunta | Recomendação |
|---|---|---|
| 1 | ✅ **Semana de calendário** (segunda a domingo): o limite renova na segunda-feira. O botão mostra "disponível na segunda" quando já usado. | — |
| 2 | ✅ **Nome do clube + letra**: "Flamengo A" x "Flamengo B" (nome vem de `state.team.name`; nada de "Time A/B"). | — |
| 3 | ✅ **Revisado:** só assistir (e Simular rápido). Controle do jogador descartado. | — |
| 4 | **"Voltar dia"** com treino feito no dia: desfaz o treino (moral/lesão/histórico)? | Sim, usando `moraleDelta` gravado na sessão. |
| 5 | Treino **abandonado** no meio: conta como treino usado? Gera notas? | Contar como usado só se passou do 1º tempo; senão descarta e não consome o limite. |
| 6 | **Lesão**: ocorre durante o jogo (evento visível) ou rolada ao final? | Rolada ao final, ponderada por fadiga/minutos; evento visível fica como melhoria. |
| 7 | **Efeito do resultado** na moral (vencedores x perdedores)? | Pequeno bônus/penalidade de equipe; o grosso vem da **nota individual**. |
| 8 | Treino **aberto**: o que é o "risco"? | Só efeito social (Pulse). A lesão não depende de aberto/fechado. |
| 9 | Quem pode ser escalado? | Só elenco disponível (como hoje). Base/jogadores externos ficam para depois. |
| 10 | Treino no **modo Jogador** e na **Seleção**? | Fora de escopo agora; só modo Treinador. |

## 7. Riscos
- **Tamanho:** é o maior módulo do app (um minijogo dentro de um simulador). Mitigação: motor separado da UI e fases jogáveis isoladamente.
- **Balanceamento das notas:** com ~5 min de jogo há poucos eventos por jogador; nota pode ficar ruidosa. Mitigação em `GAME_DESIGN_TRAINING_PIT.md` §6.
- **Controle humano influencia a nota:** o usuário que joga melhor com um jogador ruim "distorce" a informação que o treino deveria dar. Mitigação: execução das ações depende de atributos; modo *Assistir* dá o sinal mais puro.
- **Mobile:** 22 jogadores num celular deitado ficam pequenos; controle por toque precisa ser testado cedo.
- **Voltar dia / save:** treino mexe em moral, lesões e histórico; precisa ser reversível.
