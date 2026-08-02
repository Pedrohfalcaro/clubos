# ClubOS — Plano de Desenvolvimento Modular: LiveLife Update (v1.2)

> **Status (ago/2026):** MVP das Fases 0–8 **entregue**. Guia de uso: [`docs/livelife-v1.2.md`](../docs/livelife-v1.2.md) · Resumo: [`ENTREGA_V1_2.md`](./ENTREGA_V1_2.md).

> **Lead Developer & Game Designer Perspective**
> Este documento organiza o desenvolvimento do *LiveLife Update* em fases incrementais e independentes, ancoradas no estado real do código atual. Cada fase entrega valor jogável por si só; não é necessário completar a fase seguinte para que a anterior funcione em produção.

---

## Diagnóstico do código base

| Pilar da spec | Estado atual | Arquivo principal |
|---------------|-------------|-------------------|
| Data contínua / Avançar Dia | **Ausente** — `season` é apenas o ano; calendário é agenda de jogos | `GameContext.tsx` |
| Lesões com countdown | **Parcial** — `availability: 'lesionado'` existe, sem `daysLeft` | `Player.ts`, `GameContext.tsx` |
| Bilheteria / estádio | **Ausente** — `Team.fans` existe; capacidade/ingressos não | `Team.ts`, `Finance.ts` |
| Folha dia 5 | **Parcial** — `PAY_WAGES` existe mas é manual, usa relógio real | `Finance.tsx`, `GameContext.tsx` |
| Premiações automáticas | **Parcial** — `prizeTable` + UI mas não auto em `COMPLETE_MATCH` | `GameContext.tsx` |
| ClubOSocial / Coletivas / Troféus | **Só stubs WIP** em `Layout.tsx` → `/under/:section` | `Layout.tsx`, `App.tsx` |
| Checklist + Changelog (Diretoria) | **Ausente** em `Board.tsx` | `Board.tsx` |

### Gargalos críticos de arquitetura

1. **`COMPLETE_MATCH` não fecha o loop financeiro:** marca lesão sem duração e não lança bilheteria nem premiação no ledger.
2. **Datas do ledger usam `new Date()` real:** folha "dia 5 do jogo" quebra sem um clock de jogo interno.
3. **Carreiras existentes não têm `currentDate`:** migração obrigatória em `storage.ts` + modal de ativação.
4. **Sidebar já reserva as rotas Social/Manager** — integração = substituir stubs WIP, não criar nova navegação.
5. **Pulse hoje só rola em pré-partida** — estender para disparo diário requer parametrização, não reescrita.

---

## Fluxo macro do LiveLife

```
ADVANCE_DAY
  ├── tick lesões (–1 dia; zera → disponivel)
  ├── check folha (dia 5 do mês? → modal PAY_WAGES)
  ├── chance Pulse diário (parametrizado, só dias sem jogo)
  └── dia de jogo? → /match/:id/pulse → /match/:id/play
                                              └── COMPLETE_MATCH
                                                    ├── bilheteria (casa/fora)
                                                    ├── premiação auto (prizeTable)
                                                    └── manchete pós-jogo
```

---

## Fase 0 — Fundação documental *(esta etapa — já entregue)*

**Objetivo:** Criar os documentos de contratos, plano e backlog antes de qualquer linha de código no app.

**Entregas:**
- `plano_de_desenvolvimento.md` (este arquivo)
- `CLUBOS_CONEXAO.md` — contrato input/output LIVE + LIFE
- `CURSOR_MANUAL.md` — passos de portagem para o agente
- `MELHORIAS_FUTURAS.md` — expansões fora do MVP

---

## Fase 1 — Estrutura de datas e calendário contínuo

**Objetivo:** Transformar o Dashboard numa tela de "próximo dia", substituindo o CTA "Jogar" por "Avançar Dia".

### O que muda

| Arquivo | Alteração |
|---------|-----------|
| `src/types/Team.ts` | Nenhuma — clock é global |
| `src/context/GameContext.tsx` | `GameState.currentDate: string` (ISO); action `ADVANCE_DAY`; migrate sem data → null |
| `src/services/storage.ts` | `migrateSave`: adicionar `currentDate: null` se ausente |
| `src/pages/NewCareer/` (setup) | Campo "data de início" ao criar carreira (default: 01/01/ano atual) |
| `src/pages/Board/Board.tsx` | Campo "Data base da carreira" em Identidade do Clube; modal LiveLife se vazio |
| `src/pages/Dashboard/Dashboard.tsx` | CTA principal → **"Avançar Dia"** + badge da data atual; Jogar persiste como botão secundário quando há partida no dia |
| `src/utils/finance.ts` | `newLedgerEntry` passa a receber `gameDate` (ISO) em vez de `new Date()` |

### Action `ADVANCE_DAY`

```ts
// Input: nenhum (usa state.currentDate)
// Output: nextDate + eventos disparados []
// Efeitos colaterais via actions encadeadas:
//   TICK_INJURIES, (condicional) TRIGGER_PAYROLL_MODAL, (condicional) navigateToMatch
```

### Critério de pronto
- Dashboard exibe data do jogo e botão Avançar Dia.
- Clicar Avançar em dia com partida agendada vai para `/match/:id/pulse`.
- Carreiras sem data mostram modal de ativação LiveLife.
- Build passa sem erros TypeScript.

---

## Fase 2 — Lesões e status temporal

**Objetivo:** Lesões passam a ter duração real em dias de jogo; suspensos por STJD entram como tipo distinto.

### O que muda

| Arquivo | Alteração |
|---------|-----------|
| `src/types/Player.ts` | `injuryDaysRemaining?: number`; `PlayerAvailability` adiciona `'suspenso'` |
| `src/context/GameContext.tsx` | Action `TICK_INJURIES`: decrementa `injuryDaysRemaining`; ao zerar → `'disponivel'`; `COMPLETE_MATCH` passa a setar `injuryDaysRemaining` quando gera lesão |
| `src/utils/formations.ts` | Hard-block (não só aviso) para `'lesionado'` e `'suspenso'` na seleção da súmula |
| `src/pages/MatchPlay/MatchPlay.tsx` | Confirmar bloqueio visual + label "Lesionado X dias" / "Suspenso X dias" |

### Critério de pronto
- Lesão gerada pelo Pulse ou COMPLETE_MATCH define `injuryDaysRemaining`.
- A cada Avançar Dia, contador decrementa e disponibilidade auto-restaura.
- Atleta lesionado/suspenso não pode ser selecionado na súmula.

---

## Fase 3 — Motor financeiro e bilheteria

**Objetivo:** Fechar o loop econômico: cada partida gera receita real; folha é cobrada automaticamente no dia 5.

### Novos tipos

```ts
// Finance.ts
type LedgerEntryType = ... | 'ticket' | 'travel' | 'stadium_ops';

interface StadiumConfig {
  capacity: number;
  ticketPriceHome: number;
  ticketPriceAway: number;
  maintenanceCostPerMatch: number;
  travelCostAverage: number;
}
```

`StadiumConfig` vive em `ClubFinance` (não em `Team` — é dado financeiro).

### Fórmulas (espelhar spec)

```
// Mandante
publico     = fans * supporterConfidence * capacity * rand(0.6, 1.0)
receitaBruta = publico * ticketPriceHome
entradaCaixa = receitaBruta - maintenanceCostPerMatch

// Visitante
publicoVisitante = (fans / 2) * rand(0.3, 0.7)
receitaVisitante = publicoVisitante * ticketPriceAway
entradaCaixa = receitaVisitante - travelCostAverage
```

### O que muda

| Arquivo | Alteração |
|---------|-----------|
| `src/types/Finance.ts` | `StadiumConfig`, novos `LedgerEntryType` |
| `src/types/Team.ts` | Nenhuma — stadium fica em Finance |
| `src/context/GameContext.tsx` | `COMPLETE_MATCH`: calcular bilheteria + lançar ledger `ticket`/`travel`/`stadium_ops`; auto-apply `prizeTable` se competição configurada; `ADVANCE_DAY` verifica dia 5 → modal folha |
| `src/pages/Finance/Finance.tsx` | Seção "Configurações do Estádio" (capacidade, preços, custos) |
| `src/utils/finance.ts` | Funções puras `calcGateRevenue`, `calcTravelCost` |

### Critério de pronto
- Ao finalizar partida, ledger ganha entradas de bilheteria automaticamente.
- Premiação por vitória/empate entra no caixa sem ação manual.
- No Avançar Dia que cai em dia 5, pop-up de folha é exibido e `PAY_WAGES` disparado.

---

## Fase 4 — Onboarding LiveLife na Diretoria

**Objetivo:** Guiar o usuário pelos parâmetros que o modo LiveLife precisa para funcionar.

### O que muda

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Board/Board.tsx` | Nova aba "LiveLife": botão **"Tutorial & Guia LiveLife"** + checklist dos 3 itens; aba Changelog |
| `src/types/` (ou `GameState`) | Flag `livelife.onboardingComplete: boolean` no save |
| `src/services/storage.ts` | Migrate: `livelife: { onboardingComplete: false }` |

### Checklist obrigatório (spec)
1. Verificação de salários — link direto para tela de elenco
2. Premiação de competições — link para Finance > Premiações
3. Parâmetros do estádio — link para Finance > Estádio

### Changelog in-app
- v1.0 — Elenco, escalação, criação de time e partidas manuais
- v1.1 — Pulse: eventos imprevisíveis, dilemas morais, cobranças da diretoria
- v1.2 — Calendário contínuo, bilheteria, lesões temporais, folha dia 5, ClubOSocial, Coletivas, Sala de Troféus

### Critério de pronto
- Board exibe aba LiveLife com checklist e changelog.
- Checklist marca itens como concluídos conforme dados são preenchidos.
- Flag `onboardingComplete` salva no estado.

---

## Fase 5 — Pulse diário

**Objetivo:** Estender o motor Pulse para disparar em dias normais (sem partida), tornando cada manhã imprevisível.

### O que muda

| Arquivo | Alteração |
|---------|-----------|
| `src/context/GameContext.tsx` | Em `ADVANCE_DAY` (dias sem jogo): `rollDailyPulse(state)` com prob. `pulse.settings.dailyEventChance` (default 20%) |
| `src/pulse/probabilities.ts` | Adicionar categoria `'daily'`; filtrar eventos com `trigger: 'match_only'` |
| `src/pages/Dashboard/Dashboard.tsx` | Modal de evento Pulse diário pós-Avançar (mesmo componente de PulseMatch, adaptado) |
| `src/pulse/types.ts` | Campo `trigger?: 'any' | 'match_only'` nos eventos |

### Critério de pronto
- Em ~20% dos dias sem jogo, um evento Pulse aparece ao avançar.
- Configuração de chance visível em Pulse > Configurações.
- Eventos `match_only` (ex.: performance em campo) não disparam fora de jogo.

---

## Fase 6 — ClubOSocial (LIFE)

**Objetivo:** Substituir os stubs de redes sociais por um feed funcional com manchetes automáticas.

### Estrutura de estado

```ts
interface SocialState {
  handle: string;               // '@nomedoclube_oficial'
  posts: SocialPost[];
  unseenCount: number;
}

interface SocialPost {
  id: string;
  date: string;                 // gameDate ISO
  type: 'headline' | 'coach_post' | 'player_news';
  content: string;
  author: string;
  likes: number;
  matchId?: string;
}
```

`state.social` no `GameState`; persiste em `GameSave.social`.

### O que muda

| Arquivo | Alteração |
|---------|-----------|
| `src/types/Social.ts` | Novo — tipos acima |
| `src/context/GameContext.tsx` | `social` no `GameState`; `ADD_SOCIAL_POST`; geração automática em `COMPLETE_MATCH` |
| `src/pages/Social/` | Novo — substituir `/under/redes-sociais` e `/under/manchetes` |
| `src/pages/Squad/Squad.tsx` | Painel de atleta exibe personality + morale (campos já existentes) |
| `src/components/Layout/Layout.tsx` | Rotas WIP social → rotas reais |

### Critério de pronto
- Após finalizar partida, manchete é gerada automaticamente no feed.
- Feed exibe cronologia com data do jogo.
- Técnico pode postar textos livres com hashtags institucionais.
- Página de atleta no elenco exibe personalidade e moral.

---

## Fase 7 — Coletivas interativas

**Objetivo:** Dar ao técnico poder de moldar percepção pública e moral do elenco via entrevistas.

### Motor puro

```ts
// src/pressconference/engine.ts
function runPressConference(input: {
  context: 'pre_match' | 'post_match';
  matchResult?: MatchResult;
  questions: PressQuestion[];
  answers: string[];           // ID das opções escolhidas
}): {
  deltas: {
    supporterConfidence: number;   // −10 a +15
    squadMorale: number;           // −5 a +10 (média elenco)
    boardConfidence: number;       // −8 a +5
  };
  headline: string;
}
```

### O que muda

| Arquivo | Alteração |
|---------|-----------|
| `src/types/PressConference.ts` | Novo — questões, opções, efeitos |
| `src/pressconference/` | Motor + banco de perguntas PT-BR |
| `src/pages/PressConference/` | UI de coletiva; substituir `/under/coletivas` |
| `src/context/GameContext.tsx` | `APPLY_PRESS_CONFERENCE`; gatilho opcional pré/pós partida |

### Critério de pronto
- Coletiva pré-jogo disponível no Dashboard quando há partida no dia.
- Coletiva pós-jogo acessível após `COMPLETE_MATCH`.
- Respostas afetam as 3 métricas e geram manchete no ClubOSocial.

---

## Fase 8 — Manager pessoal e Sala de Troféus

**Objetivo:** Dar ao técnico uma identidade dentro do jogo e uma galeria de conquistas.

### Manager expandido

```ts
// Adicionar em Manager.ts
interface Manager {
  name: string;
  nationality: string;
  age: number;
  bio?: string;
  tacticalNotes?: string;
  agentContacts?: string;
}
```

### Sala de Troféus

- Títulos são registrados ao fechar competições (`ADVANCE_SEASON` ou ação dedicada).
- Estrutura: `{ competition, season, position, isTitle: boolean }[]` em `Team.achievements`.
- Galeria visual com ícone de troféu por título ganho.
- Prêmios individuais de técnico (Melhor Técnico) registrados separadamente em `Manager`.

### O que muda

| Arquivo | Alteração |
|---------|-----------|
| `src/types/Manager.ts` | Campos adicionais acima |
| `src/types/Team.ts` | `achievements` com tipagem forte (hoje `string[]`) |
| `src/pages/Manager/` | Novo — substituir `/under/pessoal`; bio + notas táticas |
| `src/pages/Trophies/` | Novo — substituir `/under/trofeus`; galeria visual |
| `src/components/Layout/Layout.tsx` | Rotas WIP → rotas reais |

### Critério de pronto
- Técnico tem bio e notas táticas editáveis.
- Sala de Troféus exibe conquistas passadas com temporada e competição.
- Títulos aparecem ao fechar uma temporada com posição 1º.

---

## Decisões de arquitetura

| Decisão | Escolha |
|---------|---------|
| Clock de jogo | `GameState.currentDate` (ISO string) — único clock; não duplicar em módulos |
| Motor LIVE | `src/livelife/` com `advanceDay(state) → { nextState, events[] }` puro (sem DOM) |
| Estádio/economia | Estende `ClubFinance` — não cria save paralelo |
| LIFE social | `state.social` no `GameState` — mesmo padrão do Pulse |
| IDs de atletas | Sempre IDs do ClubOS — módulos não criam IDs próprios |
| Identidade visual | ClubOSocial terá tema próprio (não o roxo do ClubOS se o branding pedir outro) |
| Carreiras antigas | `migrateSave` adiciona campos com defaults; modal de ativação para `currentDate` null |
| MVP vs backlog | Fases 1–5 são o MVP; LIFE (6–8) é sprint 2; patrocínios/DM/empréstimos em `MELHORIAS_FUTURAS.md` |

---

## Brainstorming & Novas Sugestões da IA

> Ideias inéditas para tornar o LiveLife ainda mais espetacular, prontas para discutir e priorizar.

### 1. Avançar até o Próximo Evento ("Semana Compacta")
Em vez de clicar Avançar Dia 7 vezes em semana de treino, um botão secundário **"Ir para próximo evento"** salta diretamente para a data do próximo jogo, coletiva, dia de folha ou evento Pulse previsto, exibindo um resumo dos dias ignorados (quem treinou, quem se recuperou). Elimina a repetição sem perder o senso de passagem do tempo.

### 2. Clima da Cidade & Derby Factor
Um sistema de `matchContext` baseado na data (derby local, clássico regional, título em jogo) e condição climática sorteada (chuva, calor extremo) modifica o público e a moral antes do cálculo de bilheteria. Derby aumenta demanda em até 40%; chuva reduz público em 15% mas eleva moral de times "guerreiros". Custo de implementação baixo; impacto narrativo alto.

### 3. Story Arcs no ClubOSocial
Em vez de manchetes avulsas, arcos de 3–5 dias (ex.: *"Briga no vestiário após derrota → imprensa pressiona técnico → coletiva decisiva → reconciliação ou saída"*) cruzam feed do ClubOSocial + pergunta de coletiva + evento Pulse. O feed se torna uma narrativa, não só um log. Cada arco tem estado próprio (`arc.step`) e desbloqueia a próxima cena ao Avançar Dia.

### 4. Contrato de Confiança com Countdown Visual
As metas da diretoria (já em `Board.goals`) ganham um **prazo em dias de jogo** e um medidor de urgência na tela do Manager. A proximidade do deadline muda a cor e aparece como notificação ao Avançar Dia. Se o prazo vencer com meta não cumprida, `boardConfidence` cai automaticamente e uma coletiva de crise é obrigatória. Cria tensão real sem aumentar complexidade.

### 5. Replay Financeiro do Mês (Waterfall de Caixa)
Na tela de Finanças, uma visualização de cascata dia 1–30 mostrando bilheteria de cada jogo, data da folha, premiações, transferências e saldo final. Cada barra é clicável e abre o detalhe da partida ou da transação. Transforma o extrato plano atual em um storytelling financeiro da temporada.

---

## Fora do MVP (ver MELHORIAS_FUTURAS.md)

- Patrocínios dinâmicos (Master/Manga com bônus por metas)
- Nível de infraestrutura do CT (reduz lesões e tempo de recuperação)
- Empréstimos bancários com juros para cobrir caixa negativo no dia 5
- Modo Player com mesmo clock contínuo (sincronizar `CareerPlayer.InjuryEntry`)
- Notificações push / PWA offline para avançar dias fora do desktop
