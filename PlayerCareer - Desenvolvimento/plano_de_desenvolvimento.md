# ClubOS — Plano de Desenvolvimento Modular: Player Career Update (v1.5)

> **Status (2026-09-08):** ✅ **Player Career Update (v1.5) entregue — Fases 1–5.** Decisão do usuário: encerrar a atualização aqui; Fase 6 (Seleção nacional do jogador e demais itens do Horizonte) fica registrada como backlog para uma eventual v1.6, sem compromisso de prazo. Story Arcs pessoais também cortados da Fase 5 — ver decisão abaixo. Fase 1 (correções e acabamento): dead code do setup removido, `marketValue`/`morale` ativados, expectativa do clube no Contrato. Fase 2 (LiveLife do Jogador): `currentDate`/`ADVANCE_DAY` ligados ao modo jogador, lesões pessoais "curam" automaticamente por data, card "Avançar Dia" no Dashboard. Fase 3 (Pulse Pessoal): gerador próprio e menor (`playerGenerator.ts` — o motor do clube não é parametrizável, fecha sobre o banco de eventos a nível de módulo), banco de ~36 eventos, `state.pulse` reaproveitado como o mesmo campo raiz do treinador. Fase 4 (Vida pública): mesmo padrão — motor de coletivas pessoais paralelo e menor (`pressconference/playerEngine.ts`, ~14 perguntas, contextos `pre_match`/`post_match`), rota `/player/press` com CTA no Dashboard; feed social pessoal reaproveitando `state.social`/`SocialPost`/`newSocialPost` **sem nenhuma alteração** (já eram genéricos), manchetes automáticas por desempenho (`utils/playerHeadlines.ts`), rota `/player/social` substituindo os antigos placeholders "Manchetes"/"Redes sociais" no menu (com redirect das URLs antigas). Fase 5 (Legado): sala de troféus pessoal (`/player/trophies` — marcos de carreira 100% derivados de `stats`, sem persistir nada, + títulos/prêmios manuais) e relacionamentos transparentes (`/player/relations` — histórico de ajustes de confiança/moral com motivo, alimentado pelos 4 pontos que hoje mexem nesses campos: partida, edição de partida, Pulse diário, coletiva), substituindo os placeholders "Conquistas"/"Relacionamentos". Story Arcs pessoais cortados por não terem o mesmo encaixe natural (sem placeholder de rota esperando, e o `pressHint` dos passos do arco aponta pro `PressContext` do clube, que não existe no motor de coletivas do jogador). `npx tsc -b`/`eslint`/`vite build` sem regressões em nenhuma fase; simulações isoladas (3000 dias de Pulse, ~64 combinações de coletiva) sem erros. Próxima etapa: Fase 6 (Seleção nacional do jogador) ou fechamento desta atualização — a decidir com o usuário.
> **Baseado em:** `docs/modo-jogador.md` (spec original do Modo Jogador), `docs/roadmap.md` ("Próxima entrega — Modo Jogador (aprofundamento)"), `docs/HANDOFF_CLUBOS_CLAUDE.md`, `docs/selecao-nacional.md`, `docs/livelife-v1.2.md`, `LiveLife - Desenvolvimento/MELHORIAS_FUTURAS.md` (item "Modo Player com clock contínuo"), `InternationalDuty - Desenvolvimento/MELHORIAS_FUTURAS.md` (item "Modo Jogador com Seleção Nacional"), e auditoria direta do código real do Modo Jogador e dos 10 sistemas do Modo Treinador.
> **Convenção:** este plano segue o formato de [`LiveLife - Desenvolvimento/plano_de_desenvolvimento.md`](../LiveLife%20-%20Desenvolvimento/plano_de_desenvolvimento.md), [`FinancialUpdate - Desenvolvimento/plano_de_desenvolvimento.md`](../FinancialUpdate%20-%20Desenvolvimento/plano_de_desenvolvimento.md) e [`InternationalDuty - Desenvolvimento/plano_de_desenvolvimento.md`](../InternationalDuty%20-%20Desenvolvimento/plano_de_desenvolvimento.md) — fases incrementais, cada uma jogável isoladamente, com itens marcados como **[Adição]**, **[Melhoria]**, **[Redesign]** ou **[Correção]**.
> **Manual de portagem / Contrato de integração / Backlog:** a criar (`CURSOR_MANUAL.md`, `CLUBOS_CONEXAO.md`, `MELHORIAS_FUTURAS.md`) quando a Fase 1 for aprovada para início — mesmo ritual das atualizações anteriores.

> **Lead Developer & Game Designer Perspective**
> O Modo Jogador nasceu como MVP (spec em `docs/modo-jogador.md`, Fases 1–4) e foi entregue **além** do que a spec pedia — moral automática pós-partida, edição retroativa de súmula, gráfico de evolução, CRUD de lesões. Mas ele nasceu e parou: hoje é uma "carreira de treinador em miniatura, sem clube" — tem dashboard, partidas, contrato, perfil, histórico — e nada da **camada de vida** que faz o Modo Treinador ter alma (LiveLife, Pulse, imprensa, redes sociais, arcos narrativos, sala de troféus). Essa camada é o que separa "uma planilha bonita" de "uma carreira". Esta atualização não é sobre criar telas novas do zero — é sobre portar, com adaptação de escala (1 pessoa, não 1 elenco + 1 diretoria + 1 cidade), a parte do Modo Treinador que já provou funcionar. O precedente mais importante para isso já existe no próprio código: o Modo Seleção (v1.4) resolveu exatamente esse problema — "segundo contexto de carreira, reaproveitando o motor de partida sem herdar Board/Finance do clube por herança direta" — e a técnica (`nationalPlayerToPseudoPlayer`, estruturas próprias e menores em vez de `scope`-aware) é o modelo a copiar aqui.

---

## 0. Diagnóstico — o que existe hoje vs. o que faz sentido trazer

### 0.1 Estado real do Modo Jogador (auditoria de código, não da spec)

| Bloco | Estado | Nota |
|---|---|---|
| Setup (`CareerModeSelect` → `PlayerCreate` → `PlayerClubSetup`) | ✅ Completo, **2 passos** (spec previa 3) | `SET_PLAYER_CLUB` e `setupStep: 'player-competitions'` existem no reducer mas **nenhuma UI os chama** — código morto. |
| Dashboard, Matches, Calendar, Competitions, MatchPlay | ✅ Completo, nível além de MVP | Moral automática (`playerMorale.ts`), edição retroativa de súmula (`updatePlayerMatch` reverte e reaplica efeito). |
| Profile, Contract, Evolution, History | ✅ Completo | Evolution tem CRUD de lesões e gráfico de OVR por temporada — não estava especificado como tipo formal na spec, foi além. |
| `marketValue`, `morale` (campos do `CareerPlayer`) | ⚠️ Existem no tipo, inicializados na criação, **nunca lidos por nenhuma tela nem atualizados por nenhuma ação** | Campos mortos na prática. |
| "Expectativa do clube" no Contrato (spec 5.2) | ❌ Não implementado | Sem meta de gols/titularidade vinculada ao contrato. |
| Grupo "Social" (manchetes, redes sociais, relacionamentos) | 🚧 `UnderConstruction` (placeholder "soon"), conforme planejado na Fase 4 original | Zero lógica. |
| "Conquistas" | 🚧 `UnderConstruction` | Sem tipo de dado para troféus/prêmios pessoais. |
| Seleção nacional para o jogador | ❌ Não existe | O Modo Seleção (v1.4) é exclusivo de `careerMode === 'coach'`. |
| LiveLife (clock contínuo / Avançar Dia) | ❌ Não existe | `currentDate`/`ADVANCE_DAY` são exclusivos de `CoachRoutes`; o jogador só usa `currentDate` como valor inicial de formulário. |
| Pulse (eventos aleatórios) | ❌ Não existe | Nenhum evento pessoal — nada de família, agente, imprensa, propostas. |
| Tutoriais de seção | ⚠️ Parcial | Faltam `/player/history` e as rotas `/player/under/*`. |

### 0.2 Sistemas do Modo Treinador — herdar, adaptar ou não trazer

| Sistema | Veredito | Por quê |
|---|---|---|
| Sala de Troféus (`Trophies.tsx`, `TeamAchievement`) | **Fácil — portar como conceito** | É uma lista de {competição, temporada, posição, é título}; o padrão `ManagerAward` (prêmios individuais do técnico) é ainda mais próximo do que o jogador precisa. |
| Manager (perfil pessoal do técnico) | **Fácil — já é o espelho do que existe** | `/player/profile` já cobre o equivalente; só falta a lista de prêmios. |
| Coletivas de imprensa (`pressconference/*`) | **Fácil — motor já é "sobre 1 pessoa + clima ao redor"** | Trocar `boardConfidence`/`squadMorale` por `coachConfidence`/`fanReputation`/moral pessoal e reescrever as perguntas em 1ª pessoa. |
| Story Arcs (infra de capítulos encadeados) | **Fácil — infraestrutura reaproveitável** | `tickStoryArc`, cooldown, `pendingPress` são genéricos; só os 4 arcos concretos são de clube e precisam de versões pessoais. |
| Renovação de contrato / janela de transferências (regras) | **Fácil — já parcialmente reimplementado** | `TRANSFER_PLAYER` já existe, mais simples; falta só herdar o conceito de janela oficial (datas fixas) se fizer sentido para imersão. |
| Clock LiveLife (`currentDate`, Avançar Dia) | **Fácil de portar o clock; precisa reconectar os efeitos** | O clock em si é agnóstico de elenco; o que falta é religar Pulse/Story Arc/lesão pessoal nele — que é justamente o trabalho desta atualização. |
| Padrão arquitetural do Modo Seleção (`activeContext`, "pseudo-Player", estruturas não compartilhadas por herança) | **Modelo a copiar, não a reaproveitar por import** | Mostra como já resolvemos "segundo contexto de carreira" sem herdar Board/Finance do clube — mesma disciplina se aplica ao jogador. |
| Pulse (eventos aleatórios do elenco) | **Precisa de redesign** | Motor genérico (`generatePulse(athletes, ...)` já aceita array de 1), mas o banco de ~147 eventos e os pesos por categoria são desenhados para um elenco inteiro — banco novo, menor, com categorias pessoais. |
| ClubOSocial (manchetes/posts) | **Precisa de redesign** | Padrão de post/feed é genérico; gerador de manchete e categorias precisam ser pessoais, não de clube. |
| Clima (board/torcida/mídia, 3 eixos alimentados por várias fontes) | **Precisa de redesign** | O jogador já tem 2 eixos análogos (`coachConfidence`, `fanReputation`) mas sem a mesma trama de fontes (pós-jogo, drift diário, Pulse, coletivas) — precisa ser recriada em escala pessoal. |
| Financeiro do clube (caixa, folha, empréstimos, dívidas, patrocínios, rating bancário, bilheteria) | **Não trazer — exclusivo de clube** | Todas as fórmulas dependem de elenco/estádio/torcida em escala de clube. No máximo inspira um "extrato pessoal" simples e independente (fora do MVP desta entrega). |
| Diretoria (Board) com as 9 categorias de meta | **Não trazer — exclusivo de clube** | "Confiança de alguém em mim" é portável (já existe via `coachConfidence`); as metas concretas (posição na liga, teto de folha) não fazem sentido para 1 atleta. |
| Watchlist/negociação de transferência com taxa parcelada | **Não trazer** | É sobre o clube pagar por outro atleta — não existe do lado do próprio jogador. |
| Tática/Formação/Competições como gestão de liga | **Não trazer** | O jogador não escala time; `PlayerCompetitions` já cobre a contribuição individual, que é o que importa aqui. |

### 0.3 Gargalos e riscos identificados antes de codar

1. **O clock (`currentDate`/`ADVANCE_DAY`) é uma árvore de estado única, compartilhada pelos dois modos.** Ligar "Avançar Dia" no Modo Jogador significa estender o mesmo reducer com um branch `careerMode === 'player'`, não duplicar o campo. Igual já acontece hoje com `ADVANCE_SEASON`, que tem branches separados para coach/player no mesmo reducer.
2. **Pulse pessoal com pool de 1 atleta muda a estatística do sorteio.** Pesos hoje modulados por "moral média do elenco" não existem com 1 pessoa só — a ponderação vira direta sobre os atributos do próprio `CareerPlayer` (moral, idade, personalidade se vier a existir, sequência de jogos). Simples, mas precisa de arquivo de pesos próprio (`probabilities` pessoal), não reaproveitar o do clube.
3. **Coletivas pessoais não podem herdar `PressSituation` do clube por composição direta.** Ele carrega campos 100% de clube (`recentSigningName`, sequência do time, artilheiro do elenco). Seguindo a mesma disciplina do Modo Seleção (nunca misturar `BoardGoal` de clube/federação por herança), a decisão certa é um tipo **`PlayerPressSituation`** próprio, com `buildPlayerPressSituation`/`playerPressQuestions.ts` novos, reaproveitando só o **motor** (`runPressConference`, `scaleMediaDelta`, conceito de atrito) que já é genérico o bastante.
4. **Sala de Troféus pessoal não deve reaproveitar `TeamAchievement`/`ManagerAward` por import direto**, mesmo sendo estruturalmente idênticos — outro caso de "parecido na forma, independente na fonte da verdade", para não criar acoplamento cruzado que trave evolução futura de qualquer um dos dois lados. Um tipo novo `PlayerAward` no `CareerPlayer.ts`.
5. **Seleção nacional para o jogador é a peça mais arriscada e explicitamente citada no backlog do v1.4** (`InternationalDuty - Desenvolvimento/MELHORIAS_FUTURAS.md`: "requer decisão própria de arquitetura — o jogador não tem `talentPool`/federação para gerenciar, só recebe convocações"). **Decisão desta entrega: fora de escopo do MVP** (ver §2, Fase 6) — é grande o suficiente para virar sua própria atualização depois que a Fase 2–5 abaixo estiver validada.
6. **Dead code do setup de 3 passos.** Antes de adicionar qualquer coisa nova ao setup, resolver o que fazer com `SET_PLAYER_CLUB`/`'player-competitions'`: remover (mais simples, o fluxo de 2 passos já funciona bem) ou finalmente implementar o 3º passo. Recomendação: **remover** — não há ganho de UX claro em separar "clube" de "competições" em telas diferentes, e destravar dívida técnica antes de empilhar features novas em cima.
7. **`marketValue`/`morale` mortos não devem virar decoração.** Se vão ganhar vida nesta atualização (recomendado — são a base para Pulse/imprensa/transferência terem "consequência" visível), precisam de pelo menos uma tela que os leia (Perfil/Contrato) e uma fonte que os altere (desempenho em partidas, eventos de Pulse, propostas de transferência).

---

## 1. Decisões de arquitetura (resolver antes de codar)

| Decisão | Escolha recomendada | Motivo |
|---|---|---|
| Onde mora o clock do jogador | Reaproveitar `state.currentDate`/`ADVANCE_DAY` já existentes, com um branch `careerMode === 'player'` dentro do mesmo reducer (mesmo padrão de `ADVANCE_SEASON`). **Não** criar um segundo relógio. | Evita duas fontes de verdade de data coexistindo; o clock já é conceitualmente compartilhado (invariante nº4 do handoff: "datas usam o clock do jogo"). |
| Lesões do jogador | Migrar de CRUD 100% manual para **contagem automática de dias vinculada ao `currentDate`** (como já funciona no clube), mantendo o registro manual como forma de *lançar* a lesão (tipo, data, previsão) — a **recuperação** passa a ser automática no Avançar Dia. | É item de backlog já identificado (`LiveLife - Desenvolvimento/MELHORIAS_FUTURAS.md`: "Sincronizar `CareerPlayer.InjuryEntry` com o mesmo `currentDate`"). Reduz fricção manual sem remover controle do usuário. |
| Pulse pessoal | Novo banco `eventBankPlayer.json` (pool inicial menor, ~30–40 eventos) + `generatePulse` recebendo `[careerPlayer-as-pseudo-athlete]`. Novo arquivo de pesos `probabilitiesPlayer.ts` (moduladas por moral/sequência/idade do próprio atleta, não médias de elenco). | Reaproveita o motor (`generatePulse`, raridade, cadeias, cooldown) sem reescrever do zero; troca só o banco e a ponderação, que já são a parte "hot-swappable" do sistema hoje (`eventBank.json` + `eventBankCustom.json` como precedente). |
| Categorias do Pulse pessoal | `familia`, `agente`, `imprensa_pessoal`, `proposta_clube`, `lesao`, `forma_fisica`, `torcida`, `vida_pessoal` — descartar `diretoria`/`patrocinio`/`transferencia` (de clube) e `vestiario` (não existe elenco). | Categorias precisam fazer sentido sem elenco/diretoria/patrocínio de clube. |
| Coletivas pessoais | Tipo novo **`PlayerPressSituation`** (não estende `PressSituation` do clube) + `buildPlayerPressSituation`/`playerPressQuestions.ts` novos. Reaproveita `runPressConference`/`scaleMediaDelta`/conceito de `pressFriction` do motor existente, adaptando os eixos de efeito para `coachConfidence`/`fanReputation`/moral pessoal. | Mesma disciplina do Modo Seleção com `NationalBoardGoal`: parecido na forma, independente na fonte de dado, para não acoplar switches exaustivos do lado clube a um contexto que não deveria alterá-los. |
| Contextos de coletiva pessoal | `pre_match`, `post_match`, `transfer_rumor` (proposta de outro clube), `injury_personal` (lesão ≥14 dias), `contract_standoff` (fim de contrato próximo/insatisfação salarial). | Espelha os contextos do clube (`callup`→`transfer_rumor`, `finance_crisis`→`contract_standoff`) trocando "crise financeira do clube" por "crise pessoal de carreira", que é o equivalente emocional do lado do jogador. |
| Feed social pessoal | Reaproveitar o *padrão* de `SocialPost` (feed + likes + `unseenCount`) num novo array `state.careerPlayer.socialFeed` (ou reaproveitar `state.social` com um discriminador `subject: 'club' \| 'player'` — decidir na Fase 4 conforme o quanto o componente de feed já é genérico o bastante para reuso direto de UI). Gerador de manchete novo (`buildPlayerHeadline`), reaproveitando só a lógica de escolha de tag por desempenho (hat-trick, jejum, nota alta) já validada em `socialHeadlines.ts`. | Evita duplicar componente de UI se o `Social.tsx` já for genérico o bastante; evita misturar dado de clube com dado de jogador se não for. Decisão fina fica para o início da Fase 4, quando o componente estiver sob os olhos. |
| Story Arcs pessoais | 4 arcos novos, infraestrutura (`tickStoryArc`, cooldown, `pendingPress`) generalizada para aceitar um "sujeito" (`club` ou `player`) via os mesmos princípios de `activeContext` do Modo Seleção — **não** misturar arcos de clube com arcos de jogador no mesmo array. | Reaproveita ~80% do código já validado (capítulos, cooldown, gatilho de coletiva) só trocando o conjunto de arcos e as condições de elegibilidade (que passam a ler `careerPlayer` em vez de `board`/`players`). |
| Sala de Troféus pessoal | Tipo novo `PlayerAward` em `CareerPlayer.ts` (competição/temporada/tipo de prêmio/posição), independente de `TeamAchievement`/`ManagerAward` por cópia estrutural, não herança. | Mesmo racional do item 4 dos riscos — evita acoplamento cruzado. |
| Relacionamentos (técnico/torcida/colegas) | MVP: **sem grafo de relação com colegas nomeados** (isso é o item mais especulativo do backlog e exige um "elenco fictício" que hoje não existe). Entregar nesta atualização apenas a **transparência** das relações que já existem (`coachConfidence`, `fanReputation`) — histórico + motivo dos ajustes, no mesmo padrão de `board.*History` do clube. Colegas de time nomeados ficam para uma fase futura (ver §2, Fase 6). | Entregar algo pequeno e sólido (histórico com motivo) é mais valioso agora do que um grafo de relacionamento sem dados reais de outros jogadores para popular. |
| `marketValue`/`morale` | Passam a aparecer no Perfil/Contrato e a ser atualizados por: resultado de partidas (`updatePlayerFromMatch`, já existe o gancho), eventos de Pulse pessoal, e propostas de transferência (Fase 4/5). | Sem isso os dois campos continuam mortos; eles são a base numérica que dá "peso" a Pulse/coletivas/transferência. |
| `SET_PLAYER_CLUB` / `setupStep: 'player-competitions'` | **Remover** (ação, branch do reducer e tipo do `SetupStep`) na Fase 1. | Dívida técnica sem uso; simplifica antes de expandir o domínio do jogador. |
| Seleção nacional do jogador | **Fora de escopo desta atualização.** Registrar em `MELHORIAS_FUTURAS.md` como próxima grande atualização (v1.6), com a mesma disciplina de "estrutura própria e menor" já usada no v1.4. | Complexidade comparável a um módulo inteiro (precisa de banco de convocação/elegibilidade específico do jogador, já que ele não tem `talentPool`); misturar com esta entrega dilui as duas. |
| Versão do save | Não incrementar a string de versão (`0.6.0`) só por causa desta atualização — mesmo precedente do v1.3/v1.4 (migração depende de presença/ausência de campo, não da string). | Consistência com o handoff geral (§10, invariante nº6) e o precedente documentado. |

---

## 2. Fases

Cada fase é jogável isoladamente e não quebra a anterior. Tags: **[Adição]** (recurso novo) · **[Melhoria]** (recurso existente fica melhor) · **[Redesign]** (recurso existente muda de mecânica/modelo) · **[Correção]** (bug ou dívida técnica).

### Fase 0 — Fundação documental *(esta etapa)*

**Entrega:** este `plano_de_desenvolvimento.md` — diagnóstico, decisões de arquitetura, fases 1–6. `CLUBOS_CONEXAO.md`, `CURSOR_MANUAL.md` e `MELHORIAS_FUTURAS.md` desta pasta a produzir quando a Fase 1 for aprovada para início (mesmo ritual das três atualizações anteriores).

---

### Fase 1 — Correções e acabamento (fechar a dívida da entrega anterior antes de expandir) *(entregue, 2026-09-07)*

Sem isso, cada fase seguinte herdaria a confusão do setup de 3 passos fantasma e de campos mortos.

- **[Correção]** Remover `SET_PLAYER_CLUB`, o branch de reducer associado e `'player-competitions'` do tipo `SetupStep` — código morto desde a implementação original.
- **[Correção]** Completar tutoriais de seção faltantes: `/player/history` e fallback dedicado (em vez de genérico "soon") para `/player/under/*`.
- **[Melhoria]** Ativar `marketValue`: exibir no Perfil e Contrato, com evolução simples atrelada a OVR/idade/forma recente (fórmula parecida com a inicial, `overall * fator`, recalculada a cada avanço de temporada e a cada partida marcante).
- **[Melhoria]** Ativar `morale`: exibir como barra no Dashboard/Perfil, com ganho/perda por resultado de partida (gancho já existe em `updatePlayerFromMatch`) — antes de qualquer Pulse pessoal existir (Fase 3 vai precisar deste eixo já vivo).
- **[Adição]** "Expectativa do clube" no Contrato: meta simples (gols na temporada e/ou jogos como titular), editável manualmente, com indicador de progresso lido de `seasonStats` — item da spec original (§5.2) que nunca chegou a ser implementado.
- **[Redesign]** Fechamento de `careerHistory` no `ADVANCE_SEASON`: hoje `stats` já acumula continuamente a cada partida (correto na prática), mas o modelo da spec original previa a soma acontecer explicitamente no avanço — documentar a decisão atual como definitiva (sem mudança de código, só de entendimento) para não gerar confusão em quem ler `docs/modo-jogador.md` literalmente.

**Critério de saída:** `npm run lint`/`npm run tsc` limpos, nenhuma referência a `SET_PLAYER_CLUB`, save de jogador antigo carrega sem erro (teste mental obrigatório).

**Notas de implementação (entregue):**
- `SET_PLAYER_CLUB` (tipo de ação, case do reducer, função de contexto, assinatura na interface e export) e `setPlayerClub` removidos de `GameContext.tsx`; `'player-competitions'` removido de `SetupStep` (`types/CareerMode.ts`). Zero referências restantes (confirmado por busca em `src/`).
- `utils/playerValue.ts` (novo): `calcMarketValue(overall, potential, age)` — base `overall × 100.000` + bônus por diferença de potencial + fator de idade (23-/29-/33-/34+); `formatPlayerMoney` compartilhado entre Perfil e Contrato.
- `utils/playerMorale.ts`: nova `calcOverallMoraleDelta` (moral geral, distinta de `coachConfidence`/`fanReputation`) — conectada em `updatePlayerFromMatch` (`GameContext.tsx`), com reversão simétrica em `updatePlayerMatch` (edição retroativa), mesma disciplina do resto da função.
- `marketValue` recalculado em três pontos: criação do jogador (`FINISH_PLAYER_SETUP`), edição de OVR/POT (`UPDATE_CAREER_PLAYER`) e avanço de temporada (`ADVANCE_SEASON`, idade nova). Exibido em `PlayerProfile` e `PlayerContract`. `morale` exibido como barra em `PlayerContract` (junto com confiança do técnico/torcida) e como stat em `PlayerProfile`.
- `CareerPlayer.expectation: PlayerExpectation` (`{ goalsTarget?, starterAppearancesTarget? }`) — novo campo, editável em `PlayerContract` (`updateCareerPlayer`), progresso lido de `seasonStats.goals` e de jogos como titular derivados de `state.matches` (mesmo padrão de agregação de `PlayerCompetitions.tsx`, não de `seasonStats.matches`, que conta qualquer partida com minutos — titular ou reserva). Resetado a cada `TRANSFER_PLAYER` (meta é do clube atual, não viaja com o jogador).
- Migração (`storage.ts`): saves antigos de jogador ganham `expectation: {}`, `morale: 70` e `marketValue` recalculado via `calcMarketValue` quando ausentes.
- Tutoriais de seção adicionados para `/player/history` e para as 4 rotas `/player/under/*` (explicando o que está planejado em vez de deixar sem nenhum conteúdo introdutório).
- `docs/modo-jogador.md`: nota no topo sobre o setup real de 2 passos e esclarecimento da regra 3 (§13) sobre acúmulo de `stats`.
- Validação: `npx tsc -b` sem erros; `npx eslint .` sem erros/avisos novos nos arquivos tocados (os 25 erros/11 avisos remanescentes são pré-existentes em arquivos não tocados nesta fase).

---

### Fase 2 — LiveLife do Jogador (clock pessoal) *(entregue, 2026-09-08)*

O item mais estrutural: sem isso, Pulse pessoal (Fase 3) e Story Arcs pessoais (Fase 5) não têm onde "morar" — precisam de um loop de avanço de dia para disparar.

- **[Adição]** Botão **Avançar Dia** no `PlayerDashboard`, reaproveitando `ADVANCE_DAY` do `GameContext` com um branch `careerMode === 'player'`.
- **[Redesign]** Lesões: mantém o CRUD manual de *lançamento* (tipo, data, gravidade), mas a **contagem de dias e liberação** passam a ser automáticas a cada Avançar Dia (paridade com o clube). Fecha o item de backlog já identificado no `MELHORIAS_FUTURAS.md` do LiveLife.
- **[Adição]** Dias sem partida: pequeno "resumo do dia" (nada de Pulse ainda — isso é a Fase 3) com no mínimo a contagem regressiva de lesão e o aviso de aproximação de partida agendada.
- **[Melhoria]** Calendário/Partidas do jogador passam a refletir "hoje" de forma consistente com o resto do app (data em destaque, jogos passados da semana etc.), em vez de `currentDate` ser só um valor inicial de formulário.

**Critério de saída:** avançar dia sem partida agendada não quebra nada; lesão lançada manualmente conta e libera sozinha; teste mental "avançar 30 dias seguidos sem partida".

**Notas de implementação (entregue):**
- `ADVANCE_DAY` (`GameContext.tsx`) ganhou um branch **antes** do bloco pesado de clube: `if (state.careerMode === 'player') return { ...state, currentDate: addDaysIso(state.currentDate, 1) }`. O wrapper `advanceDay()` (fora do reducer) já era genérico — ele checa `findMatchOnDate` **antes** de despachar e só avança se hoje não tiver partida pendente; reaproveitado sem alterações.
- Decisão de design (mais simples que o planejado): não foi preciso nenhuma mutação de dados para lesões no `ADVANCE_DAY`. Como `InjuryEntry` já era baseada em `startDate`/`returnDate` (não num contador `injuryDaysRemaining` como o `Player` do clube), a "cura" é só uma leitura derivada: `utils/playerClock.ts` (novo) — `isInjuryActive(injury, currentDate)` e `daysUntil(from, to)`. `PlayerEvolution` agora separa "Lesão atual" (com contagem regressiva) de "Histórico de lesões" (curadas), sem precisar apagar nada do array.
- `FINISH_PLAYER_SETUP` ganhou o campo `startDate` (novo campo "Data de início da carreira" em `PlayerClubSetup.tsx`, mesmo padrão/default `${season}-01-01` do `CompetitionsSetup.tsx` do treinador) — seta `currentDate` na criação da carreira.
- `PlayerDashboard`: novo card "Avançar Dia" (reaproveita as classes `advanceDayBanner`/`dayControls`/`nextMatchLeft`/`nextMatchMeta`/`nextMatchCta` do `Dashboard.module.css` do treinador — zero CSS novo). Resumo do dia prioriza, nesta ordem: partida hoje → lesão ativa (com dias restantes) → próxima partida (com contagem) → nenhuma partida agendada. Save antigo sem `currentDate` (zero partidas completas, então a migração não conseguiu derivar uma data): o próprio clique no card ativa o calendário com a data real do dispositivo (`setCurrentDate`), sem precisar de uma tela de onboarding dedicada como a `/diretoria` do treinador.
- `PlayerCalendar`: adicionado o marcador `dayGameClock` (posição do `currentDate`) ao lado do `dayToday` já existente (que, a rigor, sempre foi a data **real** do dispositivo, não a do jogo — mesma ambiguidade de nome que já existe em `Calendar.tsx` do treinador, mantida por consistência).
- Corrigido `PlayerEvolution.tsx`: `addInjury` usava `new Date()` (mundo real) como fallback de data de início — trocado para `state.currentDate` (invariante nº4 do handoff: datas usam o clock do jogo).
- Migração: nenhuma mudança necessária em `storage.ts` além da já existente — `currentDate` já era derivado para **qualquer** `careerMode` via `nextDayAfterLastMatch(matches)` quando ausente do save; só não havia nada no modo jogador que o consumisse antes desta fase.
- Validação: `npx tsc -b` limpo; `npx eslint .` e `npx vite build` sem regressões nos arquivos tocados (mesma lista de 17 arquivos pré-existentes com achados, nenhum novo).

---

### Fase 3 — Pulse Pessoal (eventos aleatórios individuais) *(entregue, 2026-09-08)*

- **[Adição]** `eventBankPlayer.json` — banco inicial (~30–40 eventos) nas categorias: família, agente, imprensa pessoal, proposta de clube, lesão, forma física, torcida, vida pessoal. Raridade e cadeias reaproveitando o motor existente.
- **[Adição]** `probabilitiesPlayer.ts` — pesos de categoria modulados pelos atributos do próprio `CareerPlayer` (moral, sequência de jogos/gols, idade, status no clube), já que não há "elenco" para tirar média.
- **[Adição]** Disparo diário (via Avançar Dia, Fase 2) e disparo pré-partida (mesmo padrão do `PulseMatch` do clube, adaptado — sem exigir a tela cheia se não fizer sentido para o volume de conteúdo pessoal).
- **[Melhoria]** Efeitos de Pulse pessoal já têm onde aterrissar graças à Fase 1: `morale`, `marketValue`, `coachConfidence`, `fanReputation`.
- **[Adição]** Histórico de eventos pessoais (mesmo padrão do log de Pulse do clube), visível em algum ponto do Dashboard/Perfil.

**Critério de saída:** Pulse pessoal nunca dispara mais de 1× por partida (mesma regra do clube — invariante nº9 do handoff); "nada" não polui o histórico no modo diário, igual ao clube.

**Notas de implementação (entregue):**
- **Decisão de arquitetura que não estava no plano original:** `generatePulse`/`events.ts` do clube **não são parametrizáveis** — `filtrarPorCategoria`/`getEventById` fecham sobre o `BANK` global (`eventBank.json`+`eventBankCustom.json`) a nível de módulo, sem aceitar um banco alternativo por argumento. Reaproveitar por parâmetro exigiria alterar código de produção do clube (risco desnecessário) ou aceitar que Pulse do jogador nunca sorteie fora do banco de clube (errado). Escolha: um **gerador paralelo e menor**, `playerGenerator.ts`, seguindo a mesma disciplina "estrutura própria, não compartilhada por herança" já usada no Modo Seleção (v1.4) para `NationalBoardGoal`.
- O que **foi** reaproveitado sem nenhuma alteração (funções puras, já genéricas): `computeDynamicEventChance` (`chance.ts`), `pesoEventoPorMoral`/`candidatosParaEvento`/`aplicarEfeitos`/`rollPulseOutDays`/`varsTemplate`/`toPulsePosition` (`athletes.ts`), `escolherRaridade` (`probabilities.ts`), `resolverImpactos`/`template`/`pickWeighted`/`uid`/`ageBand` (`events.ts`/`utils.ts`). `recentResultsFromMatches` (`daily.ts`) só precisou virar `export` (era privada) — nenhuma mudança de comportamento para o clube.
- `eventBankPlayer.json`: 36 eventos (não 30–40 exatos, mas dentro do espírito do plano), 8 categorias — reaproveitando literalmente os valores já existentes do enum `PulseCategory` (`atleta`, `diretoria`, `torcida`, `imprensa`, `lesao`, `familia`, `transferencia`, `escandalo`) em vez de criar categorias novas (evita mexer num union type compartilhado com o motor do clube). `diretoria`/`imprensa` só mudam de **rótulo** na tela do jogador (`CATEGORIA_LABELS_PLAYER`: "Técnico"/"Imprensa"), não de categoria interna. `financeiro`/`patrocinio` ficaram de fora — sem ledger pessoal nesta entrega (ver Fase 6).
- `probabilitiesPlayer.ts`: sem modulação por personalidade (`CareerPlayer` não tem esse traço — o pseudo-atleta usa `'Disciplinado'` fixo, então qualquer tabela de personalidade seria ruído). Modula por idade (`ageBand`, reaproveitado), moral, forma seca de atacante, e extremos de `coachConfidence`/`fanReputation` (mesmo espírito do `applyClubCategoryMod` do clube, reescrito menor).
- `playerBridge.ts`: `careerPlayerToPulseAthlete` — pool de **exatamente 1** atleta; `status` derivado de `isInjuryActive` (Fase 2), não de um campo próprio. `careerPlayerToPulseClub` — "clube" de mentirinha só para reaproveitar o motor: `boardConfidence` ← `coachConfidence`, `supporterConfidence` ← `fanReputation`, sem `mediaConfidence` (o jogador ainda não tem eixo de mídia — todo evento de categoria `imprensa` afeta só moral/torcida por enquanto).
- **Decisão simplificadora:** como há só 1 atleta, o gerador do jogador **não usa** o array `athletePatches[]` do clube (que existe para endereçar N atletas por id) — devolve deltas diretos (`moraleDelta`, `coachConfidenceDelta`, `fanReputationDelta`, `injuryOutDays?`), aplicados direto no reducer.
- `state.pulse: PulseState` é **o mesmo campo raiz** do treinador — não um campo novo. Seguro porque `careerMode` é mutuamente exclusivo por save (nunca há clube e jogador simultâneos no mesmo save); `pendingDailyPulse`/`dismissDailyPulse` também reaproveitados sem alteração. `FINISH_PLAYER_SETUP` passou a resetar `pulse`/`pendingDailyPulse` explicitamente (mesma disciplina defensiva do `START_CAREER` do clube) — sem isso, uma segunda carreira de jogador na mesma sessão herdaria o histórico de Pulse da primeira.
- **Corte de escopo consciente:** só Pulse **diário** (via Avançar Dia). Pulse **pré-partida** (equivalente ao `PulseMatch` do clube) ficou de fora — replicar a tela cheia dedicada exigiria um novo padrão de rota "Pulse → depois vai pro jogo" que o modo jogador não tem hoje (hoje "Avançar Dia" já navega direto pra `/player/match/:id/play` quando há jogo). Registrado como próximo passo natural, não como parte do MVP desta fase.
- UI: card de Pulse no `PlayerDashboard` reaproveita 100% do CSS do `PulseMatch.module.css` do clube (zero CSS novo); nova seção "Últimos eventos" no Dashboard lê `state.pulse.history` diretamente (sem filtro — já é só do jogador, pela exclusividade de `careerMode`).
- Validação: simulação standalone de 3000 dias (`generatePlayerPulse` chamado em loop, fora da UI) — 0 erros, ~24% de taxa de evento/dia (compatível com a chance base 0.20 + modulação dinâmica), lesões e cadeias disparando em proporção plausível, sem nenhuma raridade/categoria dominando de forma degenerada. `npx tsc -b`, `npx eslint .`, `npx vite build` sem regressões.

---

### Fase 4 — Vida pública (Coletivas + Redes sociais pessoais) *(entregue, 2026-09-08)*

Resolve os placeholders `/player/under/manchetes` e `/player/under/redes`.

- **[Adição]** Motor de coletivas pessoais: `PlayerPressSituation`, `buildPlayerPressSituation`, `playerPressQuestions.ts`, reaproveitando `runPressConference`/atrito de imprensa do motor existente.
- **[Adição]** Contextos: `pre_match`, `post_match`, `transfer_rumor`, `injury_personal`, `contract_standoff` — gatilhos análogos aos do clube (`pressTriggers.ts`), adaptados para ler `careerPlayer`.
- **[Adição]** Feed social pessoal (`/player/under/redes` deixa de ser placeholder): manchetes pessoais geradas por desempenho (`buildPlayerHeadline`, reaproveitando a lógica de tags de `socialHeadlines.ts`), reações da torcida ligadas a `fanReputation`.
- **[Melhoria]** `PlayerContract`: propostas de transferência de outros clubes passam a poder chegar via Pulse (Fase 3) ou coletiva (`transfer_rumor`), em vez de só o usuário registrar manualmente uma troca já decidida — o fluxo manual continua existindo como alternativa.

**Critério de saída:** atrito de imprensa pessoal sobe/desce com a mesma lógica de sessão do clube; nenhuma tela do clube (`Social.tsx`, `PressConference.tsx`) muda de comportamento para quem está no `careerMode === 'coach'`.

**Notas de implementação (entregue):**
- **Mesma decisão de arquitetura da Fase 3, confirmada de novo:** `pickPressQuestions`/`runPressConference` do clube também fecham sobre `PRESS_QUESTIONS` a nível de módulo — não parametrizável. Motor paralelo e menor: `src/pressconference/playerEngine.ts` (`buildPlayerPressSituation`, `pickPlayerPressQuestions`, `runPlayerPressConference`) + `playerQuestions.ts` (14 perguntas, não um número exato pré-definido, cobrindo vitória/empate/derrota/gol/nota alta/nota baixa/banco/genérico).
- **Corte de escopo consciente nº1:** contextos limitados a `pre_match`/`post_match`. `transfer_rumor`/`injury_personal`/`contract_standoff` ficaram de fora — cada um exigiria sua própria heurística de gatilho (análoga a `findInjuryPressOpportunity`/`findFinancePressOpportunity` do clube) construída do zero para o jogador, o que dobraria o tamanho desta fase sem um "encaixe" natural tão óbvio quanto pré/pós-jogo (que já tem o loop de partida como gatilho pronto). Registrado como próximo passo natural.
- **Corte de escopo consciente nº2:** sem eixo de mídia/atrito de imprensa para o jogador (`PlayerPressConferenceDeltas` só tem `coachConfidence`/`fanReputation`/`morale`) — consistente com a mesma decisão da Fase 3 (`CareerPlayer` não tem `mediaConfidence`). Simplifica bastante o motor (sem `scaleMediaDelta`, sem `pressFriction`).
- Gatilhos (`utils/playerPressTriggers.ts`): reaproveita **literalmente** `state.livelife.pressPreDoneDates`/`pressPostDoneMatchIds` do treinador — mesmo campo raiz, mesma disciplina de "seguro por exclusividade de `careerMode`" já usada para `state.pulse`/`state.social`. CTA de coletiva aparece no Dashboard como um card, na mesma linha visual do card de próxima partida.
- **Feed social — decisão diferente do que o plano previa:** `SocialState`/`SocialPost`/`newSocialPost`/`createDefaultSocialState` já eram **100% genéricos** (nenhum campo específico de clube) — não precisou de bridge nem de "estrutura própria e menor", foi reaproveitado tal e qual, inclusive o componente de render `SocialPost.tsx`. `state.social` é o mesmo campo raiz do treinador.
- `utils/playerHeadlines.ts` (`buildPlayerMatchHeadline`): gerador de manchete bem menor que `socialHeadlines.ts` do clube (~110 linhas vs. ~957) — prioridade hat-trick > vermelho > 2 gols > nota ≥8,5 > gol+assistência > gol > assistência > nota <5 > entrou como reserva > genérico. Disparado só em `COMPLETE_PLAYER_MATCH`, não em `UPDATE_PLAYER_MATCH` (editar retroativamente não deve gerar uma segunda manchete).
- Posts manuais do próprio jogador usam `type: 'player_news'` — valor que já existia no enum `SocialPostType`, sem precisar estender nada.
- Nav do jogador redesenhada (grupo "Social"): os dois WIP "Manchetes" e "Redes sociais" viraram **um** item real "Manchetes e redes" (`/player/social`, feed unificado, mesmo espírito do `/social` único do treinador); "Coletivas" (`/player/press`) entrou como item novo real. `/player/under/manchetes` e `/player/under/redes` agora redirecionam para `/player/social` (mesmo padrão de redirect de URL antiga já usado pelo treinador em `/under/*`).
- `FINISH_PLAYER_SETUP` passou a resetar `social`/`livelife` também, junto com `pulse` (mesma disciplina defensiva da Fase 3 — evita uma segunda carreira herdar manchetes/coletivas feitas da primeira).
- Validação: `npx tsc -b`, `npx eslint .`, `npx vite build` sem regressões; simulação isolada de `pickPlayerPressQuestions`/`runPlayerPressConference` em ~64 combinações de contexto × resultado × nota × banco — 0 erros, nunca ficou sem pergunta elegível.

---

### Fase 5 — Legado (Conquistas, Relacionamentos e Story Arcs pessoais) *(entregue parcialmente, 2026-09-08 — Story Arcs cortados)*

Resolve o placeholder `/player/under/conquistas` e `/player/under/relations`.

- **[Adição]** `PlayerAward[]` no `CareerPlayer` + Sala de Troféus pessoal (nova tela, reaproveitando o padrão visual de `Trophies.tsx`): títulos conquistados pelo clube durante a passagem do jogador, prêmios individuais (artilheiro, melhor em campo em partidas marcantes, marcos de carreira — 100 jogos, 50 gols etc., calculáveis a partir de `stats`).
- **[Adição]** Relacionamentos — versão MVP: histórico com motivo dos ajustes de `coachConfidence`/`fanReputation` (mesmo padrão de `board.*History`), substituindo a barra "caixa-preta" atual por transparência real.
- ~~**[Adição]** 2–4 Story Arcs pessoais (infra de `storyArcs.ts` generalizada para aceitar um "sujeito"): ex. "cerco da imprensa pessoal", "saga de lesão", "impasse contratual", "queda de forma/pressão da torcida" — espelhando os 4 arcos do clube em escala individual.~~ **Cortado — ver notas de implementação.**
- **[Melhoria]** `PlayerEvolution`: marcos de carreira (100 jogos, 50 gols, hat-tricks) passam a alimentar `PlayerAward[]` automaticamente, não só o gráfico de OVR. **Implementado diferente do planejado** — ver notas.

**Critério de saída:** nenhum arco pessoal compartilha array/estado com `ActiveStoryArc` do clube (mesma disciplina do Modo Seleção com `NationalBoardGoal` — invariante nº17 do handoff, generalizada). *(N/A — item cortado nesta entrega.)*

**Notas de implementação (entregue):**
- `types/CareerPlayer.ts`: `PlayerAward` (`type: 'title'|'individual'`, `title`, `season`, `clubName?`, `notes?`) e `RelationshipEvent` (`date`, `reason`, `coachDelta`, `fanDelta`, `moraleDelta`) — dois campos novos em `CareerPlayer`, `awards`/`relationshipHistory`, default `[]`.
- `ADD_PLAYER_AWARD`/`REMOVE_PLAYER_AWARD` (`GameContext.tsx`) — mesmo padrão exato de `ADD_INJURY`/`REMOVE_INJURY` (CRUD manual, sem detecção automática de título de clube: o modo jogador não tem tabela de classificação nem motor de "quem foi campeão", só o `PlayerCompetitions` derivado de `state.matches`).
- **Decisão diferente do planejado:** marcos de carreira (`utils/playerMilestones.ts`, `computePlayerMilestones`) são **100% derivados** de `player.stats` a cada render (50/100/200/300/400/500 jogos, 10/25/50/100/150/200 gols, 10/25/50/100 assistências) — **não** viram entradas persistidas em `PlayerAward[]` automaticamente como o item "[Melhoria]" original sugeria. Mais simples (zero risco de duplicar um marco, zero necessidade de rastrear "já premiado") e mais correto (um marco cruzado não precisa de um "evento" para existir — ele só *é verdade* sobre as stats atuais). `PlayerAward[]` ficou reservado só para o que exige julgamento humano: títulos e prêmios que o jogo (EA FC) não expõe de forma estruturada.
- `pushRelationshipEvent` (helper puro, perto de `updatePlayerFromMatch` em `GameContext.tsx`) — chamado nos 4 pontos que hoje ajustam `coachConfidence`/`fanReputation`/`morale`: `COMPLETE_PLAYER_MATCH`/`UPDATE_PLAYER_MATCH` (diff antes/depois do resultado de `updatePlayerFromMatch`, mais barato que alterar a assinatura da função), o branch de Pulse pessoal do `ADVANCE_DAY` (Fase 3), e `APPLY_PLAYER_PRESS_CONFERENCE` (Fase 4). No-op (não gera entrada) quando as três deltas são zero, evitando lixo no histórico. Cap 50 entradas, mesmo padrão de `board.confidenceHistory`.
- **Corte de escopo consciente (Story Arcs pessoais):** `utils/storyArcs.ts` tem o mesmo problema estrutural que Pulse e Coletivas do clube (`StoryArcId` é union fixa, `STORY_ARC_DEFS`/`DEF_BY_ID` fecham sobre o array a nível de módulo — não parametrizável). Diferente de Pulse/Coletivas, aqui o custo era ainda maior por dois motivos: (1) nenhum placeholder de rota já esperava por isso — Conquistas e Relacionamentos tinham `/player/under/conquistas`/`/player/under/relations` como alvo óbvio, Story Arcs não tinham nada equivalente; (2) `StoryArcStepDef.pressHint?: PressContext` referencia o tipo de contexto de coletiva do **clube**, que não existe no `PlayerPressContext` (só `pre_match`/`post_match` na Fase 4) — um arco pessoal accionando coletiva precisaria de um terceiro contexto inventado só pra isso. Registrado no Horizonte (Fase 6) com o racional completo.
- `/player/trophies` (rota nova) substitui `/player/under/conquistas`; `/player/relations` substitui `/player/under/relations` — ambos com redirect da URL antiga em `App.tsx` (mesmo padrão já usado para `/player/under/manchetes`/`/player/under/redes` na Fase 4).
- Nav do jogador: grupo "Carreira" ganhou "Conquistas" e "Relacionamentos" como itens reais (movidos pra lá em vez de ficarem em "Social" — são introspectivos/pessoais, não de exposição pública como Manchetes/Coletivas). `WIP_ROUTES` do `PlayerLayout.tsx` ficou vazio — **não sobra mais nenhum placeholder "soon" no menu do jogador** depois desta fase.
- `PlayerContract.tsx`: a legenda estática das barras de confiança ganhou um link "Ver histórico completo →" para `/player/relations`, em vez de duplicar o feed de histórico em duas telas.
- Validação: `npx tsc -b`, `npx eslint .`, `npx vite build` sem regressões.

---

### Fase 6 — Horizonte (fora do MVP desta entrega, backlog para v1.6 — registrar em `MELHORIAS_FUTURAS.md`)

- **Seleção nacional para o jogador** — convocações, caps, Dashboard com próxima Data FIFA. Precisa de arquitetura própria (o jogador não tem `talentPool`/federação para gerenciar, só recebe convocações) — candidata a virar a v1.6.
- **Colegas de time nomeados** — grafo de relação real (não só transparência de histórico), depende de um "elenco fictício" mínimo que ainda não existe do lado do jogador.
- **Financeiro pessoal mais rico** (patrocínio pessoal, empresário com comissão, investimentos) — inspirado no financeiro do clube mas como sistema novo e simples, não port.
- **Setup em 3 passos** — só revisitar se o usuário sentir falta real de separar clube/competições; hoje não há evidência de que o fluxo de 2 passos seja um problema.
- **Exportação de carreira** (PDF/JSON) — mesmo espírito do "Exportação de estatísticas da temporada" já listado em `docs/roadmap.md` como melhoria técnica geral, não específica do jogador.
- **Coletivas de contextos especiais** (`transfer_rumor`, `injury_personal`, `contract_standoff`) — cortadas da Fase 4 por não terem um gatilho tão natural quanto pré/pós-jogo; cada uma precisa de uma heurística própria (análoga a `findInjuryPressOpportunity`/`findFinancePressOpportunity` do clube) escrita do zero para o jogador.
- **Eixo de mídia pessoal** (`mediaConfidence`/atrito de imprensa) — Pulse e Coletivas pessoais hoje só mexem em moral/confiança do técnico/torcida; um eixo de mídia dedicado destravaria os contextos especiais acima e daria mais nuance às coletivas.
- **Story Arcs pessoais** — cortados da Fase 5. Precisa de: (1) um terceiro contexto de coletiva (`story_arc` ou similar) no `PlayerPressContext`, hoje limitado a `pre_match`/`post_match`; (2) 2–4 arcos de conteúdo novo (8–16 capítulos), no espírito de "cerco da imprensa pessoal", "saga de lesão", "impasse contratual", "queda de forma"; (3) generalizar (ou clonar) a infraestrutura de `tickStoryArc`/`pickEligibleArcId` para ler `CareerPlayer` em vez de `players[]`/`board`. Maior custo de conteúdo dos itens cortados nesta atualização — só valeria a pena depois do eixo de mídia pessoal acima, que destrava o gatilho "cerco da imprensa" de forma natural.

---

## 3. Resumo por fase (tags)

| Fase | Adição | Melhoria | Redesign | Correção |
|---|---|---|---|---|
| 1 — Correções e acabamento | Expectativa do clube no Contrato | Ativar `marketValue`/`morale` | Documentar acúmulo de `stats` | Remover `SET_PLAYER_CLUB`; tutoriais faltantes |
| 2 — LiveLife do Jogador | Avançar Dia; resumo do dia | Calendário reflete "hoje" | Lesões: contagem automática | — |
| 3 — Pulse Pessoal | Banco de eventos (36); disparo diário; histórico no Dashboard | Efeitos aterrissam em campos já vivos | Gerador próprio em vez de parametrizar o do clube (motor não é parametrizável) | — |
| 4 — Vida pública | Coletivas pessoais (pré/pós-jogo); feed social pessoal; nav "Manchetes e redes" + "Coletivas" | — | — | — |
| 5 — Legado | `PlayerAward`/Sala de Troféus (`/player/trophies`); Relacionamentos (`/player/relations`) | Marcos de carreira derivados de `stats` (não persistidos) | Relacionamentos: histórico transparente em vez de barra opaca | — |
| 6 — Horizonte (backlog) | Seleção nacional do jogador; colegas nomeados; financeiro pessoal rico | — | — | — |

---

## 4. Testes mentais obrigatórios (rodar ao fechar cada fase)

1. **Load de save de jogador antigo** (anterior a esta atualização) — todos os campos novos vêm com default seguro via `migrateSave`.
2. **Avançar 30 dias seguidos sem partida agendada** — não deve travar, duplicar Pulse, nem estourar cooldown de arco.
3. **Editar uma partida já registrada** (`updatePlayerMatch`) depois que Pulse/coletiva já leram o resultado antigo — mesma disciplina do clube (invariante nº8: `UPDATE_COMPLETED_MATCH` não reaplica efeitos completos).
4. **Trocar de clube no meio da temporada** (`transferPlayer`) com uma coletiva `contract_standoff` pendente — não deve deixar estado órfão apontando pro clube antigo.
5. **`careerMode === 'coach'` não deve ser afetado em nada** — nenhuma tela/reducer do clube muda de comportamento; é o mesmo cuidado que o Modo Seleção teve com `careerMode === 'player'` nunca vendo `nationalTeam`.
6. **Lesão lançada manualmente perto da virada de temporada** — `ADVANCE_SEASON` não deve "perder" uma lesão em contagem.

---

## 5. Próximo passo imediato

Aprovar (ou ajustar) as decisões da seção 1 — em especial: remoção do dead code do setup (Fase 1), forma do clock pessoal (Fase 2) e se o feed social pessoal reaproveita `state.social` com discriminador ou vira array próprio (Fase 4, decisão fina). Com isso fechado, a Fase 1 pode começar imediatamente — é a menor, mais segura, e desbloqueia terreno limpo para as fases seguintes.
