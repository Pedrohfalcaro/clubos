# International Duty Update (v1.4) — Melhorias Futuras

Backlog além do MVP descrito em `plano_de_desenvolvimento.md`. Prioridade: **P1** → **P3**.

## P1

| Ideia | Descrição |
|-------|-----------|
| Modo Jogador com Seleção Nacional | O `CareerPlayer` (atleta) também pode ser convocado — dashboard pessoal mostra próxima Data FIFA, histórico de convocações, evolução de caps. Requer decisão própria de arquitetura (o jogador não tem `talentPool`/federação para gerenciar, só recebe convocações). |
| Recuperação automática de `nationalDutyUntil` no `ADVANCE_DAY` | Garantir que o campo é limpo mesmo se o usuário nunca mais abrir o Modo Seleção depois de convocar (não depender de revisita à tela). Tratar como parte do MVP se o teste mental da Fase 9 falhar; senão, refinar aqui. |
| Notificação de convocação no clube | Aviso/modal no Dashboard do clube quando um jogador é convocado pela primeira vez (hoje só o badge no Squad). |

## P2

| Ideia | Descrição |
|-------|-----------|
| Pipeline de partida completo para a seleção | Lineup + tática simplificada + Pulse pré-jogo, no estilo do `MatchPlay` do clube, em vez do formulário único pós-jogo do MVP. |
| Relação por clube estrangeiro individual | Hoje o Pulse Internacional só afeta o clube do usuário (se o convocado for dele). Modelar clubes rivais/estrangeiros como entidades com relação própria é backlog — precisa de uma base mínima de "clubes conhecidos" que o ClubOS não tem hoje. |
| Ranking FIFA com liga de seleções simuladas | Simular outras seleções (não só a do usuário) subindo/descendo no ranking, para dar contexto de "Top 10 real" em vez de uma classificação manual do adversário. |
| Convocação sugerida automaticamente | Botão "sugerir 23" com base em overall/posição dos atletas do `talentPool`, similar ao `buildBestLineup` do clube. |
| Coletiva de imprensa da seleção | Reaproveitar `pressconference/*` com um novo contexto `national_callup`/`national_result`, hoje fora de escopo (só existem contextos do clube). |

## P3

| Ideia | Descrição |
|-------|-----------|
| Múltiplas seleções ao longo da carreira (troca de federação) | Hoje `nationalTeam` é singular por carreira; permitir "aposentar" de uma seleção e assumir outra depois. |
| Exportação/relatório por Data FIFA | PDF/JSON de resumo da janela (convocados, resultados, estatísticas), no espírito do backup ZIP já existente na Diretoria do clube. |
| Bônus financeiro de convocação | Prêmio em dinheiro para o clube quando um jogador seu é convocado/campeão pela seleção — cruzaria com `ClubFinance`, avaliar com cautela (ver invariantes financeiras no handoff financeiro antes de tocar em `finance.ledger`). |
| Efeito de fadiga por serviço nacional | Hoje o desfalque é só indisponibilidade binária durante a janela; poderia reduzir `fatigue`/`morale` do jogador ao retornar, proporcional a minutos jogados na seleção. |

## Já entregue no protótipo

- (nenhum — este módulo ainda não tem código, só planejamento — Fase 0 concluída em 2026-08-26)

Quando implementado no ClubOS, mover item para **Feito** com data.
