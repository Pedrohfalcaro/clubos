# HANDOFF — ClubOS (site inteiro, para Claude)

> **Audiência:** Claude / agente Cursor que vai continuar o projeto **sem** precisar vasculhar todo o repositório.
> **Escopo:** o site ClubOS inteiro — arquitetura, estado, modos de carreira, partidas, táticas, finanças, transferências, competições, diretoria, narrativa (Pulse / Social / Coletivas / Story Arcs), persistência e nuvem.
> **Data desta passagem:** 2026-09-08 (Locker Room Update v1.6 entregue — ver §5, §12 e §17).
> **Doc de detalhe financeiro:** `docs/HANDOFF_FINANCEIRO_CLAUDE.md` + `docs/sistema-financeiro.md` (§12 cobre a v1.3) + `FinancialUpdate - Desenvolvimento/`.
> **Doc de detalhe do Modo Seleção:** `docs/selecao-nacional.md` + `InternationalDuty - Desenvolvimento/plano_de_desenvolvimento.md` — ver §15 abaixo.

Se você ler só **este** arquivo, deve conseguir: entender a arquitetura, achar onde cada feature mora, aplicar mudanças sem quebrar invariantes e não reinventar o que já existe.

---

## 0. O que é o ClubOS (1 minuto)

Companion web do **Modo Carreira** do EA FC/FIFA. O usuário joga as partidas no console/PC; o ClubOS registra e **gera as consequências**: elenco, finanças, transferências, diretoria, calendário contínuo, lesões, eventos aleatórios e narrativa. O jogo dá o resultado; o ClubOS dá a história.

Dois modos de carreira:
- **Treinador (coach)** — gerencia clube, elenco, tática, finanças, diretoria.
- **Jogador (player)** — gerencia um atleta: desempenho, contrato, evolução.

Versão atual do produto: **v1.6 "Locker Room Update"** (Modo Jogador — aba Time com Metas mensais e Elenco de colegas, motor de partida redesenhado — ver §5 e §17) sobre a base v1.5 "Player Career Update" (LiveLife/Pulse/imprensa/redes/legado pessoais), v1.4 "International Duty Update" (Modo Seleção / Dual Career — ver §15), v1.3 "Financial Update" (dashboard financeiro, rating bancário, teto de gastos) e v1.2 "LiveLife Update" (calendário contínuo). Save version string: `0.6.0` (inalterada — a migração não depende dessa string, só de presença/ausência de campos).

---

## 1. Stack e arquitetura

| Camada | Onde | Papel |
|--------|------|-------|
| Build/host | **Vite + React + TypeScript**, deploy GitHub Pages | SPA |
| Roteamento | `src/App.tsx` (react-router) | Setup / Coach / Player |
| Estado global | `src/context/GameContext.tsx` (`useReducer` + Context) | **Fonte da verdade** |
| Auth + nuvem | `src/context/AuthContext.tsx`, `src/services/firebase.ts`, `cloudSave.ts` | Google login + Firestore |
| Persistência local | `src/services/storage.ts` + `saveSlots.ts` | localStorage, 3 slots |
| Tipos | `src/types/*` | Modelos de domínio |
| Lógica pura | `src/utils/*` | Cálculos sem DOM |
| Narrativa | `src/pulse/*`, `src/pressconference/*`, `src/utils/storyArcs.ts` | Eventos e feed |
| UI | `src/pages/*` + `src/components/*` (CSS modules) | Telas |
| Tema | `src/index.css`, `utils/clubColors.ts` | Tokens; cores do clube |

**Regra de ouro nº1:** `GameContext` é a fonte da verdade. UI só dispara ações; lógica pesada vive em `utils`/reducer.
**Regra de ouro nº2:** `finance.balance === team.budget` sempre.

### Roteamento (`App.tsx`)

```
AppRoutes:
  !state.started            → SetupRoutes  (splash, menu, criação)
  careerMode === 'player'   → PlayerRoutes (/player/*, PlayerLayout)
  else                      → CoachRoutes  (/dashboard, /squad…, Layout)
```

`RequireAuth` protege as rotas de setup se Firebase estiver configurado.

---

## 2. Estado global (`GameState`)

Definido em `GameContext.tsx`. Campos-chave:

| Campo | Tipo | Observação |
|-------|------|-----------|
| `started` | boolean | Carreira iniciada? |
| `careerMode` | `'coach' \| 'player' \| null` | Decide o roteador |
| `setupStep`, `pending*` | — | Estado transitório do wizard de criação |
| `team` | `Team \| null` | Clube (coach) |
| `players` | `Player[]` | Elenco (coach) |
| `manager` | `Manager \| null` | Técnico |
| `careerPlayer` | `CareerPlayer \| null` | Atleta (modo jogador) |
| `matches` | `Match[]` | Partidas (ambos modos) |
| `season` | number | Temporada atual |
| `seasonCompetitions` | `SeasonCompetition[]` | Torneios da temporada |
| `tactics` / `tacticsPresets` / `activeTacticsId` | — | Táticas (≤5 presets) |
| `finance` | `ClubFinance` | Caixa (ver §7) |
| `board` | `BoardState` | Confiança + metas + históricos |
| `transfers` | `TransferState` | Watchlist, histórico, parcelas |
| `pulse` | `PulseState` | Eventos, settings, cooldowns |
| `social` | `SocialState` | Feed + Story Arc ativo |
| `livelife` | `LiveLifeMeta` | Onboarding + coletivas feitas + `pressFriction` |
| `seasonHistory` | `SeasonArchive[]` | Temporadas encerradas |
| `currentDate` | `string \| null` | **Clock LiveLife** (ISO). null = carreira antiga |
| `payrollDue` / `transferPaymentsDue` / `loanPaymentsDue` / `debtPaymentsDue` | boolean | Flags de cobrança (não persistem todas) |
| `pendingDailyPulse` / `liveLifePromptPending` | — | Modais transitórios |
| `saveSlotId` | `'1'\|'2'\|'3'` | Slot ativo |
| `activeContext` | `'club' \| 'national'` | v1.4 — qual layout/rotas montam em `CoachRoutes`. Só vira `'national'` se `nationalTeam` existir |
| `nationalTeam` | `NationalTeamState \| null` | v1.4 — Modo Seleção/Dual Career, ver §15. Independente do estado do clube acima |

O reducer usa `GameAction` (union grande) — cada feature tem seus tipos de ação. As APIs públicas (`useGame()`) estão listadas por área nas seções abaixo.

---

## 3. Fluxos de criação (setup)

### Treinador
```
/menu → /new/mode (CareerModeSelect) → /new/country (CountrySelect)
     → /new/team (ClubCreate: nome, cores, elenco manual ou “exemplo”)
     → /setup/manager (ManagerSetup)
     → /setup/competitions (CompetitionsSetup: competições + formato,
        moeda, estádio, premiações, dívida de abertura opcional, data base)
     → START_CAREER → /dashboard
```
`START_CAREER` monta finance via `createDefaultFinance` + `seedLiveLifeFinance` (estádio/prêmios template), fixa `currentDate = startDate`, zera históricos.

Elenco **não** vem de JSON seed — o usuário cria clube + atletas (`customSquad.ts`, `clubImport.ts` para importar).

### Jogador
```
/new/mode → /new/player (PlayerCreate: bio, posição, OVR/POT)
         → /setup/player-club (clube, liga, competição principal, salário, contrato)
         → FINISH_PLAYER_SETUP → /player/dashboard
```
Monta `CareerPlayer` (`createDefaultCareerPlayer`), zera campos de coach.

---

## 4. Modo Treinador — páginas e sistemas

Navegação em `components/Layout/Layout.tsx` (sidebar com grupos Clube / Jogos / Social / Manager). Rotas em `CoachRoutes`.

| Rota | Página | O que faz |
|------|--------|-----------|
| `/dashboard` | Dashboard | **Avançar Dia**, modais de cobrança, hub financeiro, CTAs de coletiva, Pulse/arcos |
| `/squad` | Squad | Elenco: filtros, edição inline (`updatePlayer`), stats por competição/escopo |
| `/tactics` | Tactics | Formação + presets (`saveTacticsPreset`, `setActiveTactics`) |
| `/matches` | Matches | Registrar/agendar partidas |
| `/calendar` | Calendar | Calendário: jogos, folha dia 5, parcelas, janela, patrocínios |
| `/competitions` | Competitions | Tabelas de liga, mata-mata, premiação por fase |
| `/pulse` | Pulse | Histórico de eventos + settings (chances) |
| `/financas` | Finance | Caixa, extrato, folha, empréstimos, dívidas, patrocínios, prêmios, estádio |
| `/diretoria` | Board | Confiança, metas, identidade, backup, **encerrar temporada** |
| `/transferencias` | Transfers | Watchlist, compra/venda/empréstimo, renovação, histórico |
| `/social` | Social | ClubOSocial (feed + posts do técnico + arcos) |
| `/press-conference` | PressConference | Coletivas |
| `/manager` | Manager | Bio, prêmios pessoais |
| `/trofeus` | Trophies | Títulos / sala de troféus |
| `/under/*` | UnderConstruction | Treinamento, metas, social-jogadores (WIP) |

### 4.1 Clock LiveLife — Avançar Dia (`ADVANCE_DAY`)

O coração do modo. Ao avançar 1 dia (`computeAdvanceDay`):
1. Recupera lesões/suspensões (contadores −1); apresenta atletas contratados quando `availableFrom` chega.
2. Deriva flags de cobrança para `nextDate`: folha (dia **5**), parcelas de transferência/empréstimo/dívida.
3. Paga **cotas de patrocínio** do dia (`applyMonthlySponsorPayments`).
4. Se o próximo dia **não** tem jogo e há time:
   - `dailyClimateDrift` (oscila board/torcida/mídia)
   - `rollDailyPulse` (evento diário → `pendingDailyPulse`)
   - `tickStoryArc` (inicia/avança arco narrativo)
5. Se o próximo dia **tem** jogo → Dashboard encaminha para `/match/:id/pulse`.

`advanceDay()` retorna `{ matchId }` para a UI navegar.

### 4.2 Partida (fluxo completo)

Detalhado por [Match/Gameplay](11dbce3b-27e4-4bd1-bc0a-90077f3473d8). Pipeline:

```
Agendar (Matches/Calendar → scheduleMatch)
  → /match/:id/pulse (PulseMatch → APPLY_PULSE, 1×/matchId)
  → /match/:id/play (MatchPlay, steps locais)
  → completeMatch(COMPLETE_MATCH)  [efeitos completos]
  → /press-conference?ctx=post   (coletiva pós opcional)
```

**Steps do MatchPlay:** lineup → score → teamGoals → (pathChoice) → opponentGoals → events (cartões/lesões/subs) → ratings (nota 5–10, MOTM, pior) → recap. Navegação condicional por placar. Há modo **“Ao Vivo”** que embute tudo em `MatchResultStep`.

**O que `COMPLETE_MATCH` atualiza (num só reducer):**
- Stats de time e jogador via `recalculateFromMatches` (recontagem de todas as completed) + tempo de jogo (`getMatchPlayingTime`).
- Disponibilidade (`applyMatchAvailability`): lesão com dias até `returnDate`; vermelho = suspenso 1 jogo **na mesma competição**.
- Moral do elenco (`squadMorale.ts`) só para envolvidos.
- Confiança diretoria/torcida (`calcMatchClimateDeltas`) — **mídia não** muda aqui.
- Financeiro (`calcGateRevenue` + `applyMatchPrize`).
- Manchete no ClubOSocial (`buildMatchHeadline`).

**Edição** (`UPDATE_COMPLETED_MATCH`) regrava resultado + recalc stats, mas **não** reaplica moral/clima/finanças/manchete.

### 4.3 Táticas

`types/Tactics.ts` + `utils/formations.ts` + `utils/tacticalStyles.ts`. ~20 formações preset, 10 estilos (traits). Presets ≤5, um ativo (`SET_ACTIVE_TACTICS` copia para `state.tactics`). `buildBestLineup` autofill por fit de função + overall; `lineupWarnings`/`isLineupComplete` bloqueiam lesionados/suspensos. Nota: `StylePicker` existe mas hoje não é montado em `Tactics.tsx`.

### 4.4 Competições

`types/Competition.ts` + `utils/competitions.ts` + `competitionEngine.ts`. Cada `SeasonCompetition` tem `type` (league/cup/continental/state/friendly/other) e `format`:
- **league** — tabela editável que cresce com adversários; sincroniza com jogos.
- **knockout** — fase a fase; `advanceKnockoutPhase` credita `knockout`/`champion` prize (via `applyLedger`).
- **league_knockout** — tabela e depois “Iniciar mata-mata”.

### 4.5 Transferências

`types/Transfer.ts` + páginas Transfers. Watchlist, `executeTransfer` (cria/remove Player, gera `transfer_fee`/`loan_fee`, opcional parcelas em `transfers.pendingPayments`), renovação (`renewPlayerContract`), histórico. **Janela**: 01/01–31/01 e 01/07–31/08 (`transferWindow.ts`); fora dela só renovar. Parcelas vencidas → modal no Dashboard (`PAY_TRANSFER_PAYMENT`).

### 4.6 Diretoria (Board)

`types/Board.ts`. Confiança (board/torcida/mídia) + `confidenceHistory`, metas (`BoardGoal`), identidade do clube (nome/cores/torcedores), ajuste de caixa, dívida de abertura, backup ZIP (`utils/backup.ts`), e **Encerrar temporada** (`advanceSeason`).

**Virada de temporada (`ADVANCE_SEASON`, coach):** arquiva `SeasonArchive` (stats, saldo, receita/despesa), liquida patrocínios da temporada (`settleSponsorsForSeason`: bônus, rescisão por cláusula, −1 temporada), aplica títulos, `season++`. No modo jogador, `advanceSeason` faz `season++/age++/contrato−−` e zera `seasonStats`.

---

## 5. Modo Jogador — páginas e sistemas

Detalhado por [Modo Jogador](df5cb7fc-956a-430d-b59f-2bd614fcdd51). Layout: `PlayerLayout.tsx`. Modelo: `CareerPlayer` (`currentClub`, status, salário/contrato, `expectation` (meta de gols/titularidade, v1.5), `coachConfidence`/`fanReputation`/`morale` (moral geral, v1.5), `marketValue` (`calcMarketValue`, v1.5), `stats` + `seasonStats`, `careerHistory`, `overallHistory`, `injuries`, `teammates: Teammate[]` (v1.6), `monthlyGoals: MonthlyGoal[]` (v1.6)).

| Rota | O que faz |
|------|-----------|
| `/player/dashboard` | OVR/POT, próxima partida (só via Avançar Dia desde v1.6 — sem atalho pra pular a fila), stats da temporada, confiança, contrato, últimas 5 |
| `/player/matches` | Agendar (`schedulePlayerMatch`) + listas (atalho manual "Jogar Partida" pra qualquer agendada, independente do clock — igual ao treinador) |
| `/player/calendar` | Calendário do atleta |
| `/player/competitions` | Stats agregadas por competição — editar/remover competição (v1.6) |
| `/player/match/:id/play` | **Motor de partida redesenhado (v1.6)** — ver nota própria abaixo |
| `/player/profile` | Bio + editar OVR/POT (espelha o jogo) |
| `/player/team/goals` | Metas mensais (v1.6) — ver nota própria abaixo |
| `/player/team/squad` | Elenco de colegas (v1.6) — ver nota própria abaixo |
| `/player/contract` | Clube/salário/anos; transferência (`transferPlayer`) — grupo de nav "Time" desde v1.6, junto de Metas/Elenco |
| `/player/evolution` | Gráfico OVR por temporada; lesões; nova temporada |
| `/player/history` | Timeline de clubes + highlights |

Partida: `completePlayerMatch`/`updatePlayerMatch` → deriva `playerPerformance` de `goals`/`cards` estruturados (v1.6, `derivePlayerPerformance` em `utils/playerMatch.ts`) → `updatePlayerFromMatch` (stats + moral via `playerMorale.ts`). Sem tática nem finanças de clube (o elenco de colegas existe desde v1.6, mas é só nome/posição/idade/número + moral — não escalável, sem eligibilidade por minuto). Usa o mesmo tipo `Match` estendido com `playerPerformance`, `goals`/`cards`/`assists`/`opponentGoals` (v1.6 — campos que antes só o treinador preenchia) e `clubName`.

**Clock LiveLife (v1.5):** o jogador tem `currentDate`/`ADVANCE_DAY` próprios — mesmo campo raiz do treinador, com um branch dedicado no reducer (`careerMode === 'player'` → incrementa a data e, em dia sem partida, rola o Pulse pessoal — sem folha/patrocínio/clima de clube). Setado em `FINISH_PLAYER_SETUP` (campo "Data de início" no setup, igual ao treinador, também reseta `pulse`/`pendingDailyPulse` para uma carreira nova); saves antigos sem `currentDate` migram via `nextDayAfterLastMatch` (`storage.ts`), com fallback de ativação manual no Dashboard (`setCurrentDate`) se não houver partidas. `CareerPlayer.injuries` (`InjuryEntry`) não usa contador de dias como `Player` do clube — é baseada em `returnDate`, então "cura" automaticamente ao comparar com `currentDate` (`utils/playerClock.ts`: `isInjuryActive`, `daysUntil`); uma lesão sofrida via Pulse já nasce com `returnDate` calculado (`currentDate + diasFora`). `PlayerCalendar` ganhou o mesmo marcador duplo do `Calendar.tsx` do treinador (`dayGameClock` = `currentDate`, `dayToday` = data real, só como referência visual).

**Pulse pessoal (v1.5):** `state.pulse: PulseState` é **reaproveitado literalmente** do treinador (mesmo campo raiz, mesmo `pendingDailyPulse`/`dismissDailyPulse`) — seguro porque `careerMode` é mutuamente exclusivo por save (nunca há clube e jogador ao mesmo tempo). O motor em si **não é reaproveitado por parâmetro** (`generatePulse`/`events.ts` fecham sobre o banco global `eventBank.json`+`eventBankCustom.json` a nível de módulo, sem aceitar um banco alternativo) — em vez disso, `src/pulse/playerGenerator.ts` é um gerador paralelo e menor, com seu próprio banco (`eventBankPlayer.json`, ~36 eventos, 8 categorias reaproveitadas do enum `PulseCategory` existente — sem `financeiro`/`patrocinio`, sem criar categorias novas) e sua própria ponderação (`probabilitiesPlayer.ts`, sem modulação por personalidade — `CareerPlayer` não tem esse traço, só idade/moral/forma seca/extremos de confiança). Reaproveita sem alteração as partes puras e já genéricas do motor do clube: `computeDynamicEventChance` (`chance.ts`), `pesoEventoPorMoral`/`candidatosParaEvento`/`rollPulseOutDays`/`varsTemplate` (`athletes.ts`), `escolherRaridade` (`probabilities.ts`), `resolverImpactos`/`template`/`pickWeighted`/`uid`. Ponte `src/pulse/playerBridge.ts`: `careerPlayerToPulseAthlete` (pool de exatamente 1 — status `'lesionado'` derivado de `isInjuryActive`) e `careerPlayerToPulseClub` (`boardConfidence`←`coachConfidence`, `supporterConfidence`←`fanReputation`, sem `mediaConfidence`). Efeitos aplicados direto no reducer (`ADVANCE_DAY`), sem o array `athletePatches[]` do clube (desnecessário com 1 atleta só): delta de moral/confiança e, se o evento é `status: 'lesionado'`, cria uma `InjuryEntry` nova. **Sem Pulse de pré-partida ainda** (só diário) — decisão de escopo do v1.5 Fase 3, ver plano de desenvolvimento.

**Coletivas e redes sociais pessoais (v1.5, Fase 4):** mesma disciplina do Pulse — motor **paralelo e menor**, não parametrização do motor do clube (`pickPressQuestions`/`runPressConference` também fecham sobre `PRESS_QUESTIONS` a nível de módulo). `src/pressconference/playerEngine.ts` (`buildPlayerPressSituation`, `pickPlayerPressQuestions`, `runPlayerPressConference`) + banco próprio `playerQuestions.ts` (~14 perguntas, contextos `pre_match`/`post_match` só — sem `transfer_rumor`/`injury_personal`/`contract_standoff` nesta entrega, sem eixo de mídia/atrito de imprensa, já que `CareerPlayer` não tem `mediaConfidence`). Efeitos em `coachConfidence`/`fanReputation`/`morale` só, via `APPLY_PLAYER_PRESS_CONFERENCE`. Gatilhos (`utils/playerPressTriggers.ts`) reaproveitam **literalmente** `state.livelife.pressPreDoneDates`/`pressPostDoneMatchIds` do treinador (mesmo campo raiz, seguro por exclusividade de `careerMode`) — CTA no Dashboard, rota `/player/press`.

Feed social (`/player/social`, nav "Manchetes e redes" — substitui os antigos itens WIP "Manchetes"/"Redes sociais", com redirect de `/player/under/manchetes`/`/player/under/redes`): reaproveita **sem nenhuma mudança** `SocialState`/`SocialPost`/`newSocialPost`/`createDefaultSocialState` (já eram genéricos, sem nada club-specific) e o componente `SocialPost.tsx` de renderização. `state.social` é o mesmo campo raiz do treinador. Manchetes automáticas via `utils/playerHeadlines.ts` (`buildPlayerMatchHeadline`, gerador próprio e bem menor que `socialHeadlines.ts` do clube — prioriza hat-trick > vermelho > 2 gols > nota alta > gol+assist > gol > assist > nota baixa > entrou banco > genérico), disparadas em `COMPLETE_PLAYER_MATCH` (não em `UPDATE_PLAYER_MATCH`, para não spammar manchete ao editar retroativamente). Posts manuais do jogador usam `type: 'player_news'` (valor já existente no enum, sem precisar estender nada). `FINISH_PLAYER_SETUP` passou a resetar `social`/`livelife` também (mesma disciplina defensiva já aplicada a `pulse` na Fase 3).

**Legado — Conquistas e Relacionamentos (v1.5, Fase 5):** `CareerPlayer` ganhou `awards: PlayerAward[]` (título de clube ou prêmio individual, **registro manual** — não há detecção automática de "o clube ganhou o campeonato" no modo jogador, mesma limitação estrutural que levou o `TrophyCabinetEntry` do clube a também ser manual) e `relationshipHistory: RelationshipEvent[]` (ajustes de `coachConfidence`/`fanReputation`/`morale` com motivo, cap 50 — mesmo padrão de `board.confidenceHistory`). `pushRelationshipEvent` (helper puro em `GameContext.tsx`) é chamado nos 4 pontos que hoje mexem nesses três campos: `COMPLETE_PLAYER_MATCH`/`UPDATE_PLAYER_MATCH` (diff antes/depois do `updatePlayerFromMatch`), o branch de Pulse pessoal no `ADVANCE_DAY`, e `APPLY_PLAYER_PRESS_CONFERENCE`. Marcos de carreira (`utils/playerMilestones.ts` — 50/100/200/300/400/500 jogos, 10/25/50/100/150/200 gols, 10/25/50/100 assistências) são **puramente derivados** de `player.stats` a cada render, não persistidos — mais simples que a spec original sugeria e sem risco de duplicar um marco. `/player/trophies` (rota nova, substitui `/player/under/conquistas`) e `/player/relations` (substitui `/player/under/relations`) — ambos com redirect de URL antiga.

**Cortado da Fase 5, registrado no backlog:** Story Arcs pessoais. `utils/storyArcs.ts`/`STORY_ARC_DEFS` do clube tem o mesmo problema estrutural do Pulse/Coletivas (`StoryArcId` é union fixa, `DEF_BY_ID` fecha sobre o array a nível de módulo) — replicar exigiria não só um gerador paralelo (já um padrão validado 2x nesta atualização), mas também 2-4 arcos de conteúdo novo (8-16 capítulos) e uma decisão de arquitetura extra: `StoryArcStepDef.pressHint?: PressContext` aponta para o `PressContext` do **clube** (`pre_match`/`post_match`/`callup`/`injury`/.../`story_arc`), que não bate com `PlayerPressContext` (só `pre_match`/`post_match` nesta entrega) — um arco pessoal precisaria de um terceiro contexto de coletiva só para si. Sem placeholder de rota esperando por isso (diferente de Conquistas/Relacionamentos), então ficou de fora por não ter o mesmo "encaixe" natural.

**Time — Metas e Elenco (v1.6, Fases 1–3):** grupo de nav novo "Time" (`PlayerLayout.tsx`, primeiro grupo, antes de "Carreira") com Metas, Elenco e Contrato (que saiu de "Carreira"). **Elenco de colegas** (`types/Teammate.ts` — `{ id, name, position, age, number, moraleTowardsPlayer }`, bem menor que `Player` do treinador) **não é gerado automaticamente** — decisão do usuário no meio da Fase 2, corrigindo uma primeira versão que gerava nomes aleatórios: o elenco nasce vazio em `FINISH_PLAYER_SETUP` e o usuário monta manualmente (`ADD_TEAMMATE`/`UPDATE_TEAMMATE`/`REMOVE_TEAMMATE`) ou importa um JSON no **mesmo modelo do treinador** (`utils/teammateImport.ts` reaproveita literalmente `parseClubImport`/`CLUB_IMPORT_TEMPLATE`/`downloadClubTemplate` de `utils/clubImport.ts`, só mapeando `Player[]` → `Teammate[]` e descartando overall/potencial/salário/personalidade). `utils/teammateMorale.ts` calcula a moral de cada colega em relação a você: assistência dada a ele sempre soma (mesmo se ele é rival de posição); nota ≥8/gols somam pra quem não disputa sua posição e **descem** pra quem disputa (rivalidade); nota ≤5 inverte. Tela `/player/team/squad` agrupada por posição. **Metas mensais** (`types/PlayerGoal.ts` — `MonthlyGoal` por (season, year, month), 1 métrica por posição via `utils/playerMonthlyGoals.ts`: ataque→gols, meio→assistências, defesa/goleiro→jogos sem sofrer gol, + nota-alvo opcional) — popup em `FINISH_PLAYER_SETUP` e a cada dia 1º de mês (`GameState.pendingMonthlyGoalPrompt`, branch `careerMode === 'player'` do `ADVANCE_DAY`). Progresso **derivado** de `state.matches` a cada render (`computeMonthlyProgress`), nunca persistido — mesma disciplina de `computePlayerMilestones` (v1.5). Achado no caminho: `PlayerStats.cleanSheets` nunca foi incrementado pelo motor do jogador (campo morto pré-existente) — `computeMonthlyProgress` contorna calculando clean sheet direto de `match.goalsAgainst === 0` no mês, sem depender do campo quebrado. Tela `/player/team/goals`.

**Motor de partida redesenhado (v1.6, Fase 4):** `PlayerMatchPlay.tsx` reescrito por completo, com base explícita no `MatchPlay.tsx` do treinador — mas o reaproveitamento foi bem mais direto do que o padrão "gerador paralelo" das fases anteriores, porque boa parte do motor do treinador já é genérica sobre `Player[]`/tipos de rascunho, sem fechar sobre conteúdo de clube: `ScoreStep`, `OpponentGoalsStep` e **`MatchRecapStep`** são reaproveitados **sem nenhuma alteração**, junto com as funções puras `buildGoalEvents`/`buildAssistEvents`/`buildCardEvents`/`syncTeamGoalsCount`/`isTeamGoalsValid`/`isOpponentGoalsValid` (`utils/matchPlayHelpers.ts`) e `MinuteInput`. Ponte `utils/playerMatchBridge.ts` (`buildPseudoSquad`) monta `[você, ...colegas]` como `Player[]` de mentirinha só pra esses helpers resolverem nome por id — 3ª vez que essa técnica aparece no projeto (depois de `nationalPlayerToPseudoPlayer`, v1.4). Sem tela de escalação: primeiro passo é "Você" (titular/reserva/não relacionado); reserva abre popup (minuto de entrada + "no lugar de quem"). `TeamGoalsStep`/`EventsStep`/`MatchSummaryStep` do treinador (que dependem de elegibilidade-por-minuto de uma escalação real) foram trocados por versões próprias e menores: `PlayerGoalsStep` (autor entre você — sempre primeiro, dourado — e colegas, sem elegibilidade por minuto), `PlayerIncidentsStep` (cartão/lesão sempre sobre você, só pede minuto; lesão também gera uma `InjuryEntry` de verdade em `careerPlayer.injuries`, integrando com o clock pessoal da Fase 2 do v1.5), `PlayerRatingStep` (nota final). `CompletePlayerMatchInput` (`types/PlayerMatchPerformance.ts`) trocou `performance` digitado por `goals`/`assists`/`cards`/`role`/`minutesPlayed`/`rating` — `playerPerformance` agora é **derivado** no reducer (`derivePlayerPerformance`, `utils/playerMatch.ts`), e `deriveAssistedTeammateIds` finalmente ativa o bônus de moral por assistência específica que a Fase 2 deixou dormente (antes não existia id real de autor/assistente por gol).

---

## 6. Narrativa (Pulse / Social / Coletivas / Story Arcs / clima)

Detalhado por [Narrativa](672a92bc-75c9-4149-b32a-ad3687f667f2).

### 6.1 Pulse (`src/pulse/*`)
Motor `generatePulse` em dois modos:
- **Daily** (`rollDailyPulse` no `ADVANCE_DAY`, só dias **sem** jogo): base `settings.dailyEventChance` ≈ **0.20**, dinâmica clamp 0.04–0.50. “Nada” não entra no histórico.
- **Match** (`rollPulseForMatch` na tela pré-jogo): base `settings.chanceEvento` ≈ **0.28**, clamp 0.12–0.62; “nada” entra no histórico; permite eventos `match_only`.

Banco de eventos: `eventBank.json` + `eventBankCustom.json` (~147). Categorias com pesos (`probabilities.ts`), raridade (comum 55/incomum 28/raro 13/muito-raro 4), cadeias (`cadeia.chance` ≈ 0.30, cooldown ≈ 20). Efeitos: moral/fadiga/status/lesão, `caixa`→finance (`other_in/out`), `board/supporter/media`→clima.

### 6.2 ClubOSocial (`src/pages/Social`, `types/Social.ts`)
Feed com posts `headline` (jogo/transferência), `coach_post` (manual ≤280 chars + imagem), `player_news` e arcos. `buildMatchHeadline` (`socialHeadlines.ts`) escolhe tag (hat_trick, thrashing, late, shutout, brace, red…) + estilo/autor; likes por resultado. `buildTransferHeadline` por tipo de transferência. `unseenCount` para badge.

### 6.3 Coletivas (`src/pressconference/*`, `types/PressConference.ts`)
Contextos: `pre_match`, `post_match`, `callup`, `injury`, `finance_crisis`, `story_arc`. Pipeline: `buildPressSituation` → `pickPressQuestions(3)` → `runPressConference` (efeitos; `scaleMediaDelta` reduz ganhos de mídia conforme atrito) → `applyPressConference` (clima, moral, post, marca done keys, atualiza `pressFriction`). **Atrito** sobe +14 por resposta agressiva, −3 se sessão calma. Triggers especiais em `pressTriggers.ts` (Dashboard): convocação (jogo importante ≤3 dias), lesão (≥14 dias), crise financeira (caixa crítico, 1×/mês).

### 6.4 Story Arcs (`utils/storyArcs.ts`, `types/StoryArc.ts`)
4 arcos × 4 capítulos, cooldown 40–55 dias. Gatilhos: `dressing_room_rift` (derrotas+moral baixa), `media_siege` (atrito≥45 ou mídia<38), `injury_saga` (lesão ≥21 dias), `board_ultimatum` (board em crise). `tickStoryArc` no `ADVANCE_DAY` (não em dia de jogo), chance de início `STORY_ARC_START_CHANCE = 0.38`, 1 capítulo/dia; alguns pedem coletiva (`pendingPress`).

### 6.5 Clima (`utils/clubConfidence.ts`)
Board/torcida/mídia 0–100. Fontes: pós-jogo (`calcMatchClimateDeltas`, board+torcida), drift diário (`dailyClimateDrift`), Pulse, coletivas, arcos. Históricos em `board.*History` (cap 50).

---

## 7. Financeiro (resumo — detalhe no handoff dedicado)

`ClubFinance` no state; página `/financas`. Componentes: extrato (`ledger`), bilheteria pós-jogo (estádio configurável), folha (dia 5, com opção de empréstimo-ponte 120%/12%/6x ou virar dívida), empréstimos bancários (`loan_credit` entra na hora, parcelas no calendário), dívidas (parcela obrigatória, ignorar = +2,5% juros), patrocínios Master/Manga (cota mensal + bônus de temporada), premiações (win/draw no fim do jogo; knockout/champion em Competições). Moeda BRL/EUR/GBP/USD só formata (sem câmbio).

**v1.3 “Financial Update”** adicionou, por cima desse motor (que não mudou): dashboard na Visão geral (KPIs com variação %, gráfico de fluxo de caixa + projeção, orçamento mensal com breakdown por categoria, rosca de despesas, barras receita/despesa, ranking de lançamentos), teto de gastos mensal (`finance.monthlyBudget`, penaliza diretoria se estourado) e rating bancário do clube (`finance.health`, score/rating cacheado, badge na Diretoria).

Arquivos: `types/Finance.ts`, `utils/finance.ts`, `clubLoans.ts`, `clubDebts.ts`, `sponsors.ts`, `livelifeTemplates.ts`, `utils/financeAnalytics.ts` (v1.3), `utils/financialHealth.ts` (v1.3), `components/Finance/*` (v1.3).

**Para qualquer trabalho financeiro, ler:** `docs/HANDOFF_FINANCEIRO_CLAUDE.md`.

---

## 8. Persistência, saves e nuvem

- **Local:** `storage.ts` grava em localStorage; `saveSlots.ts` gerencia **3 slots** (`clubos_save_slot_1..3`) + espelho legado `clubos_save`. Save version `0.6.0`.
- **Migração:** `migrateSave` (em `storage.ts`) preenche defaults, normaliza players/finance/board/transfers/pulse/social, deriva `currentDate` para carreiras antigas, roda `migrateAbsurdGateRevenue`, sincroniza `team.budget = finance.balance`. **Sempre estenda a migração ao adicionar campos.**
- **Nuvem:** `AuthContext.tsx` + `cloudSave.ts` (Firestore) com login Google. Estratégia: abre local na hora e sincroniza em background; `isSavePreferable` resolve conflitos por progresso/`savedAt`. Erros de sync aparecem no header do Layout. Firebase é **opcional** (`isFirebaseConfigured`); sem config, roda 100% local.
- **Autosave:** o `GameProvider` persiste o snapshot (`getSaveSnapshot`) após mudanças; `forceCloudRef` força push em ações importantes (ex.: empréstimo).

---

## 9. Índice “mexa aqui” (arquivos por área)

| Área | Arquivos-âncora |
|------|-----------------|
| Estado/ações | `context/GameContext.tsx` |
| Auth/nuvem | `context/AuthContext.tsx`, `services/firebase.ts`, `services/cloudSave.ts` |
| Persistência | `services/storage.ts`, `services/saveSlots.ts` |
| Roteamento/nav | `App.tsx`, `components/Layout/Layout.tsx`, `components/PlayerLayout/PlayerLayout.tsx` |
| Partida | `pages/MatchPlay/*`, `pages/PulseMatch/*`, `pages/Matches/*`, `utils/matchStats.ts`, `playingTime.ts`, `squadMorale.ts`, `matchEvents.ts` |
| Táticas | `types/Tactics.ts`, `utils/formations.ts`, `tacticalStyles.ts`, `components/FormationField` |
| Competições | `types/Competition.ts`, `utils/competitions.ts`, `competitionEngine.ts` |
| Transferências | `types/Transfer.ts`, `pages/Transfers/*`, `utils/transferWindow.ts`, `transferPayments.ts`, `transferHeadlines.ts` |
| Finanças | `types/Finance.ts`, `utils/finance.ts`, `clubLoans.ts`, `clubDebts.ts`, `sponsors.ts`, `livelifeTemplates.ts`, `pages/Finance/Finance.tsx`, `utils/financeAnalytics.ts` (v1.3), `utils/financialHealth.ts` (v1.3), `components/Finance/*` (v1.3) |
| Diretoria/temporada | `types/Board.ts`, `pages/Board/*`, `types/SeasonHistory.ts`, `utils/achievements.ts`, `historyScope.ts` |
| Narrativa | `pulse/*`, `pressconference/*`, `utils/storyArcs.ts`, `socialHeadlines.ts`, `pressTriggers.ts`, `clubConfidence.ts`, `pages/Social/*`, `pages/PressConference/*` |
| Modo jogador | `pages/Player/**`, `pages/PlayerSetup/*`, `types/CareerPlayer.ts`, `CareerMode.ts`, `PlayerMatchPerformance.ts`, `utils/playerMorale.ts`, `playerMatch.ts`, `playerClock.ts`, `playerValue.ts` |
| Pulse pessoal (v1.5) | `pulse/eventBankPlayer.json`, `pulse/playerEvents.ts`, `pulse/probabilitiesPlayer.ts`, `pulse/playerBridge.ts`, `pulse/playerGenerator.ts`, `pulse/playerDaily.ts` |
| Coletivas e social pessoais (v1.5) | `pressconference/playerQuestions.ts`, `playerEngine.ts`, `types/PlayerPressConference.ts`, `utils/playerPressTriggers.ts`, `utils/playerHeadlines.ts`, `pages/Player/PressConference/*`, `pages/Player/Social/*` |
| Legado do jogador (v1.5) | `utils/playerMilestones.ts`, `pages/Player/Trophies/*`, `pages/Player/Relationships/*` (`PlayerAward`/`RelationshipEvent` em `types/CareerPlayer.ts`) |
| Time do jogador (v1.6) | `types/Teammate.ts`, `types/PlayerGoal.ts`, `utils/teammateMorale.ts`, `utils/teammateImport.ts`, `utils/playerMonthlyGoals.ts`, `pages/Player/Squad/*`, `pages/Player/Goals/*` |
| Motor de partida do jogador (v1.6) | `pages/Player/MatchPlay/PlayerMatchPlay.tsx`, `pages/Player/MatchPlay/steps/*`, `utils/playerMatchBridge.ts`, `utils/playerMatch.ts` (`derivePlayerPerformance`/`deriveAssistedTeammateIds`), `types/PlayerMatchPerformance.ts` |
| Tema/onboarding | `utils/clubColors.ts`, `utils/tutorials.ts`, `components/Tutorial`, `types/LiveLife.ts` (`LIVELIFE_CHANGELOG`/`CURRENT_UPDATE_VERSION`, popup "o que há de novo" — v1.6) |
| Modo Seleção (v1.4) | `types/NationalTeam.ts`, `pages/National/**`, `components/NationalLayout/*`, `utils/nationalWindows.ts`, `nationalStats.ts`, `nationalRanking.ts`, `nationalMatchPlay.ts`, `nationalImport.ts`, `pulse/nationalEvents.ts` |

---

## 10. Invariantes e pegadinhas (ler antes de alterar)

1. **`GameContext` é a fonte da verdade.** UI dispara ações; não duplique estado.
2. **`team.budget === finance.balance`** após qualquer mutação financeira.
3. **Ledger:** positivo = receita, negativo = despesa. Use `newLedgerEntry` e passe `currentDate`.
4. **Datas usam o clock do jogo (`currentDate`)**, não `new Date()` do mundo real (exceto `savedAt`/ids).
5. **`careerMode` decide o roteador inteiro.** Não misture páginas coach/player.
6. **Ao adicionar campo ao save:** tipar → default no factory → **estender `migrateSave`** → seed se preciso → UI.
7. **Suspensão** é por competição (vermelho = 1 jogo da mesma competição). Lesão conta em dias de jogo.
8. **`COMPLETE_MATCH`** aplica efeitos completos; **`UPDATE_COMPLETED_MATCH`** não reaplica moral/clima/finanças.
9. **Pulse por partida:** 1× por `matchId` (`rolledMatchIds`).
10. **Janela de transferências** bloqueia negociações fora das datas; renovação sempre permitida.
11. **Prêmios:** win/draw no fim do jogo; knockout/champion só em Competições.
12. **Ordem dos modais no Dashboard:** folha → transferência → empréstimo → dívida. Não trocar de leve.
13. **Nuvem é best-effort:** nunca bloqueie a UI esperando Firestore; conflitos via `isSavePreferable`.
14. **Firebase opcional:** o app tem que funcionar sem login (100% local).
15. **Nunca nomeie uma propriedade de retorno de hook como `current`/`previous` sozinho.** O React Compiler deste projeto (eslint-plugin-react-hooks v7) interpreta `algumaCoisa.current` como acesso a `ref.current` e recusa memoizar o componente (`"Compilation Skipped"`). Vale para qualquer hook novo no app, não só financeiro — achado em `FinanceOverviewTab.tsx` (v1.3).
16. **`Player.nationalDutyUntil` é ortogonal a `PlayerAvailability`** (v1.4) — não é um novo valor do enum, é um campo de data à parte, recalculado **do zero** (`recomputeNationalDuty`, nunca incrementado) a cada mudança de convocação/vínculo/janela. Prioridade de exibição sempre abaixo de lesão/suspensão/empréstimo reais.
17. **`nationalTeam` e `board`/metas do clube nunca se misturam** (v1.4) — `NationalBoardGoal` é uma estrutura própria e menor, nunca compartilhada por herança com `BoardGoal`/`BoardState`. `Board.tsx` do clube não lê `nationalTeam.goals`, e `NationalBoard.tsx` não lê `state.board`.

---

## 11. Ciclo de vida da carreira (coach)

```
Setup (clube + manager + competições + finanças) → START_CAREER
  → Dashboard: Avançar Dia (loop)
       · dia sem jogo: clima drift + Pulse + Story Arc
       · dia 5: folha
       · vencimentos: empréstimo/dívida/transferência
       · cotas de patrocínio
  → dia de jogo: Pulse → MatchPlay → COMPLETE_MATCH → coletiva
       · stats, moral, clima, bilheteria, prêmio, manchete
  → Transferências (na janela) / Competições (mata-mata) / Diretoria (metas)
  → Encerrar temporada (Board): arquiva SeasonArchive, liquida patrocínios,
    aplica títulos, season++
```

---

## 12. Estado do produto e backlog

**Entregue (v1.2):** LiveLife (calendário, bilheteria, folha, lesões temporais), Pulse diário + de partida, ClubOSocial, Coletivas (+ atrito de imprensa), Story Arcs, Competições (liga/mata-mata/híbrido), Empréstimos, Dívidas, Patrocínios, Janela de transferências, Manager, Sala de Troféus, modo Jogador (setup 2 passos), multi-save + nuvem.

**Entregue (v1.3 “Financial Update”):** dashboard financeiro na Visão geral (KPIs com variação %, gráfico de fluxo de caixa + projeção, orçamento mensal com breakdown por categoria, rosca de despesas, barras receita/despesa, ranking de lançamentos), teto de gastos mensal (penaliza diretoria se estourado, pode abrir coletiva), rating bancário do clube (badge na Diretoria), extrato com ícones + busca. Detalhe: `docs/sistema-financeiro.md` §12, `docs/HANDOFF_FINANCEIRO_CLAUDE.md` Camada D.

**Entregue (v1.4 "International Duty Update"):** Modo Seleção / Dual Career completo — Datas FIFA como hub (jogos, convocação com numeração herdada, tática própria por janela), desfalque automático no clube (`nationalDutyUntil`), partida da seleção reaproveitando o motor do clube sem duplicar código, dashboard com líderes e ranking, diretoria da federação (metas + moral), ranking FIFA dinâmico e Pulse Internacional (pedido de desconvocação em amistosos). Detalhe: `docs/selecao-nacional.md`, `InternationalDuty - Desenvolvimento/plano_de_desenvolvimento.md`.

**Entregue (v1.5 "Player Career Update"):** aprofundamento do Modo Jogador — LiveLife/Pulse/imprensa/redes sociais/sala de troféus pessoais, portados e adaptados do Modo Treinador (Fases 1–5; Fase 6 — seleção nacional do jogador e demais itens do Horizonte — ficou como backlog sem versão pinada; **não** é a v1.6 que de fato saiu depois, ver próximo parágrafo). Correções e acabamento (dead code do setup, `marketValue`/`morale`, expectativa do clube no Contrato), clock pessoal (`currentDate`/`ADVANCE_DAY`, lesões que curam por data), Pulse pessoal (gerador próprio e menor, ~36 eventos), vida pública (coletivas de imprensa pessoais + feed social pessoal, resolvendo os antigos placeholders "Manchetes"/"Redes sociais"), legado (`/player/trophies` — sala de troféus pessoal com marcos de carreira derivados de `stats` + títulos/prêmios manuais; `/player/relations` — histórico transparente de ajustes de confiança/moral, resolvendo "Conquistas"/"Relacionamentos"). Story Arcs pessoais cortados da Fase 5 (ver §"Coletivas e social pessoais" abaixo). Detalhe: `PlayerCareer - Desenvolvimento/plano_de_desenvolvimento.md`.

**Entregue (v1.6 "Locker Room Update"):** pedido direto do usuário, não relacionado à Fase 6 do v1.5 acima — Modo Jogador ganhou um "time" ao redor: aba "Time" (Metas mensais por posição — gols/assistências/jogos sem sofrer gol, popup no início do mês e da carreira; Elenco de colegas com moral própria, montado manualmente ou por import de JSON no mesmo modelo do treinador — **sem geração automática**, corrigido em correção de rumo do usuário no meio da Fase 2), Competições com editar/remover, Dashboard sem atalho pra pular a fila do clock (só entra em partida agendada via Avançar Dia, igual ao treinador), e o motor de partida completamente redesenhado (`/player/match/:id/play` — sem escalação, primeiro passo é "Você", reaproveita `ScoreStep`/`OpponentGoalsStep`/`MatchRecapStep` do treinador sem alteração, `goals`/`cards` com autor real entre você e colegas). Popup "O que há de novo" (`livelife.seenUpdateVersion`) reaproveitando o componente `Tutorial` existente. Sem nenhum placeholder "soon" restante no menu do jogador. Detalhe: `PlayerTeam - Desenvolvimento/plano_de_desenvolvimento.md`.

**Backlog / WIP** (ver `LiveLife - Desenvolvimento/MELHORIAS_FUTURAS.md`, `FinancialUpdate - Desenvolvimento/MELHORIAS_FUTURAS.md` e `InternationalDuty - Desenvolvimento/MELHORIAS_FUTURAS.md`):
- Treinamento, Social de jogadores (`/under/*`) do lado treinador
- Avançar Dia em lote; notificações PWA (folha/jogo/mudança de rating)
- Seleção nacional do jogador; colegas de time com histórico de relação próprio (grafo, além da moral simples da v1.6); financeiro pessoal mais rico; Story Arcs pessoais — nenhum tem plano/fase própria ainda, ficam soltos até virarem pedido concreto
- Eixo de mídia pessoal (`mediaConfidence`) e coletivas de contextos especiais (`transfer_rumor`/`injury_personal`/`contract_standoff`) pro jogador
- CT/infraestrutura como investimento
- `StylePicker` não montado em Tactics
- Rating bancário ainda não gateia juros/limite de empréstimo na UI; ofertas de patrocínio dinâmicas por rating; conversão cambial real
- Modo Seleção: sem simulação de clubes estrangeiros, sem treino/infraestrutura própria, `careerMode === 'player'` fora de escopo, metas da federação sem motor de progresso automático

Se o usuário pedir “melhorar X”, verifique primeiro se X já existe (seção 12/§4–7) antes de reimplementar.

---

## 13. Como trabalhar neste projeto (procedimento)

1. Lógica pura em `utils/*`; efeito em `GameContext` (reducer + API); superfície na `page`.
2. Formatação de dinheiro via `formatMoney`/`MoneyAmountHint`; datas via helpers de `transferPayments`/`clubDebts`.
3. Novo campo persistente → factory default + `migrateSave` + (seed) + UI.
4. Teste mental obrigatório: **load de save antigo**, dia 5 sem caixa, partida sem estádio, edição de partida concluída, modo jogador vs coach.
5. Rode lint/tsc antes de concluir; corrija erros que você introduziu.
6. Atualize os docs relevantes ao mudar comportamento:
   - Produto geral: `docs/livelife-v1.2.md`, `docs/guia-de-uso.md`
   - Financeiro: `docs/sistema-financeiro.md`, `docs/HANDOFF_FINANCEIRO_CLAUDE.md`
   - Este handoff: se mudar arquitetura/invariantes.

---

## 14. Docs relacionados

| Doc | Uso |
|-----|-----|
| `docs/HANDOFF_FINANCEIRO_CLAUDE.md` | Handoff só do financeiro (profundo) |
| `docs/sistema-financeiro.md` | Manual do sistema financeiro |
| `docs/livelife-v1.2.md` | Visão da atualização LiveLife |
| `docs/guia-de-uso.md` | Como usar cada tela |
| `docs/modo-jogador.md` | Spec do modo jogador |
| `docs/documentacao.md` | Filosofia e sistemas (visão de produto) |
| `docs/roadmap.md` | Roadmap |
| `docs/firebase-setup.md` | Configuração da nuvem |
| `docs/financial-v1.3.md` | Spec original do Financial Update |
| `FinancialUpdate - Desenvolvimento/` | Plano, contrato e manual de portagem da v1.3 |
| `docs/selecao-nacional.md` | Manual do Modo Seleção / Dual Career (v1.4) |
| `InternationalDuty - Desenvolvimento/` | Plano, contrato e manual de portagem da v1.4 |
| `LiveLife - Desenvolvimento/MELHORIAS_FUTURAS.md` | Backlog + histórico |
| `.cursor/skills/clubos-novo-modulo/SKILL.md` | Como integrar módulos novos |

---

## 15. Modo Seleção / Dual Career (v1.4 "International Duty Update")

Detalhado por `docs/selecao-nacional.md` e `InternationalDuty - Desenvolvimento/plano_de_desenvolvimento.md`. Resumo essencial:

Segundo contexto de jogo inteiro, paralelo ao clube — não um substituto. `state.activeContext: 'club' | 'national'` decide qual layout/rotas montam em `CoachRoutes`; `state.nationalTeam: NationalTeamState | null` é a guarda real — sem ele, `activeContext` nunca vira `'national'` (`SET_ACTIVE_CONTEXT`). Onboarding pelo Dashboard do clube ("Modo Seleção") cria `nationalTeam` uma vez (`CREATE_NATIONAL_TEAM`), sem desfazer.

| Rota | Página | O que faz |
|---|---|---|
| `/national/dashboard` | `NationalDashboard` | Data FIFA ativa/próxima, líderes de carreira, moral da federação, ranking FIFA + variação, card de Pulse Internacional |
| `/national/windows` | `NationalWindows` | Lista de Datas FIFA — clicar entra no hub |
| `/national/windows/:id` | `NationalWindowHub` | **O hub** — 3 abas (Jogos / Convocação / Tática), tudo escopado a essa Data FIFA |
| `/national/players` | `NationalPlayerBase` | Banco recorrente de convocáveis (cadastro/importação JSON/vínculo ao clube) |
| `/national/history` | `NationalHistory` | Retrospecto da gestão + estatísticas por convocado |
| `/national/board` | `NationalBoard` | Metas da federação (CRUD manual) + moral com histórico |
| `/national/match/:windowId/:gameId/play` | `NationalMatchPlay` | Partida completa — escalação, tática, eventos ao vivo, mesmo motor do clube |

**Data FIFA como hub:** cada `FifaWindow` carrega sua própria `tactics`/`tacticsPresets`/`activeTacticsId` e `callUpNumbers` (numeração por convocação, sugerida automaticamente pela convocação anterior). Sem convocação ou sem jogo mapeado, um checklist de pendências trava a aba Tática e o botão de jogar partida. `listSize` (23/26) só é escolhido na criação da Data FIFA.

**Desfalque no clube:** convocado com `clubPlayerId` → `Player.nationalDutyUntil` (campo ortogonal a `PlayerAvailability`, ver invariante nº16) = maior `endDate` entre as janelas em que ainda está convocado (`recomputeNationalDuty`, recálculo total). Bloqueia escalação do clube e mostra o motivo, com prioridade abaixo de lesão/suspensão reais.

**Partida da Seleção sem duplicar o motor do clube:** `NationalMatchPlay`/aba Tática reaproveitam `FormationField`/`utils/formations.ts`/os steps de `pages/MatchPlay/*` sem modificação, convertendo `NationalPlayer` num `Player` "de mentirinha" via `nationalPlayerToPseudoPlayer` (nunca bloqueado — a Seleção não tem lesão/suspensão própria). `FifaWindowGame` espelha os campos de `Match`. Lesão em serviço reflete no `Player` do clube se vinculado.

**Ranking FIFA + Pulse Internacional:** `applyRankingDelta` (tabela fixa por resultado × força do adversário, clamp 1–210) só na 1ª finalização de cada jogo. `findNationalDeconvocationOpportunity` (independente do Pulse do clube) — só em Data FIFA `amistoso` ativa com convocado vinculado ao elenco; nunca em `copa_mundo`/`eliminatorias`.

**Fora de escopo:** `careerMode === 'player'` nunca vê o Modo Seleção; sem simulação de clubes estrangeiros nem tabela real de 200+ países; sem treino/infraestrutura da seleção; metas da federação sem motor de progresso automático.

---

## 16. Mensagem final para o próximo Claude

ClubOS é uma SPA React madura com **estado centralizado** e um **clock contínuo (LiveLife)** que orquestra finanças, partidas, lesões e narrativa. Antes de criar algo novo:
- Confirme que não existe (seções 4–7 e 12).
- Respeite as **invariantes** (seção 10) — especialmente fonte da verdade, `budget===balance`, uso do `currentDate` e extensão da migração.
- Coloque **lógica em utils, efeito no GameContext, superfície na page**.

Para entender rápido qualquer área: comece pelo **tipo** em `src/types/*`, ache a **ação** no `GameContext`, e siga até a **página** correspondente.
