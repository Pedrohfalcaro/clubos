# CURSOR_MANUAL — LiveLife Update: Passos de Portagem para o Agente

> **Status do MVP:** Fases 1–8 **entregues** no código. Não reabrir estas checklists salvo regressão.  
> Guia: [`docs/livelife-v1.2.md`](../docs/livelife-v1.2.md) · Entrega: [`ENTREGA_V1_2.md`](./ENTREGA_V1_2.md).

> Leia este arquivo antes de qualquer edição no `src/`. Cada fase é independente; nunca pule a checklist de uma fase sem marcar todos os itens.

---

## Contexto rápido

- **Padrão de referência:** Pulse (`src/pulse/`, `state.pulse`, migrate em `storage.ts`)
- **Clock de jogo:** `GameState.currentDate` (ISO string) — único lugar
- **LiveLife não tem pasta própria em `src/`** — extensões vão direto em `GameContext`, `Finance.ts`, `Team.ts`, etc.
- **Motor puro LIVE** pode viver em `src/livelife/advanceDay.ts` (funções sem DOM)

---

## Fase 1 — Estrutura de datas e calendário contínuo

### Ordem de edição
1. `src/types/` — nenhuma alteração de tipo necessária para esta fase (currentDate é `string`)
2. `src/context/GameContext.tsx`
   - Adicionar `currentDate: string | null` em `GameState`
   - Adicionar action `ADVANCE_DAY` (ver contrato em CLUBOS_CONEXAO.md)
   - `ADVANCE_DAY` case: incrementa data, chama `tickInjuries` e verifica partida do dia
3. `src/services/storage.ts`
   - `migrateSave`: se `save.currentDate` undefined → setar `null`
4. `src/pages/NewCareer/` (ou equivalente de setup)
   - Campo `startDate` no formulário de criação de carreira; salvar como `currentDate`
5. `src/pages/Board/Board.tsx`
   - Aba Identidade: campo "Data base da carreira" (date picker)
   - Se `currentDate === null`: exibir modal LiveLife de ativação
6. `src/pages/Dashboard/Dashboard.tsx`
   - CTA principal → **"Avançar Dia"** + badge `DD/MM/AAAA`
   - Manter botão "Jogar" como secundário quando há jogo no dia
7. `src/utils/finance.ts`
   - `newLedgerEntry` recebe `gameDate?: string`; usa `gameDate ?? new Date().toISOString()`

### Checklist de pronto
- [ ] `state.currentDate` existe e persiste no save
- [ ] Criar carreira define data inicial
- [ ] Avançar Dia incrementa data e navega para jogo se houver no dia
- [ ] Carreiras sem data mostram modal de ativação
- [ ] Build TypeScript sem erros
- [ ] Ledger de folha usa data do jogo, não relógio real

---

## Fase 2 — Lesões e status temporal

### Ordem de edição
1. `src/types/Player.ts`
   - Adicionar `injuryDaysRemaining?: number`
   - `PlayerAvailability` += `'suspenso'`
2. `src/context/GameContext.tsx`
   - Extrair helper `tickInjuries(players): Player[]` (decrementa; zera → `'disponivel'`)
   - Chamar `tickInjuries` dentro de `ADVANCE_DAY`
   - Em `COMPLETE_MATCH` (onde seta `availability: 'lesionado'`): também setar `injuryDaysRemaining` (valor vem do Pulse patch ou padrão aleatório 7–21 dias)
3. `src/utils/formations.ts`
   - Hard-block (filtrar, não só avisar) atletas com `availability === 'lesionado' || 'suspenso'`
4. `src/pages/MatchPlay/MatchPlay.tsx`
   - Label "Lesionado X dias restantes" / "Suspenso X dias"

### Checklist de pronto
- [ ] Lesão define `injuryDaysRemaining`
- [ ] Avançar Dia decrementa contador; ao zerar: `availability = 'disponivel'`
- [ ] Hard-block na súmula para lesionado/suspenso
- [ ] `'suspenso'` é tipo válido em `PlayerAvailability`
- [ ] Build TypeScript sem erros

---

## Fase 3 — Motor financeiro e bilheteria

### Ordem de edição
1. `src/types/Finance.ts`
   - Adicionar `'ticket' | 'travel' | 'stadium_ops'` em `LedgerEntryType`
   - Adicionar `StadiumConfig` interface (capacity, ticketPriceHome, ticketPriceAway, maintenanceCostPerMatch, travelCostAverage)
   - Adicionar `stadiumConfig?: StadiumConfig` em `ClubFinance`
   - `createDefaultFinance`: `stadiumConfig: undefined`
2. `src/utils/finance.ts`
   - Funções puras: `calcGateRevenue(match, team, finance): FinanceLedgerEntry[]`
   - Função: `applyMatchPrize(match, finance): FinanceLedgerEntry | null`
3. `src/context/GameContext.tsx`
   - Em `COMPLETE_MATCH`: chamar `calcGateRevenue` + `applyMatchPrize`; aplicar ledger entries
   - Em `ADVANCE_DAY`: verificar se `gameDate.getDate() === 5` → setar flag `payrollDue: true` no state ou disparar `PAY_WAGES` com confirm
4. `src/services/storage.ts`
   - Migrate: `finance.stadiumConfig` → default vazio se ausente
5. `src/pages/Finance/Finance.tsx`
   - Nova seção "Parâmetros do Estádio": campos de capacity, preços, custos

### Checklist de pronto
- [ ] `StadiumConfig` existe em `Finance.ts`
- [ ] Finalizar partida → ledger ganha entradas de ticket/stadium_ops ou travel
- [ ] Premiação auto entra no caixa (sem ação manual)
- [ ] Avançar em dia 5 → modal de folha salarial
- [ ] Finance.tsx exibe e salva configurações do estádio
- [ ] Build TypeScript sem erros

---

## Fase 4 — Onboarding LiveLife na Diretoria

### Ordem de edição
1. `src/types/` (ou direto em `GameState`)
   - `livelife?: { onboardingComplete: boolean }` em `GameState`
2. `src/services/storage.ts`
   - Migrate: `livelife: { onboardingComplete: false }` se ausente
3. `src/context/GameContext.tsx`
   - Action `COMPLETE_LIVELIFE_ONBOARDING`
4. `src/pages/Board/Board.tsx`
   - Nova aba (ou seção) "LiveLife"
   - Botão **"Tutorial & Guia LiveLife"** abre checklist modal/inline
   - Checklist: 3 itens com estado derivado (salário > 0 em todos? premiação configurada? stadiumConfig preenchido?)
   - Seção Changelog in-app (v1.0 / v1.1 / v1.2)

### Checklist de pronto
- [ ] Board exibe aba/seção LiveLife
- [ ] Checklist mostra status real de cada item (derivado do state)
- [ ] Changelog mostra descrição das versões
- [ ] Flag `onboardingComplete` persiste
- [ ] Build TypeScript sem erros

---

## Fase 5 — Pulse diário

### Ordem de edição
1. `src/pulse/types.ts`
   - Campo `trigger?: 'any' | 'match_only'` em `PulseEvent`
2. `src/pulse/probabilities.ts`
   - Marcar eventos incompatíveis com dia sem jogo como `trigger: 'match_only'`
3. `src/pulse/` — novo `src/pulse/daily.ts`
   - `rollDailyPulse(state): PulseResult | null` — filtra por `trigger !== 'match_only'`
4. `src/context/GameContext.tsx`
   - Em `ADVANCE_DAY` (quando não é dia de jogo): chamar `rollDailyPulse` com chance `pulse.settings.dailyEventChance ?? 0.2`
   - Se resultado: setar `pendingDailyPulse` no state
5. `src/pages/Dashboard/Dashboard.tsx`
   - Se `pendingDailyPulse`: exibir modal Pulse (reutilizar componente existente)
6. `src/pages/Pulse/Pulse.tsx` (settings)
   - Campo `dailyEventChance` (0%–50%)

### Checklist de pronto
- [ ] ~20% dos dias sem jogo dispara evento Pulse
- [ ] Eventos `match_only` não aparecem em dias normais
- [ ] Configuração de chance visível nas settings do Pulse
- [ ] Build TypeScript sem erros

---

## Fase 6 — ClubOSocial

### Ordem de edição
1. `src/types/Social.ts` — novo arquivo (ver tipos em CLUBOS_CONEXAO.md)
2. `src/context/GameContext.tsx`
   - `social: SocialState` no `GameState`; `ADD_SOCIAL_POST`
   - Em `COMPLETE_MATCH`: gerar manchete automática → `ADD_SOCIAL_POST`
3. `src/services/storage.ts`
   - `GameSave.social`; migrate com `{ handle: '@'+teamName, posts: [], unseenCount: 0 }`
4. `src/pages/Social/` — nova pasta
   - `Social.tsx` (feed), `SocialPost.tsx` (componente de post)
5. `src/pages/Squad/Squad.tsx`
   - Painel de atleta: exibir `personality` e `morale` (campos existentes)
6. `src/components/Layout/Layout.tsx`
   - Rotas `/under/redes-sociais` e `/under/manchetes` → `/social`

### Checklist de pronto
- [ ] Manchete gerada automaticamente após partida
- [ ] Feed exibe posts em ordem cronológica de gameDate
- [ ] Técnico pode publicar post livre
- [ ] Atleta no Squad exibe personality + morale
- [ ] Build TypeScript sem erros

---

## Fase 7 — Coletivas interativas

### Ordem de edição
1. `src/types/PressConference.ts` — novo (questões, opções, efeitos)
2. `src/pressconference/engine.ts` — motor puro (ver contrato em CLUBOS_CONEXAO.md)
3. `src/pressconference/questions.ts` — banco de perguntas PT-BR (pré/pós jogo)
4. `src/context/GameContext.tsx` — `APPLY_PRESS_CONFERENCE`
5. `src/pages/PressConference/` — UI; acessível pré e pós partida
6. `src/components/Layout/Layout.tsx` — `/under/coletivas` → `/press-conference`

### Checklist de pronto
- [ ] Motor retorna deltas de morale/confiança/torcida
- [ ] Deltas aplicados ao state
- [ ] Manchete gerada e adicionada ao ClubOSocial
- [ ] Gatilho pré-jogo disponível no Dashboard em dia de jogo
- [ ] Build TypeScript sem erros

---

## Fase 8 — Manager pessoal e Sala de Troféus

### Ordem de edição
1. `src/types/Manager.ts` — adicionar `bio?`, `tacticalNotes?`, `agentContacts?`
2. `src/types/Team.ts` — tipar `achievements` com `{ competition, season, position, isTitle }[]`
3. `src/context/GameContext.tsx` — `UPDATE_MANAGER`; logic de title award em `ADVANCE_SEASON`
4. `src/pages/Manager/` — nova pasta; página pessoal do técnico
5. `src/pages/Trophies/` — nova pasta; galeria de troféus
6. `src/components/Layout/Layout.tsx` — stubs `/under/pessoal` e `/under/trofeus` → rotas reais

### Checklist de pronto
- [ ] Manager tem bio e notas editáveis
- [ ] Sala de Troféus lista conquistas com temporada/competição
- [ ] Títulos registrados ao `ADVANCE_SEASON` com posição 1
- [ ] Build TypeScript sem erros

---

## Regras gerais para o agente

1. **Nunca criar IDs próprios** — usar IDs de `Player.id`, `Match.id`, `Team.id` do ClubOS.
2. **Toda função de cálculo deve ser pura** (sem `dispatch` interno) — recebe estado, retorna resultado.
3. **Textos narrativos em PT-BR** (manchetes, eventos Pulse, perguntas de coletiva).
4. **Após cada fase:** rodar `npm run build` e confirmar zero erros TypeScript antes de avançar.
5. **Não implementar itens de `MELHORIAS_FUTURAS.md`** neste MVP.
6. **`migrateSave` sempre** ao adicionar campo novo no `GameState` — sem migrate = saves antigos quebrados.
