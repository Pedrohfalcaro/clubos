# Manual Cursor/Claude — Implementar **International Duty Update (v1.4)** no ClubOS

> Leia `CLUBOS_CONEXAO.md` e `plano_de_desenvolvimento.md` antes deste manual. Este módulo **não** segue a skill `clubos-novo-modulo` (que é para módulos prototipados fora em `modulos-em-desenvolvimento/`) — aqui a implementação é direta no app, no mesmo estilo do Financial Update (`FinancialUpdate - Desenvolvimento/`).

## 1. Objetivo

Adicionar um segundo contexto de comando (Seleção Nacional / Dual Career) ao ClubOS, comutável a partir do Dashboard do clube, com Datas FIFA, convocação, partidas/estatísticas, ranking simplificado, Pulse Internacional e diretoria da federação — preservando 100% do que já existe no clube.

## 2. O que ler (ordem)

1. `docs/documento_clubos_v1_4.pdf` — spec/pedido original (nomeado internamente "v1.3", tratar como v1.4 — ver `plano_de_desenvolvimento.md` §0.1)
2. `CLUBOS_CONEXAO.md` — contratos de integração, em especial o de convocação/vínculo com o clube (maior risco)
3. `plano_de_desenvolvimento.md` — diagnóstico, decisões de arquitetura (§1) e fases (§2)
4. `MELHORIAS_FUTURAS.md` — o que **não** fazer no MVP
5. Código-fonte relevante do ClubOS antes de mexer: `src/types/Player.ts` (`isPlayerBlockedFromLineup`), `src/context/GameContext.tsx` (`GameState`, actions de `ADVANCE_DAY`), `src/App.tsx` (roteamento `CoachRoutes`/`PlayerRoutes`/`PlayerLayout`), `src/utils/clubImport.ts` (padrão de import JSON a replicar)

## 3. Núcleo a criar (prioridade, ordem = fases do plano)

| Prioridade | Arquivo | Ação |
|------------|---------|------|
| 1 | `src/types/NationalTeam.ts` | Criar todos os tipos (§Fase 1 do plano) |
| 1 | `src/context/GameContext.tsx` | `GameState.activeContext` + `GameState.nationalTeam`; `Player.nationalDutyUntil` em `types/Player.ts` |
| 1 | `src/services/storage.ts` (`migrateSave`) | Defaults `activeContext: 'club'`, `nationalTeam: null` para saves antigos |
| 2 | `src/context/GameContext.tsx` | Actions `SET_ACTIVE_CONTEXT`, `CREATE_NATIONAL_TEAM` |
| 2 | `src/components/NationalOnboarding/`, `src/components/NationalLayout/` | Modal de criação + shell de navegação do novo contexto |
| 2 | `src/App.tsx` | Ramo condicional dentro de `CoachRoutes`: `activeContext === 'national'` → `NationalLayout` + `NationalRoutes` |
| 3 | `src/utils/nationalWindows.ts`, actions `ADD_FIFA_WINDOW`/`UPDATE_FIFA_WINDOW`/`*_GAME` | Datas FIFA + jogos |
| 3 | `src/pages/National/Windows/` | Telas de Data FIFA |
| 4 | `src/utils/nationalImport.ts` | Import JSON de pré-lista (mesma disciplina de `clubImport.ts`) |
| 4 | `src/context/GameContext.tsx` | Actions `ADD_NATIONAL_PLAYER`, `SET_CALL_UP_LIST`, `LINK_NATIONAL_PLAYER_TO_CLUB` |
| 4 | `src/pages/National/Squad/` | Convocação + banco recorrente |
| 5 | `src/types/Player.ts` (`isPlayerBlockedFromLineup`, `availabilityStatusLabel`) | Ler `nationalDutyUntil` |
| 5 | Efeito de `SET_CALL_UP_LIST` + `ADVANCE_DAY` | Setar/limpar `nationalDutyUntil` |
| 5 | `src/pages/Squad/Squad.tsx` | Badge "Em Serviço Nacional" |
| 6 | `src/utils/nationalStats.ts` | `aggregateCallUpOverview` |
| 6 | Action `COMPLETE_NATIONAL_MATCH` | Registro de jogo + stats |
| 6 | `src/pages/National/Windows/`, `src/pages/National/Squad/` (aba Visão Geral) | Formulário pós-jogo + tabela consolidada |
| 7 | `src/pages/National/Dashboard/`, `src/pages/National/Board/` | Líderes de desempenho + diretoria da federação |
| 7 | `src/context/GameContext.tsx` | Actions `ADD_NATIONAL_GOAL`, `UPDATE_NATIONAL_GOAL`, `ADJUST_FEDERATION_MOOD` |
| 8 | `src/utils/nationalRanking.ts` | `applyRankingDelta` |
| 8 | `src/pulse/nationalEvents.ts` | Evento de desconvocação por clube |
| 9 | Docs (`docs/roadmap.md`, `docs/HANDOFF_CLUBOS_CLAUDE.md`, novo `docs/selecao-nacional.md`, `Board.tsx` changelog) | Fechar o épico |

**Não portar** nada de `modulos-em-desenvolvimento/_template/` — esse padrão é para protótipos isolados (tipo Pulse), e este módulo já nasce integrado.

**Não reescrever** `Player`, `Team`, `BoardState`, `Match`, `Finance` — o módulo só lê esses tipos e escreve exclusivamente `Player.nationalDutyUntil` (Fase 5) e `board.boardConfidence` (Pulse Internacional, efeito pequeno, só se o clube afetado for o do usuário).

## 4. Checklist MVP (fases 1–9)

- [ ] `src/types/NationalTeam.ts` com todos os tipos do plano (Fase 1)
- [ ] `GameState.activeContext` + `GameState.nationalTeam` + migração (Fase 1)
- [ ] `Player.nationalDutyUntil` + `isPlayerBlockedFromLineup` atualizado (Fase 1/5)
- [ ] Seletor Clube/Seleção no Dashboard + onboarding + roteamento (Fase 2)
- [ ] CRUD de Data FIFA + jogos (Fase 3)
- [ ] Convocação 23/26 + banco recorrente + import JSON (Fase 4)
- [ ] Desfalque no clube ("Em Serviço Nacional") funcionando nos dois sentidos (marcar/liberar) (Fase 5)
- [ ] Registro de partida + stats agregados + Visão Geral de Convocados (Fase 6)
- [ ] Dashboard internacional + Diretoria da Federação (Fase 7)
- [ ] Ranking FIFA simplificado + Pulse Internacional (Fase 8)
- [ ] `npm run build` e `npm run lint` limpos
- [ ] Documentação de produto atualizada (Fase 9)

## 5. Prompt curto (para retomar em outra sessão)

```text
Implemente a Fase [N] do International Duty Update (v1.4) neste repositório ClubOS.
Leia em "InternationalDuty - Desenvolvimento/": plano_de_desenvolvimento.md (seção da Fase [N]),
CLUBOS_CONEXAO.md e MELHORIAS_FUTURAS.md.
Não recrie elenco/tática/financeiro/pipeline de partida do clube — a Seleção é um contexto novo
que só lê state.players/state.team para o vínculo de convocação (Player.nationalDutyUntil).
Siga as decisões de arquitetura da seção 1 do plano (não desviar sem justificar).
Rode npm run build e npm run lint ao final.
```
