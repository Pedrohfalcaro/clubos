# ClubOS ↔ International Duty Update — Conexão de Projeto

## Identidade do módulo

| Campo | Valor |
|-------|-------|
| **Nome do produto** | **ClubOS International Duty Update** |
| **Nome curto** | **international-duty-v1.4** |
| **Slogan** | *Dois comandos, uma carreira.* |
| **Papel no ClubOS** | Segundo contexto de jogo (Seleção Nacional) rodando em paralelo ao clube, com ponte de mão dupla para convocação |
| **Pasta atual** | `InternationalDuty - Desenvolvimento/` |
| **Destino** | Extensão do `GameState` (novo campo raiz `nationalTeam` + `activeContext`) — não é módulo satélite como o Pulse, é direto no app, no padrão do Financial Update |

---

## O que é cada parte

### ClubOS
Gerenciador de carreira: clube, elenco, temporada, partidas, finanças (`ClubFinance`). **Fonte da verdade** de tudo que já existe — este módulo não recria nada disso.

### International Duty Update (v1.4)
Adiciona um **segundo contexto de comando** (a Seleção Nacional), comutável a qualquer momento no Dashboard do clube, com:

- **Datas FIFA** — janelas de calendário paralelas ao `currentDate` do clube, com jogos individuais (adversário/mando/data).
- **Convocação** — banco de atletas próprio da seleção (`NationalPlayer`), não o elenco do clube. Um convocado pode, opcionalmente, ser vinculado a um `Player` do elenco do usuário (`clubPlayerId`) — só nesse caso ele afeta o clube.
- **Partidas e estatísticas** — registro simplificado (placar + desempenho por atleta), sem o pipeline completo do `MatchPlay` do clube.
- **Ranking FIFA simplificado** — métrica autocontida da seleção do usuário, não uma tabela real de 200+ países.
- **Pulse Internacional** — eventos narrativos de conflito com clubes (ceder ou recusar desconvocação para amistoso).
- **Diretoria da Federação** — moral + metas, estrutura própria (`NationalBoardState`), sem misturar com `BoardState` do clube.

Como o Financial Update, ele **lê e escreve** estado do ClubOS via actions do reducer, mas ao contrário do Pulse **não tem motor externo portado** — é construído direto dentro de `src/`.

---

## Contrato de integração — Dual Career switch

```text
input:
  state.careerMode: 'coach' | 'player'   // Seleção só existe quando 'coach'
  state.activeContext: 'club' | 'national'
  state.nationalTeam: NationalTeamState | null

output (actions):
  SET_ACTIVE_CONTEXT { context: 'club' | 'national' }
    → só permite 'national' se nationalTeam !== null (senão abre onboarding)
  CREATE_NATIONAL_TEAM { name, primaryColor?, secondaryColor?, startingFifaRanking }
    → popula state.nationalTeam com defaults (federationMood: 60, windows: [], talentPool: [], goals: [])
    → NÃO cria careerMode novo, NÃO altera state.team/state.players do clube

roteamento:
  careerMode === 'coach' && activeContext === 'club'    → Layout (existente)
  careerMode === 'coach' && activeContext === 'national' → NationalLayout (novo) + NationalRoutes
  careerMode === 'player'                                → PlayerLayout (existente, inalterado)
```

---

## Contrato de integração — Convocação e vínculo com o clube (ponto de maior risco)

```text
input:
  window: FifaWindow                     // Data FIFA ativa
  nationalPlayer: NationalPlayer         // do talentPool ou recém-criado/importado
  clubPlayerId?: string                  // presente só se o convocado é um Player do elenco do usuário

output (action SET_CALL_UP_LIST):
  window.callUpIds = [...]               // dentro do limite window.listSize
  para cada NationalPlayer convocado com clubPlayerId setado:
    state.players[clubPlayerId].nationalDutyUntil = window.endDate

efeito ao remover da lista ou ao a janela expirar (checagem em ADVANCE_DAY):
  state.players[clubPlayerId].nationalDutyUntil = undefined

invariante:
  NationalPlayer sem clubPlayerId NUNCA escreve em state.players.
  state.players só é tocado por este módulo através do campo nationalDutyUntil —
  nenhum outro campo do Player (moral, salário, status, stats) é lido ou escrito aqui.
```

**Por que isso é o ponto mais delicado:** é a única escrita deste módulo em dados que pertencem ao clube. Qualquer bug aqui pode "prender" um jogador do clube marcado como indisponível para sempre (se o `ADVANCE_DAY` não limpar `nationalDutyUntil` corretamente) ou, na direção contrária, popular convocações fantasmas em elencos.

---

## Contrato de integração — Partidas e estatísticas (`utils/nationalStats.ts`, `utils/nationalRanking.ts`)

```text
input:
  game: FifaWindowGame
  performances: NationalMatchPerformance[]   // um por NationalPlayer que jogou

output (action COMPLETE_NATIONAL_MATCH):
  game.played = true; game.ourGoals / game.opponentGoals preenchidos
  para cada performance: nationalPlayer.stats.{matches,minutes,goals,assists,ratingSum,ratingCount} += valores
  nationalTeam.fifaRanking = applyRankingDelta(fifaRanking, resultado, game.opponentStrength)
  nationalTeam.fifaRankingHistory.push({ date: game.date, value: novoRanking })

output (função pura, sem dispatch):
  aggregateCallUpOverview(nationalTeam) → tabela consolidada por atleta (Visão Geral de Convocados)
```

---

## Contrato de integração — Diretoria da Federação (`NationalBoardState`)

```text
input:
  nationalTeam.federationMood: number         // 0–100, independente de board.boardConfidence do clube
  nationalTeam.goals: NationalBoardGoal[]     // kind reduzido: reach_stage | win_tournament | avoid_relegation_ranking

output:
  ADD_NATIONAL_GOAL / UPDATE_NATIONAL_GOAL / ADJUST_FEDERATION_MOOD

invariante:
  pages/Board/Board.tsx (clube) NUNCA lê nationalTeam.goals/federationMood.
  pages/National/Board/ NUNCA lê nem escreve state.board (clube).
```

---

## Contrato de integração — Pulse Internacional (`src/pulse/nationalEvents.ts`)

```text
input:
  state.activeContext === 'national'
  janela FIFA ativa com type === 'amistoso'
  ao menos um convocado com clubPlayerId setado

output:
  evento narrativo (ceder / recusar desconvocação)
    ceder  → remove o NationalPlayer de window.callUpIds; pequeno bônus de confiança
              em board.boardConfidence (clube de origem do atleta, só se for o clube do usuário)
    recusar → mantém a convocação; pequeno acréscimo de força/moral em nationalTeam.federationMood;
              leve atrito (efeito cosmético, sem novo sistema de atrito paralelo)

invariante:
  não modela clubes estrangeiros como entidades — o único "clube" afetado é o do usuário,
  e só quando o convocado tem clubPlayerId.
```

---

## Contrato de integração — UI (`pages/National/*`)

```text
input:
  state.nationalTeam                     // squad, windows, goals, ranking
  state.players                          // só para resolver nome/status de convocados vinculados (clubPlayerId)
  state.currentDate                      // clock do jogo — datas de janela/jogo usam currentDate, nunca new Date()

output:
  render puro + dispatch apenas das actions já listadas acima
  nenhum novo estado local persistido fora do reducer
```

---

## O que o International Duty Update NÃO é responsável por

- Recriar elenco, tática, financeiro ou o pipeline de partida do clube — tudo isso já existe e permanece intocado.
- Modo Jogador com convocação para seleção — fora de escopo desta versão (`MELHORIAS_FUTURAS.md`).
- Base de dados real de seleções/ranking FIFA mundial — ranking é simplificado e autocontido, documentado como tal.
- IDs próprios fora do padrão — sempre gera IDs no mesmo estilo do resto do ClubOS (`crypto.randomUUID()`/helper já usado no projeto).
- Qualquer efeito financeiro (bônus de convocação, prêmio de seleção) — não pedido pela spec, fica no backlog.
