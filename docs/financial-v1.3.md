# 🏦 ClubOS — Especificação Técnica & Prompt de Desenvolvimento: Versão 1.3 "Financial Update"

> **INSTRUÇÕES PARA O CLAUDE / AGENTE DE DESENVOLVIMENTO:**
> Leia atentamente esta documentação técnica de UI/UX, regras de negócio e arquitetura.
> **SUA PRIMEIRA TAREFA AO RECEBER ESTE PROJETO:**
> 1. Crie uma pasta chamada `FinancialUpdate - Desenvolvimento` na raiz do repositório.
> 2. Dentro dessa pasta, crie o arquivo `plano_de_desenvolvimento.md` estruturando a migração do módulo financeiro em Sprints / Fases modulares.
> 3. Crie os arquivos de contrato e instrução de portagem (`CLUBOS_CONEXAO.md`, `CURSOR_MANUAL.md` ou equivalentes adaptados para o Claude).
> 4. Atualize o `storage.ts` garantindo a retrocompatibilidade (migração de dados sem breaking changes) de todos os saves da v1.2 para a v1.3.
> 5. Proponha um plano de refatoração visual baseando-se no layout da referência "Meu Dinheiro" (cards KPI modernos com variação %, fluxo de caixa em gráfico, teto de gastos e saúde financeira) mantendo a estética dark/esportiva do ClubOS.

---

## 📋 1. VISÃO GERAL DA ATUALIZAÇÃO (v1.3 — Financial Update)

A **v1.3 Financial Update** repagina e evolui a aba de Finanças (`/financas`) do ClubOS, transformando o extrato/tabela legado em uma **Central de Inteligência Financeira e CFO Simularizado**.

Inspirada em dashboards de finanças modernas (como a referência "Meu Dinheiro"), a v1.3 combina **análise gráfica preditiva, saúde financeira em tempo real (Rating Bancário), gestão de teto orçamentário e categorização inteligente**, sem perder a profundidade de simulação de futebol (bilheterias mandante/visitante, custos operacionais, salários no dia 5, empréstimos, dívidas e patrocínios).

---

## 🎨 2. REDESIGN VISUAL & UX (Inspirado no "Meu Dinheiro")

### 2.1. Header Executivo & Boas-Vindas
Substituir o cabeçalho plano por um banner de status executivo:
* **Mensagem Personalizada:** *"Olá, [Nome do Treinador]. Seu dinheiro em um só lugar."* ou *"Saúde financeira do [Nome do Clube] sob controle."*
* **Ações Rápidas (Primary Buttons):**
  * `[ + Novo Lançamento ]`
  * `[ Solicitar Empréstimo ]`
  * `[ Definir Teto de Gastos ]`
* **Seletor Global de Período:** Filtro no topo para alternar entre *Mês Atual*, *Últimos 6 Meses*, *Temporada Atual* ou *Histórico Acumulado*.

### 2.2. Grid de Cards KPI com Variação Percentual (%)
Substituir os blocos de texto estáticos por cards interativos com indicadores de tendência (setas de variação e comparativo com o período anterior):

| KPI Card | Métrica Exibida | Indicador de Tendência / Subtexto |
| :--- | :--- | :--- |
| **Patrimônio / Caixa Atual** | `finance.balance` formatado | `% de crescimento em relação ao início da temporada` |
| **Receitas da Temporada** | Total de Entradas | `▲ X% em relação ao mês anterior` |
| **Despesas da Temporada** | Total de Saídas | `▼ Y% em relação ao mês anterior` |
| **Margem / Taxa de Lucro** | `((Receita - Despesa) / Receita) * 100` | Status visual (*Excelente >20% / Alerta <5% / Deficitário*) |
| **Runway (Autonomia)** | `Caixa ÷ Folha Salarial Mensal` | `X meses de folha garantidos` (Badges: Verde / Amarelo / Vermelho) |

### 2.3. Gráfico Interativo de Fluxo de Caixa (6 Meses / Temporada)
* **Visualização Dupla (Linhas/Barras):** Comparativo mensal entre **Receitas (Linha Verde/Ciano)** e **Despesas (Linha Vermelha/Laranja)**.
* **Projeção Futura (Linha Pontilhada):** Previsão para os próximos 3 meses considerando a folha salarial fixa + parcelas de empréstimos/dívidas no calendário + cotas de patrocínio a receber.
* **Tooltips Ricos:** Ao passar o cursor sobre um mês, exibe o balanço detalhado com as maiores entradas (ex: Bilheteria) e maiores saídas (ex: Folha salarial / Transferências).

### 2.4. Módulo de Planejamento & Teto de Gastos Mensal
* **Barra de Progresso do Orçamento:** Indicador visual de consumo do teto mensal (ex: `84,0% consumido` de `R$ 6.430,00` disponíveis).
* **Breakdown de Categorias:** Barras horizontais coloridas segmentando as despesas do mês:
  * 🔵 **Folha Salarial**
  * 🔴 **Operação do Estádio / Viagens**
  * 🟡 **Parcelas de Empréstimos & Dívidas**
  * 🟣 **Transferências & Mercado**
  * ⚪ **Outras Despesas / Eventos Pulse**

---

## ⚙️ 3. NOVAS MECÂNICAS E FUNCIONALIDADES DE GAMEPLAY

### 3.1. Sistema de Teto Orçamentário (Budgeting System)
* O treinador/diretoria pode estabelecer um **Teto de Gastos Mensal**.
* Ultrapassar o teto repetidamente gera insatisfação na diretoria, reduzindo o `boardConfidence` e podendo disparar coletivas de imprensa sobre crise financeira.

### 3.2. Rating Bancário & Score de Crédito (Credit Rating)
* **Rating do Clube:** Classificação de `AAA` até `F` calculada com base em:
  1. Autonomia financeira (*Runway* em meses).
  2. Adimplência no pagamento da folha salarial (dia 5).
  3. Razão entre dívida acumulada e caixa atual.
* **Impactos no Jogo:**
  * **Rating AAA / AA:** Acesso a empréstimos bancários com taxas de juros reduzidas (3% a 5%) e melhores propostas de patrocínio Master/Manga.
  * **Rating D / F:** Empréstimos bloqueados pelos bancos, risco de punição esportiva por atraso salarial e taxas de juros abusivas.

### 3.3. Categorização Inteligente do Extrato (Ledger V2)
Aba de Extrato totalmente reformulada com filtros rápidos, busca textual e ícones/badges coloridos por categoria:
* 🎟️ `ticket` — Bilheteria Mandante / Neutro
* ✈️ `travel` — Viagens / Operação Visitante
* 🏟️ `stadium_ops` — Custos de Operação do Estádio
* 💼 `wage` — Folha Salarial Mensal
* 🏆 `prize` — Premiações de Jogos e Fases de Torneios
* 📄 `sponsor` — Cotas e Bônus de Patrocínio
* 🤝 `transfer_fee` — Compra / Venda / Empréstimo de Jogadores
* 🏦 `loan_credit` / `loan_repay` — Transações Bancárias
* ⚠️ `debt_repay` — Amortização de Dívidas

---

## 🏗️ 4. ARQUITETURA, TIPAGEM E MODELO DE DADOS

### 4.1. Estrutura Atual do Módulo (`src/types/Finance.ts`)
O modelo do ClubOS v1.2 já possui a seguinte estrutura base, que deve ser mantida e expandida:

```typescript
export interface ClubFinance {
  balance: number;
  currency: 'BRL' | 'EUR' | 'GBP' | 'USD';
  prizeTable: Record<string, PrizeTableEntry>;
  ledger: FinanceLedgerEntry[];
  stadiumConfig?: StadiumConfig;
  loans?: ClubLoan[];
  loanPayments?: ClubLoanPayment[];
  debts?: ClubDebt[];
  sponsors?: ClubSponsor[];
}
```

### 4.2. Extensão Obrigatória para a v1.3 (`src/types/Finance.ts`)

```typescript
export type FinancialRating = 'AAA' | 'AA' | 'A' | 'BBB' | 'BB' | 'B' | 'CCC' | 'D' | 'F';

export interface MonthlyBudget {
  targetExpenseLimit: number; // Teto de gastos mensal definido
  currentSpent: number;        // Total de despesas acumuladas no mês vigente
}

export interface FinancialHealth {
  score: number;             // Pontuação de 0 a 100
  rating: FinancialRating;   // Rating bancário
  creditLimit: number;       // Limite de crédito pré-aprovado para empréstimos
}

// Extensão sem breaking changes
export interface ClubFinanceV13 extends ClubFinance {
  monthlyBudget?: MonthlyBudget;
  health?: FinancialHealth;
}
```

### 4.3. Script de Migração Retrocompatível (`src/services/storage.ts`)

```typescript
export function migrateToV13(save: GameSave): GameSave {
  if (!save.finance) {
    save.finance = createDefaultFinance();
  }
  
  // Garantir existência das novas estruturas da v1.3
  if (!save.finance.monthlyBudget) {
    save.finance.monthlyBudget = {
      targetExpenseLimit: (save.finance.balance || 5000000) * 0.25, // Default 25% do caixa
      currentSpent: 0
    };
  }
  
  if (!save.finance.health) {
    save.finance.health = {
      score: 75,
      rating: 'A',
      creditLimit: (save.finance.balance || 5000000) * 1.5
    };
  }
  
  return save;
}
```

---

## 📜 5. HISTÓRICO ATUALIZADO DE VERSÕES (Changelog na Diretoria)

| Versão | Nome do Update | Principais Funcionalidades Implementadas |
| :--- | :--- | :--- |
| **v1.0** | **Lançamento Base** | Gestão de elenco, criação de time, registro manual de partidas e dashboard inicial. |
| **v1.1** | **Pulse Update** | Motor de eventos imprevisíveis, dilemas morais de vestiário e cobranças da diretoria. |
| **v1.2** | **LiveLife Update** | Calendário contínuo, avanço diário, bilheteria mandante/visitante, lesões por tempo, folha no dia 5, ClubOSocial e Sala de Troféus. |
| **v1.3** | **Financial Update** | Redesign estilo Fintech ("Meu Dinheiro"), gráficos de fluxo de caixa preditivo, rating bancário/crédito, teto de orçamento mensal e categorização inteligente. |

---

## 🎯 6. REGRAS GERAIS DE EXECUÇÃO PARA O CLAUDE

1. **Manter as Rotinas Automáticas da v1.2:** Não quebrar a bilheteria pós-jogo (`calcGateRevenue`), os débitos no dia 5 (`payrollDue`), o recebimento automático de cotas de patrocínio e o sistema de empréstimos/dívidas.
2. **Performance de Renderização:** Como o extrato (`ledger`) e os gráficos de fluxo de caixa processam muitos dados históricos, utilize funções puras e memoização (`useMemo`, `useCallback`) para evitar travamentos de UI.
3. **Padrão Estético Escuro (Dark Mode):** O layout deve seguir a estrutura moderna da referência enviada, adaptando o esquema de cores para casar com a paleta dark do ClubOS (fundo `#0f172a` / `#1e293b`, destaques em ciano, verde e azul neon).
4. **Zero Erros TypeScript:** Executar `npm run build` ao finalizar cada fase da migração para garantir compilação sem erros.
