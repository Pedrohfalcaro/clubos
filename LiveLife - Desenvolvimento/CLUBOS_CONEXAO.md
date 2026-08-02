# ClubOS ↔ LiveLife — Conexão de Projeto

## Identidade do módulo

| Campo | Valor |
|-------|-------|
| **Nome do produto** | **ClubOS LiveLife** |
| **Nome curto** | **livelife** |
| **Slogan** | *Cada dia importa. Cada decisão tem peso.* |
| **Papel no ClubOS** | Motor de tempo contínuo (LIVE) + camada social e humana (LIFE) |
| **Pasta atual** | `LiveLife - Desenvolvimento/` |
| **Destino** | Integração direta no `GameState` do ClubOS (não módulo externo) |

---

## O que é cada projeto

### ClubOS
Gerenciador de carreira: clube, elenco, temporada, partidas. **Fonte da verdade** de todos os dados.

### LiveLife
Não é um módulo satélite isolado como o Pulse. É uma extensão do núcleo do ClubOS:

- **LIVE** = adiciona clock de jogo (`currentDate`), lógica de avanço de dia, economia contínua e lesões temporais.
- **LIFE** = adiciona camada social (ClubOSocial), coletivas interativas e identidade do manager.

O LiveLife lê estado do ClubOS e **escreve diretamente no `GameState`** via actions do reducer.

---

## Contrato de integração — LIVE

```
input:
  state.currentDate: string          // ISO — clock atual do jogo
  state.players: Player[]            // elenco com availability + injuryDaysRemaining
  state.matches: Match[]             // agenda; filtrar pelo currentDate
  state.finance: ClubFinance         // balance + prizeTable + ledger + stadiumConfig
  state.team: Team                   // fans + supporterConfidence + boardConfidence

output (por action ADVANCE_DAY):
  currentDate: string                // +1 dia
  playerPatches: Partial<Player>[]   // injuries decrementadas; disponivel restaurado
  ledgerEntries: FinanceLedgerEntry[]// folha (dia 5), bilheteria pós-jogo
  events: LiveEvent[]                // { type: 'match_day' | 'payroll' | 'pulse_daily' | 'injury_cleared' }
  navigation?: '/match/:id/pulse'    // se dia de jogo
```

### Action `ADVANCE_DAY`

```ts
type GameAction =
  | { type: 'ADVANCE_DAY' }
  // Encadeia internamente:
  //   TICK_INJURIES
  //   CHECK_PAYROLL_DAY     (se dia === 5 do mês do jogo)
  //   ROLL_DAILY_PULSE      (se não é dia de jogo, % configurável)
  //   navigate              (se partida agendada na data)
```

---

## Contrato de integração — Bilheteria (em COMPLETE_MATCH)

```
input:
  match.location: 'home' | 'away' | 'neutral'
  team.fans: number
  team.supporterConfidence: number
  finance.stadiumConfig: StadiumConfig

output (patch no ledger):
  + ticket   home/away: receita bruta
  - stadium_ops: custo manutenção (home) ou custo viagem (away)
  + prize    (se competition configurada em prizeTable)
```

---

## Contrato de integração — LIFE (ClubOSocial)

```
input:
  state.social: SocialState          // feed + handle + unseenCount
  match result (de COMPLETE_MATCH)   // para manchetes automáticas

output (por ADD_SOCIAL_POST):
  social.posts: SocialPost[]         // manchete, post do técnico, notícia de atleta
  social.unseenCount: number
```

---

## Contrato de integração — LIFE (Coletivas)

```
input:
  context: 'pre_match' | 'post_match'
  questions[]: PressQuestion
  answers[]: string                  // IDs das opções escolhidas

output (por APPLY_PRESS_CONFERENCE):
  deltas.supporterConfidence: number
  deltas.squadMorale: number         // aplicado como média ao elenco
  deltas.boardConfidence: number
  headline: string                   // gerada para ADD_SOCIAL_POST
```

---

## O que o LiveLife NÃO é responsável por

- Criar ou gerenciar o cadastro de atletas, clube ou competições
- Persistência própria — usa `GameSave` do ClubOS via `storage.ts`
- IDs próprios — sempre reutiliza IDs ClubOS
- Lógica de escalação ou motor de jogo — pertence ao MatchPlay/Pulse
