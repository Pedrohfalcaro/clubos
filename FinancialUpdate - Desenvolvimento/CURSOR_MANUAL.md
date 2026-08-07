# CURSOR_MANUAL — Financial Update (v1.3): Passos de Portagem para o Agente

> **Status (2026-08-07):** **Épico completo** — todas as fases (0–9, + 7.5) entregues. Este arquivo fica como referência histórica de como cada peça foi construída.
> Plano/rationale: [`plano_de_desenvolvimento.md`](./plano_de_desenvolvimento.md) · Contrato: [`CLUBOS_CONEXAO.md`](./CLUBOS_CONEXAO.md).

> Leia este arquivo antes de qualquer edição no `src/`. Cada fase é independente na checklist, mas Fases 1–3 são pré-requisito de todas as outras (ver ordem de dependência no plano, §3). Nunca pule um item da checklist de uma fase sem marcar todos.

---

## Contexto rápido

- **Padrão de referência:** motor financeiro v1.2 (`utils/finance.ts`, `clubLoans.ts`, `clubDebts.ts`, `sponsors.ts`) — **não alterar a lógica desses arquivos**, só consumi-los.
- **Clock de jogo:** `GameState.currentDate` (ISO string) — único lugar; nunca `new Date()` em lançamento/cálculo.
- **Financial Update não tem pasta própria em `src/`** — extensões vão em `types/Finance.ts`, dois utils novos (`financeAnalytics.ts`, `financialHealth.ts`) e `components/Finance/*`.
- **Regra de ouro que nunca muda:** `team.budget === finance.balance`. Nada nesta atualização toca nessa invariante — analytics/rating/orçamento são somente leitura sobre o ledger, exceto `SET_MONTHLY_BUDGET` (que só grava `targetExpenseLimit`, nunca `balance`).

---

## Fase 1 — Modelo de dados e migração

### Ordem de edição
1. `src/types/Finance.ts`
   - Adicionar `FinancialRating`, `MonthlyBudget` (`targetExpenseLimit`, `updatedAt`), `FinancialHealth` (`score`, `rating`, `creditLimit`, `computedAt`)
   - `ClubFinance.monthlyBudget?: MonthlyBudget`
   - `ClubFinance.health?: FinancialHealth`
   - **Não** adicionar `currentSpent` a nenhum tipo persistido (é derivado — ver Fase 2)
2. `src/services/storage.ts`
   - `migrateSave`: se `finance.monthlyBudget` ausente → deixar `undefined` (feature opt-in, sem default forçado)
   - `migrateSave`: se `finance.health` ausente → calcular com `computeFinancialHealth` (requer Fase 3 pronta antes de ligar esta linha; se fizer Fase 1 isolada, deixar `undefined` e preencher quando Fase 3 chegar)

### Checklist de pronto
- [ ] `FinancialRating`, `MonthlyBudget`, `FinancialHealth` tipados em `Finance.ts`
- [ ] `ClubFinance` aceita os dois campos novos como opcionais
- [ ] Save v1.2 sem esses campos carrega sem erro
- [ ] `team.budget === finance.balance` continua verdadeiro após o load
- [ ] `npm run build` sem erros

---

## Fase 2 — Motor de agregação (`utils/financeAnalytics.ts`, novo arquivo)

### Ordem de edição
1. Criar `src/utils/financeAnalytics.ts`
   - `getMonthlyCashFlow(ledger, currentDate, months = 6)` — agrupa por `YYYY-MM` a partir de `date` de cada entry; soma `amount >= 0` em `income`, `amount < 0` (absoluto) em `expense`. Sem `currentDate`, ancora no mês da entrada mais recente do ledger; sem ledger nenhum, retorna `[]`
   - `getCategoryBreakdown(ledger, monthKey)` — retorna `{ monthKey, groups: { group, total }[], total }` (só despesas, `amount < 0`), agrupado por `payroll`/`stadium_travel`/`loans_debts`/`transfers`/`other`; `.total` é a soma de todos os grupos (é o valor que a Fase 4 compara com o teto)
   - `getCashFlowProjection({ finance, players, currentDate }, monthsAhead = 3)` — `projectedExpense` = `wageBill(players)` + soma de `debts` ativas (`monthlyInstallment`) + `loanPayments` pendentes cujo `dueDate` cai no mês; `projectedIncome` = cota mensal de `sponsors` ativos (`monthlyFee` — é receita, não despesa). Não projeta bilheteria/premiação — dependem de jogos ainda não agendados. Sem `currentDate`, retorna `[]`
   - `percentChange(current, previous)` — retorna `null` se `previous === 0` (sem base de comparação, não `Infinity`)
2. **Não** chamar essas funções direto no reducer — são consumidas só pela UI (Fase 5/6) via `useMemo`

### Checklist de pronto
- [ ] Todas as funções são puras (sem `dispatch`, sem leitura de `Date.now()`)
- [ ] `getMonthlyCashFlow([], currentDate, 6)` retorna 6 meses com valores zerados, não array vazio
- [ ] `percentChange` nunca retorna `Infinity`/`NaN`
- [ ] `getCashFlowProjection` com `currentDate === null` retorna array vazio (carreira sem LiveLife)
- [ ] `npm run build` sem erros

---

## Fase 3 — Rating bancário (`utils/financialHealth.ts`, novo arquivo)

### Ordem de edição
1. Criar `src/utils/financialHealth.ts`
   - Constantes de peso exportadas (não hardcoded inline): `RUNWAY_WEIGHT = 40`, `PUNCTUALITY_WEIGHT = 35`, `DEBT_RATIO_WEIGHT = 25`
   - `computeFinancialHealth(state): FinancialHealth` — fórmula completa no plano §2 Fase 3
   - Helper interno: `countWageOverdrafts(debts, currentDate, monthsBack = 6)` — conta `debts` com `source === 'wage_overdraft'` e `createdAt` dentro da janela
2. `src/services/storage.ts`
   - Completar a linha deixada pendente na Fase 1: `finance.health` ausente → `computeFinancialHealth(migratedState)`
3. `src/context/GameContext.tsx`
   - Em `ADVANCE_DAY` (fim do case, L1708+): recalcular `finance.health`
   - Em `PAY_WAGES` (L2138+) e em `payWagesWithBridgeLoan`: recalcular após aplicar o efeito
   - Em `payClubDebt`: recalcular após aplicar o pagamento
   - **Não** recalcular em `APPLY_LEDGER` genérico nem em `UPDATE_COMPLETED_MATCH` (rating não deve reagir a lançamento manual avulso nem a edição de partida passada)
4. `src/pages/Finance/` (ou já como parte da Fase 5) — aba Empréstimos: taxa de juros sugerida/mínima e bloqueio de empréstimo novo variam por `finance.health.rating` (D/F bloqueado; ponte da folha nunca bloqueada — é a válvula de emergência)

### Checklist de pronto
- [ ] `computeFinancialHealth` roda sem exceção com `debts: []`, `wageBill = 0`
- [ ] Rating recalculado apenas nos 4 checkpoints listados (grep por `computeFinancialHealth(` deve retornar exatamente esses 4 call sites + o de load)
- [ ] Empréstimo-ponte da folha continua disponível mesmo com rating D/F
- [ ] `npm run build` sem erros

---

## Fase 4 — Teto de gastos mensal *(entregue, 2026-08-07)*

### Ordem de edição
1. `src/context/GameContext.tsx`
   - Nova action `SET_MONTHLY_BUDGET` — grava `finance.monthlyBudget = { targetExpenseLimit, updatedAt: state.currentDate }`
   - Em `ADVANCE_DAY`: ao detectar virada de mês (dia 1), se `finance.monthlyBudget` definido: calcular `getCategoryBreakdown(ledger, mêsAnterior).total` e comparar com `targetExpenseLimit`
     - Se estourou e chave `budget:YYYY-MM` (mês anterior) ainda não usada: aplicar delta negativo em `board.confidence` + marcar chave usada
2. `src/utils/pressTriggers.ts` — **adiado para a Fase 8** (não pedido pelo checklist desta fase; feito junto da integração com Diretoria/narrativa)
3. `src/pages/Finance/` — **adiado para a Fase 5** (ainda não existe UI para o teto; só a action/reducer estão prontos)

Implementado: `SET_MONTHLY_BUDGET` (action + case + `setMonthlyBudget()` em `useGame()`). Penalidade em `ADVANCE_DAY`: na virada de mês (`dayOfMonth === 1`), se `finance.monthlyBudget` definido e `getCategoryBreakdown(ledger, mêsFechado).total` estourou o teto, aplica `BUDGET_OVERRUN_BOARD_PENALTY = -6` (via `softScaleDelta`, mesma suavização de extremos usada em resultado de partida) no `board.confidence`, registra no `confidenceHistory` e marca a chave `budget:YYYY-MM` em `livelife.pressSpecialDoneKeys` (reaproveita o array de cooldowns já usado por `pressTriggers.ts` — nenhum campo de estado novo).

### Checklist de pronto
- [x] `SET_MONTHLY_BUDGET` disponível via `useGame()`
- [x] Sem `monthlyBudget` definido → `ADVANCE_DAY` não faz nenhuma checagem de teto
- [x] Estourar o teto 1x no mês não gera penalidade duplicada no mesmo mês
- [x] `npm run build` sem erros

---

## Fase 5 — Split de `Finance.tsx` + Header executivo + KPI cards

### Ordem de edição
1. Criar pasta `src/components/Finance/`
2. `components/Finance/FinanceOverviewTab.tsx` — mover conteúdo atual da aba "Visão geral" (`Finance.tsx` L169+) para cá
3. `components/Finance/FinanceLedgerTab.tsx` — mover conteúdo atual da aba "Extrato" (`Finance.tsx` L182+) para cá (base para Fase 7)
4. `components/Finance/KpiCard.tsx` — componente genérico: `{ label, value, deltaPercent, tone: 'good'|'warn'|'bad' }`
5. `components/Finance/FinanceHeader.tsx` — saudação (`manager`/`team.name`), seletor de período (`'month'|'6months'|'season'|'all'`), botões `+ Novo Lançamento` (já existe, só mover trigger), `Solicitar Empréstimo` (troca `tab` para `'loans'`), `Definir Teto de Gastos` (abre modal que dispara `SET_MONTHLY_BUDGET`)
6. `pages/Finance/Finance.tsx` — vira shell: renderiza `FinanceHeader` + tabs + `FinanceOverviewTab`/`FinanceLedgerTab`/demais abas (que continuam inline até suas próprias fases, se houver)
7. KPI cards na `FinanceOverviewTab` usando `getMonthlyCashFlow`/`percentChange` (Fase 2) e `finance.health` (Fase 3): Caixa atual, Receita do período, Despesa do período, Margem, Runway (badge por faixa)

### Checklist de pronto
- [ ] `Finance.tsx` não cresce além do necessário para o shell (queda de linhas vs. os 1404 originais)
- [ ] As 8 abas continuam com o mesmo comportamento funcional de antes
- [ ] KPI cards mostram `—` (não `NaN%`) quando não há período anterior para comparar
- [ ] `npm run build` + `npm run lint` sem erros

---

## Fase 6 — Gráfico de fluxo de caixa + projeção *(entregue, 2026-08-07)*

### Ordem de edição
1. `components/Finance/CashFlowChart.tsx` — SVG custom (sem lib nova, decisão do plano §1); recebe `historyPoints`/`projectionPoints`/`monthTooltips` já computados pelo pai via `useMemo`
2. `components/Finance/CashFlowChart.module.css` — paleta dark do ClubOS (verde receita, laranja despesa, `stroke-dasharray` na continuação de projeção)
3. Integrado em `FinanceOverviewTab.tsx` abaixo dos KPI cards

Implementado como duas linhas (não barras — mais simples de fazer bem em SVG puro e igualmente válido pela spec, que permite "linhas/barras"): receita e despesa, 6 meses de histórico (`getMonthlyCashFlow`) + até 3 meses de projeção pontilhada (`getCashFlowProjection`), mesma paleta de cores já usada no resto do extrato (verde receita, laranja despesa). Tooltip via `<title>` nativo do SVG (sem tooltip customizado com posicionamento em JS) — inclui receita/despesa do mês e a maior categoria de entrada/saída (por `LedgerEntryType`, calculado 1x em `FinanceOverviewTab` via `useMonthTooltips`, não a cada hover — não há hover-JS nenhum, é tudo estático no render).

### Checklist de pronto
- [x] Renderiza com 0, 1 e 6+ meses de ledger sem quebrar layout (ledger vazio → mensagem "sem dados"; `getMonthlyCashFlow` sempre devolve 6 pontos zerados quando há pelo menos `currentDate`)
- [x] Tooltip por mês mostra maior receita/maior despesa daquele mês
- [x] Projeção não aparece se `currentDate === null` (`getCashFlowProjection` retorna `[]`)
- [x] Dados agregados calculados uma vez via `useMemo` no componente pai, não recalculados a cada hover

---

## Fase 7 — Extrato V2 (categorização + busca) *(entregue, 2026-08-07)*

### Ordem de edição
1. `components/Finance/FinanceLedgerTab.tsx`
   - Adicionar `LEDGER_ICON: Record<LedgerEntryType, string>` (emoji por tipo, ver spec §3.3 do `docs/financial-v1.3.md`)
   - Adicionar `<input>` de busca textual filtrando por `label` (case-insensitive)
   - Combinar busca (AND) com os filtros já existentes (Todos/Receitas/Despesas/Transferências/Folha) — não substituir a lógica de filtro atual

`LEDGER_ICON` é um `Record<LedgerEntryType, string>` completo (não `Partial`) — se um tipo novo for adicionado a `LedgerEntryType` no futuro sem ícone, o `tsc` quebra o build em vez de deixar passar silenciosamente sem ícone.

**Fora do escopo desta fase, corrigido incidentalmente:** `formatMoney` (`utils/finance.ts`) não tinha faixa acima de Bilhão — um lançamento de teste na casa dos quatrilhões aparecia como texto quebrado ("120000000,0B"). Adicionadas faixas T (trilhão) e Qa (quadrilhão). Bug pré-existente do app inteiro, não introduzido por esta atualização, mas ficou visível pelos novos KPI cards/gráfico da Fase 5/6.

### Checklist de pronto
- [x] Busca + filtro de tipo combinam corretamente
- [x] Ícone exibido para todo `LedgerEntryType` existente (nenhum tipo sem ícone mapeado)
- [x] Nenhuma alteração em como o ledger é lido/gravado

---

## Fase 7.5 — Dashboard expandido na Visão geral *(fora do plano original, pedido explícito do usuário — entregue, 2026-08-07)*

**Motivo:** depois da Fase 7, o usuário pediu uma melhoria visual maior no financeiro inteiro — "aspecto de site/aplicação financeira, com abas, mais opções de gráficos e visualizações, dashboards mais visuais e completos". Decisão tomada com o usuário (`AskUserQuestion`): expandir a aba **Visão geral** (não criar aba nova), e adicionar 3 visualizações além do módulo de orçamento que já estava na spec original (§2.4) mas nunca tinha sido construído.

### O que foi adicionado

| Componente | O que mostra | Dados |
|---|---|---|
| `MonthlyBudgetCard.tsx` | Barra de progresso do teto de gastos do mês + breakdown por categoria (5 barras horizontais coloridas) | `finance.monthlyBudget` + `getCategoryBreakdown` (Fase 2) |
| `CategoryDonutChart.tsx` | Rosca SVG de despesas por categoria do **período selecionado** no header | `sumExpensesByCategory` (novo em `financeAnalytics.ts`) |
| `IncomeExpenseBarChart.tsx` | Barras agrupadas receita/despesa por mês (complementa a linha da Fase 6, mesmos `historyPoints`, sem novo fetch) | `getMonthlyCashFlow` (Fase 2/6, reaproveitado) |
| `TopEntriesList.tsx` | Ranking dos 5 maiores lançamentos de entrada e de saída do período | Entradas cruas do período (novo `usePeriodEntries`) |

### Refatoração de suporte (`utils/financeAnalytics.ts`)

- `getCategoryBreakdown(ledger, monthKey)` continua com a mesma assinatura/retorno (nenhum call site quebrado — `ADVANCE_DAY` no `GameContext.tsx` não muda), mas agora delega para uma nova função exportada `sumExpensesByCategory(entries)` que soma um conjunto **qualquer** de lançamentos por categoria, sem filtrar por mês. Isso permite reaproveitar a mesma lógica de categorização para recortes maiores que um mês (6 meses, temporada, histórico).
- `latestLedgerMonthKey` passou a ser exportado (antes era privada).
- Em `FinanceOverviewTab.tsx`, o hook `usePeriodTotals` (baseado em `getMonthlyCashFlow`) foi substituído por `usePeriodEntries`, que devolve os **lançamentos crus** do período selecionado + do período anterior — fonte única para KPIs, breakdown de categoria, donut e ranking (evita recalcular o mesmo recorte 4 vezes). Os KPIs continuam com o mesmo resultado numérico de antes, só mudou a implementação interna.

### Armadilhas encontradas e corrigidas

1. **Mutação de variável durante o render** (`CategoryDonutChart.tsx`): calculava o ângulo acumulado da rosca com um `let cumulative` mutado dentro de `.map()` — o lint (`react-hooks/immutability`, parte do React Compiler) barra isso porque pode ficar inconsistente entre renders. Reescrito para calcular a fração acumulada por item sem variável mutável (`ordered.slice(0, i).reduce(...)` — no máximo 5 itens, custo irrelevante).
2. **Nome de propriedade colidindo com semântica de ref**: o hook `usePeriodEntries` originalmente devolvia `{ current, previous }`. O React Compiler interpreta `algumaCoisa.current` como acesso a `ref.current` e se recusa a memoizar o componente por causa disso ("Differences in ref.current access"). Renomeado para `{ inPeriod, previousPeriod }`.

### Checklist de pronto
- [x] `npm run build` sem erros
- [x] `npm run lint` no mesmo baseline de antes (51 problemas — nenhum novo, nenhum corrigido incidentalmente desta vez)
- [x] KPIs numéricos idênticos aos de antes da refatoração (mesma fonte de dados, só reorganizada)
- [x] Layout responsivo (grids `auto-fit`) — cards empilham em telas estreitas, já que `.page` tem `max-width: 720px`

---

## Fase 8 — Integração com Diretoria e narrativa *(entregue, 2026-08-07)*

### Ordem de edição
1. `src/pages/Board/Board.tsx`
   - Adicionar linha "v1.3 — Financial Update" na seção de changelog já existente
   - Badge de rating (lendo `finance.health.rating`, sem recalcular) no resumo/identidade do clube
2. `src/utils/pressTriggers.ts` (se não feito na Fase 4) — incluir motivo "estouro de teto" no texto de `finance_crisis` quando aplicável

Implementado:
- `types/LiveLife.ts` — nova entrada no topo de `LIVELIFE_CHANGELOG` (`v1.3 — Financial Update`); Board já renderiza essa lista sem mudança de código.
- `pages/Board/Board.tsx` — linha "Rating financeiro" na aba **Temporada** (seção "Resumo da temporada", ao lado de "Caixa atual"), reaproveitando o badge `.confStatus`/`.statusStable|Watchful|Crisis` já usado pra Confiança/Torcida. Só lê `finance.health` — zero chamada a `computeFinancialHealth` neste arquivo (`grep computeFinancialHealth` continua batendo só nos 6 call sites da Fase 3). Sem `finance.health` (não deveria acontecer pós-migração, mas defensivo), a linha simplesmente não renderiza.
- `utils/pressTriggers.ts` — `findFinancePressOpportunity` ganhou uma 4ª condição: se a chave `budget:YYYY-MM` já foi marcada em `livelife.pressSpecialDoneKeys` (penalidade de teto aplicada em `ADVANCE_DAY`, Fase 4) e a coletiva financeira do mês ainda não rodou (`finance:YYYY-MM`), oferece coletiva com motivo "Estouro do teto de gastos mensal". As duas chaves de cooldown são independentes de propósito — uma é do reducer (penalidade), outra é da coletiva (apresentação) — reaproveitando o mesmo array sem estado novo.

### Checklist de pronto
- [x] Rating em Board é sempre o mesmo valor lido em Finanças (nenhum segundo cálculo)
- [x] Changelog novo não quebra saves antigos (é conteúdo estático)

---

## Fase 9 — Testes, checklist geral e documentação *(entregue, 2026-08-07 — fecha o épico)*

### Testes mentais obrigatórios (rodar após cada fase, não só no fim)
- [x] Load de save v1.2 sem `monthlyBudget`/`health` — spread de `save.finance` preserva ausência; `health` preenchido no load (`storage.ts`) se faltar
- [x] Carreira sem `currentDate` (LiveLife nunca ativado) — `getMonthlyCashFlow`/`getCashFlowProjection`/`usePeriodEntries`/`MonthlyBudgetCard` caem no fallback da entrada mais recente do ledger, ou retornam vazio sem crashar
- [x] `wageBill === 0` (runway infinito) não trava `computeFinancialHealth` nem os KPI cards — `runway === Infinity` tratado explicitamente em ambos
- [x] Teto não definido → sem barra de progresso, sem penalidade — `ADVANCE_DAY` só checa estouro se `finance.monthlyBudget` existir; `MonthlyBudgetCard` mostra hint em vez de barra
- [x] Save migrado com `debts` antigas de `wage_overdraft` → rating reflete atrasos passados — `countWageOverdrafts` conta por `source`+janela de 6 meses, independe de quando a dívida foi criada no mundo real
- [x] `UPDATE_COMPLETED_MATCH` não dispara recomputo de rating — confirmado por leitura: o case só retorna `{...state, matches, ...recalculated}`, nunca toca `finance`
- [x] `npm run build` e `npm run lint` limpos ao final de cada fase — baseline 51 problemas (40 erros/11 avisos pré-existentes, nenhum introduzido) mantido do início ao fim do épico

### Documentação atualizada no fim do épico
- [x] `docs/sistema-financeiro.md` — nova §12 (Teto, Rating, Dashboard expandido) + atualizações em §1, §2, §3.1, §3.5, §3.7, §8, §11
- [x] `docs/HANDOFF_FINANCEIRO_CLAUDE.md` — nova Camada D (§1) + §3.11–3.13 + invariantes 13–16 (§9) + constantes (§8) + snippets (§13) + arquivos (§6) + backlog (§11)
- [x] `docs/HANDOFF_CLUBOS_CLAUDE.md` — versão do produto v1.2 → v1.3 (§0), §7 financeiro, §9 índice de arquivos, §10 invariante 15 (gotcha do React Compiler), §12 backlog/entregue, §14 docs relacionados

---

## Regras gerais para o agente

1. **Nunca reescrever o motor financeiro v1.2** (`finance.ts`, `clubLoans.ts`, `clubDebts.ts`, `sponsors.ts`) — só consumir.
2. **`currentSpent` do orçamento nunca é persistido** — sempre `getCategoryBreakdown` em runtime.
3. **`finance.health` só recalcula nos checkpoints listados na Fase 3** — não a cada render nem a cada `APPLY_LEDGER`.
4. **Toda função de analytics/rating deve ser pura** (sem `dispatch` interno).
5. **Após cada fase:** rodar `npm run build` e confirmar zero erros TypeScript antes de avançar.
6. **Não implementar itens de `MELHORIAS_FUTURAS.md`** nesta versão.
7. **`migrateSave` sempre** ao adicionar campo novo em `ClubFinance` — sem migrate, saves antigos quebram.
