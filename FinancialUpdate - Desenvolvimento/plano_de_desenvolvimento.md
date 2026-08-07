# ClubOS — Plano de Desenvolvimento Modular: Financial Update (v1.3)

> **Status (2026-08-07):** **Épico completo.** Fases 0–9 entregues, incluindo a Fase 7.5 (dashboard expandido, pedida pelo usuário fora da ordem original). `npm run build`/`npm run lint` no mesmo baseline do início (nenhum erro introduzido). Documentação de produto (`docs/sistema-financeiro.md`, os dois handoffs) atualizada.
> **Baseado em:** `docs/HANDOFF_CLUBOS_CLAUDE.md`, `docs/HANDOFF_FINANCEIRO_CLAUDE.md`, `docs/sistema-financeiro.md` (estado real do código) e `docs/financial-v1.3.md` (spec/pedido da atualização).
> **Convenção:** este plano segue o formato usado em [`LiveLife - Desenvolvimento/plano_de_desenvolvimento.md`](../LiveLife%20-%20Desenvolvimento/plano_de_desenvolvimento.md) — fases incrementais, cada uma jogável isoladamente.
> **Manual de portagem:** [`CURSOR_MANUAL.md`](./CURSOR_MANUAL.md) (ordem de edição arquivo a arquivo + checklist por fase) · **Contrato de integração:** [`CLUBOS_CONEXAO.md`](./CLUBOS_CONEXAO.md) · **Backlog fora de escopo:** [`MELHORIAS_FUTURAS.md`](./MELHORIAS_FUTURAS.md)

> **Lead Developer & Game Designer Perspective**
> A v1.2 já entregou um motor financeiro completo (ledger, bilheteria, folha, empréstimos, dívidas, patrocínios, premiações — ver §1). A v1.3 **não recria** esse motor: ela adiciona uma camada de *inteligência* (analytics, orçamento, rating de crédito) e um redesign visual em cima dele. Tratar como "repaginação + 3 mecânicas novas", não como reescrita.

---

## 0. Diagnóstico — o que já existe vs. o que a spec v1.3 pede

| Pilar da spec v1.3 | Estado atual (v1.2) | Arquivo principal |
|---|---|---|
| Ledger, saldo, `team.budget === finance.balance` | **Completo** | `types/Finance.ts`, `context/GameContext.tsx` (`APPLY_LEDGER` L2124) |
| Bilheteria, folha dia 5, empréstimos, dívidas, patrocínios, premiações | **Completo** (Camada A/B do handoff financeiro) | `utils/finance.ts`, `clubLoans.ts`, `clubDebts.ts`, `sponsors.ts` |
| Header executivo + saudação + seletor de período | **Ausente** — `Finance.tsx` tem título estático | `pages/Finance/Finance.tsx` (1404 linhas, 8 abas fixas) |
| KPI cards com variação % vs período anterior | **Ausente** — cards da aba "Visão geral" são valores absolutos, sem comparação | `Finance.tsx` L169+ |
| Gráfico de fluxo de caixa (linhas + projeção) | **Ausente** — **nenhuma lib de gráfico no projeto** (ver `package.json`) | n/a |
| Teto de gastos mensal | **Ausente** | `types/Finance.ts` |
| Rating bancário / score de crédito | **Ausente** | n/a |
| Extrato categorizado com ícones/busca | **Parcial** — já tem filtros Todos/Receitas/Despesas/Transferências/Folha | `Finance.tsx` aba "Extrato" |
| Changelog de versões na Diretoria | **Já existe uma seção de changelog** em Board — só precisa da entrada v1.3 | `pages/Board/Board.tsx` |

### Gargalos e riscos identificados antes de codar

1. **Sem lib de gráficos.** `package.json` só tem `firebase`, `jszip`, `react`, `react-dom`, `react-router-dom` como deps de runtime. Precisa de uma decisão explícita (ver §1) antes da Fase de gráficos.
2. **`currentSpent` como campo persistido (proposto na spec) é uma armadilha.** Duplicar "quanto já foi gasto no mês" como campo salvo cria uma 2ª fonte da verdade que pode dessincronizar do ledger real — a mesma classe de bug que a regra de ouro nº2 (`budget === balance`) já existe para evitar. **Decisão: `currentSpent` é sempre derivado do `ledger` via `useMemo`, nunca persistido.** Só `targetExpenseLimit` é salvo.
3. **Rating bancário depende de "adimplência da folha", que hoje não é rastreada como série temporal.** Mas dá pra derivar sem campo novo: cada dívida em `finance.debts` com `source === 'wage_overdraft'` já é, por definição, um atraso de folha histórico. Contar essas ocorrências nos últimos N meses substitui um tracker dedicado.
4. **`Finance.tsx` já tem 1404 linhas numa página só com 8 abas.** Adicionar header executivo + KPIs + gráfico + orçamento sem quebrar em subcomponentes vai deixar o arquivo inviável de manter. Fase 5 exige split em `components/Finance/*`.
5. **Regras de ouro continuam valendo integralmente**: `team.budget === finance.balance`; ledger positivo=receita; datas via `currentDate` do jogo (nunca `new Date()`); todo campo novo em `ClubFinance` precisa de default no factory + extensão do `migrateSave` + seed se aplicável.
6. **Não reimplementar o que já existe.** Empréstimos, dívidas, patrocínios e bilheteria já estão prontos (Camada B do handoff) — a v1.3 só **lê** esses dados para analytics/rating, não os reescreve.

---

## 1. Decisões de arquitetura (resolver antes de codar)

| Decisão | Escolha recomendada | Motivo |
|---|---|---|
| Lib de gráfico | **Nenhuma dependência nova** — componente SVG/CSS custom em `components/Finance/CashFlowChart` | Projeto hoje tem 4 deps de runtime; um gráfico de linha/barra com tooltip é implementável em SVG puro sem inflar bundle. Reavaliar `recharts` só se o gráfico precisar de interações complexas depois. |
| `MonthlyBudget.currentSpent` | **Derivado em runtime**, não persistido | Evita 2ª fonte da verdade (ver gargalo 2). Só `targetExpenseLimit` entra no save. |
| `FinancialHealth` (rating/score/creditLimit) | **Persistido, mas recalculado só em checkpoints** (`ADVANCE_DAY`, load do save, após pagar/atrasar folha) — não a cada render | Rating "piscando" a cada lançamento manual do extrato seria ruim para gameplay e para UI (usado para liberar/bloquear empréstimo). Cachear em `finance.health` e recalcular nos pontos que realmente mudam adimplência/runway/dívida. |
| Estrutura de `Finance.tsx` | Quebrar em subcomponentes por aba (`FinanceOverviewTab.tsx`, `FinanceLedgerTab.tsx`, etc.) dentro de `components/Finance/` | Arquivo atual já é o maior do módulo financeiro; crescer sem split o torna difícil de revisar. |
| Extrato V2 | Incremental sobre o filtro atual (Todos/Receitas/Despesas/Transferências/Folha) — adiciona busca textual + ícone por `LedgerEntryType`, não reescreve o motor de filtro | Já existe lógica de filtro funcionando; só precisa de UI em cima. |
| Trigger de estouro de teto | Reaproveitar o padrão de cooldown mensal já usado em `pressTriggers.ts` (`finance:YYYY-MM`) em vez de criar um sistema de cooldown paralelo | Consistência com o padrão existente de 1 evento/mês. |

---

## 2. Fases

### Fase 0 — Fundação documental *(esta etapa — já entregue, 2026-08-07)*

**Objetivo:** criar os documentos de contrato, plano e backlog antes de qualquer linha de código no app — mesma disciplina usada na LiveLife Update.

**Entregas:**
- `plano_de_desenvolvimento.md` (este arquivo) — diagnóstico, decisões de arquitetura, fases 1–9
- `CLUBOS_CONEXAO.md` — contrato de integração (analytics, rating, orçamento, UI) e o que o módulo **não** cobre
- `CURSOR_MANUAL.md` — passos de portagem arquivo a arquivo + checklist por fase, para o agente que for implementar
- `MELHORIAS_FUTURAS.md` — expansões identificadas durante o planejamento que ficam fora do MVP desta v1.3

---

### Fase 1 — Modelo de dados e migração

**Objetivo:** estender `ClubFinance` com os campos mínimos necessários para orçamento e rating, sem quebrar saves existentes.

**O que muda**

| Arquivo | Alteração |
|---|---|
| `src/types/Finance.ts` | Novos tipos: `FinancialRating`, `MonthlyBudget` (só `targetExpenseLimit` + `updatedAt`), `FinancialHealth` (`score`, `rating`, `creditLimit`, `computedAt`, `computedForDate`) |
| `src/types/Finance.ts` | `ClubFinance.monthlyBudget?: MonthlyBudget`, `ClubFinance.health?: FinancialHealth` |
| `src/services/storage.ts` | Estender `migrateSave` (não criar função de migração paralela): se `finance.monthlyBudget` ausente → não seta (teto é opt-in, sem default forçado); se `finance.health` ausente → calcula com `computeFinancialHealth` (Fase 3) e persiste |

```ts
export type FinancialRating = 'AAA' | 'AA' | 'A' | 'BBB' | 'BB' | 'B' | 'CCC' | 'D' | 'F';

export interface MonthlyBudget {
  targetExpenseLimit: number;
  updatedAt: string; // currentDate do jogo, não new Date()
}

export interface FinancialHealth {
  score: number;            // 0–100
  rating: FinancialRating;
  creditLimit: number;      // teto sugerido para novos empréstimos
  computedAt: string;       // currentDate no momento do cálculo
}
```

**Critério de pronto**
- `npm run build` sem erros.
- Save antigo (sem `monthlyBudget`/`health`) carrega normalmente; `health` é preenchido no load, `monthlyBudget` fica `undefined` até o usuário configurar.
- `team.budget === finance.balance` continua intacto (nenhum campo novo participa dessa invariante).

---

### Fase 2 — Motor de agregação (`utils/financeAnalytics.ts`, novo arquivo)

**Objetivo:** funções puras que transformam `ledger` em séries mensais, sem tocar em state. Base para KPIs, gráfico e teto.

```ts
// Agrupa o ledger em até N meses (mais recente por último), a partir de currentDate
getMonthlyCashFlow(ledger: FinanceLedgerEntry[], currentDate: string, months = 6):
  { month: string; income: number; expense: number }[]

// Soma despesas do mês corrente por grupo de categoria (para o teto e o breakdown)
getCategoryBreakdown(ledger: FinanceLedgerEntry[], monthKey: string):
  { group: 'payroll' | 'stadium_travel' | 'loans_debts' | 'transfers' | 'other'; total: number }[]

// Projeção simples dos próximos N meses: folha fixa (wageBill) + parcelas já
// agendadas em loanPayments/debts + cotas de patrocínio já contratadas
getCashFlowProjection(state: GameState, monthsAhead = 3):
  { month: string; projectedIncome: number; projectedExpense: number }[]

// % de variação vs período anterior, para os cards KPI
percentChange(current: number, previous: number): number | null // null = sem base de comparação
```

Mapeamento categoria → grupo (`LedgerEntryType` já existe, só precisa do agrupamento):

| Grupo | Tipos incluídos |
|---|---|
| `payroll` | `wage` |
| `stadium_travel` | `stadium_ops`, `travel` |
| `loans_debts` | `loan_repay`, `debt_repay` |
| `transfers` | `transfer_fee`, `loan_fee` |
| `other` | `other_out`, `adjustment` (parte despesa) |

**Critério de pronto**
- Funções 100% puras, testáveis sem store/render.
- `getMonthlyCashFlow` com ledger vazio retorna meses com `income: 0, expense: 0` (sem `NaN`/`undefined`).
- Performance: `useMemo` obrigatório nos componentes que chamam essas funções (ledger pode ter centenas de entradas em carreiras longas — requisito explícito da spec §6.2).

---

### Fase 3 — Rating bancário / score de crédito (`utils/financialHealth.ts`, novo arquivo)

**Objetivo:** `computeFinancialHealth(state): FinancialHealth`, determinística e barata (chamada só nos checkpoints da Fase 1).

**Fórmula proposta** (pesos ajustáveis em constantes, não hardcoded inline):

```
runwayScore     = clamp(runwayMonths(balance, wageBill) / 6, 0, 1) * 40   // até 40 pts
punctualityScore = clamp(1 - (atrasosDeFolha6Meses / 3), 0, 1) * 35        // até 35 pts
  // atrasosDeFolha6Meses = count(finance.debts, d => d.source === 'wage_overdraft'
  //                          && d.createdAt dentro dos últimos 6 meses de currentDate)
debtRatioScore  = clamp(1 - (totalDebtRemaining / max(balance, 1)), 0, 1) * 25 // até 25 pts

score = round(runwayScore + punctualityScore + debtRatioScore)  // 0–100
rating = score>=90?'AAA': score>=80?'AA': score>=70?'A': score>=60?'BBB':
         score>=50?'BB': score>=40?'B': score>=25?'CCC': score>=10?'D':'F'
creditLimit = rating in {AAA,AA} ? balance*2 : rating in {A,BBB} ? balance*1.5 :
              rating in {BB,B} ? balance*1 : rating==='CCC' ? balance*0.5 : 0
```

**Efeitos no jogo:**
- `pages/Finance` (aba Empréstimos): taxa de juros mínima sugerida no formulário passa a variar por rating (3–5% AAA/AA, escala até taxas "abusivas" em CCC, **bloqueado** em D/F com mensagem explicativa) — ajuste de UI/validação em `clubLoans.ts` ou na própria tela, não uma regra nova de motor.
- Empréstimo-ponte da folha (já existente, 120%/12%/6x) **não é bloqueado por rating** — é o mecanismo de emergência, não pode ficar preso em círculo (rating baixo → sem ponte → folha atrasa → rating pior).

**Critério de pronto**
- `computeFinancialHealth` chamada em: load do save (Fase 1), fim de `ADVANCE_DAY`, fim de `PAY_WAGES`/`payWagesWithBridgeLoan`, fim de `payClubDebt`.
- Save antigo sem histórico de dívidas → rating calculável sem exceptions (score baseado só em runway se não houver dívidas).
- Rating exibido não muda ao simplesmente abrir a página Finanças (só nos checkpoints acima).

---

### Fase 4 — Teto de gastos mensal (Budgeting)

**Objetivo:** treinador define um teto; UI mostra consumo; estourar repetidamente afeta a diretoria.

**O que muda**

| Arquivo | Alteração |
|---|---|
| `context/GameContext.tsx` | Nova action `SET_MONTHLY_BUDGET` (recebe `targetExpenseLimit`) |
| `pages/Finance` | Modal "Definir Teto de Gastos" (botão do header executivo) |
| `context/GameContext.tsx` (`ADVANCE_DAY`) | No fechamento de mês (dia 1, olhando o mês anterior): se `currentSpent(mês anterior) > targetExpenseLimit` → delta negativo de `board.confidence` (reaproveitar `dailyClimateDrift`/`calcMatchClimateDeltas` como referência de magnitude, não duplicar fórmula) + marca chave mensal `budget:YYYY-MM` para no máx. 1 evento/mês |
| `utils/pressTriggers.ts` | Opcional: reaproveitar `finance_crisis` incluindo "estouro de teto" como um dos gatilhos possíveis, em vez de criar contexto de coletiva novo |

**Critério de pronto**
- Sem `monthlyBudget` definido → nenhuma penalidade, nenhuma UI de progresso (feature é opt-in).
- Estourar o teto uma vez não gera múltiplas penalidades (idempotente por `YYYY-MM`).
- `currentSpent` nunca é lido de um campo salvo — sempre via `getCategoryBreakdown`/`getMonthlyCashFlow` (Fase 2).

---

### Fase 5 — Split de `Finance.tsx` + Header executivo + KPI cards

**Objetivo:** preparar a página para crescer sem virar um arquivo de 3000+ linhas, e entregar o redesign do topo.

**O que muda**

| Arquivo | Alteração |
|---|---|
| `pages/Finance/Finance.tsx` | Vira shell: header + tabs + roteia para subcomponentes |
| `components/Finance/FinanceOverviewTab.tsx` (novo) | Conteúdo atual da aba "Visão geral" + KPI cards novos |
| `components/Finance/FinanceLedgerTab.tsx` (novo) | Conteúdo atual da aba "Extrato" (base para Fase 7) |
| `components/Finance/FinanceHeader.tsx` (novo) | Saudação, seletor de período (Mês atual / 6 meses / Temporada / Histórico), botões rápidos (+ Lançamento existente, Solicitar Empréstimo → foca aba Empréstimos, Definir Teto → modal Fase 4) |
| `components/Finance/KpiCard.tsx` (novo) | Card genérico: valor, variação %, cor por tendência |

KPI cards (usando Fase 2/3): Caixa atual (+ % vs início da temporada), Receita do período (+ % vs período anterior), Despesa do período (+ % vs período anterior), Margem (`(receita-despesa)/receita`, com faixas Excelente/Alerta/Deficitário), Runway (já existe `runwayMonths`, só ganha badge verde/amarelo/vermelho).

**Critério de pronto**
- Abas Folha/Empréstimos/Dívidas/Patrocínios/Premiações/Estádio continuam funcionando sem alteração de comportamento (só possivelmente movidas de arquivo).
- Nenhuma regressão nos modais de cobrança do Dashboard (não mexe neles).
- `npm run build` + `npm run lint` limpos.

---

### Fase 6 — Gráfico de fluxo de caixa + projeção

**Objetivo:** gráfico de linhas/barras (receita vs despesa, últimos 6 meses) com projeção pontilhada de 3 meses e tooltip rico.

**O que muda**

| Arquivo | Alteração |
|---|---|
| `components/Finance/CashFlowChart.tsx` (novo) | SVG custom, sem lib externa (decisão §1); usa `getMonthlyCashFlow` + `getCashFlowProjection` |
| `components/Finance/CashFlowChart.module.css` (novo) | Paleta dark do ClubOS (ciano/verde receita, vermelho/laranja despesa, linha pontilhada para projeção) |

**Critério de pronto**
- Renderiza sem erro com 0, 1 e 6+ meses de histórico.
- Tooltip mostra maior receita e maior despesa do mês ao passar o mouse.
- Projeção some (ou fica vazia) se não houver `currentDate`/carreira LiveLife ativa (carreiras antigas sem clock).
- `useMemo` nos dados agregados — não recalcular a cada re-render do componente pai.

---

### Fase 7 — Extrato V2 (categorização + busca)

**Objetivo:** melhorar a aba Extrato sem reescrever o motor de filtro existente.

**O que muda**

| Arquivo | Alteração |
|---|---|
| `components/Finance/FinanceLedgerTab.tsx` | Adiciona: mapa `LedgerEntryType → ícone/emoji` (spec §3.3), campo de busca textual (por `label`), mantém os filtros Todos/Receitas/Despesas/Transferências/Folha já existentes |

**Critério de pronto**
- Busca + filtro de tipo combinam (AND), não substituem um ao outro.
- Nenhuma mudança nos dados do ledger — é puramente apresentação.

---

### Fase 7.5 — Dashboard expandido na Visão geral *(inserida fora da ordem original — pedido do usuário)*

**Objetivo:** o usuário pediu explicitamente, após a Fase 7, uma melhoria visual maior no financeiro ("aspecto de site/aplicação financeira... dashboards mais visuais e completos") antes de seguir para a Diretoria. Decisão de escopo tomada com o usuário: expandir a aba **Visão geral** (não criar aba nova) e construir o módulo de orçamento visual que já estava na spec original (`docs/financial-v1.3.md` §2.4) mas nunca tinha sido implementado, mais 3 visualizações adicionais escolhidas pelo usuário.

**O que muda**

| Arquivo | Alteração |
|---|---|
| `utils/financeAnalytics.ts` | Extrai `sumExpensesByCategory(entries)` de dentro de `getCategoryBreakdown` (mesma assinatura pública, sem quebrar `ADVANCE_DAY`); exporta `latestLedgerMonthKey` |
| `components/Finance/categoryMeta.ts` (novo) | Label PT-BR + cor por `ExpenseCategoryGroup`, compartilhado entre os componentes novos |
| `components/Finance/ledgerIcons.ts` (novo) | `LEDGER_ICON` extraído de `FinanceLedgerTab.tsx` para reuso no ranking |
| `components/Finance/MonthlyBudgetCard.tsx` (novo) | Barra de progresso do teto + breakdown por categoria (spec §2.4) |
| `components/Finance/CategoryDonutChart.tsx` (novo) | Rosca SVG de despesas por categoria do período |
| `components/Finance/IncomeExpenseBarChart.tsx` (novo) | Barras receita/despesa por mês, reaproveita os `historyPoints` da Fase 6 |
| `components/Finance/TopEntriesList.tsx` (novo) | Ranking de maiores entradas/saídas do período |
| `components/Finance/FinanceOverviewTab.tsx` | `usePeriodTotals` (baseado em `getMonthlyCashFlow`) substituído por `usePeriodEntries`, que expõe os lançamentos crus do período — fonte única para KPIs + os 4 novos blocos |

**Critério de pronto**
- Build e lint no mesmo baseline de antes (sem regressão).
- KPIs numéricos idênticos aos de antes da refatoração de `usePeriodTotals` → `usePeriodEntries`.
- Layout responsivo dentro do `max-width: 720px` já existente da página (grids `auto-fit`, não 2 colunas fixas).

---

### Fase 8 — Integração com Diretoria e narrativa *(entregue, 2026-08-07)*

**Objetivo:** dar visibilidade ao rating fora da página Finanças e registrar a versão no changelog que já existe em Board.

**O que muda**

| Arquivo | Alteração |
|---|---|
| `pages/Board/Board.tsx` | Nova entrada no changelog existente: "v1.3 — Financial Update" (linha na tabela, seguindo o padrão atual) |
| `pages/Board/Board.tsx` | Badge de rating financeiro no resumo/identidade do clube (leitura de `finance.health`, sem novo cálculo) |
| `utils/pressTriggers.ts` | Se Fase 4 optar por reaproveitar `finance_crisis`: incluir motivo "estouro de teto" no texto quando aplicável |

**Critério de pronto**
- Rating exibido em Board é sempre o mesmo valor cacheado lido em Finanças (nunca um segundo cálculo divergente).
- Changelog não quebra saves antigos (é só conteúdo estático de UI).

---

### Fase 9 — Testes, checklist e documentação *(entregue, 2026-08-07 — épico fechado)*

**Testes mentais obrigatórios** (mesmo padrão dos dois handoffs) — todos verificados por leitura de código:
- Load de save v1.2 sem `monthlyBudget`/`health`.
- Carreira sem `currentDate` (LiveLife nunca ativado) → analytics/projeção não quebram, só ficam vazios.
- Folha (`wageBill`) = 0 → runway infinito não deve travar `computeFinancialHealth` nem os cards.
- Teto de gastos não definido → nenhuma barra de progresso, nenhuma penalidade.
- Rating em save recém-migrado com dívidas antigas de `wage_overdraft` → score reflete atrasos passados corretamente.
- Edição de partida concluída (`UPDATE_COMPLETED_MATCH`) não deve disparar recomputo de rating (não é um checkpoint da Fase 3).
- `npm run build` (tsc) e `npm run lint` limpos ao final de cada fase — não só no fim do épico inteiro.

**Documentação a atualizar ao final:**
- `docs/sistema-financeiro.md` — novas seções: Teto de gastos, Rating bancário, Extrato V2.
- `docs/HANDOFF_FINANCEIRO_CLAUDE.md` — Camada C (ou nova "Camada D — Financial Update v1.3") + novas invariantes (`currentSpent` sempre derivado; `health` só recalcula em checkpoints).
- `docs/HANDOFF_CLUBOS_CLAUDE.md` — atualizar versão do produto (v1.2 → v1.3) e §12 (backlog/entregue).

---

## 3. Ordem recomendada de execução

```
Fase 1 (dados/migração)
  → Fase 2 (agregação)          → Fase 3 (rating)
       ↓                              ↓
  Fase 4 (teto, depende de 2)   Fase 5 (split + header + KPIs, depende de 2 e 3)
       ↓                              ↓
       └──────────────→ Fase 6 (gráfico, depende de 2 e 5)
                              ↓
                         Fase 7 (extrato V2, independente — pode rodar em paralelo com 4–6)
                              ↓
                         Fase 8 (Diretoria/narrativa, depende de 3)
                              ↓
                         Fase 9 (testes/docs — fecha o épico)
```

Fases 1–3 são pré-requisito de tudo. Fase 7 é isolada e pode ser feita a qualquer momento depois da Fase 1. Nenhuma fase exige tocar em `calcGateRevenue`, `payWages`, `clubLoans`/`clubDebts`/`sponsors` — o motor econômico da v1.2 permanece intocado, só ganha uma camada de leitura por cima.

---

## 4. O que NÃO entra nesta v1.3 (fora de escopo)

- Conversão cambial real (já descartada no handoff financeiro — moeda continua só formatação).
- Reescrita de empréstimos/dívidas/patrocínios/bilheteria (já entregues, só consumidos por analytics/rating).
- Ofertas dinâmicas de patrocínio geradas por narrativa (fica no backlog do handoff financeiro §11 — fora do escopo de "rating bancário").
- CT/infraestrutura como investimento (backlog geral, não pedido pela spec v1.3).
