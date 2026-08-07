# Sistema financeiro do ClubOS

Documentação do estado atual do financeiro: o que existe, como funciona, onde aparece na interface e quais arquivos mexem no caixa.

---

## 1. Visão geral

O financeiro é o módulo de **caixa do clube** no modo LiveLife. Tudo passa por um objeto `ClubFinance` no estado do jogo (`GameContext`), com:

- **Saldo** (`balance`) — caixa atual
- **Moeda** (`currency`) — BRL, EUR, GBP ou USD (só formatação; não há conversão cambial)
- **Extrato** (`ledger`) — lista de lançamentos (receitas e despesas)
- **Premiações** (`prizeTable`) — valores por competição
- **Estádio** (`stadiumConfig`) — parâmetros de bilheteria
- **Empréstimos** (`loans` + `loanPayments`)
- **Dívidas** (`debts`)
- **Patrocínios** (`sponsors`)
- **Teto de gastos** (`monthlyBudget?`) — opcional, v1.3
- **Rating bancário** (`health?`) — cacheado, v1.3

O saldo do time (`team.budget`) é **espelhado** sempre que o caixa muda: `team.budget === finance.balance`.

A página principal é **`/financas`**. O Dashboard, o Calendário, Transferências, Diretoria, Competições, Pulse e Coletivas também leem ou alteram o financeiro.

> **v1.3 "Financial Update":** repaginou a aba Visão geral em um dashboard (KPIs com variação %, gráfico de fluxo de caixa projetado, orçamento mensal, despesas por categoria, ranking de lançamentos) e adicionou rating bancário do clube. Motor de caixa (bilheteria, folha, empréstimos, dívidas, patrocínios, premiações) é o mesmo da v1.2, inalterado. Detalhe completo em [`FinancialUpdate - Desenvolvimento/`](../FinancialUpdate%20-%20Desenvolvimento/plano_de_desenvolvimento.md) e §12 deste documento.

---

## 2. Modelo de dados

Arquivo: `src/types/Finance.ts`

### `ClubFinance`

| Campo | Tipo | Função |
|-------|------|--------|
| `balance` | `number` | Caixa atual |
| `currency` | `BRL \| EUR \| GBP \| USD` | Símbolo e formatação |
| `prizeTable` | `Record<nomeCompetição, PrizeTableEntry>` | Premiação por jogo / mata-mata |
| `ledger` | `FinanceLedgerEntry[]` | Extrato (mais recentes no início) |
| `stadiumConfig?` | `StadiumConfig` | Capacidade, ingressos, custos |
| `loans?` | `ClubLoan[]` | Empréstimos bancários |
| `loanPayments?` | `ClubLoanPayment[]` | Parcelas no calendário |
| `debts?` | `ClubDebt[]` | Dívidas (manual ou sobreaviso de folha) |
| `sponsors?` | `ClubSponsor[]` | Patrocínios Master / Manga |
| `monthlyBudget?` | `MonthlyBudget` | Teto de gastos mensal (v1.3, opt-in) |
| `health?` | `FinancialHealth` | Rating bancário cacheado (v1.3, ver §12) |

### Tipos de lançamento (`LedgerEntryType`)

| Tipo | Label na UI | Sentido típico |
|------|-------------|----------------|
| `wage` | Folha salarial | Despesa |
| `prize` | Premiação | Receita |
| `transfer_fee` | Taxa de transferência | Compra (−) / venda (+) |
| `loan_fee` | Taxa de empréstimo (atleta) | Idem para empréstimo de jogador |
| `loan_credit` | Empréstimo (crédito) | Crédito bancário entra no caixa |
| `loan_repay` | Parcela de empréstimo | Despesa |
| `debt_repay` | Pagamento de dívida | Despesa |
| `sponsor` | Patrocínio | Receita (cota ou bônus) |
| `other_in` / `other_out` | Receita / Despesa | Lançamento genérico / Pulse |
| `adjustment` | Ajuste | Ajuste manual / Diretoria |
| `ticket` | Bilheteria | Receita pós-jogo |
| `travel` | Viagem | Despesa (fora / neutro) |
| `stadium_ops` | Operação do estádio | Despesa (casa) |

Cada entrada tem: `id`, `date` (YYYY-MM-DD do jogo), `season`, `type`, `amount` (positivo = receita), `label`, e opcionalmente `relatedPlayerId`, `relatedTransferId`, `matchId`.

### Estádio (`StadiumConfig`)

Configurável na UI:

- `capacity` — capacidade mandante
- `ticketPriceHome` — ingresso casa / neutro
- `ticketPriceAway` — ingresso cota visitante
- `maintenanceCostPerMatch` — custo de operação em casa
- `travelCostAverage` — custo médio de viagem (fora / neutro)

**Constantes fixas do jogo** (não editáveis na UI), em `GATE_RULES` (`src/utils/finance.ts`):

| Regra | Valor |
|-------|-------|
| Capacidade adversário (visitante) | 40.000 |
| Capacidade campo neutro | 60.000 |
| Cota casa | 90% da capacidade do clube |
| Cota visitante | 10% de 40.000 = **4.000** |
| Cota neutro | 50% de 60.000 = **30.000** |

Lotação = confiança da torcida (`supporterConfidence` 0–100 → fator 5%–100%) × jitter aleatório ~92%–105%.

### Premiação (`PrizeTableEntry`)

- `win` / `draw` — creditados **ao finalizar partida** (`applyMatchPrize`)
- `knockout` / `champion` — creditados ao **avançar fase de mata-mata** em Competições (`advanceKnockoutPhase` + `applyLedger`)

---

## 3. Onde aparece na interface

### 3.1 Página Financeiro — `/financas`

Arquivos: `src/pages/Finance/Finance.tsx` (shell) + `src/components/Finance/*` (header, abas, gráficos — ver §12) + `Finance.module.css`

Oito abas, com um **header executivo** acima delas (saudação, seletor de período Mês atual/6 meses/Temporada/Histórico, botões + Novo lançamento / Solicitar empréstimo / Definir teto de gastos):

#### Visão geral (dashboard — v1.3)
- Caixa atual (vermelho se negativo) + seletor de **moeda**
- Grid de **5 KPI cards**: Caixa atual, Receita do período, Despesa do período, Margem, Runway — cada um com variação % vs. período anterior (quando aplicável)
- Gráfico de **fluxo de caixa** (6 meses de histórico + até 3 meses de projeção pontilhada)
- **Orçamento do mês**: barra de progresso do teto de gastos + breakdown por categoria (Folha, Estádio/Viagens, Empréstimos & Dívidas, Transferências, Outras)
- Gráfico de **rosca** (despesas por categoria do período) + gráfico de **barras** (receita x despesa por mês)
- **Ranking** das maiores entradas e saídas do período
- Aviso se o estádio não estiver configurado
- Últimos 8 lançamentos
- Detalhe completo de cada peça: §12

#### Extrato
Lista completa do ledger com filtros: Todos · Receitas · Despesas · Transferências · Folha, ícone por tipo de lançamento e busca por descrição (v1.3).

#### Folha salarial
Tabela de jogadores (salário editável inline) + total mensal. Botão **Pagar folha** (mesmo fluxo do Dashboard).

#### Empréstimos
- Formulário: valor, juros %, nº de parcelas, 1ª data, notas
- Crédito entra **na hora** no caixa (`loan_credit`)
- Parcelas vão para o calendário e só saem no vencimento (popup no Dashboard)
- Lista de empréstimos ativos e parcelas pendentes

#### Dívidas
- Registrar dívida (não altera caixa na criação)
- Parcela mensal no dia 1–28
- Amortizar / quitar (sai do caixa + lançamento `debt_repay`)
- Origem `wage_overdraft` marcada como “folha”

#### Patrocínios
- Um contrato **Master** e um **Manga** ativos por vez
- Cota mensal no dia escolhido (automática ao avançar o dia)
- Cláusula de posição mínima na liga → rescisão + multa
- Bônus: classificação, título, artilheiro do clube (liquidados no **fim de temporada**)
- Renovar (+1 temporada) / rescindir (multa no extrato)

#### Premiações
Tabela por competição da temporada: Vitória · Empate · Eliminatória · Campeão. Valores em unidades da moeda do save.

#### Estádio
Editar parâmetros; **Usar valores padrão**; **Desativar bilheteria** (remove config → sem tickets automáticos).

#### Modal “Novo lançamento”
Receita ou despesa, categoria, descrição e valor → `applyLedger`.

---

### 3.2 Dashboard — `/dashboard`

- Card de hub financeiro: caixa, folha, runway, receita/despesa (com escopo de temporada histórica), últimos lançamentos
- CTA de **coletiva · crise financeira** quando o caixa está crítico
- Checklist LiveLife (estádio, salários, etc.)
- **Modais de cobrança** (prioridade aproximada):
  1. Folha (dia 5)
  2. Parcelas de transferência
  3. Parcelas de empréstimo
  4. Parcelas de dívida

**Folha (dia 5):**

| Ação | Efeito |
|------|--------|
| Emprestar e pagar | Empréstimo-ponte 120% da folha, 12% juros, 6 parcelas → paga a folha |
| Pagar (vira dívida) | Se não cobrir: caixa zera, faltante vira dívida `wage_overdraft` |
| Pagar folha | Desconta a folha (saldo pode ficar 0 + dívida se negativo) |
| Adiar | Fecha o modal; moral do elenco −15 |

**Dívida no dia:** pagar parcelas ou **ignorar** (+2,5% de juros sobre o restante).

**Empréstimo no dia:** pagar parcelas vencidas (ou dispensar o aviso).

---

### 3.3 Calendário — `/calendario`

Marcações por dia:

- Dia **5** → Folha
- Datas de parcelas de **empréstimo**
- Dia fixo de **dívida** (1–28)
- Dia fixo de **patrocínio** (cota)
- Janela de transferências / jogos

---

### 3.4 Transferências — `/transferencias`

- Exibe caixa atual
- Compra / venda / empréstimo de atleta gera `transfer_fee` ou `loan_fee` no extrato
- Pode parcelar: `pendingPayments` cobrados no Dashboard no vencimento
- Renovação de contrato pode ter bônus (lançamento no ledger) e altera salário (impacta folha futura)

---

### 3.5 Diretoria — `/diretoria`

- Ajuste de **orçamento/caixa** (diferença vira `adjustment` no extrato)
- Pode **adicionar dívida** sem mexer no caixa
- Resumo de temporada: receita, despesa, saldo, **rating financeiro** (badge lido de `finance.health`, v1.3)
- Aba LiveLife: checklist (estádio, premiações, salários…)
- Changelog in-app lista "v1.3 — Financial Update"

---

### 3.6 Competições — `/competicoes`

- Mostra premiações configuradas (incl. eliminatória / campeão)
- Ao **avançar fase de mata-mata**, se houver valor: `applyLedger` com tipo `prize`

---

### 3.7 Outros

| Local | Relação com o financeiro |
|-------|---------------------------|
| **Criação do clube** | `budget` inicial (padrão 5M) vira `finance.balance` |
| **Pulse** | Eventos podem aplicar `financePatch` → `other_in` / `other_out` |
| **Coletiva** | Trigger `finance_crisis` (caixa &lt; meia folha, runway &lt; 1, estouro do teto de gastos — v1.3, etc.; 1×/mês) |
| **Board confidence** | Saúde financeira entra no clima / metas |
| **Escopo histórico** | Dashboard pode mostrar receita/despesa de temporadas arquivadas |

---

## 4. Fluxos automáticos (quando o caixa muda sozinho)

### 4.1 Após finalizar partida

No `GameContext` (conclusão de jogo):

1. **`calcGateRevenue`** — se estádio configurado:
   - **Casa:** bilheteria (`ticket`) − operação (`stadium_ops`)
   - **Fora:** cota visitante (`ticket`) − viagem (`travel`)
   - **Neutro:** bilheteria neutro (`ticket`) − viagem (`travel`)
2. **`applyMatchPrize`** — se vitória/empate e tabela tem `win`/`draw` → `prize`

Lançamentos entram no ledger e o saldo é atualizado.

### 4.2 Avançar dia (`ADVANCE_DAY`)

- Dia **5** → `payrollDue = true` (se há folha)
- Cotas de **patrocínio** do dia → crédito automático (`sponsor`)
- Flags de parcelas de empréstimo / dívida / transferência vencidas

### 4.3 Fim de temporada

`settleSponsorsForSeason`:

- Paga bônus batidos (classificação, título, artilheiro)
- Rescinde se posição na liga &gt; cláusula
- Decrementa temporadas restantes (expira contrato se chegar a 0)

### 4.4 Seed LiveLife

`seedLiveLifeFinance` (nova carreira / load):

- Preenche estádio template se vazio
- Preenche `prizeTable` por tipo de competição se vazia (valores “realistas” escalados pela moeda)

### 4.5 Migração de saves

`migrateAbsurdGateRevenue` (em `storage.ts`): corrige bilheterias visitante/neutro absurdamente altas de fórmulas antigas e ajusta o saldo.

---

## 5. Empréstimos e dívidas (detalhe)

### Empréstimo bancário

Util: `src/utils/clubLoans.ts`

- Total a devolver = principal × (1 + juros%)
- Parcelas mensais iguais (`splitInstallmentAmounts`)
- **Ponte da folha:** principal = 120% da folha, 12% juros, 6 parcelas, 1ª no mês seguinte

### Dívida

Util: `src/utils/clubDebts.ts`

- Criação **não** altera caixa
- Fonte: `manual` ou `wage_overdraft`
- Ignorar parcela: +2,5% sobre o restante (`DEBT_SKIP_INTEREST_RATE`)
- Adiar folha: moral −15 (`PAYROLL_DELAY_MORALE_HIT`)

### Patrocínio

Util: `src/utils/sponsors.ts`

- Pagamento mensal no dia do contrato ao avançar o dia
- Bônus e cláusulas no fechamento da temporada

---

## 6. Formatação e utilitários

Arquivo: `src/utils/finance.ts`

| Função | Uso |
|--------|-----|
| `formatMoney` | Abreviado (K / M / B) na UI |
| `formatMoneyFull` | Valor completo |
| `wageBill` | Soma dos salários |
| `runwayMonths` | `floor(caixa / folha)` |
| `newLedgerEntry` | Cria linha do extrato |
| `ledgerEntryTypeLabel` | Label PT |
| `isIncome` | Classifica tipo como receita |
| `balanceFromLedger` | Reconstroi saldo a partir do extrato |
| `calcGateRevenue` / `applyMatchPrize` | Pós-jogo |
| `isStadiumConfigured` / `normalizeStadiumConfig` | Validação do estádio |

Componente auxiliar: `MoneyAmountHint` — mostra valor por extenso ao digitar montantes.

---

## 7. Estado e ações no `GameContext`

Flags relevantes (não todas persistem da mesma forma):

- `payrollDue`, `transferPaymentsDue`, `loanPaymentsDue`, `debtPaymentsDue`

Ações principais:

| API | Efeito |
|-----|--------|
| `applyLedger` | Soma `amount` ao saldo + prepend no ledger |
| `payWages` / `payWagesWithBridgeLoan` / `dismissPayroll` | Folha |
| `updateFinance` / `setPrizeTable` | Config |
| `takeClubLoan` / `payLoanPayment` / `dismissLoanPayments` | Empréstimos |
| `addClubDebt` / `payClubDebt` / `dismissDebtPayments` | Dívidas |
| `addClubSponsor` / `renewClubSponsor` / `terminateClubSponsor` | Patrocínios |
| `EXECUTE_TRANSFER` / `PAY_TRANSFER_PAYMENT` | Mercado |
| Conclusão de partida | Bilheteria + premiação win/draw |

Persistência: save local/cloud inclui `finance` (e flags como `payrollDue`). Load passa por seed + migração de bilheteria.

---

## 8. Mapa de arquivos

| Arquivo | Papel |
|---------|--------|
| `src/types/Finance.ts` | Tipos e defaults |
| `src/utils/finance.ts` | Cálculos, bilheteria, premiação de jogo, formatação |
| `src/utils/clubLoans.ts` | Empréstimos + ponte da folha |
| `src/utils/clubDebts.ts` | Dívidas + juros + moral |
| `src/utils/sponsors.ts` | Patrocínios mensais e de temporada |
| `src/utils/livelifeTemplates.ts` | Templates de estádio/premiação + seed + gaps |
| `src/utils/transferPayments.ts` | Datas/valores de parcelas (usado por empréstimos e transferências) |
| `src/utils/pressTriggers.ts` | Detecção de crise financeira (inclui estouro de teto — v1.3) |
| `src/utils/historyScope.ts` | Recorte de extrato por temporada |
| `src/utils/competitionEngine.ts` | Premiação knockout/champion |
| `src/utils/financeAnalytics.ts` | **(v1.3)** Séries mensais, projeção, breakdown por categoria — puro, sem tocar em state |
| `src/utils/financialHealth.ts` | **(v1.3)** Rating bancário (`computeFinancialHealth`) |
| `src/context/GameContext.tsx` | Estado, reducers, efeitos ao avançar dia / finalizar jogo |
| `src/pages/Finance/Finance.tsx` | Shell da página (header + abas) |
| `src/components/Finance/*` | **(v1.3)** Header, dashboard da Visão geral, gráficos, extrato — ver §12 |
| `src/pages/Dashboard/Dashboard.tsx` | Modais de cobrança + hub |
| `src/pages/Calendar/Calendar.tsx` | Marcadores financeiros |
| `src/pages/Transfers/Transfers.tsx` | Taxas e parcelas de mercado |
| `src/pages/Board/Board.tsx` | Ajuste de caixa, dívida, resumo (+ rating v1.3), checklist |
| `src/pages/Competitions/Competitions.tsx` | Premiação de mata-mata |
| `src/services/storage.ts` | Load/save + migração |
| `src/pulse/generator.ts` | Patch de caixa em eventos |
| `src/components/MoneyAmountHint/*` | Hint de valor |

Rota: `App.tsx` → `<Route path="/financas" element={<Finance />} />`.

---

## 9. Ciclo de vida típico na carreira

```
Criar clube (budget) 
  → seedLiveLifeFinance (estádio + prize table)
  → configurar salários / estádio / patrocínios (opcional)
  → Avançar Dia…
       · dia 5: pagar ou adiar folha
       · dias de cota: patrocínio automático
       · vencimentos: empréstimo / dívida / transferência
  → Jogar partida
       · bilheteria + custos
       · premiação win/draw
  → Transferências (taxas ± parcelas)
  → Mata-mata em Competições (knockout / champion)
  → Pulse (pode mexer no caixa)
  → Fim de temporada (bônus / rescisão de patrocínio)
```

---

## 10. Limites e comportamento atual

- **Moeda** só muda símbolo/formatação; valores já lançados não são convertidos.
- **Knockout / campeão** não saem ao “finalizar partida”; saem ao avançar fase em Competições.
- Sem **estádio configurado**, não há bilheteria automática.
- Dívida nova **não** injeta dinheiro; só empréstimo (`loan_credit`) injeta.
- Runway infinito se a folha for 0.
- Bilheteria usa jitter aleatório (exceto migração determinística de saves antigos).

---

## 11. Referências rápidas

- Guia de uso (seção Financeiro): [`guia-de-uso.md`](./guia-de-uso.md)
- LiveLife v1.2: [`livelife-v1.2.md`](./livelife-v1.2.md)
- Constantes de bilheteria: [`INSTRUCOES_LIVELIFE_V1_2.md`](./INSTRUCOES_LIVELIFE_V1_2.md)
- Financial Update v1.3 — spec original: [`financial-v1.3.md`](./financial-v1.3.md)
- Financial Update v1.3 — plano de desenvolvimento, contrato e manual de portagem: [`FinancialUpdate - Desenvolvimento/`](../FinancialUpdate%20-%20Desenvolvimento/)
- Handoff financeiro (profundo): [`HANDOFF_FINANCEIRO_CLAUDE.md`](./HANDOFF_FINANCEIRO_CLAUDE.md)

---

## 12. Financial Update (v1.3) — detalhe

Repaginação da aba Visão geral + duas mecânicas novas (teto de gastos, rating bancário). O motor de caixa da v1.2 (bilheteria, folha, empréstimos, dívidas, patrocínios, premiações — seções 1–9 acima) **não muda**; esta seção documenta só o que a v1.3 adicionou por cima.

### 12.1 Teto de gastos mensal (Budgeting)

- Definido no header da página Financeiro (botão **Definir teto de gastos**) → `finance.monthlyBudget.targetExpenseLimit`. Opt-in — sem teto definido, nada acontece.
- **Consumo do mês nunca é salvo.** É sempre recalculado na hora a partir do `ledger` (`getCategoryBreakdown`) — evita um segundo "saldo" que possa dessincronizar do extrato real, o mesmo cuidado que já existe para `team.budget === finance.balance`.
- Ao virar o mês (`ADVANCE_DAY`, dia 1), se o gasto do mês que fechou passou do teto: a diretoria perde confiança (delta suavizado pelas mesmas regras de pós-jogo) e o evento é marcado como tratado (`livelife.pressSpecialDoneKeys`, chave `budget:YYYY-MM`) para não penalizar duas vezes.
- Se o teto estourou e ainda não rolou nenhuma coletiva financeira no mês, isso também pode abrir uma coletiva de crise financeira com o motivo "Estouro do teto de gastos mensal" (mesmo gatilho de `finance_crisis`, `pressTriggers.ts`).
- Categorias do breakdown (`ExpenseCategoryGroup`): **Folha salarial** (`wage`), **Estádio / Viagens** (`stadium_ops`, `travel`), **Empréstimos & Dívidas** (`loan_repay`, `debt_repay`), **Transferências & Mercado** (`transfer_fee`, `loan_fee`), **Outras despesas** (`other_out`, `adjustment`).

### 12.2 Rating bancário (`FinancialHealth`)

- Score 0–100 → rating `AAA` a `F`, cacheado em `finance.health` (não recalculado a cada render — só em checkpoints específicos, ver abaixo).
- Fórmula (pesos em `utils/financialHealth.ts`): até 40 pts por **runway** (meses de caixa ÷ folha, teto em 6 meses), até 35 pts por **adimplência** (menos dívidas `wage_overdraft` — atraso de folha — nos últimos 6 meses, melhor), até 25 pts pela **relação dívida/caixa**.
- Recalculado só em: load do save (local e nuvem), fim de `ADVANCE_DAY`, fim de pagar folha (normal ou com ponte), fim de pagar/quitar dívida. **Não** recalcula em lançamento manual avulso nem em edição de partida já concluída.
- Onde aparece: badge na Diretoria (aba Temporada, "Resumo da temporada"). Ainda não influencia juros de empréstimo na UI de Finanças (ficou fora do escopo desta v1.3 — ver `MELHORIAS_FUTURAS.md`).

### 12.3 Dashboard da Visão geral

| Peça | Arquivo | Dado |
|---|---|---|
| Header executivo | `components/Finance/FinanceHeader.tsx` | Saudação, seletor de período, ações rápidas |
| KPI cards | `components/Finance/KpiCard.tsx` | `getMonthlyCashFlow` / `percentChange` / `finance.health` |
| Gráfico de fluxo de caixa | `components/Finance/CashFlowChart.tsx` | `getMonthlyCashFlow` (6 meses) + `getCashFlowProjection` (3 meses) |
| Orçamento do mês | `components/Finance/MonthlyBudgetCard.tsx` | `finance.monthlyBudget` + `getCategoryBreakdown` |
| Despesas por categoria (rosca) | `components/Finance/CategoryDonutChart.tsx` | `sumExpensesByCategory` sobre o período selecionado |
| Receita x despesa (barras) | `components/Finance/IncomeExpenseBarChart.tsx` | Mesmos pontos do gráfico de linha |
| Maiores lançamentos | `components/Finance/TopEntriesList.tsx` | Lançamentos crus do período, ordenados |
| Extrato (ícones + busca) | `components/Finance/FinanceLedgerTab.tsx` | `LEDGER_ICON` (`components/Finance/ledgerIcons.ts`) |

Todos os gráficos são **SVG custom, sem dependência nova** — decisão tomada para não inflar o bundle (o app tinha só 4 dependências de runtime antes da v1.3, continua com 4).

### 12.4 Invariantes novas (v1.3)

Além das invariantes da v1.2 (seção 10 acima, que continuam todas válidas):

1. **`monthlyBudget.currentSpent` não existe como campo** — é sempre derivado do `ledger` em runtime.
2. **`finance.health` só recalcula nos checkpoints listados em 12.2** — nunca a cada render nem a cada `APPLY_LEDGER` genérico.
3. **Analytics (`financeAnalytics.ts`) são funções puras** — recebem `ledger`/`state`, nunca despacham ações nem dependem de `Date.now()` (usam `currentDate` do jogo; sem clock, caem no fallback da entrada mais recente do `ledger`).
4. **Nomes de propriedade em hooks nunca usam `current`/`previous` sozinhos** — o React Compiler deste projeto (eslint-plugin-react-hooks v7) trata `.current` como acesso de `ref` e recusa memoizar; usar nomes como `inPeriod`/`previousPeriod`.

### 12.5 O que ficou fora desta versão

Ver [`FinancialUpdate - Desenvolvimento/MELHORIAS_FUTURAS.md`](../FinancialUpdate%20-%20Desenvolvimento/MELHORIAS_FUTURAS.md): ofertas dinâmicas de patrocínio por rating, CT/infraestrutura como investimento, conversão cambial real, notificações de mudança de rating, meta de diretoria atrelada a rating.
