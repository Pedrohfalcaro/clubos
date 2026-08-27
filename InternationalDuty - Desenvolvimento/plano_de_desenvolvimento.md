# ClubOS — Plano de Desenvolvimento Modular: International Duty Update (v1.4)

> **Status (2026-08-27):** ✅ **International Duty Update (v1.4) entregue por completo — Fases 0–9.** Modo Seleção / Dual Career: fundação documental, modelo de dados/migração, dual career switch, Datas FIFA como hub (jogos + convocação + tática por janela, numeração de camisa herdada), conflito de calendário "Em Serviço Nacional", partidas da seleção reaproveitando o motor do clube, dashboard com líderes, diretoria da federação, ranking FIFA dinâmico + Pulse Internacional, testes mentais e documentação. `npm run build` limpo; `npm run lint` com +1 erro esperado desde a Fase 2 (`NationalLayout.tsx` replica o mesmo padrão de efeito já presente em `Layout.tsx`/`PlayerLayout.tsx` — pré-existente, não uma regressão nova; nenhum erro novo em todo o desenvolvimento).
> **Baseado em:** `docs/documento_clubos_v1_4.pdf` (spec/pedido da atualização), `docs/HANDOFF_CLUBOS_CLAUDE.md`, `docs/HANDOFF_FINANCEIRO_CLAUDE.md` e leitura direta de `src/context/GameContext.tsx`, `src/types/*` (estado real do código, v1.3 "Financial Update" já entregue).
> **Convenção:** este plano segue o formato usado em [`LiveLife - Desenvolvimento/plano_de_desenvolvimento.md`](../LiveLife%20-%20Desenvolvimento/plano_de_desenvolvimento.md) e [`FinancialUpdate - Desenvolvimento/plano_de_desenvolvimento.md`](../FinancialUpdate%20-%20Desenvolvimento/plano_de_desenvolvimento.md) — fases incrementais, cada uma jogável isoladamente.
> **Manual de portagem:** [`CURSOR_MANUAL.md`](./CURSOR_MANUAL.md) (ordem de edição arquivo a arquivo + checklist por fase) · **Contrato de integração:** [`CLUBOS_CONEXAO.md`](./CLUBOS_CONEXAO.md) · **Backlog fora de escopo:** [`MELHORIAS_FUTURAS.md`](./MELHORIAS_FUTURAS.md)

> **Lead Developer & Game Designer Perspective**
> Este é o maior módulo desde o LiveLife: não é uma camada de leitura sobre um motor existente (como foi a v1.3 Financial Update sobre o financeiro), é um **segundo contexto de jogo inteiro** rodando em paralelo ao clube — elenco próprio (parcial, formado por convocação), calendário próprio (Datas FIFA), identidade visual própria, e uma ponte de mão dupla com o clube (desfalques). Tratar como "Pulse-sized new system", não como um ajuste de tela.

---

## 0. Diagnóstico — o que o PDF pede vs. o que já existe no código

### 0.1. Correção de numeração de versão (resolver antes de tudo)

O arquivo `docs/documento_clubos_v1_4.pdf` tem o nome do arquivo em `v1_4`, mas o conteúdo interno do documento se autointitula **"Versão 1.3 — International Duty Update"** e lista no changelog interno `v1.3 = International Duty Update`.

Isso conflita com a realidade do produto: **`v1.3` já foi entregue e é o "Financial Update"** (dashboard financeiro, rating bancário, teto de gastos — ver `docs/HANDOFF_FINANCEIRO_CLAUDE.md`, entregue em 2026-08-07). O changelog real na Diretoria (`Board.tsx`) e os dois handoffs já documentam essa versão.

**Decisão:** este módulo é **v1.4 "International Duty Update"**, sucessor do Financial Update. Todo texto/UI/changelog gerado a partir da spec do PDF deve trocar "v1.3" por "v1.4" onde aparecer nome de versão. O conteúdo funcional do PDF (seções 1–6) permanece válido — só a numeração muda.

### 0.2. Pilares da spec vs. estado atual do código

| Pilar da spec v1.4 | Estado atual | Observação / arquivo relevante |
|---|---|---|
| Alternância Clube ⇄ Seleção no Dashboard | **Ausente** | `careerMode` hoje é só `'coach' \| 'player'` (`types/CareerMode.ts`), fixado na criação da carreira. Precisa de um *terceiro eixo* ortogonal (contexto ativo), não um novo `careerMode`. |
| Onboarding da Seleção (nome na 1ª vez) | **Ausente** | Padrão já existe para o clube (`ClubCreate.tsx`) e para o jogador (`PlayerCreate.tsx`) — reaproveitar estrutura de wizard, não o componente. |
| Interface tematizada por federação | **Parcial** | `utils/clubColors.ts` já resolve cores dinâmicas do clube: o mesmo mecanismo serve para a seleção. |
| Datas FIFA (janela, tipo de competição, jogos) | **Ausente** | Nenhum calendário paralelo ao `state.currentDate`/`matches` existe. `types/Competition.ts` (`SeasonCompetition`, `KnockoutPhase`) é o modelo estrutural mais próximo e deve inspirar `FifaWindow`, mas **não** deve ser reaproveitado por referência direta — a seleção não é uma `SeasonCompetition` do clube. |
| Convocação 23/26, banco recorrente, inclusão manual | **Ausente**, mas o *padrão* de cadastro manual de atleta já existe (`utils/customSquad.ts`, `createPlayerDraft`) | Convocados **não são** necessariamente jogadores do elenco do usuário (ex.: atletas de outros clubes, ver JSON de exemplo do PDF com "Arsenal", "Newcastle"). Precisa de um tipo próprio, não reaproveitar `Player` por herança. |
| Importação JSON de pré-lista (até 30) | **Ausente**, mas o *padrão* de import já existe (`utils/clubImport.ts`, usado na criação do clube) | Replicar a mesma disciplina de validação (falha tudo ou nada, mensagens por índice/nome) num novo `nationalImport.ts`. |
| Histórico por Data FIFA + visão geral de convocados | **Ausente** | Precisa de um `NationalMatch`/`CallUpRecord` análogo a `Match`/`PlayerMatchPerformance`, mas mais simples (sem tática, sem financeiro). |
| Dashboard internacional (artilheiros, assistências, notas) | **Ausente** | Squad.tsx já calcula rankings do elenco por stats — mesma lógica de agregação, fonte de dados diferente. |
| Painel da diretoria/federação (metas + moral) | **Ausente**, mas o *padrão* já existe (`types/Board.ts`, `BoardGoal`, `boardStatus`) | Decisão de arquitetura necessária: reaproveitar `BoardGoalKind`/`BoardState` com um `scope: 'club' \| 'national'`, ou criar um `NationalBoardState` paralelo mais simples (ver §1). |
| Conflito de calendário — "Em Serviço Nacional" | **Ausente**, mas o mecanismo de bloqueio de escalação já existe (`isPlayerBlockedFromLineup`, `PlayerAvailability`, `suspensionCompetition` como precedente de "disponibilidade condicional") | Não deve virar um novo valor solto de `availability` (quebraria todo lugar que faz switch exaustivo sobre `PlayerAvailability`) — ver decisão em §1. |
| Pulse Internacional (clubes pedem desconvocação) | **Ausente**, mas o motor de eventos já existe e é extensível (`src/pulse/*`, `eventBank.json`/`eventBankCustom.json`, conceito de evento `match_only`) | Precisa de um novo "modo" de evento com escopo `national`, análogo a `match_only`, e de um efeito que não existe hoje: patch em `nationalTeam` (moral) + patch em `board.mediaHistory`/relação com clubes. |
| Ranking FIFA dinâmico | **Ausente** | Não existe hoje nenhum conceito de "força do adversário" nem de ranking numérico externo ao clube. Precisa de decisão de escopo (ver §1) — o PDF não define de onde vêm os rankings dos outros 200+ seleções. |

### 0.3. Gargalos e riscos identificados antes de codar

1. **Convocado ≠ `Player` do clube.** A spec deixa isso explícito: o JSON de exemplo convoca "Gabriel Martinelli (Arsenal)" e "Bruno Guimarães (Newcastle)" — atletas que quase certamente não existem no `state.players` do usuário. Precisamos de um tipo leve e independente, `NationalPlayer`, com o próprio ciclo de vida (banco recorrente da seleção), e uma **ligação opcional** (`clubPlayerId?`) só quando o convocado for de fato um jogador do elenco do usuário — é esse vínculo que dispara o desfalque no clube (§0.2, linha "Em Serviço Nacional").
2. **Two-way binding é a parte arriscada, não a criação de tela nova.** Convocar um jogador do próprio elenco precisa refletir no clube (indisponibilidade/desgaste); isso é o único ponto onde este módulo escreve em `state.players`, que é dado do clube. Precisa de um contrato de escrita muito claro (ver `CLUBOS_CONEXAO.md`) para não recriar bugs de dessincronização como os que a regra `team.budget === finance.balance` já existe para evitar no financeiro.
3. **`isPlayerBlockedFromLineup` faz switch sobre `PlayerAvailability`.** Adicionar um 5º valor (`'servico_nacional'`) exige atualizar todo lugar que trata essa enum de forma exaustiva (Squad, MatchPlay, lineup warnings, badges de status). É mais seguro **não estender a enum** e em vez disso adicionar um campo ortogonal `player.nationalDutyUntil?: string` (data ISO), verificado como uma condição adicional dentro de `isPlayerBlockedFromLineup`/`lineupWarnings`, do mesmo jeito que `availableFrom` já é tratado como uma condição paralela à enum.
4. **Ranking FIFA "de verdade" não existe no ClubOS.** O motor não tem uma base de 200+ seleções nem histórico de ranking real. **Decisão necessária:** o ranking é uma métrica *só da seleção do usuário* (um número que sobe/desce por resultado), e a "força do Top 10" citada no PDF é uma **classificação manual do adversário no momento de cadastrar o jogo** (`opponentStrength: 'top10' | 'top30' | 'outros'`), não uma tabela real. Ver §1.
5. **Partida da seleção não deve reusar o pipeline completo do `MatchPlay` do clube.** O PDF não pede lineup/tática/pulse pré-jogo para a seleção — só "Mapeamento de Jogos" (adversário/mando/data) e depois estatísticas por atleta. Recriar o pipeline de 6 steps do `MatchPlay` do clube é sobre-engenharia; um formulário mais simples (placar + lista de convocados com minutos/gols/assistências/nota, no estilo do registro do Modo Jogador) é suficiente e mais barato.
6. **`BoardState` não deve virar `scope`-aware.** Adicionar `scope: 'club' | 'national'` em `BoardGoal`/`BoardState` obrigaria a auditar todo o código que já lê `state.board` (metas, `boardGoals.ts`, checklist LiveLife, badge de rating financeiro em Board.tsx) para filtrar por escopo — alto risco de vazamento cruzado (meta da seleção contando como meta do clube). **Decisão: `NationalBoardState` é uma estrutura própria e menor** (moral da federação 0–100 + metas com um `NationalBoardGoalKind` reduzido: `reach_stage`, `win_tournament`, `avoid_relegation_ranking`), sem reaproveitar `BoardGoal`/`BoardState` por herança — só por semelhança de forma. Ver §1.
7. **Não é um "módulo satélite" como o Pulse.** Diferente do padrão em `modulos-em-desenvolvimento/` (prototipar isolado, portar depois), a Seleção Nacional depende de tipos e reducers do ClubOS desde o primeiro commit (dual career só faz sentido lendo `state.players`/`state.team`). Este módulo segue o padrão da **Fase 0 documental do Financial Update**: planejar em pasta própria, mas implementar direto no app.
8. **Volume de UI.** Datas FIFA + convocação + partidas + dashboard + diretoria da federação é, em número de telas, comparável ao módulo `/financas` inteiro. Vai exigir sua própria pasta de página (`pages/National/`, dividida em abas) desde o início — não vale a pena começar com um arquivo monolítico e quebrar depois (lição aprendida na Fase 5 do Financial Update, onde `Finance.tsx` cresceu para 1404 linhas antes do split).

---

## 1. Decisões de arquitetura (resolver antes de codar)

| Decisão | Escolha recomendada | Motivo |
|---|---|---|
| Onde mora o "modo seleção" no state | **Não é um novo `careerMode`.** Novo campo `state.activeContext: 'club' \| 'national'` (default `'club'`), independente de `careerMode`. Só existe quando `careerMode === 'coach'` — modo Jogador não tem Seleção nesta versão (ver `MELHORIAS_FUTURAS.md`). | `careerMode` decide hoje o roteador inteiro (`CoachRoutes` vs `PlayerRoutes`, invariante nº5 do handoff geral). Reaproveitar esse campo para um terceiro valor quebraria esse contrato em todo lugar que faz `careerMode === 'coach'`. Um campo ortogonal preserva a invariante e é mais barato. |
| Roteamento do modo Seleção | Nova árvore `NationalRoutes` (`/national/*`), montada **dentro** de `CoachRoutes` quando `activeContext === 'national'`, com `NationalLayout` próprio (sidebar temática) — mesmo padrão de `PlayerLayout` vs `Layout`, mas comutável em runtime (não fixado no setup). | Reaproveita o precedente arquitetural de "layout por contexto" já validado pelo modo Jogador, sem misturar o roteador de clube com o de seleção. |
| Modelo do convocado | Tipo novo **`NationalPlayer`**, independente de `Player`. Campos mínimos: `id, name, position, age, club (texto livre), overall?, caps, stats agregados`. Campo opcional `clubPlayerId?: string` só quando corresponder a um `Player` do elenco do usuário. | Convocado majoritariamente **não** é um `Player` do save (jogadores de outros clubes fictícios/reais digitados pelo usuário). Herdar de `Player` obrigaria campos que não fazem sentido fora de clube (salário, moral de vestiário, status Titular/Reserva). |
| Desfalque no clube | `Player.nationalDutyUntil?: string` (ISO) — campo ortogonal, não um novo valor de `PlayerAvailability`. `isPlayerBlockedFromLineup` ganha mais uma condição (igual já faz com `availableFrom`). | Evita quebrar todo `switch`/mapa exaustivo sobre `PlayerAvailability` espalhado em Squad/MatchPlay/badges (gargalo 3 do diagnóstico). |
| Partida da seleção | Tipo novo e **simples**, `NationalMatch` (adversário, mando, data, placar, `opponentStrength`), com performances por atleta num array plano (`NationalPlayerPerformance[]`) preenchido num formulário único pós-jogo — **sem** replicar o pipeline de 6 steps do `MatchPlay` do clube nem o `PulseMatch` pré-jogo. | A spec não pede tática/pulse pré-jogo para seleção; replicar o pipeline do clube é custo alto sem pedido correspondente. Pode entrar como melhoria futura (`MELHORIAS_FUTURAS.md`). |
| Diretoria da Seleção (Federação) | Estrutura própria **`NationalBoardState`** (moral 0–100 + metas com `NationalBoardGoalKind` reduzido: `reach_stage \| win_tournament \| avoid_relegation_ranking`) — **não** reaproveita `BoardGoal`/`BoardState` do clube. | Evita vazamento cruzado de metas/histórico entre clube e seleção (gargalo 6). Menor superfície = menor risco. |
| Ranking FIFA | Campo simples `nationalTeam.fifaRanking: number` (posição, começa numa faixa configurável no onboarding, ex. 1–210) + `fifaRankingHistory`. Evolui por resultado: vitória sobe, derrota desce, ponderado por `opponentStrength` classificado manualmente ao cadastrar o jogo (`'top10' \| 'top30' \| 'outros'`). **Não** existe base de dados de seleções reais. | O PDF pede "sistema simplificado" — não pede simulação de ranking mundial completo. Documentar essa simplificação explicitamente para não gerar expectativa de precisão real. |
| Pulse Internacional | Novo arquivo `src/pulse/nationalEvents.ts` (ou extensão do gerador existente com um escopo `'national'`), consumido só quando `activeContext === 'national'` e há uma Data FIFA ativa. Efeito: patch em `nationalTeam.federationMood` (moral) + opcionalmente em `board.mediaHistory` do **clube dono do jogador** (não implementar relação por clube estrangeiro individual — ver `MELHORIAS_FUTURAS.md`). | Reaproveita a infraestrutura de motor de eventos (`generatePulse`, cooldowns, cadeias) em vez de inventar um sistema paralelo, mas mantém o efeito simples no MVP. |
| Importação JSON de pré-lista | Novo `utils/nationalImport.ts`, mesma disciplina de `clubImport.ts` (falha tudo ou nada, limite de 30, mensagens por índice/nome). | Já existe um padrão validado no projeto — só trocar o shape validado (`NationalPlayer`, sem `status`/`personality`/`salary`). |
| Persistência | Novo campo raiz `state.nationalTeam: NationalTeamState \| null` (não populado até o onboarding). `activeContext` também raiz. Ambos entram em `migrateSave` como `undefined`/`'club'` para saves antigos. | Mesmo padrão de extensão incremental usado em `finance.monthlyBudget`/`finance.health` na v1.3 — nenhum campo novo é obrigatório em saves existentes. |
| Salvamento de versão do save | Não incrementar a string de versão do save (`0.6.0`) só por causa deste módulo — mesma decisão tomada na v1.3 (a migração depende de presença/ausência de campo, não da string). | Consistência com o precedente já documentado no handoff geral (§8). |

---

## 2. Fases

### Fase 0 — Fundação documental *(esta etapa)*

**Objetivo:** produzir os documentos de contrato, plano e backlog antes de qualquer linha de código — mesma disciplina da LiveLife Update e do Financial Update.

**Entregas:**
- `plano_de_desenvolvimento.md` (este arquivo) — diagnóstico, decisões de arquitetura, fases 1–9
- `CLUBOS_CONEXAO.md` — contrato de integração (dual career, convocação, calendário, ranking) e o que o módulo **não** cobre
- `CURSOR_MANUAL.md` — passos de portagem arquivo a arquivo + checklist por fase
- `MELHORIAS_FUTURAS.md` — expansões identificadas fora do MVP desta v1.4

---

### Fase 1 — Modelo de dados e migração *(entregue, 2026-08-26)*

**Objetivo:** criar os tipos novos sem tocar em nenhum reducer/UI existente, e estender a migração sem quebrar saves atuais.

**Arquivo novo:** `src/types/NationalTeam.ts`

```ts
export type FifaWindowType = 'eliminatorias' | 'amistoso' | 'copa_mundo' | 'copa_continental' | 'outros';
export type OpponentStrength = 'top10' | 'top30' | 'outros';
export type CallUpListSize = 23 | 26;

export interface NationalPlayer {
  id: string;
  name: string;
  position: PlayerPosition;        // reaproveita o enum já existente em types/Player.ts
  age: number;
  club: string;                    // texto livre — clube de origem do atleta
  overall?: number;
  /** Vínculo opcional com o elenco do usuário — dispara o desfalque no clube. */
  clubPlayerId?: string;
  caps: number;                    // total de convocações
  stats: {
    matches: number; minutes: number; goals: number; assists: number;
    ratingSum: number; ratingCount: number;  // média = ratingSum / ratingCount
  };
}

export interface FifaWindowGame {
  id: string;
  opponent: string;
  location: 'home' | 'away' | 'neutral';
  date: string;              // ISO
  opponentStrength: OpponentStrength;
  played: boolean;
  ourGoals?: number;
  opponentGoals?: number;
  performances?: NationalMatchPerformance[];
}

export interface NationalMatchPerformance {
  nationalPlayerId: string;
  minutes: number;
  goals: number;
  assists: number;
  rating?: number;          // 5–10, opcional (nem toda partida precisa nota)
  yellowCard?: boolean;
  redCard?: boolean;
}

export interface FifaWindow {
  id: string;
  label: string;             // sugestão automática (ex. "OUT/2026") + editável
  type: FifaWindowType;
  typeOther?: string;        // texto livre quando type === 'outros'
  startDate: string;         // ISO — início da liberação dos atletas
  endDate: string;           // ISO — fim da liberação
  listSize: CallUpListSize;
  callUpIds: string[];       // NationalPlayer.id convocados nesta janela
  games: FifaWindowGame[];
}

export type NationalBoardGoalKind = 'reach_stage' | 'win_tournament' | 'avoid_relegation_ranking';

export interface NationalBoardGoal {
  id: string;
  kind: NationalBoardGoalKind;
  label: string;
  target: number;
  current: number;
  status: 'active' | 'done' | 'failed';
}

export interface NationalTeamState {
  name: string;
  primaryColor?: string;
  secondaryColor?: string;
  federationMood: number;          // 0–100, equivalente a boardConfidence
  fifaRanking: number;
  fifaRankingHistory: { date: string; value: number }[];
  talentPool: NationalPlayer[];    // banco recorrente de convocados
  windows: FifaWindow[];
  goals: NationalBoardGoal[];
  onboardedAt: string;             // currentDate do jogo no momento da criação
}
```

**O que muda em código existente**

| Arquivo | Alteração |
|---|---|
| `src/context/GameContext.tsx` (`GameState`) | `activeContext: 'club' \| 'national'` e `nationalTeam: NationalTeamState \| null` |
| `src/context/GameContext.tsx` (initial state) | `activeContext: 'club'`, `nationalTeam: null` |
| `src/types/Player.ts` | `Player.nationalDutyUntil?: string` (ISO) — campo ortogonal, sem tocar em `PlayerAvailability` |
| `src/utils/Player.ts` (`isPlayerBlockedFromLineup`) | nova condição: bloqueado se `nationalDutyUntil` estiver no futuro em relação a `gameDate`, igual ao tratamento de `availableFrom` |
| `src/services/storage.ts` (`migrateSave`) | preencher `activeContext = 'club'` e `nationalTeam = null` quando ausentes (opt-in total — nada é criado até o onboarding) |

**Critério de pronto**
- `npm run build` sem erros.
- Save antigo carrega normalmente com `activeContext: 'club'` e `nationalTeam: null`.
- `isPlayerBlockedFromLineup` com `nationalDutyUntil` no passado não bloqueia nada (comportamento idêntico ao atual).

---

### Fase 2 — Ativação do Modo Seleção (dual career switch) *(entregue, 2026-08-26)*

**Objetivo:** o seletor no Dashboard, o onboarding (nome da seleção) e o roteamento/layout do novo contexto.

**O que muda**

| Arquivo | Alteração |
|---|---|
| `context/GameContext.tsx` | Nova action `SET_ACTIVE_CONTEXT` (`'club' \| 'national'`); `CREATE_NATIONAL_TEAM` (nome + cores) → popula `nationalTeam` com defaults (`federationMood: 60`, `fifaRanking` escolhido no onboarding, arrays vazios) |
| `pages/Dashboard/Dashboard.tsx` | Seletor `[ Modo Clube ] [ Modo Seleção ]` no topo; se `nationalTeam === null` e usuário clica Seleção → abre modal de onboarding em vez de navegar |
| `components/NationalOnboarding/` (novo) | Modal: nome da seleção nacional (+ cores opcionais) |
| `App.tsx` | Dentro de `CoachRoutes`: se `activeContext === 'national'` → monta `NationalLayout` + `NationalRoutes` (`/national/dashboard`, `/national/windows`, `/national/squad`, `/national/board`) em vez do `Layout` de clube |
| `components/NationalLayout/` (novo) | Sidebar temática (usa `clubColors.ts` com as cores da seleção), botão para voltar ao Modo Clube |

**Critério de pronto**
- Alternar para Seleção pela primeira vez sempre abre onboarding; nas próximas vezes vai direto para `/national/dashboard`.
- Alternar de volta para Clube preserva exatamente o estado do clube (nenhuma mutação cruzada).
- Recarregar a página com `activeContext: 'national'` salvo reabre no contexto correto.
- `npm run build` limpo.

---

### Fase 3 — Datas FIFA e mapeamento de jogos *(entregue, 2026-08-26)*

**Objetivo:** CRUD de `FifaWindow` com sugestão automática de nome, janela temporal, tipo de competição e jogos individuais.

**O que muda**

| Arquivo | Alteração |
|---|---|
| `utils/nationalWindows.ts` (novo) | `suggestWindowLabel(startDate, type)` (ex. `"OUT/2026"` ou `"Eliminatórias Copa do Mundo 2026"` conforme `type`); `createFifaWindow(...)` |
| `context/GameContext.tsx` | Actions `ADD_FIFA_WINDOW`, `UPDATE_FIFA_WINDOW`, `ADD_FIFA_WINDOW_GAME`, `UPDATE_FIFA_WINDOW_GAME` |
| `pages/National/Windows/` (novo) | Lista de Datas FIFA (abas navegáveis por janela, como pedido no PDF §3.2) + botão "Adicionar Data FIFA" + modal de criação + modal "Adicionar jogo" (adversário/mando/data/força do adversário) |

**Critério de pronto**
- Criar uma Data FIFA sem jogos é permitido (mapeamento de jogos é incremental).
- Sugestão de nome não trava se `type === 'outros'` sem `typeOther`.
- Datas de jogo fora da janela (`startDate`–`endDate`) mostram aviso, mas não bloqueiam (o usuário pode ajustar depois).

---

### Fase 4 — Sistema de convocação e banco de talentos *(entregue, 2026-08-27)*

**Objetivo:** convocar 23/26 atletas por Data FIFA, com banco recorrente, inclusão manual e importação JSON.

**O que muda**

| Arquivo | Alteração |
|---|---|
| `utils/nationalImport.ts` (novo) | `parseNationalImport(raw)` — mesma disciplina de `clubImport.ts` (falha tudo ou nada), limite de 30 por arquivo, valida `nome/posicao/clube/idade` |
| `context/GameContext.tsx` | Actions `ADD_NATIONAL_PLAYER` (manual ou import, entra em `talentPool`), `SET_CALL_UP_LIST` (define `listSize` + `callUpIds` da janela), `LINK_NATIONAL_PLAYER_TO_CLUB` (seta `clubPlayerId`) |
| `pages/National/Squad/` (novo) | Aba "Convocação" da Data FIFA ativa: seletor 23/26, lista do banco recorrente com checkbox, botão "Cadastrar atleta" (manual), botão "Importar JSON", contador ao vivo (`x/23` ou `x/26`) |

**Critério de pronto**
- Importar JSON com mais de 30 entradas falha com mensagem clara, nada é parcialmente aceito.
- Selecionar mais convocados que `listSize` bloqueia com aviso.
- Um `NationalPlayer` já convocado antes aparece pré-marcado como "já convocado Nx" no banco recorrente.

---

### Fase 5 — Conflito de calendário com o clube ("Em Serviço Nacional") *(entregue, 2026-08-27)*

**Objetivo:** quando um convocado tem `clubPlayerId`, o jogador correspondente no elenco do usuário fica marcado durante a janela da Data FIFA.

**O que muda**

| Arquivo | Alteração |
|---|---|
| `context/GameContext.tsx` (efeito de `SET_CALL_UP_LIST`) | Para cada `callUpId` convocado com `clubPlayerId` setado: `player.nationalDutyUntil = window.endDate`. Ao remover da lista ou ao fechar a janela: limpar o campo. |
| `pages/Squad/Squad.tsx` | Badge "Em Serviço Nacional até DD/MM" nos jogadores com `nationalDutyUntil` no futuro (mesmo padrão visual de `availabilityStatusLabel`) |
| `utils/Player.ts` (`availabilityStatusLabel`) | Incluir o caso `nationalDutyUntil` no futuro, com prioridade **abaixo** de lesão/suspensão real (se o jogador está lesionado E em serviço nacional, mostra lesão) |
| `pages/MatchPlay/*` (lineup) | `isPlayerBlockedFromLineup` já cobre o bloqueio (Fase 1) — só validar que o aviso na tela de escalação reflete o motivo certo |

**Critério de pronto**
- Convocar um jogador do próprio elenco bloqueia a escalação dele no clube durante a janela, com o motivo certo na UI.
- Ao fechar/expirar a Data FIFA, o jogador volta a ficar disponível automaticamente (checagem no `ADVANCE_DAY`, mesmo padrão de recuperação de lesão).
- Jogador sem `clubPlayerId` (convocado que não é do elenco do usuário) não afeta nada no clube — é só um registro dentro da seleção.

**Ajuste pós-entrega (2026-08-27):** a UX de cadastro na Convocação foi revista — o modal "Cadastrar atleta" agora abre com um seletor "Novo atleta" vs. "Do elenco do clube"; a segunda aba lista o elenco do usuário (excluindo quem já está no banco) e um clique adiciona direto, já vinculado (`clubPlayerId`), sem precisar redigitar nome/posição/idade nem usar o `SearchableSelect` de vínculo separado. A importação JSON (`parseNationalImport`) também passou a receber `state.players` e faz auto-vínculo por nome idêntico (case-insensitive) — se o `nome` da pré-lista bater com um jogador do elenco, `clubPlayerId` é setado automaticamente na importação.

---

### Fase 6 — Partidas da seleção, estatísticas e visão geral de convocados *(entregue, 2026-08-27)*

**Objetivo:** registrar resultado + desempenho individual por jogo da Data FIFA; consolidar histórico e ranking de desempenho.

**O que muda**

| Arquivo | Alteração |
|---|---|
| `context/GameContext.tsx` | Action `COMPLETE_NATIONAL_MATCH` (placar + `NationalMatchPerformance[]`) → atualiza `NationalPlayer.stats` (acumulado) e `game.played = true`; recalcula `fifaRanking` (Fase 8) |
| `utils/nationalStats.ts` (novo) | `aggregateCallUpOverview(nationalTeam)` → tabela consolidada (partidas, minutos, gols, assistências, média de nota) por atleta na era do treinador, para a "Visão Geral de Convocados" do PDF §3.2 |
| `pages/National/Windows/` | Formulário único pós-jogo: placar + lista dos convocados daquela janela com campos minutos/gols/assistências/nota/cartão |
| `pages/National/Squad/` | Aba "Visão Geral" — tabela consolidada + filtro por Data FIFA (histórico) |

**Critério de pronto**
- Registrar um jogo sem preencher performance de todos os convocados é permitido (nem todos jogam).
- Stats acumulados de `NationalPlayer` batem com a soma manual dos jogos registrados (teste mental com 2–3 jogos).
- Editar um jogo já registrado recalcula os agregados (não duplica).

**Nota de implementação:** não foi criada uma action `COMPLETE_NATIONAL_MATCH` separada — a action genérica `UPDATE_FIFA_WINDOW_GAME` (Fase 3) já aceitava `played`/`ourGoals`/`opponentGoals`/`performances`; o reducer foi estendido para, sempre que `performances` ou `played` estiverem no patch, recalcular `talentPool[].stats` do zero via `utils/nationalStats.ts` (`recomputeNationalPlayerStats`) — mesmo padrão diff-free de `recomputeNationalDuty`. Isso evita duplicar a lógica de patch de jogo em duas actions.

**Revisão (Fase 6.1, 2026-08-27):** o formulário único pós-jogo acima foi descartado a pedido do usuário — "deve ser exatamente como no clube", com escalação, tática própria da Seleção e eventos ao vivo (gols, cartões, substituições, lesões), não só um placar + tabela de notas. Em vez de duplicar `FormationField`/`utils/formations.ts`/os steps de `pages/MatchPlay`, a Seleção reaproveita esse motor inteiro:
- `utils/nationalMatchPlay.ts` (novo) — converte `NationalPlayer` num `Player` "de mentirinha" (`nationalPlayerToPseudoPlayer`) com `status: 'Titular'`/`availability: 'disponivel'` fixos (nunca bloqueado — a Seleção não tem lesão/suspensão própria, só "convocado ou não"); e `buildNationalPerformances`, que deriva `NationalMatchPerformance[]` (minutos via `getMatchPlayingTime`, gols/assistências/cartões contados dos eventos estruturados) — substitui a entrada manual de minutos/nota do formulário antigo.
- `utils/playingTime.ts` (`getMatchPlayingTime`/`getPlayersWhoPlayed`) e `utils/matchStats.ts` (`getHomeAway`) tiveram a assinatura generalizada para uma interface estrutural mínima (`PlayingTimeSource`/`HomeAwaySource`) em vez de exigir `Match` — mudança compatível, `Match` continua satisfazendo; permite reusar as mesmas funções para `FifaWindowGame`.
- `FifaWindowGame` ganhou os mesmos campos estruturados do `Match` do clube: `lineup`, `goals`, `assists`, `cards`, `substitutions`, `injuries`, `opponentGoals`/`opponentCards`/`opponentSubs` (estruturados), `playerRatings`, `motmNationalPlayerId`/`worstNationalPlayerId`, `description`. Os campos de placar final foram renomeados `ourGoals`→`goalsFor`/`opponentGoals`(número)→`goalsAgainst` para abrir o nome `opponentGoals` para a lista estruturada, espelhando exatamente a nomenclatura de `Match`.
- `NationalTeamState` ganhou `tactics`/`tacticsPresets`/`activeTacticsId` (mesmo formato de `state.tactics` do clube) + actions `SAVE_NATIONAL_TACTICS_PRESET`/`DELETE_NATIONAL_TACTICS_PRESET`/`SET_ACTIVE_NATIONAL_TACTICS` espelhando as do clube 1:1.
- `pages/National/Tactics/NationalTactics.tsx` (novo, nav "Tática") — cópia funcional de `pages/Tactics/Tactics.tsx` sobre o banco de talentos inteiro (reaproveita até o CSS module do clube via import cruzado).
- `pages/National/MatchPlay/NationalMatchPlay.tsx` (novo, rota `/national/match/:windowId/:gameId/play`, fora do `NationalLayout` — full-screen, igual `/match/:matchId/play`) — cópia funcional de `pages/MatchPlay/MatchPlay.tsx` reaproveitando todos os steps (`ScoreStep`, `TeamGoalsStep`, `OpponentGoalsStep`, `PathChoiceStep`, `EventsStep`, `MatchSummaryStep`, `MatchResultStep`, `MatchRecapStep`) sem modificação — escalação parte só dos convocados da Data FIFA (`resolveTactics` já filtra pelo roster passado).
- Lesão sofrida em serviço na Seleção por um convocado com `clubPlayerId` agora reflete no `Player` do clube (`availability: 'lesionado'`, `injuryDaysRemaining` calculado via `daysBetweenIso`) — tratado dentro do reducer de `UPDATE_FIFA_WINDOW_GAME`.
- `pages/National/Windows/NationalWindows.tsx` — botão "Registrar resultado" virou "Jogar partida"/"Editar partida", navega para a nova rota; o modal de formulário manual (`RegisterResultModal`) foi removido por completo.

**Revisão (Fase 6.2, 2026-08-27) — Data FIFA como hub:** o usuário redesenhou a navegação: "a Data FIFA é o hub — você clica nela e dentro dela configura tudo: jogos, convocação, tática, elenco". Isso substitui a estrutura de páginas separadas (Datas FIFA / Convocação / Tática) por:
- `pages/National/Windows/NationalWindows.tsx` — agora é só a LISTA de Datas FIFA (cards clicáveis, marca a que está ativa na data atual do jogo); ao criar ou clicar numa, navega para o hub.
- `pages/National/WindowHub/NationalWindowHub.tsx` (novo, rota `/national/windows/:windowId`) — o hub: header com "Dia N de M" quando a data atual cai dentro da janela, e 3 abas — **Jogos** (o que já era Fase 6.1, mapear/jogar), **Convocação** (seleção de convocados + numeração, ver abaixo) e **Tática** (o que era `NationalTactics.tsx`, agora escopado só aos convocados desta janela).
- `pages/National/PlayerBase/NationalPlayerBase.tsx` (novo, rota `/national/players`, nav "Base de Jogadores") — CRUD do banco recorrente (cadastro manual/importação JSON/remoção/vínculo ao clube), extraído da antiga `NationalSquad.tsx`. Convocar (marcar quem joga nesta janela) e cadastrar (adicionar ao banco) viraram telas propositalmente separadas.
- `pages/National/History/NationalHistory.tsx` (novo, rota `/national/history`, nav "Histórico") — resumo da gestão (nº de Datas FIFA, V/E/D e saldo de gols desde que assumiu) + a tabela "Visão Geral de Convocados" (antes uma aba dentro de `NationalSquad.tsx`) via `aggregateCallUpOverview`.
- `NationalSquad.tsx` e `NationalTactics.tsx` foram **removidos** (totalmente absorvidos pelo hub/Base de Jogadores/Histórico acima).
- `NationalDashboard.tsx` — prioridade agora é a Data FIFA ativa ou a próxima (card em destaque com CTA "Entrar na Data FIFA →"); os cards secundários apontam para Datas FIFA/Base de Jogadores/Histórico/Diretoria.

**Numeração por convocação:** `FifaWindow.callUpNumbers: Record<nationalPlayerId, number>` — específica de cada Data FIFA (não um atributo fixo do `NationalPlayer`, times reais trocam número de uma convocação pra outra). Ao marcar alguém como convocado pela primeira vez nesta janela, `carryOverCallUpNumber` (`utils/nationalWindows.ts`) sugere automaticamente o número da convocação anterior mais recente em que ele apareceu; sem histórico, fica em branco ("—", editável a qualquer momento em Convocação).

**Tática por Data FIFA + herança de convocação:** `tactics`/`tacticsPresets`/`activeTacticsId` saíram de `NationalTeamState` (Fase 6.1) e foram para dentro de cada `FifaWindow` — cada Data FIFA tem sua própria tática, porque o elenco disponível (convocados) muda de janela pra janela. `carryOverTacticsDraft` monta o rascunho inicial de uma Data FIFA sem tática salva: quem repete convocação da Data FIFA anterior entra na mesma posição; quem é novo na lista entra no banco (até o limite) em vez de ficar solto. As actions `SAVE_NATIONAL_TACTICS_PRESET`/`DELETE_NATIONAL_TACTICS_PRESET`/`SET_ACTIVE_NATIONAL_TACTICS` passaram a receber `windowId`.

**Dia dentro da Data FIFA:** `dayInWindow`/`windowTotalDays` (`utils/nationalWindows.ts`) traduzem a data real do jogo (`state.currentDate`, calendário único e compartilhado com o clube) em "Dia N de M" relativo ao início da janela — usado no header do hub e na lista de jogos mapeados, no lugar da data absoluta.

**Revisão (Fase 6.3, 2026-08-27) — checklist de pendências e listSize só na criação:**
- O tamanho da convocação (23/26) só é escolhido na criação da Data FIFA (`CreateWindowModal`, tela de lista) — o seletor duplicado que existia dentro da aba Jogos foi removido; `listSize` não é mais editável depois de criada.
- Ao entrar no hub, se a Data FIFA ainda não tem convocados ou não tem nenhum jogo mapeado, aparece um card de "Pendências" (Convocar jogadores / Registrar compromissos) — cada item leva direto pra aba certa. Enquanto pendente, a aba **Tática** fica desabilitada (🔒) e os botões "Jogar partida"/"Editar partida" também, com tooltip explicando o motivo. As abas Jogos e Convocação continuam sempre acessíveis (são elas que resolvem a pendência).

**Pendente (não incluído nesta revisão):** coletiva de imprensa no dia anterior a cada jogo da Data FIFA. O sistema de coletivas do clube (`pressconference/engine.ts`, `utils/pressTriggers.ts`) é fundo a fundo acoplado a conceitos só do clube (boardConfidence/supporterConfidence/mediaConfidence, LiveLife) — reaproveitar tal como está misturaria a moral da federação com a do clube, contra o princípio já registrado no §1 deste plano. Fica como próximo passo: uma versão enxuta e independente (poucas perguntas, afeta só `federationMood`), sinalizada por jogo (`FifaWindowGame`) em vez do sistema `pressPreDoneDates` do clube.

---

### Fase 7 — Dashboard internacional e diretoria da federação *(entregue, 2026-08-27)*

**Objetivo:** telas de liderança de desempenho e painel da federação (metas + moral), como pedido no PDF §4.

**O que muda**

| Arquivo | Alteração |
|---|---|
| `pages/National/Dashboard/` (novo) | Módulos: Maiores Artilheiros / Líderes de Assistência / Maior Nota Média (deriva de `nationalStats.ts`), próxima Data FIFA/jogo, termômetro de moral da federação |
| `pages/National/Board/` (novo) | CRUD de `NationalBoardGoal` (3 tipos definidos em §1), histórico simples de `federationMood` |
| `context/GameContext.tsx` | Actions `ADD_NATIONAL_GOAL`, `UPDATE_NATIONAL_GOAL`, `ADJUST_FEDERATION_MOOD` |

**Critério de pronto**
- Dashboard sem nenhum jogo registrado ainda mostra estado vazio, não erro/`NaN`.
- Metas da federação nunca aparecem misturadas com metas do clube (`Board.tsx` do clube não lê `nationalTeam.goals`, e vice-versa).

**Nota de implementação:** o Dashboard (hero + Data FIFA ativa/próxima + moral) já tinha sido adiantado nas revisões Fase 6.2/6.3 a pedido do usuário; esta fase completou o que faltava — o widget de líderes (Artilheiro/Assistências/Nota, via `aggregateCallUpOverview`, só aparece quando há pelo menos um gol/assistência/nota registrada) e `pages/National/Board/NationalBoard.tsx` (novo): CRUD manual de `NationalBoardGoal` (3 tipos, sem motor de progresso automático — target/current editados à mão, status Ativa/Concluída/Fracassada definido manualmente) + moral da federação com ajuste manual (±5, motivo opcional) e histórico (`federationMoodHistory`, novo campo). Actions novas: `ADD_NATIONAL_GOAL`/`UPDATE_NATIONAL_GOAL`/`REMOVE_NATIONAL_GOAL`/`ADJUST_FEDERATION_MOOD`. Nenhum gatilho automático liga resultado de partida à moral/ranking ainda — isso é o Pulse Internacional da Fase 8.

---

### Fase 8 — Ranking FIFA dinâmico + Pulse Internacional *(entregue, 2026-08-27)*

**Objetivo:** pontuação simplificada de ranking por resultado, e eventos narrativos de conflito com clubes europeus.

**O que muda**

| Arquivo | Alteração |
|---|---|
| `utils/nationalRanking.ts` (novo) | `applyRankingDelta(current, result, opponentStrength)` — vitória sobe (mais contra `top10`), derrota desce, empate quase neutro; clamp em faixa razoável (ex. 1–210) |
| `context/GameContext.tsx` (`COMPLETE_NATIONAL_MATCH`) | Chama `applyRankingDelta` e empurra em `fifaRankingHistory` |
| `src/pulse/nationalEvents.ts` (novo) | Evento(s) de "clube pede desconvocação para amistoso" — só dispara se houver Data FIFA tipo `amistoso` ativa e algum convocado com `clubPlayerId`; ceder = pequeno bônus de moral do clube de origem (fora de escopo modelar clube estrangeiro — ver `MELHORIAS_FUTURAS.md`) e remove o atleta da lista; recusar = pequeno bônus de força da seleção (sem remoção) e leve atrito |
| `pages/National/Dashboard/` | Badge de ranking FIFA + variação (↑/↓) desde o último jogo |

**Critério de pronto**
- Ranking nunca sai da faixa configurada (clamp).
- Evento de desconvocação só aparece em janelas `amistoso`, nunca em `copa_mundo`/`eliminatorias` (essas não têm essa mecânica no PDF).
- Documentar claramente (produto) que o ranking é uma métrica simplificada da própria seleção, não uma tabela real de 200+ países.

**Nota de implementação:**
- `utils/nationalRanking.ts` (novo) — `applyRankingDelta`/`outcomeFromScore`: tabela fixa de variação por resultado × força do adversário (vitória sobre `top10`: -4 posições / empate: -1 / derrota: +1; sobre `outros`: -1 / +1 / +4 — perder pro fraco dói mais que perder pro forte). Clamp em [1, 210].
- Sem action `COMPLETE_NATIONAL_MATCH` (nunca existiu — ver nota da Fase 6.1): o gatilho foi plugado no reducer de `UPDATE_FIFA_WINDOW_GAME`, só na transição `played: false → true` (editar um jogo já registrado não pontua de novo), empurrando em `fifaRankingHistory`.
- `src/pulse/nationalEvents.ts` (novo) — `findNationalDeconvocationOpportunity`: função pura e independente do Pulse do clube (que é todo acoplado a moral de elenco/imprensa/LiveLife — não haveria como reaproveitar sem misturar conceitos). Só considera Data FIFA `amistoso` ativa na data atual, primeiro convocado com `clubPlayerId` ainda não resolvido nesta janela (`FifaWindow.deconvocationResolvedIds`, novo campo). Surge como card no Dashboard com "Ceder"/"Recusar" — ceder remove da convocação (recalcula `nationalDutyUntil` do clube) e dá pequeno bônus de confiança ao clube do usuário; recusar mantém o convocado e dá pequeno bônus de moral da federação + leve atrito na confiança do clube.
- Dashboard: badge de ranking FIFA agora mostra variação (↑/↓ N) comparando as duas últimas entradas de `fifaRankingHistory`.

---

### Fase 9 — Testes, checklist e documentação *(entregue, 2026-08-27)*

**Testes mentais obrigatórios** (mesmo padrão dos handoffs existentes):
- Load de save v1.3 sem `activeContext`/`nationalTeam` → vira `'club'`/`null`, nenhuma tela de Seleção aparece sem onboarding.
- Alternar Clube ⇄ Seleção repetidamente não duplica nem perde estado de nenhum dos dois lados.
- Convocar e depois **remover** um jogador do próprio elenco da lista antes do fim da janela devolve a disponibilidade dele no clube.
- Data FIFA sem nenhum jogo cadastrado não quebra a Visão Geral (tabela vazia, não erro).
- `careerMode === 'player'` nunca vê o seletor de Modo Seleção (fora de escopo nesta versão).
- `npm run build` (tsc) e `npm run lint` limpos ao final de cada fase.

**Documentação a criar/atualizar ao final:**
- `docs/roadmap.md` — nova seção "International Duty (v1.4)" em "Disponível agora", saindo de "Em construção".
- `docs/HANDOFF_CLUBOS_CLAUDE.md` — nova seção "Modo Seleção / Dual Career" (§4/§5) + atualizar versão do produto (v1.3 → v1.4) + invariantes novas (nº16: `nationalDutyUntil` ortogonal a `PlayerAvailability`; nº17: `nationalTeam` e `board` do clube nunca se misturam).
- Novo `docs/selecao-nacional.md` (manual de produto, no padrão de `docs/sistema-financeiro.md`) — cobrindo Datas FIFA, convocação, ranking, Pulse Internacional.
- Entrada no changelog da Diretoria (`Board.tsx`): "v1.4 — International Duty Update".

**Nota de implementação:**
- Todos os testes mentais acima foram verificados lendo o código (não só "mentalmente"): `LOAD_SAVE`/`normalizeNationalTeam` cobrem save antigo; `SET_ACTIVE_CONTEXT` é um flip de flag puro (não toca em `nationalTeam`/clube) e bloqueia `'national'` sem `nationalTeam` e fora de `careerMode === 'coach'`; `recomputeNationalDuty` já é chamado após `SET_CALL_UP_LIST`/`LINK_NATIONAL_PLAYER_TO_CLUB`/etc. (Fase 5); `NationalHistory`/`aggregateCallUpOverview` tratam janela vazia sem erro; o seletor de Modo Seleção só existe em `pages/Dashboard/Dashboard.tsx` (coach), nunca nas páginas de `pages/Player/*`.
- Documentação: `docs/roadmap.md` ganhou a seção "Modo Seleção / Dual Career (v1.4)" em "Disponível agora" + linha na tabela de versões. `docs/HANDOFF_CLUBOS_CLAUDE.md` ganhou uma nova **§15** "Modo Seleção / Dual Career" (inserida antes da antiga última seção, que virou §16 — único renumero necessário, sem outras referências cruzadas por número no arquivo), atualização de versão do produto, linha de estado (`activeContext`/`nationalTeam`), índice "mexa aqui", backlog e as invariantes nº16/17 pedidas. `docs/selecao-nacional.md` (novo) documenta o módulo inteiro no padrão de `sistema-financeiro.md`. `types/LiveLife.ts` (`LIVELIFE_CHANGELOG`, lido por `Board.tsx`) ganhou a entrada "v1.4 — International Duty Update".

---

## 3. Ordem recomendada de execução

```
Fase 1 (dados/migração)
  → Fase 2 (dual career switch, depende de 1)
       ↓
  Fase 3 (Datas FIFA, depende de 2)
       ↓
  Fase 4 (convocação, depende de 3)
       ↓
  Fase 5 (conflito de calendário, depende de 4 e do Player.ts da Fase 1)
       ↓
  Fase 6 (partidas + stats, depende de 4)
       ↓
  Fase 7 (dashboard + diretoria da federação, depende de 6)
       ↓
  Fase 8 (ranking + Pulse Internacional, depende de 6)
       ↓
  Fase 9 (testes/docs — fecha o épico)
```

Fases 1–2 são pré-requisito de tudo (sem elas não existe nem o contexto "seleção" nem onde guardar dados). Fase 5 é a única que escreve em dados do clube — tratar com mais cautela e mais teste manual que as demais. Nenhuma fase toca em `finance.*`, `tactics.*` ou no pipeline `COMPLETE_MATCH` do clube — o motor de clube existente permanece intocado, a seleção é um contexto adicional que lê `state.players`/`state.team` só para o vínculo de convocação.

---

## 4. O que NÃO entra nesta v1.4 (fora de escopo)

- Modo Jogador com Seleção Nacional (o atleta sendo convocado) — fica para uma versão futura, ver `MELHORIAS_FUTURAS.md`.
- Pipeline completo de partida (lineup/tática/Pulse pré-jogo) para jogos da seleção — só registro pós-jogo (placar + performances).
- Base de dados real de seleções/ranking FIFA mundial — ranking é simplificado e autocontido.
- Modelagem individual de "clubes europeus" como entidades com relação própria — o Pulse Internacional afeta a seleção e, no máximo, o clube de origem do atleta (se for o clube do usuário), não uma rede de clubes externos.
- Convocação automática por IA/sugestão de escalação ideal — inclusão é sempre manual ou via JSON.
