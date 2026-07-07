# ClubOS — Modo Jogador (Planejamento)

Documento de especificação para implementar a carreira como **jogador**, em paralelo ao modo **treinador** já existente. Estruturado para implementação direta no próximo passo.

---

## Visão geral

O ClubOS passa a suportar dois tipos de carreira:

| | Treinador (atual) | Jogador (novo) |
|---|---|---|
| Foco | Gestão do clube | Vida e desempenho do atleta |
| Elenco | Base de clubes (`teams.json` / `players.json`) | Apenas o **seu** jogador |
| Clube | Seleção na base de dados | Informado manualmente pelo usuário |
| Tática | Formações e escalação completa | Não existe — você é um jogador no time |
| Finanças | Orçamento do clube | Salário, contrato e valor de mercado pessoais |

A filosofia continua a mesma: o EA FC gera o resultado da partida; o ClubOS gera as consequências e o registro da carreira.

---

## 1. Fluxo inicial (alteração obrigatória)

### Menu principal (sem mudança visual grande)

```
Splash → Menu Principal
  ├── Começar  →  Escolha do modo
  └── Carregar →  Carrega save (detecta modo automaticamente)
```

### Nova tela: Escolha do modo (`/new/mode`)

Aparece **após** "Começar" e **antes** de qualquer outro passo.

```
┌─────────────────────────────────────┐
│         Escolha sua carreira        │
│                                     │
│  ┌─────────────┐  ┌─────────────┐  │
│  │  Treinador  │  │   Jogador   │  │
│  │  Gerencie   │  │  Viva sua   │  │
│  │  o clube    │  │  carreira   │  │
│  └─────────────┘  └─────────────┘  │
└─────────────────────────────────────┘
```

- **Treinador** → fluxo atual: `/new/country` → `/new/team` → `/setup/manager` → `/setup/competitions`
- **Jogador** → fluxo novo: `/new/player` → `/setup/player-club` → `/setup/player-competitions`

### Carregar save

- O save passa a ter `careerMode: 'coach' | 'player'`
- Ao carregar, redireciona para o dashboard correto (`/dashboard` ou `/player/dashboard`)
- Saves antigos sem `careerMode` são migrados como `'coach'`

---

## 2. Fluxo de setup — Modo Jogador

### Passo 1 — Criar jogador (`/new/player`)

Campos do formulário:

| Campo | Tipo | Obrigatório | Notas |
|---|---|---|---|
| Nome | texto | sim | Nome do atleta |
| Nacionalidade | select | sim | Mesma lista de países (começa com Brasil) |
| Idade | número (15–40) | sim | |
| Posição | select | sim | GK, CB, RB, LB, CDM, CM, CAM, RW, LW, ST, CF |
| Overall inicial | número (40–85) | sim | Valor que o usuário vê no jogo |
| Potencial | número (40–99) | sim | Teto de evolução |
| Número da camisa | número (1–99) | não | Pode ser null |
| Altura | texto | não | Ex: "1,78m" — cosmético |
| Pé preferido | select | não | Direito / Esquerdo / Ambidestro |

### Passo 2 — Clube atual (`/setup/player-club`)

**Sem base de clubes.** Tudo digitado pelo usuário.

| Campo | Tipo | Obrigatório |
|---|---|---|
| Nome do clube | texto | sim |
| Liga / competição principal | texto | sim | Ex: "Campeonato Brasileiro" |
| País do clube | select | sim |
| Status no time | select | sim | Titular / Reserva / Promessa / Em recuperação |
| Salário mensal | número | não | Em reais |
| Duração do contrato | select | não | 1 / 2 / 3 / 4 / 5 anos |
| Confiança do técnico | slider 0–100 | não | Default 50 |

### Passo 3 — Competições da temporada (`/setup/player-competitions`)

Igual ao treinador, mas contextualizado ao jogador:

- Lista `AVAILABLE_COMPETITIONS` (reutilizar)
- Texto: "Selecione as competições que **você** disputará nesta temporada"
- Botão: **Iniciar Carreira**

---

## 3. O que NÃO existe no modo jogador

Estas funcionalidades são **exclusivas do treinador** e não aparecem na navegação do jogador:

| Recurso | Motivo |
|---|---|
| Seleção de clube na base (`teams.json`) | Sem base de clubes |
| Página Elenco (`/squad`) | Não há elenco para gerenciar |
| Tática (`/tactics`) | Jogador não escala o time |
| Finanças do clube | Não é dono do clube |
| Transferências do clube | Não contrata/vende jogadores |
| Diretoria do clube | Relacionamento é com técnico/diretor, não conselho |
| Treinamento do elenco | Treino é pessoal |
| Sala de troféus do clube | Troféus são pessoais |
| `teams.json` / `players.json` como fonte | Dados 100% do save |

---

## 4. O que MANTER (adaptado)

Funcionalidades do treinador que fazem sentido no modo jogador, com adaptação de escopo:

### Dashboard → `/player/dashboard`

- Nome do jogador, clube atual, temporada
- Overall / potencial (barra visual)
- Próxima partida (com botão para registrar)
- Resumo de stats da temporada (jogos, gols, assistências, nota média)
- Confiança do técnico (barra)
- Contrato (salário, anos restantes)

### Jogos — Registro de partida → `/player/matches`

- Agendar partidas manualmente (mesmo modal, sem depender de `teamId` da base)
- Registrar resultado
- **Foco no desempenho individual**: gols, assistências, cartões, nota, minutos jogados, foi titular?

### Calendário → `/player/calendar`

- Mesma lógica visual, filtrado pelas partidas do save do jogador

### Competições → `/player/competitions`

- Classificação manual ou estatísticas por competição
- Sem recalcular stats de time inteiro — apenas contribuição do jogador

### Jogar partida → `/player/match/:matchId/play`

Versão simplificada do `MatchPlay` atual:

- **Não** escala formação
- Formulário de desempenho individual:
  - Minutos jogados
  - Titular / Reserva / Não relacionado
  - Gols, assistências, cartões
  - Nota (1–10)
  - Comentário opcional
- Ao salvar, atualiza stats do `CareerPlayer` e histórico da partida

### Tutorial

- Tutorial de boas-vindas específico para jogador
- Tutoriais por seção (matches, calendar, etc.) com textos diferentes

---

## 5. O que ADICIONAR (novo no modo jogador)

### Navegação — grupo "Carreira" (substitui "Clube" e "Manager")

```
Dashboard
├── Carreira
│   ├── Perfil          → /player/profile
│   ├── Contrato        → /player/contract
│   ├── Evolução        → /player/evolution
│   ├── Histórico       → /player/history
│   └── Conquistas      → /player/achievements  (WIP inicial)
├── Jogos
│   ├── Registro        → /player/matches
│   ├── Calendário      → /player/calendar
│   └── Competições     → /player/competitions
└── Social
    ├── Manchetes       → /player/under/manchetes   (WIP)
    ├── Redes sociais   → /player/under/redes       (WIP)
    └── Relacionamentos → /player/under/relations    (WIP)
```

### 5.1 Perfil (`/player/profile`)

- Dados biográficos (nome, idade, posição, nacionalidade)
- Overall atual vs potencial (gráfico ou barras)
- Stats acumuladas da carreira (todas as temporadas)
- Status no time atual

### 5.2 Contrato (`/player/contract`)

- Clube atual (texto livre, editável ao trocar de time)
- Salário, anos restantes
- Expectativa do clube (meta de gols, jogos como titular, etc.)
- Botão "Registrar transferência" → modal para novo clube (manual)

### 5.3 Evolução (`/player/evolution`)

- Gráfico de overall ao longo das temporadas
- Registro manual de treinos / evolução de atributos
- Lesões registradas (tipo, duração, data de retorno)

### 5.4 Histórico (`/player/history`)

- Linha do tempo de clubes
- Temporadas jogadas por clube
- Troféus pessoais (registro manual)
- Melhores momentos (partidas com nota alta, hat-tricks, etc.)

### 5.5 Relacionamentos (WIP — placeholder)

- Confiança do técnico
- Relação com torcida (0–100)
- Colegas de time (notas opcionais, futuro)

### 5.6 Seleção nacional (futuro — WIP)

- Convocações
- Jogos pela seleção
- Separado do clube

---

## 6. Modelo de dados

### Novos tipos (`src/types/`)

```ts
// CareerMode.ts
export type CareerMode = 'coach' | 'player';

// CareerPlayer.ts
export interface CareerPlayer {
  id: string;
  name: string;
  nationality: string;
  age: number;
  position: PlayerPosition;
  number: number | null;
  height?: string;
  preferredFoot?: 'Direito' | 'Esquerdo' | 'Ambidestro';

  overall: number;
  potential: number;

  // Clube atual (manual — sem teamId da base)
  currentClub: {
    name: string;
    league: string;
    country: string;
  };

  status: 'Titular' | 'Reserva' | 'Promessa' | 'Em recuperação';
  salary: number;
  contractYearsLeft: number;
  coachConfidence: number;   // 0–100
  fanReputation: number;     // 0–100

  marketValue: number;
  morale: number;

  stats: PlayerStats;        // reutiliza PlayerStats existente
  seasonStats: PlayerStats;  // stats só da temporada atual

  careerHistory: ClubHistoryEntry[];
}

export interface ClubHistoryEntry {
  clubName: string;
  league: string;
  country: string;
  seasonStart: number;
  seasonEnd: number | null;  // null = clube atual
  stats: PlayerStats;
}

// PlayerMatchPerformance.ts
export interface PlayerMatchPerformance {
  matchId: string;
  minutesPlayed: number;
  started: boolean;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  rating: number | null;     // 1–10
  notes?: string;
}
```

### Extensão do `Match` (modo jogador)

No modo jogador, `Match` não precisa de `teamId` da base. Campos:

```ts
interface PlayerMatch extends Omit<Match, 'teamId' | 'goals' | 'assists' | 'cards' | 'playerMatches'> {
  careerMode: 'player';
  clubName: string;           // clube do jogador na época
  opponent: string;
  // ... date, location, competition, status, goalsFor, goalsAgainst, result
  performance: PlayerMatchPerformance;
}
```

### Extensão do `GameState`

```ts
export interface GameState {
  careerMode: CareerMode | null;   // null durante setup
  setupStep: SetupStep;            // ver abaixo

  // Coach-only (null no modo jogador)
  pendingTeamId: string | null;
  teamId: string | null;
  team: Team | null;
  manager: Manager | null;
  players: Player[];
  tactics: SavedTactics | null;

  // Player-only (null no modo treinador)
  careerPlayer: CareerPlayer | null;

  // Compartilhado
  started: boolean;
  seasonCompetitions: string[];
  matches: Match[];                // ou PlayerMatch[] com discriminated union
  season: number;
  tutorialCompleted: boolean;
}

type SetupStep =
  | 'mode'              // novo: escolha jogador/treinador
  | 'team' | 'manager' | 'competitions'   // coach
  | 'player' | 'player-club' | 'player-competitions'  // player
  | 'done';
```

### Extensão do save (`storage.ts`)

```ts
export interface GameSave {
  version: string;               // bump para '0.3.0'
  careerMode: CareerMode;

  // Coach fields (opcionais)
  teamId?: string;
  team?: Team;
  players?: Player[];
  manager?: Manager | null;
  tactics?: SavedTactics | null;

  // Player fields (opcionais)
  careerPlayer?: CareerPlayer;

  // Shared
  matches: Match[];
  season: number;
  seasonCompetitions: string[];
  tutorialCompleted?: boolean;
  savedAt: string;
}
```

---

## 7. Rotas

### Setup (antes de `started`)

| Rota | Componente | Modo |
|---|---|---|
| `/new/mode` | `CareerModeSelect` | ambos |
| `/new/country` | `CountrySelect` | coach |
| `/new/team` | `TeamSelect` | coach |
| `/setup/manager` | `ManagerSetup` | coach |
| `/setup/competitions` | `CompetitionsSetup` | coach |
| `/new/player` | `PlayerCreate` | player |
| `/setup/player-club` | `PlayerClubSetup` | player |
| `/setup/player-competitions` | `PlayerCompetitionsSetup` | player |

### In-game — Treinador (inalterado)

Prefixo `/` — rotas atuais.

### In-game — Jogador

Prefixo `/player/`:

| Rota | Componente | Status |
|---|---|---|
| `/player/dashboard` | `PlayerDashboard` | criar |
| `/player/matches` | `PlayerMatches` | criar (adaptar Matches) |
| `/player/calendar` | `PlayerCalendar` | criar (adaptar Calendar) |
| `/player/competitions` | `PlayerCompetitions` | criar (adaptar Competitions) |
| `/player/match/:id/play` | `PlayerMatchPlay` | criar (adaptar MatchPlay) |
| `/player/profile` | `PlayerProfile` | criar |
| `/player/contract` | `PlayerContract` | criar |
| `/player/evolution` | `PlayerEvolution` | criar |
| `/player/history` | `PlayerHistory` | criar |
| `/player/under/*` | `UnderConstruction` | placeholder |

### `App.tsx` — lógica de roteamento

```ts
if (!state.started) {
  // rotas de setup (mode + coach + player)
}
if (state.careerMode === 'player') {
  // rotas /player/*
}
// else coach routes (atual)
```

---

## 8. Layout e navegação

### `PlayerLayout` (novo componente)

- Sidebar similar ao `Layout` atual
- Header mostra: nome do jogador, clube atual (texto), temporada
- **Sem** referência a `state.team` da base
- `NAV_GROUPS` específico para jogador (ver seção 5)
- Botão "Reiniciar Carreira" igual

### `Layout` (treinador)

- Inalterado

---

## 9. Context / Actions novas

### `GameContext` — novas actions

```ts
| { type: 'SELECT_CAREER_MODE'; mode: CareerMode }
| { type: 'SET_CAREER_PLAYER'; player: Partial<CareerPlayer> }
| { type: 'SET_PLAYER_CLUB'; club: CareerPlayer['currentClub'] & { status, salary, contractYearsLeft, coachConfidence } }
| { type: 'START_PLAYER_CAREER'; seasonCompetitions: string[] }
| { type: 'UPDATE_CAREER_PLAYER'; updates: Partial<CareerPlayer> }
| { type: 'TRANSFER_PLAYER'; newClub: CareerPlayer['currentClub']; salary: number; contractYears: number }
| { type: 'ADVANCE_SEASON' }   // reseta seasonStats, decrementa contractYearsLeft, incrementa season
```

### Novas funções no context

```ts
selectCareerMode(mode: CareerMode): void
setCareerPlayer(data: Partial<CareerPlayer>): void
setPlayerClub(data: ...): void
startPlayerCareer(seasonCompetitions: string[]): void
updateCareerPlayer(updates: Partial<CareerPlayer>): void
transferPlayer(newClub, salary, contractYears): void
advanceSeason(): void
```

---

## 10. Arquivos a criar

```
src/
├── types/
│   ├── CareerMode.ts
│   ├── CareerPlayer.ts
│   └── PlayerMatchPerformance.ts
├── pages/
│   ├── CareerModeSelect/
│   │   ├── CareerModeSelect.tsx
│   │   └── CareerModeSelect.module.css
│   ├── PlayerSetup/
│   │   ├── PlayerCreate.tsx
│   │   ├── PlayerClubSetup.tsx
│   │   ├── PlayerCompetitionsSetup.tsx
│   │   └── PlayerSetup.module.css      (reutilizar Setup.module.css como base)
│   └── Player/
│       ├── Dashboard/
│       │   ├── PlayerDashboard.tsx
│       │   └── PlayerDashboard.module.css
│       ├── Matches/
│       │   ├── PlayerMatches.tsx
│       │   └── PlayerMatches.module.css
│       ├── Calendar/
│       │   └── PlayerCalendar.tsx        (pode reexportar Calendar com props)
│       ├── Competitions/
│       │   └── PlayerCompetitions.tsx
│       ├── MatchPlay/
│       │   ├── PlayerMatchPlay.tsx
│       │   └── PlayerMatchPerformanceStep.tsx
│       ├── Profile/
│       │   ├── PlayerProfile.tsx
│       │   └── PlayerProfile.module.css
│       ├── Contract/
│       │   ├── PlayerContract.tsx
│       │   └── PlayerContract.module.css
│       ├── Evolution/
│       │   ├── PlayerEvolution.tsx
│       │   └── PlayerEvolution.module.css
│       └── History/
│           ├── PlayerHistory.tsx
│           └── PlayerHistory.module.css
├── components/
│   └── PlayerLayout/
│       ├── PlayerLayout.tsx
│       └── PlayerLayout.module.css
└── utils/
    └── playerTutorials.ts              (textos de tutorial do modo jogador)
```

---

## 11. Arquivos a modificar

| Arquivo | Mudança |
|---|---|
| `src/App.tsx` | Rotas de setup + rotas `/player/*` condicionais |
| `src/context/GameContext.tsx` | `careerMode`, `careerPlayer`, novas actions |
| `src/services/storage.ts` | `careerMode` no save, migração v0.3.0 |
| `src/pages/MainMenu/MainMenu.tsx` | "Começar" → `/new/mode` |
| `src/utils/tutorials.ts` | Exportar ou referenciar tutoriais do jogador |

---

## 12. Ordem de implementação (próximo comando)

Implementar nesta ordem para ter algo jogável rapidamente:

### Fase 1 — Fundação (MVP jogável)
1. Tipos: `CareerMode`, `CareerPlayer`, `PlayerMatchPerformance`
2. `GameContext`: `careerMode`, actions de setup do jogador
3. `storage.ts`: save v0.3.0 com migração
4. `CareerModeSelect` — tela de escolha
5. Setup: `PlayerCreate` → `PlayerClubSetup` → `PlayerCompetitionsSetup`
6. `PlayerLayout` com navegação básica
7. `PlayerDashboard` — visão geral
8. `App.tsx` — roteamento condicional
9. `MainMenu` — apontar para `/new/mode`

### Fase 2 — Jogos
10. `PlayerMatches` — agendar e listar partidas
11. `PlayerMatchPlay` — registrar desempenho individual
12. `PlayerCalendar` — calendário de partidas
13. `PlayerCompetitions` — competições da temporada

### Fase 3 — Carreira
14. `PlayerProfile` — perfil e stats
15. `PlayerContract` — contrato e transferência manual
16. `PlayerHistory` — histórico de clubes
17. `PlayerEvolution` — evolução de overall

### Fase 4 — Polimento
18. Tutoriais do modo jogador
19. `advanceSeason` — virada de temporada
20. Placeholders WIP (social, conquistas, seleção)

---

## 13. Regras de negócio importantes

1. **Isolamento total**: modo jogador nunca importa `teams.json` nem `players.json`
2. **Clube é texto**: `currentClub.name` é string livre; troca de clube via formulário manual
3. **Stats duplas**: `stats` (carreira total) e `seasonStats` (temporada atual); ao avançar temporada, `seasonStats` zera e soma em `stats`
4. **Histórico automático**: ao registrar transferência, fecha entrada anterior em `careerHistory` e abre nova
5. **Save único**: por enquanto um slot; o save sabe o modo e carrega o layout certo
6. **Idade**: incrementa +1 ao avançar temporada
7. **Overall**: editável manualmente em Perfil/Evolução (usuário espelha o que vê no EA FC)

---

## 14. UI — referência visual

Reutilizar ao máximo:
- `Setup.module.css` para formulários de setup
- `Dashboard.module.css` como base do `PlayerDashboard`
- `StatCard` para métricas
- `MatchScheduleModal` para agendar partidas
- `Tutorial` com steps customizados

Cards do dashboard do jogador (sugestão):

```
┌──────────────────────────────────────────────┐
│  João Silva · ST · 22 anos                   │
│  Flamengo · Brasileirão 2025                 │
│  OVR 78 ▓▓▓▓▓▓▓▓░░ POT 86                   │
├──────────────────────────────────────────────┤
│  Próxima partida: Flamengo × Palmeiras       │
│  12/07 · Maracanã · Brasileirão              │
├──────────┬──────────┬──────────┬─────────────┤
│ Jogos 18 │ Gols  7  │ Ast  4   │ Nota 7.2   │
├──────────┴──────────┴──────────┴─────────────┤
│  Confiança do técnico  ▓▓▓▓▓▓░░░░  62%       │
│  Contrato: 2 anos · R$ 45K/mês               │
└──────────────────────────────────────────────┘
```

---

## 15. Versão do save

`0.3.0` — adiciona `careerMode` e `careerPlayer`. Saves `0.2.0` migrados automaticamente com `careerMode: 'coach'`.
