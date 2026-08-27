# Modo Seleção / Dual Career do ClubOS (v1.4 "International Duty Update")

Documentação do estado atual do Modo Seleção: o que existe, como funciona, onde aparece na interface e quais arquivos mexem em cada peça.

---

## 1. Visão geral

O Modo Seleção é um **segundo contexto de jogo inteiro**, paralelo ao clube — não uma tela a mais dentro dele. O usuário continua sendo o técnico do seu clube e, a partir de um certo ponto, passa a acumular a seleção nacional, alternando entre os dois:

- `state.activeContext: 'club' | 'national'` decide qual layout/rotas montam (`CoachRoutes` em `App.tsx`).
- `state.nationalTeam: NationalTeamState | null` é a **guarda real** — sem ele, `activeContext` nunca vira `'national'` (ver `SET_ACTIVE_CONTEXT`, `GameContext.tsx`).
- O clube e a seleção têm elenco, calendário e identidade **totalmente independentes**; a única ponte de mão dupla é o desfalque automático (§4) e, opcionalmente, um pedido de desconvocação do próprio clube (§5).

Onboarding: botão "Modo Seleção" no Dashboard do clube abre um formulário curto (nome, cores, ranking FIFA inicial) → `CREATE_NATIONAL_TEAM`, uma vez só (não há como recriar/desfazer). Depois disso, "← Voltar ao Clube" na barra lateral do Modo Seleção alterna de volta.

`careerMode === 'player'` **nunca** vê o seletor de Modo Seleção — fora de escopo nesta versão.

---

## 2. Modelo de dados

Arquivo: `src/types/NationalTeam.ts`

### `NationalTeamState`

| Campo | Tipo | Função |
|-------|------|--------|
| `name`, `primaryColor?`, `secondaryColor?` | — | Identidade visual |
| `federationMood` | `number` (0–100) | Moral da federação — equivalente a `boardConfidence`, mas independente |
| `federationMoodHistory` | `{date, value, reason}[]` | Histórico dos ajustes de moral (cap 50) |
| `fifaRanking` | `number` | Ranking FIFA simplificado (1 = melhor), ver §5 |
| `fifaRankingHistory` | `{date, value}[]` | Empurrado a cada jogo finalizado (cap 50) |
| `talentPool` | `NationalPlayer[]` | Banco recorrente de convocáveis — a "Base de Jogadores" |
| `windows` | `FifaWindow[]` | As Datas FIFA — ver abaixo |
| `goals` | `NationalBoardGoal[]` | Metas da federação — nunca lidas por `Board.tsx` do clube, e vice-versa |
| `onboardedAt` | `string` | `currentDate` do jogo no momento da criação |

### `NationalPlayer` (banco recorrente)

Independente de `Player` do clube — a maioria dos convocados não pertence ao elenco do usuário. `clubPlayerId?` só existe quando o convocado é, de fato, um `Player` do próprio elenco (é isso que dispara o desfalque, §4). Sem número de camisa fixo: numeração é por convocação (`FifaWindow.callUpNumbers`, ver abaixo). `caps` conta convocações totais (independe de ter jogado); `stats` (`NationalPlayerStats`) é o agregado de carreira, recalculado do zero a cada jogo finalizado (`recomputeNationalPlayerStats`, nunca incremental).

### `FifaWindow` — a Data FIFA, e o hub central da UI

| Campo | Tipo | Função |
|-------|------|--------|
| `label`, `type`, `typeOther?` | — | Nome (sugerido automaticamente, editável) e competição |
| `startDate`, `endDate` | ISO | Janela de liberação pelos clubes |
| `listSize` | `23 \| 26` | Definido **só na criação** — não é editável depois |
| `callUpIds` | `string[]` | `NationalPlayer.id` convocados nesta janela |
| `callUpNumbers` | `Record<id, number>` | Numeração de camisa **desta convocação** — sugerida automaticamente pela convocação anterior mais recente do atleta (`carryOverCallUpNumber`), editável a qualquer momento |
| `games` | `FifaWindowGame[]` | Jogos mapeados — ver abaixo |
| `tactics` / `tacticsPresets` / `activeTacticsId` | — | Tática **desta** Data FIFA (não da seleção toda — o elenco disponível muda de convocação pra convocação) |
| `deconvocationResolvedIds` | `string[]` | Convocados já resolvidos no evento de Pulse Internacional (§5) nesta janela |

### `FifaWindowGame` — espelha `Match` do clube

`opponent`, `location`, `date`, `opponentStrength` (`top10`/`top30`/`outros` — classificação manual), `played`, `goalsFor?`/`goalsAgainst?` (placar final) e, depois de jogada: `lineup`, `goals`, `assists`, `cards`, `substitutions`, `injuries`, `opponentGoals`/`opponentCards`/`opponentSubs` (estruturados), `playerRatings`, `motmNationalPlayerId`/`worstNationalPlayerId`, `description`, e `performances?: NationalMatchPerformance[]` — o agregado (minutos/gols/assistências/nota/cartões por convocado) derivado desses campos ao finalizar (`buildNationalPerformances`), nunca editado à mão.

### `NationalBoardGoal`

3 tipos (`reach_stage`, `win_tournament`, `avoid_relegation_ranking`), `target`/`current` (numérico, sem motor de progresso automático — o usuário edita à mão) e `status` (`active`/`done`/`failed`, também manual). Estrutura própria e menor que `BoardGoal` do clube — nunca compartilhada.

---

## 3. Onde aparece na interface

Layout: `components/NationalLayout/NationalLayout.tsx` (sidebar própria, tema com as cores da seleção). Rotas em `App.tsx`, dentro do branch `activeContext === 'national'` de `CoachRoutes`.

| Rota | Página | O que faz |
|---|---|---|
| `/national/dashboard` | `NationalDashboard` | Data FIFA ativa/próxima em destaque (com "Dia N de M"), líderes de carreira (artilheiro/assistências/nota), moral da federação, ranking FIFA + variação desde o último jogo, card do Pulse Internacional quando há oportunidade |
| `/national/windows` | `NationalWindows` | Lista de Datas FIFA (cards, marca a ativa) + criar nova (nome sugerido, tipo, datas, **tamanho da convocação**) |
| `/national/windows/:windowId` | `NationalWindowHub` | **O hub.** Header com "Dia N de M"; checklist de pendências (Convocar jogadores / Registrar compromissos) enquanto a Data FIFA não tem convocação e jogo mapeado; 3 abas: |
| — aba Jogos | | Mapear jogos (adversário, mando, força) e jogar/editar cada um |
| — aba Convocação | | Marcar quem joga nesta janela (busca no banco, checkbox, limite do `listSize`), numeração de camisa, vínculo ao clube |
| — aba Tática | | **Travada** até resolver as pendências. Escalação/formação só com quem foi convocado; sem tática salva ainda, herda a posição de quem repete a convocação anterior e põe quem é novidade no banco (`carryOverTacticsDraft`) |
| `/national/players` | `NationalPlayerBase` | Banco recorrente: cadastro manual (novo atleta **ou** direto do elenco do clube) + importação JSON + vínculo/remoção |
| `/national/history` | `NationalHistory` | Retrospecto da gestão (nº de Datas FIFA, V/E/D, saldo de gols) + tabela de estatísticas por convocado, com filtro por Data FIFA ou carreira inteira |
| `/national/board` | `NationalBoard` | Metas da federação (CRUD manual) + moral com ajuste (±5, motivo) e histórico |
| `/national/match/:windowId/:gameId/play` | `NationalMatchPlay` | Partida completa, fora do `NationalLayout` (tela cheia, igual `/match/:id/play` do clube) |

### 3.1 Partida da Seleção — o motor do clube, sem duplicar

`NationalMatchPlay` e a aba Tática do hub **reaproveitam** `FormationField`, `FormationPicker`, `utils/formations.ts` e todos os steps de `pages/MatchPlay/*` (`ScoreStep`, `TeamGoalsStep`, `OpponentGoalsStep`, `PathChoiceStep`, `EventsStep`, `MatchSummaryStep`, `MatchResultStep`, `MatchRecapStep`) **sem modificar nenhum deles**. A ponte é `utils/nationalMatchPlay.ts`:

- `nationalPlayerToPseudoPlayer` — converte um `NationalPlayer` num `Player` "de mentirinha" com `status: 'Titular'`/`availability: 'disponivel'` fixos (a Seleção não tem lesão/suspensão própria — só "convocado ou não"). IDs são preservados, então tudo que esse código devolve (escalação, eventos, minutos) já vem com o `NationalPlayer.id`.
- `buildNationalPerformances` — deriva `NationalMatchPerformance[]` (minutos via `getMatchPlayingTime` generalizado, gols/assistências/cartões contados dos eventos estruturados) ao finalizar a partida.

Fluxo completo: lineup → placar → gols → (adversário) → incidências (cartões/subs/**lesões**) → notas → resumo → `updateFifaWindowGame(windowId, gameId, {...})`. Se uma lesão em serviço pela seleção acontece com um convocado vinculado ao clube (`clubPlayerId`), o `Player` do clube volta machucado (`availability: 'lesionado'`, `injuryDaysRemaining` calculado a partir do `returnDate`) — tratado dentro do reducer de `UPDATE_FIFA_WINDOW_GAME`.

---

## 4. Desfalque no clube (`nationalDutyUntil`)

Campo em `Player` (`types/Player.ts`), ortogonal ao enum `PlayerAvailability` — não é um novo valor dele, pra não quebrar switches exaustivos existentes.

- `recomputeNationalDuty` (`utils/nationalWindows.ts`) roda depois de **qualquer** mudança em convocação/vínculo/janela (`SET_CALL_UP_LIST`, `LINK_NATIONAL_PLAYER_TO_CLUB`, `REMOVE_NATIONAL_PLAYER`, `UPDATE_FIFA_WINDOW`, `RESOLVE_NATIONAL_DECONVOCATION`). Sempre **recalcula do zero** a partir de `windows`/`talentPool` — nunca incrementa/decrementa o campo diretamente, pra não acumular estado obsoleto.
- Valor = maior `endDate` entre as Datas FIFA em que o `clubPlayerId` vinculado ainda está em `callUpIds`. Sem convocação ativa, o campo é limpo (`undefined`).
- `isPlayerBlockedFromLineup` bloqueia a escalação do clube enquanto `nationalDutyUntil` não passou; `availabilityStatusLabel` mostra "Em Serviço Nacional até DD/MM" — **prioridade abaixo** de lesão/suspensão/empréstimo reais (se as duas coisas coincidem, mostra o motivo real).
- No Elenco (`Squad.tsx`), o badge é **não clicável** quando o motivo é só convocação (clicar nele abriria edição de lesão/suspensão, que não tem nada a ver).
- Ao remover alguém da convocação (ou fechar a Data FIFA), a disponibilidade no clube volta sozinha no próximo recálculo — não precisa de nenhuma ação manual no elenco.

---

## 5. Ranking FIFA e Pulse Internacional (v1.4, fase 8)

### Ranking dinâmico

`utils/nationalRanking.ts` — `applyRankingDelta(atual, resultado, forçaAdversário)`: tabela fixa de variação (posição 1 é a melhor, então vencer **diminui** o número):

| Força do adversário | Vitória | Empate | Derrota |
|---|---|---|---|
| Top 10 | −4 | −1 | +1 |
| Top 30 | −2 | 0 | +2 |
| Outros | −1 | +1 | +4 |

Clamp sempre em `[1, 210]`. Aplicado no reducer de `UPDATE_FIFA_WINDOW_GAME`, **só na transição `played: false → true`** — editar um jogo já registrado (corrigir placar, por exemplo) não pontua de novo. Cada aplicação empurra em `fifaRankingHistory`; o Dashboard mostra a variação comparando as duas últimas entradas.

> Métrica simplificada e autocontida da seleção do próprio usuário — **não** é uma tabela real de 200+ países.

### Pulse Internacional — pedido de desconvocação

`src/pulse/nationalEvents.ts` — `findNationalDeconvocationOpportunity`, função pura e **independente** do Pulse do clube (`src/pulse/*`, todo construído em cima de moral de elenco/imprensa/LiveLife — misturaria conceitos se fosse reaproveitado). Só dispara quando:

1. Há uma Data FIFA tipo `amistoso` **ativa** na data atual do jogo.
2. Algum convocado dessa janela tem `clubPlayerId` (é de fato um jogador do elenco do usuário).
3. Esse convocado ainda não foi resolvido nesta janela (`deconvocationResolvedIds`).

Aparece como card no Dashboard do Modo Seleção com duas opções (`RESOLVE_NATIONAL_DECONVOCATION`):

| Escolha | Efeito |
|---|---|
| **Ceder** | Remove o atleta da convocação (recalcula `nationalDutyUntil`), `caps −1`, moral da federação −2, confiança do clube (diretoria + torcida) +3 |
| **Recusar** | Mantém o convocado, moral da federação +3, confiança do clube −2 (leve atrito) |

Nunca aparece em `copa_mundo`/`eliminatorias` — essas competições não têm essa mecânica.

---

## 6. Formatação e utilitários

| Arquivo | Função |
|---|---|
| `utils/nationalWindows.ts` | `createFifaWindow`/`createFifaWindowGame`, `suggestWindowLabel` (nome automático "Competição - MÊS/ANO"), `sortWindowsByStart`, `isGameOutsideWindow`, `isDateWithinWindow`, `dayInWindow`/`windowTotalDays` (dia relativo ao início da janela), `recomputeNationalDuty`, `carryOverCallUpNumber`, `carryOverTacticsDraft`, `normalizeFifaWindow` |
| `utils/nationalStats.ts` | `recomputeNationalPlayerStats` (agregado de carreira, recálculo total), `aggregateCallUpOverview` (tabela da Visão Geral/Histórico, com ou sem filtro de janela) |
| `utils/nationalRanking.ts` | `applyRankingDelta`, `outcomeFromScore` |
| `utils/nationalMatchPlay.ts` | `nationalPlayerToPseudoPlayer`, `buildNationalPerformances` |
| `utils/nationalImport.ts` | `parseNationalImport` (JSON, tudo ou nada, até 30 atletas, auto-vincula por nome igual a um jogador do elenco), `downloadNationalImportTemplate` |
| `pulse/nationalEvents.ts` | `findNationalDeconvocationOpportunity` |

---

## 7. Estado e ações no `GameContext`

| API | Efeito |
|---|---|
| `setActiveContext` | Alterna `'club' ⇄ 'national'` — vira `'national'` só se `nationalTeam` existir |
| `createNationalTeam` | Onboarding (1×) |
| `addFifaWindow` / `updateFifaWindow` | CRUD de Data FIFA |
| `addFifaWindowGame` / `updateFifaWindowGame` | Mapear/finalizar jogo — dispara recomputo de stats, ranking e lesão no clube quando aplicável |
| `addNationalPlayer` / `importNationalPlayers` / `removeNationalPlayer` | Banco recorrente |
| `linkNationalPlayerToClub` | Vincula/desvincula `clubPlayerId` — dispara `recomputeNationalDuty` |
| `setCallUpList` / `setCallUpNumber` | Convocação e numeração da janela |
| `saveNationalTacticsPreset` / `deleteNationalTacticsPreset` / `setActiveNationalTactics` | Tática **por Data FIFA** (recebem `windowId`) |
| `addNationalGoal` / `updateNationalGoal` / `removeNationalGoal` | Metas da federação |
| `adjustFederationMood` | Ajuste manual de moral + histórico |
| `resolveNationalDeconvocation` | Pulse Internacional (§5) |

Persistência: `nationalTeam` inteiro entra no save (local e nuvem) via `getSaveSnapshot`/`buildPersistPayload`; `normalizeNationalTeam`/`normalizeFifaWindow` preenchem defaults ao carregar saves de fases anteriores desta mesma versão.

---

## 8. Mapa de arquivos

| Arquivo | Papel |
|---|---|
| `src/types/NationalTeam.ts` | Tipos e defaults |
| `src/utils/nationalWindows.ts` | Data FIFA, desfalque, numeração, herança de tática, dia relativo |
| `src/utils/nationalStats.ts` | Agregados de desempenho |
| `src/utils/nationalRanking.ts` | Ranking FIFA |
| `src/utils/nationalMatchPlay.ts` | Ponte com o motor de partida do clube |
| `src/utils/nationalImport.ts` | Importação JSON do banco |
| `src/pulse/nationalEvents.ts` | Pulse Internacional |
| `src/context/GameContext.tsx` | Estado, reducers, ações (buscar por `NATIONAL`/`FIFA_WINDOW`) |
| `src/components/NationalLayout/*` | Sidebar do Modo Seleção |
| `src/pages/National/Dashboard/*` | Dashboard |
| `src/pages/National/Windows/*` | Lista de Datas FIFA |
| `src/pages/National/WindowHub/*` | O hub (Jogos/Convocação/Tática) |
| `src/pages/National/PlayerBase/*` | Banco recorrente |
| `src/pages/National/History/*` | Histórico/estatísticas |
| `src/pages/National/Board/*` | Diretoria da federação |
| `src/pages/National/MatchPlay/*` | Partida da seleção |
| `src/services/storage.ts` | Persistência de `activeContext`/`nationalTeam` |

Rotas: `App.tsx` → dentro do branch `activeContext === 'national'` de `CoachRoutes`.

---

## 9. Ciclo de vida típico

```
Dashboard do clube → "Modo Seleção" → onboarding (nome, cores, ranking inicial)
  → Dashboard da Seleção
  → Datas FIFA → criar (tipo, datas, tamanho da convocação)
       → entrar no hub
            · aba Convocação: marcar quem joga, numerar
            · aba Jogos: mapear os compromissos
            → pendências resolvidas → aba Tática libera
            · aba Tática: escalação (herda a convocação anterior)
            → Jogar partida (motor idêntico ao clube)
                 · lesão em serviço reflete no clube, se vinculado
                 · ranking FIFA ajusta (só na 1ª finalização)
       · Pulse Internacional: clube pode pedir desconvocação num amistoso
  → Histórico: retrospecto da gestão
  → Diretoria: metas da federação + moral
  → "← Voltar ao Clube" quando quiser
```

---

## 10. Limites e comportamento atual

- Sem simulação de clubes estrangeiros — o "clube pede desconvocação" (§5) só existe pro **próprio** clube do usuário, já que é o único clube modelado no jogo.
- Ranking FIFA é uma métrica própria da seleção do usuário, não uma tabela real com outras seleções.
- Metas da federação não têm motor de progresso automático — `target`/`current`/`status` são editados manualmente.
- `careerMode === 'player'` não tem acesso ao Modo Seleção nesta versão.
- Sem treino/infraestrutura da seleção (fora de escopo).
- Editar um jogo já finalizado recalcula estatísticas dos convocados, mas **não** reaplica o ranking FIFA nem a lesão em serviço (mesmo espírito de `UPDATE_COMPLETED_MATCH` do clube, que também não reaplica efeitos completos).

---

## 11. Referências rápidas

- Handoff geral do site (arquitetura, invariantes): [`HANDOFF_CLUBOS_CLAUDE.md`](./HANDOFF_CLUBOS_CLAUDE.md)
- Plano de desenvolvimento completo (todas as fases, decisões e notas de implementação): [`InternationalDuty - Desenvolvimento/plano_de_desenvolvimento.md`](../InternationalDuty%20-%20Desenvolvimento/plano_de_desenvolvimento.md)
- Contrato de integração / manual de portagem: [`InternationalDuty - Desenvolvimento/CLUBOS_CONEXAO.md`](../InternationalDuty%20-%20Desenvolvimento/CLUBOS_CONEXAO.md), [`CURSOR_MANUAL.md`](../InternationalDuty%20-%20Desenvolvimento/CURSOR_MANUAL.md)
- Backlog fora de escopo: [`InternationalDuty - Desenvolvimento/MELHORIAS_FUTURAS.md`](../InternationalDuty%20-%20Desenvolvimento/MELHORIAS_FUTURAS.md)
- Roadmap geral: [`roadmap.md`](./roadmap.md)
