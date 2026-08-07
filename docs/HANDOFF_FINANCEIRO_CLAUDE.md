# HANDOFF — Sistema financeiro ClubOS (para Claude)

> **Audiência:** Claude / agente Cursor que vai continuar o trabalho **sem** precisar vasculhar o repositório.  
> **Escopo:** financeiro LiveLife + como ele se encaixa no ClubOS.  
> **Data desta passagem:** 2026-08-07 (Financial Update v1.3 entregue — ver Camada D, §1).  
> **Doc irmão (mais “manual de produto”):** `docs/sistema-financeiro.md` (§12 cobre a v1.3 em detalhe).  
> **Plano/contrato/manual da v1.3:** `FinancialUpdate - Desenvolvimento/`.

Se você só ler **este** arquivo, deve conseguir: entender o modelo, saber onde cada feature mora, aplicar mudanças sem quebrar invariantes e não reinventar o que já existe.

---

## 0. Contexto do produto (30 segundos)

**ClubOS** = companion do Modo Carreira (EA FC/FIFA). O usuário joga no console/PC; aqui gerencia elenco, finanças, transferências, diretoria, calendário contínuo e narrativa.

Stack: **Vite + React + TypeScript**, estado global em **`GameContext`** (`useReducer`), persistência em **`storage.ts`** (localStorage + cloud), UI em **`src/pages/*`** + CSS modules.

Regra de ouro: **`finance.balance` e `team.budget` devem permanecer iguais.** Quase todo reducer financeiro atualiza os dois.

App coach: rota financeira = **`/financas`**. Código da página: `src/pages/Finance/Finance.tsx`.

---

## 1. Linha do tempo — o que entrou e quando

Use isto para saber o que é “core MVP” vs “expansão recente”.

### Camada A — LiveLife MVP (v1.2 base)

| Feature | O que faz |
|---------|-----------|
| Calendário contínuo + Avançar Dia | `currentDate` avança 1 dia; dispara efeitos |
| Bilheteria pós-jogo | Casa / fora / neutro → `ticket` + custos |
| Premiação win/draw | Ao finalizar partida, se `prizeTable` tiver valor |
| Folha no dia 5 | Modal no Dashboard (`payrollDue`) |
| Estádio configurável | Sem config → **zero** bilheteria automática |
| Moeda BRL/EUR/GBP/USD | Só símbolo/formatação (sem câmbio) |
| Extrato (`ledger`) | Fonte da verdade das movimentações |
| Seed LiveLife | Preenche estádio + prize table template se vazios |

### Camada B — Expansões econômicas (pós-MVP deste ciclo, ~2026-08-02)

| Feature | O que faz |
|---------|-----------|
| **Empréstimos bancários** | Crédito entra no caixa agora; parcelas no calendário; popup ao vencer |
| **Empréstimo-ponte da folha** | Se caixa &lt; folha no dia 5: opção “Emprestar e pagar” (120% folha, 12%, 6x) |
| **Dívidas** | Passivo com parcela no dia 1–28; ignorar = +2,5% juros; folha sem caixa vira dívida |
| **Patrocínios Master/Manga** | Cota no dia escolhido; bônus no fim da temporada; cláusula + rescisão |
| **Janela de transferências** | Compra/venda/empréstimo só em janelas; fora = só renovar |
| **Coletiva crise financeira** | Trigger 1×/mês se caixa crítico |
| **Premiação knockout/champion** | Ao avançar fase em Competições (não no fim do jogo) |
| **Migração bilheteria absurda** | Corrige saves com fórmula antiga visitante/neutro |

### Camada C — Ajustes recentes no motor de bilheteria (`finance.ts`)

| Mudança | Motivo |
|---------|--------|
| `GATE_RULES` (capacidades base fixas) | Visitante/neutro não usam “fans/2” sem teto |
| Cota casa 90% · fora 10% de 40k · neutro 50% de 60k | Regras LiveLife documentadas |
| Lotação = moral da torcida × jitter | Público realista |
| `migrateAbsurdGateRevenue` | Sanea saves antigos no load |
| `normalizeStadiumConfig` | Remove campos legados de capacidade adversário no save |

### Camada D — Financial Update (v1.3, 2026-08-07)

Camada de **inteligência + redesign visual** sobre o motor A/B/C, que continua intocado. Nada aqui recria bilheteria/folha/empréstimos/dívidas/patrocínios/premiações.

| Feature | O que faz |
|---------|-----------|
| **Dashboard da Visão geral** | Header executivo (saudação, seletor de período), 5 KPI cards com variação %, gráfico de fluxo de caixa (6 meses + projeção de 3), orçamento mensal (barra + breakdown por categoria), rosca de despesas, barras receita/despesa, ranking de maiores lançamentos |
| **Teto de gastos mensal** | `finance.monthlyBudget`, opt-in; estourar penaliza confiança da diretoria 1×/mês e pode abrir coletiva |
| **Rating bancário** | `finance.health` (score 0–100 → `AAA`..`F`), cacheado, recalculado só em checkpoints (`utils/financialHealth.ts`) |
| **Extrato V2** | Ícone por tipo de lançamento + busca textual (aba Extrato) |
| `formatMoney` com faixas T/Qa | Corrigido incidentalmente — faltava faixa acima de Bilhão, lançamentos muito grandes apareciam com texto quebrado |

Ver `docs/sistema-financeiro.md` §12 para o detalhe completo (fórmulas, arquivos, invariantes).

---

## 2. Modelo mental — como o dinheiro se move

```
qualquer evento financeiro
  → cria FinanceLedgerEntry (amount +/−)
  → balance += amount
  → team.budget = balance
  → ledger.unshift(entry)
```

**Não** recalcule o saldo só pelo ledger em runtime (exceto util `balanceFromLedger` e migrações). O saldo é mutado incrementalmente.

Tipos de lançamento (completos):

| `type` | Quando nasce |
|--------|----------------|
| `ticket` | Pós-jogo (bilheteria) |
| `stadium_ops` | Pós-jogo casa (manutenção) |
| `travel` | Pós-jogo fora/neutro |
| `prize` | Pós-jogo win/draw **ou** avanço de mata-mata |
| `wage` | Pagar folha |
| `loan_credit` | Contratar empréstimo / ponte |
| `loan_repay` | Pagar parcela de empréstimo |
| `debt_repay` | Amortizar/quitar dívida |
| `sponsor` | Cota mensal ou bônus de temporada |
| `transfer_fee` / `loan_fee` | Transferência de atleta |
| `other_in` / `other_out` | Lançamento manual, Pulse, multa patrocínio |
| `adjustment` | Ajuste de caixa na Diretoria |

Objeto raiz: **`ClubFinance`** em `src/types/Finance.ts`.

```
ClubFinance {
  balance, currency,
  prizeTable, ledger,
  stadiumConfig?,
  loans?, loanPayments?,
  debts?, sponsors?
}
```

---

## 3. Features — o que cada uma faz (completo)

### 3.1 Caixa e extrato

- Página `/financas` → abas Visão geral + Extrato.
- Lançamento manual: modal “+ Lançamento” → `applyLedger`.
- Visão geral (v1.3): 5 KPI cards (caixa, receita/despesa do período com variação %, margem, runway), gráfico de fluxo de caixa + projeção, orçamento mensal, breakdown de despesas por categoria, ranking de maiores lançamentos. Ver §3.11–3.13.
- Formatação: `formatMoney` (K/M/B/T/Qa) em `src/utils/finance.ts`.

### 3.2 Folha salarial

- Soma: `wageBill(players)` = Σ `player.salary`.
- Edição de salário: aba Folha em Finanças (`updatePlayer`).
- Cobrança: **todo dia 5** ao Avançar Dia → `payrollDue = true` → modal Dashboard.
- Ações do modal:
  1. **Emprestar e pagar** → `payWagesWithBridgeLoan()` (só se shortfall &gt; 0).
  2. **Pagar (vira dívida)** / **Pagar folha** → `payWages()`: se `balance - bill < 0`, zera caixa e cria dívida `wage_overdraft` com o faltante.
  3. **Adiar** → `dismissPayroll()`: moral −15 nos que têm salário (`PAYROLL_DELAY_MORALE_HIT`).

### 3.3 Empréstimos bancários

Arquivo: `src/utils/clubLoans.ts` · UI: aba Empréstimos · cobrança: Dashboard.

| Peça | Comportamento |
|------|----------------|
| Contratar | `createClubLoanPackage` → crédito `loan_credit` = principal; parcelas `pending` |
| Juros | Total = principal × (1 + %); mínimo 0,5% na UI |
| Parcelas | Datas via `buildInstallmentDates`; valores via `splitInstallmentAmounts` |
| Vencimento | Flag `loanPaymentsDue`; modal paga com `loan_repay` |
| Quitação | Quando todas parcelas `paid` → loan `status: 'paid'` |
| Ponte folha | Principal = `wageBill * 1.2`, juros 12%, 6 parcelas, 1ª = +1 mês |

**Importante:** crédito entra **na hora**. Parcelas só saem no dia (popup). Não debitar antecipado.

### 3.4 Dívidas

Arquivo: `src/utils/clubDebts.ts` · UI: aba Dívidas (+ Diretoria pode criar).

| Peça | Comportamento |
|------|----------------|
| Criar | **Não** mexe no caixa; só registra passivo |
| Fontes | `manual` \| `wage_overdraft` |
| Parcela | Dia 1–28; `monthlyInstallment`; marca `lastInstallmentMonth` ao tratar |
| Pagar | `debt_repay` + reduz `remaining` |
| Ignorar no Dashboard | `skipDebtInstallment`: +2,5% sobre restante (`DEBT_SKIP_INTEREST_RATE = 0.025`) |
| Calendário | Marca o dia do mês da parcela |

### 3.5 Patrocínios

Arquivo: `src/utils/sponsors.ts` · UI: aba Patrocínios.

| Peça | Comportamento |
|------|----------------|
| Tiers | **Um** Master ativo + **um** Manga ativo |
| Cota | No `paymentDay` (1–28), ao Avançar Dia → `applyMonthlySponsorPayments` → `sponsor` |
| Bônus | Avaliados em **`settleSponsorsForSeason`** (fim de temporada): classificação, título, artilheiro do clube |
| Cláusula | Se posição na liga &gt; `minLeaguePosition` → `terminated` + multa `other_out` |
| Renovar / rescindir | UI; rescisão antecipada cobra `terminationFee` |

Nota: a lista antiga de melhorias dizia “cota no dia 5”; **código atual** usa o dia configurável do contrato.

### 3.6 Estádio e bilheteria

Arquivo: `src/utils/finance.ts` → `calcGateRevenue`.

Só roda se `isStadiumConfigured` (capacity &gt; 0 e algum preço &gt; 0).

| Local | Receita | Custo |
|-------|---------|-------|
| `home` | até 90% capacidade × `ticketPriceHome` × fill | `maintenanceCostPerMatch` → `stadium_ops` |
| `away` | até 4.000 × `ticketPriceAway` × fill | `travelCostAverage` → `travel` |
| `neutral` | até 30.000 × `ticketPriceHome` × fill | `travelCostAverage` → `travel` |

Fill: `supporterFillRate(supporterConfidence)` ∈ [0.05, 1], × jitter [0.92, 1.05] (exceto migração `jitter=false`).

Constantes fixas (não na UI):

```
GATE_RULES = {
  awayStadiumCapacity: 40000,
  neutralStadiumCapacity: 60000,
  homeSpaceShare: 0.9,
  awayQuotaShare: 0.1,
  neutralQuotaShare: 0.5,
}
```

Defaults por moeda: `createDefaultStadiumConfig` / `stadiumTemplate` em `livelifeTemplates.ts`.

### 3.7 Premiações

| Campo | Quando credita |
|-------|----------------|
| `win` / `draw` | Finalizar partida (`applyMatchPrize`) — **não** em derrota |
| `knockout` | Avançar fase mata-mata em Competições (vitória, não final) |
| `champion` | Avançar fase marcada como final |

Templates por tipo de competição (liga, copa, continental…): `prizeTemplate` + escala por moeda (`CURRENCY_SCALE`).

### 3.8 Transferências (impacto financeiro)

- Taxa imediata e/ou parcelas (`pendingPayments` em `state.transfers`, **não** em `finance`).
- Ledger: `transfer_fee` ou `loan_fee`.
- Modal Dashboard quando parcela vence (`transferPaymentsDue`).
- Renovação: pode gerar bônus no ledger + novo salário.

### 3.9 Pulse e coletivas

- Pulse: `financePatch: { amount, label }` → lançamento `other_in`/`other_out`.
- Coletiva crise: `findFinancePressOpportunity` — caixa negativo, &lt; 50% da folha, runway &lt; 1, ou estouro do teto de gastos (v1.3); chave mensal `finance:YYYY-MM`.

### 3.10 Diretoria

- Editar “orçamento” = delta no caixa via `adjustment`.
- Pode registrar dívida sem injetar dinheiro.
- Checklist LiveLife aponta gaps (estádio, prêmios, salários…).
- Aba Temporada mostra badge de **rating financeiro** (v1.3, §3.12) no resumo.

### 3.11 Teto de gastos mensal (v1.3)

Arquivo: reducer `SET_MONTHLY_BUDGET` em `GameContext.tsx` · UI: modal no header de Finanças.

| Peça | Comportamento |
|------|----------------|
| Definir | `finance.monthlyBudget = { targetExpenseLimit, updatedAt }` — opt-in, sem default forçado |
| Consumo do mês | **Nunca persistido.** Sempre `getCategoryBreakdown(ledger, mêsAtual).total` (`utils/financeAnalytics.ts`) |
| Estouro | Checado em `ADVANCE_DAY` na virada de mês (dia 1) contra o mês que fechou |
| Penalidade | Confiança da diretoria −6 (suavizado por `softScaleDelta`, igual pós-jogo), 1×/mês, chave `budget:YYYY-MM` em `livelife.pressSpecialDoneKeys` |
| Efeito extra | Pode abrir coletiva `finance_crisis` com motivo “estouro do teto” (§3.9) |

**Por quê `currentSpent` não é salvo:** um segundo campo de "quanto já foi gasto" corre o risco de dessincronizar do ledger real — a mesma classe de bug que a regra `team.budget === finance.balance` já existe pra evitar. Sempre derive, nunca persista.

### 3.12 Rating bancário — `FinancialHealth` (v1.3)

Arquivo: `src/utils/financialHealth.ts` · UI: badge na Diretoria (aba Temporada).

| Peça | Comportamento |
|------|----------------|
| Score | 0–100: até 40 pts runway (teto 6 meses), até 35 pts adimplência (menos `wage_overdraft` recentes, melhor), até 25 pts relação dívida/caixa |
| Rating | `score` → `AAA`\|`AA`\|`A`\|`BBB`\|`BB`\|`B`\|`CCC`\|`D`\|`F` (thresholds em `RATING_THRESHOLDS`) |
| `creditLimit` | Sugestão de teto para novos empréstimos — calculado mas **não gatekeeping** nenhuma ação hoje |
| Cache | `finance.health`, recalculado só em: load do save, fim de `ADVANCE_DAY`, fim de `PAY_WAGES`/`PAY_WAGES_WITH_BRIDGE_LOAN`, fim de `PAY_CLUB_DEBT` |

**Importante:** ponte da folha (empréstimo-emergência) **nunca é bloqueada por rating** — é a válvula de escape; bloquear criaria um ciclo sem saída (rating baixo → sem ponte → folha atrasa → rating pior).

### 3.13 Dashboard da Visão geral (v1.3)

Arquivos: `src/components/Finance/*` (`FinanceHeader`, `KpiCard`, `CashFlowChart`, `MonthlyBudgetCard`, `CategoryDonutChart`, `IncomeExpenseBarChart`, `TopEntriesList`, `FinanceLedgerTab`) + `financeAnalytics.ts`.

- Seletor de período no header (`month`\|`6months`\|`season`\|`all`) controla os KPIs de receita/despesa/margem e as visualizações por categoria/ranking — **não** afeta o gráfico de fluxo de caixa (sempre 6 meses + projeção) nem o rating (não é "por período").
- Todos os gráficos são SVG custom — sem lib nova (decisão de arquitetura, ver `FinancialUpdate - Desenvolvimento/CLUBOS_CONEXAO.md`).
- `usePeriodEntries` (em `FinanceOverviewTab.tsx`) é a fonte única dos lançamentos do período selecionado — KPIs, breakdown de categoria, rosca e ranking derivam todos dela, sem recalcular o recorte 4 vezes.

---

## 4. Ordem dos modais no Dashboard (não mude de leve)

Prioridade de exibição (condições no JSX):

1. **Folha** (`payrollDue`)
2. **Parcelas de transferência** (se não há folha)
3. **Parcelas de empréstimo** (se não há folha nem transferência)
4. **Parcelas de dívida** (só se nenhum dos anteriores)

Ao Avançar Dia, as flags são ligadas se houver vencimento na `nextDate`.

---

## 5. Onde cada coisa aparece na UI

| Superfície | O que o jogador vê / faz |
|------------|---------------------------|
| `/financas` | Hub completo (8 abas) |
| `/dashboard` | Caixa, runway, últimos lançamentos, modais de cobrança, CTA coletiva financeira |
| `/calendario` | Folha dia 5, empréstimos por data, dívidas/patrocínios por dia do mês |
| `/transferencias` | Caixa + taxas + parcelas |
| `/diretoria` | Ajuste de caixa, dívida, checklist LiveLife, resumo temporada |
| `/competitions` | Premiação knockout/champion ao avançar fase |
| `/press-conference` | Crise financeira |
| ClubOSocial | Manchetes de transferência (valores) |

---

## 6. Arquivos — índice “mexa aqui”

Não precisa abrir o resto do repo para a maioria das tarefas financeiras.

| Arquivo | Responsabilidade |
|---------|------------------|
| `src/types/Finance.ts` | Tipos, defaults, símbolos de moeda |
| `src/utils/finance.ts` | Formatação, bilheteria, prize de jogo, migração, labels |
| `src/utils/clubLoans.ts` | Empréstimo + ponte (constantes 12% / 6x / 120%) |
| `src/utils/clubDebts.ts` | Dívidas, juros 2,5%, moral −15, dias de pagamento |
| `src/utils/sponsors.ts` | Cota mensal, settle de temporada, renew |
| `src/utils/livelifeTemplates.ts` | Seed estádio/prêmios, gaps LiveLife |
| `src/utils/transferPayments.ts` | Datas/split de parcelas (compartilhado) |
| `src/utils/pressTriggers.ts` | Trigger coletiva financeira |
| `src/utils/competitionEngine.ts` | Cálculo prize knockout/champion |
| `src/utils/historyScope.ts` | Extrato por temporada no Dashboard |
| `src/utils/financeAnalytics.ts` | **(v1.3)** `getMonthlyCashFlow`, `getCashFlowProjection`, `getCategoryBreakdown`/`sumExpensesByCategory`, `percentChange` — puro |
| `src/utils/financialHealth.ts` | **(v1.3)** `computeFinancialHealth` — rating bancário |
| `src/context/GameContext.tsx` | **Todos** os reducers e APIs (`applyLedger`, `payWages`, loans, debts, sponsors, `SET_MONTHLY_BUDGET`, ADVANCE_DAY, fim de jogo) |
| `src/pages/Finance/Finance.tsx` | Shell das 8 abas |
| `src/components/Finance/*` | **(v1.3)** Header, dashboard, gráficos, extrato — ver `sistema-financeiro.md` §12.3 |
| `src/pages/Dashboard/Dashboard.tsx` | Modais + hub |
| `src/pages/Calendar/Calendar.tsx` | Marcadores |
| `src/pages/Transfers/Transfers.tsx` | Taxas de mercado |
| `src/pages/Board/Board.tsx` | Ajuste caixa / dívida / checklist / badge de rating (v1.3) |
| `src/pages/Competitions/Competitions.tsx` | applyLedger de mata-mata |
| `src/services/storage.ts` | Load/save + `migrateAbsurdGateRevenue` + preenche `finance.health` se ausente |
| `src/pulse/generator.ts` | `financePatch` |
| `src/components/MoneyAmountHint/*` | Valor por extenso em inputs |

Rota: `App.tsx` → `/financas`.

---

## 7. APIs do `useGame()` (financeiro)

```
applyLedger(entry)
payWages()
payWagesWithBridgeLoan() → boolean
dismissPayroll()
setPrizeTable(competition, prize)
updateFinance(partial)
takeClubLoan({ principal, interestRatePercent, installmentCount, firstPaymentDate, notes? })
payLoanPayment(paymentId)
dismissLoanPayments()
addClubDebt({ amount, monthlyInstallment, paymentDay, label? })
payClubDebt(debtId, amount, asMonthlyInstallment?)
dismissDebtPayments()
addClubSponsor(...) → boolean  // false se tier já ativo
renewClubSponsor(id, extraSeasons?)
terminateClubSponsor(id)
setMonthlyBudget(targetExpenseLimit)  // v1.3
```

Flags de estado: `payrollDue`, `transferPaymentsDue`, `loanPaymentsDue`, `debtPaymentsDue`.

---

## 8. Constantes — cola rápida

| Constante | Valor | Arquivo |
|-----------|-------|---------|
| Ponte: % da folha | 120% | `clubLoans.ts` |
| Ponte: juros | 12% | `clubLoans.ts` |
| Ponte: parcelas | 6 | `clubLoans.ts` |
| Juros skip dívida | 2,5% | `clubDebts.ts` |
| Moral atraso folha | −15 | `clubDebts.ts` |
| Dia padrão pagamento | 5 (clamp 1–28) | `clubDebts.ts` |
| Capacidade adversário | 40.000 | `finance.ts` GATE_RULES |
| Capacidade neutro | 60.000 | idem |
| Cota casa / fora / neutro | 90% / 10% / 50% | idem |
| Budget default criação | 5.000.000 | `createDefaultFinance` / ClubCreate |
| Pulse diário (não financeiro) | ~20% dias sem jogo | LiveLife |
| Rating: peso runway / adimplência / dívida | 40 / 35 / 25 pts | `financialHealth.ts` |
| Rating: runway alvo p/ pontuação máxima | 6 meses | `financialHealth.ts` |
| Rating: atrasos p/ zerar adimplência | 3 em 6 meses | `financialHealth.ts` |
| Penalidade estouro de teto (confiança) | −6 (suavizado) | `GameContext.tsx` |

---

## 9. Invariantes e pegadinhas (leia antes de alterar)

1. **`team.budget === finance.balance`** após qualquer mutação financeira.
2. **Ledger: positivos = receita.** Despesas com `amount` negativo.
3. **Sem estádio configurado → sem bilheteria.** Não “inventar” ticket.
4. **Dívida ≠ empréstimo.** Dívida não injeta caixa; empréstimo sim (`loan_credit`).
5. **win/draw** no fim do jogo; **knockout/champion** só em Competições.
6. **Moeda não converte** valores antigos — só muda símbolo.
7. **Parcelas de transferência** vivem em `transfers.pendingPayments`, não em `finance.loanPayments`.
8. **Patrocínio:** no máximo 1 Master + 1 Manga ativos.
9. **Migração de bilheteria** roda no load (`storage.ts`) — não remova sem substituto.
10. **Seed** (`seedLiveLifeFinance`) no START_CAREER e load — preenche vazios; não sobrescreve configs já preenchidas.
11. Ao criar lançamento, use **`newLedgerEntry`** e passe `gameDate` (`currentDate`) quando existir — datas do extrato devem ser do **calendário do jogo**, não do relógio real.
12. Prioridade dos modais do Dashboard: alterar ordem quebra UX de cobrança.
13. **`monthlyBudget.currentSpent` não existe como campo salvo** — sempre derivar do `ledger` (v1.3).
14. **`finance.health` só recalcula nos checkpoints do §3.12** — nunca a cada render, nunca em `APPLY_LEDGER` genérico, nunca em `UPDATE_COMPLETED_MATCH` (v1.3).
15. **Ponte da folha nunca é bloqueada por rating**, mesmo em `D`/`F` — é a válvula de emergência (v1.3).
16. **Nunca nomear propriedade de hook como `current`/`previous` sozinho** — o React Compiler deste projeto (eslint-plugin-react-hooks v7) trata `.current` como acesso de `ref` e recusa memoizar o componente. Use nomes como `inPeriod`/`previousPeriod` (v1.3, achado em `FinanceOverviewTab.tsx`).

---

## 10. Fluxos ponta a ponta (colar mental)

### Nova carreira
`ClubCreate.budget` → `createDefaultFinance(budget, currency)` → `seedLiveLifeFinance` (estádio + prizeTable) → save.

### Avançar Dia
+1 dia → recupera lesões → se dia 5 e há folha: `payrollDue` → paga cotas de patrocínio do dia → seta flags de parcelas vencidas → pode Pulse / Story Arc.

### Finalizar partida
`calcGateRevenue` + `applyMatchPrize` → entries no ledger → atualiza balance/budget → (social etc.).

### Fim de temporada
`settleSponsorsForSeason` (bônus, rescisão, −1 temporada) → histórico de temporada guarda balance/income/expense.

---

## 11. O que ainda NÃO está feito (backlog próximo ao financeiro)

De `LiveLife - Desenvolvimento/MELHORIAS_FUTURAS.md`, `FinancialUpdate - Desenvolvimento/MELHORIAS_FUTURAS.md` e gaps conhecidos:

- Avançar Dia em **lote** (pausar em jogos/dia 5/estouro de teto)
- Notificações PWA (folha / jogo / mudança de rating)
- Patrocínios mais “dinâmicos” de narrativa (ofertas aleatórias, melhores termos por rating) — o contrato Master/Manga já existe; ofertas geradas pelo jogo ainda são limitadas ao Pulse/`other_*`
- CT / infraestrutura como investimento (não implementado)
- Conversão cambial real (não existe e provavelmente não deve existir no curto prazo)
- Rating bancário **não gateia** juros/limite de empréstimo na UI ainda (só sugere `creditLimit`, não bloqueia nem oferece taxa diferenciada)
- Meta de diretoria atrelada a rating (`BoardGoalKind` novo)

Se o usuário pedir “melhorar finanças”, **não** reimplemente empréstimos/dívidas/patrocínios **nem** o dashboard/rating/teto de gastos — já estão entregues (Camadas A–D, seção 1).

---

## 12. Como trabalhar neste módulo (procedimento)

1. Preferir alterar utils puros (`finance`, `clubLoans`, `clubDebts`, `sponsors`) e chamar do reducer — não espalhar fórmulas na UI.
2. UI só dispara APIs do context; formatação via `formatMoney` / `MoneyAmountHint`.
3. Novos tipos de lançamento: adicionar em `LedgerEntryType` + `ledgerEntryTypeLabel` + filtros da página Finance (`INCOME_TYPES` / `EXPENSE_TYPES`).
4. Novos campos em `ClubFinance`: tipar → default em `createDefaultFinance` → migrate no `storage.ts` → seed se necessário → UI.
5. Testar mentalmente: load de save antigo, dia 5 sem caixa, bilheteria sem estádio, patrocínio duplicado de tier.
6. Documentação de produto: atualizar `docs/sistema-financeiro.md` se mudar comportamento; este handoff se mudar regras/arquitetura.

---

## 13. Snippets de verdade (comportamento canônico)

**Ponte da folha — quando sugerir:**
```
needed se wageBill > 0 && balance < wageBill
principal = round(wageBill * 1.2)
juros = 12%, parcelas = 6, 1ª = +1 mês
```

**Folha sem caixa:**
```
balance -= bill
se balance < 0:
  criar dívida(amount = -balance, source=wage_overdraft, parcela≈/6, dia 5)
  balance = 0
```

**Bilheteria casa:**
```
quota = floor(capacity * 0.9)
attendance = min(quota, round(quota * fill * jitter))
gross = round(attendance * ticketPriceHome)
ops = round(maintenanceCostPerMatch)
```

**Ignorar dívida:**
```
interest = max(1, round(remaining * 0.025))
remaining += interest
accruedInterest += interest
lastInstallmentMonth = YYYY-MM
```

**Rating bancário (v1.3):**
```
runwayScore      = (runway==Infinity ? 1 : clamp01(runway/6)) * 40
punctualityScore = clamp01(1 - atrasosFolha6Meses/3) * 35
debtRatioScore   = clamp01(1 - dívidaRestante/max(balance,1)) * 25
score  = round(soma)  // 0–100
rating = score>=90 AAA · >=80 AA · >=70 A · >=60 BBB · >=50 BB · >=40 B · >=25 CCC · >=10 D · senão F
```

**Estouro de teto (v1.3, em `ADVANCE_DAY` na virada de mês):**
```
se monthlyBudget definido e getCategoryBreakdown(mêsFechado).total > targetExpenseLimit:
  se chave budget:YYYY-MM ainda não usada:
    boardConfidence += softScaleDelta(boardConfidence, -6)
    marca budget:YYYY-MM em livelife.pressSpecialDoneKeys
```

---

## 14. Docs relacionados (opcional; este handoff já cobre o essencial)

| Doc | Uso |
|-----|-----|
| `docs/sistema-financeiro.md` | Manual detalhado do sistema |
| `docs/livelife-v1.2.md` | Visão da atualização LiveLife |
| `docs/guia-de-uso.md` | Como jogar tela a tela |
| `docs/INSTRUCOES_LIVELIFE_V1_2.md` | Spec original (algumas ideias viraram backlog) |
| `LiveLife - Desenvolvimento/MELHORIAS_FUTURAS.md` | Backlog + histórico 2026-08-02 |
| `FinancialUpdate - Desenvolvimento/plano_de_desenvolvimento.md` | Plano modular da v1.3 (diagnóstico, decisões de arquitetura, 9 fases) |
| `FinancialUpdate - Desenvolvimento/CURSOR_MANUAL.md` | Passo a passo de implementação da v1.3, arquivo por arquivo |
| `FinancialUpdate - Desenvolvimento/CLUBOS_CONEXAO.md` | Contrato de integração da v1.3 (analytics, rating, orçamento) |
| `FinancialUpdate - Desenvolvimento/MELHORIAS_FUTURAS.md` | Backlog específico da v1.3 |
| `.cursor/skills/clubos-novo-modulo/SKILL.md` | Como integrar módulos novos no ClubOS |

---

## 15. Mensagem final para o próximo Claude

O financeiro **já é um sistema completo** de caixa LiveLife: ledger, bilheteria, folha, empréstimos, dívidas, patrocínios, premiações, integração com Dashboard/Calendário/Transferências/Competições/Pulse — **e agora (v1.3) também** um dashboard analítico (KPIs, fluxo de caixa projetado, orçamento mensal, categorização de despesas), rating bancário e teto de gastos.

Antes de criar feature nova:
- Verifique se já não existe nas **Camadas A–D** (seção 1) — inclusive o dashboard/rating/orçamento da v1.3.
- Preserve as **invariantes** (seção 9), especialmente as 4 novas da v1.3 (`currentSpent` derivado, `health` só em checkpoints, ponte nunca bloqueada por rating, nomes de hook sem `current`/`previous` sozinhos).
- Coloque lógica em **utils** (`finance.ts`/`financeAnalytics.ts`/`financialHealth.ts`), efeito em **GameContext**, superfície em **Finance/Dashboard/Board**.

Se for só explicar ou depurar: comece por `ClubFinance` + `APPLY_LEDGER` / `PAY_WAGES` / `calcGateRevenue` para o motor de caixa, ou por `computeFinancialHealth` / `getMonthlyCashFlow` / `usePeriodEntries` (`FinanceOverviewTab.tsx`) para a camada analítica da v1.3 — o resto é especialização.
