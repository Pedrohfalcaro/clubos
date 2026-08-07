# ClubOS ↔ Financial Update — Conexão de Projeto

## Identidade do módulo

| Campo | Valor |
|-------|-------|
| **Nome do produto** | **ClubOS Financial Update** |
| **Nome curto** | **financial-v1.3** |
| **Slogan** | *Seu dinheiro em um só lugar.* |
| **Papel no ClubOS** | Camada de inteligência financeira (analytics, rating, orçamento) sobre o motor econômico já existente |
| **Pasta atual** | `FinancialUpdate - Desenvolvimento/` |
| **Destino** | Extensão de `ClubFinance` no `GameState` (não é módulo satélite como o Pulse) |

---

## O que é cada parte

### ClubOS
Gerenciador de carreira: clube, elenco, temporada, partidas, **finance** (`ClubFinance`). Fonte da verdade de todos os dados.

### Financial Update (v1.3)
**Não é um motor econômico novo.** O motor (bilheteria, folha, empréstimos, dívidas, patrocínios, premiações) já existe e permanece intocado — ver `docs/HANDOFF_FINANCEIRO_CLAUDE.md`. O Financial Update adiciona três camadas que **leem** esse motor:

- **Analytics** — agrega o `ledger` existente em séries mensais/projeções para os gráficos e KPIs.
- **Rating** — deriva um score de saúde financeira a partir de dados que já existem (`balance`, `debts`, `wageBill`), sem novo tracker persistente de eventos.
- **Orçamento** — adiciona um teto opcional (`monthlyBudget.targetExpenseLimit`) e observa o `ledger` para saber se foi estourado; não introduz um novo tipo de lançamento.

Como o Pulse, ele lê estado do ClubOS e escreve de volta via actions do reducer — mas, diferente do Pulse, **não tem pasta própria em `src/`**: vive espalhado em `types/Finance.ts`, `utils/financeAnalytics.ts`, `utils/financialHealth.ts` e `components/Finance/*`.

---

## Contrato de integração — Analytics (`utils/financeAnalytics.ts`)

```
input:
  finance.ledger: FinanceLedgerEntry[]   // fonte única — nunca duplicar em outro campo
  state.currentDate: string | null       // se null (carreira sem LiveLife), analytics retorna séries vazias
  state.players: Player[]                // para wageBill() na projeção

output (funções puras, sem dispatch):
  getMonthlyCashFlow(ledger, currentDate, months)         → { month, income, expense }[]
  getCategoryBreakdown(ledger, monthKey)                  → { monthKey, groups: { group, total }[], total }
  getCashFlowProjection({ finance, players, currentDate }, monthsAhead)
                                                           → { month, projectedIncome, projectedExpense }[]
    // projectedIncome = cota mensal de sponsors ativos (receita)
    // projectedExpense = wageBill + parcelas de debts ativas + loanPayments pendentes do mês
  percentChange(current, previous)                        → number | null
```

---

## Contrato de integração — Rating (`utils/financialHealth.ts`)

```
input:
  finance.balance: number
  finance.debts: ClubDebt[]              // wage_overdraft = proxy de atraso de folha
  state.players: Player[]                // wageBill()
  state.currentDate: string | null

output:
  computeFinancialHealth(state) → FinancialHealth { score, rating, creditLimit, computedAt }

persistência:
  finance.health: FinancialHealth        // cacheado, não recalculado a cada render

checkpoints de recomputo (únicos pontos que chamam a função):
  - load do save (storage.ts)
  - fim de ADVANCE_DAY
  - fim de PAY_WAGES / payWagesWithBridgeLoan
  - fim de payClubDebt
```

---

## Contrato de integração — Orçamento (`SET_MONTHLY_BUDGET`)

```
input (action):
  { type: 'SET_MONTHLY_BUDGET', targetExpenseLimit: number }

output:
  finance.monthlyBudget: MonthlyBudget { targetExpenseLimit, updatedAt }
  // currentSpent NUNCA é persistido — sempre getCategoryBreakdown(ledger, mês atual)

efeito colateral (em ADVANCE_DAY, ao virar o mês):
  se getCategoryBreakdown(mês anterior).total > targetExpenseLimit:
    → delta negativo em board.confidence (mesma família de magnitude de dailyClimateDrift)
    → cooldown mensal: chave 'budget:YYYY-MM' (mesmo padrão de pressTriggers finance:YYYY-MM)
```

---

## Contrato de integração — UI (`components/Finance/*`)

```
input:
  state.finance                          // balance, ledger, monthlyBudget, health
  state.players                          // wageBill
  state.board                            // para exibir rating no resumo

output:
  render puro + dispatch apenas das actions já existentes (applyLedger, SET_MONTHLY_BUDGET)
  nenhum novo estado local persistido fora do reducer
```

---

## O que o Financial Update NÃO é responsável por

- Recriar ou alterar bilheteria, folha, empréstimos, dívidas, patrocínios ou premiações — já entregues na v1.2 (Camada A/B do handoff financeiro).
- Conversão cambial real — decisão já tomada de não implementar.
- Ofertas dinâmicas de patrocínio geradas por narrativa — fica no backlog (`MELHORIAS_FUTURAS.md`).
- CT/infraestrutura como investimento — fora de escopo desta versão.
- IDs próprios — sempre reutiliza IDs do ClubOS (`ledger[].id`, `debts[].id`, etc.).
