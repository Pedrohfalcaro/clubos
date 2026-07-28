# ClubOS Pulse — Melhorias Futuras

Backlog além do MVP já implementado no protótipo e além da integração básica com o ClubOS.  
Prioridade sugerida: **P1** (alto valor na carreira) → **P3** (polish).

---

## P1 — Imersão e gestão

| Ideia | Descrição |
|-------|-----------|
| Confiança da diretoria | Meter global que sobe/desce com resultados e eventos `diretoria` / `escandalo`. |
| Popularidade da torcida | Meter global afetado por `torcida`, resultados e ídolos. |
| Moral dinâmica de verdade | Decair moral “fria” entre jogos; eventos e resultados restauram ou afundam. |
| Relacionamentos entre atletas | Afinidade / rivalidade; eventos a dois (discussão, mentoria, ciúme). |
| Resultado da partida informado | Usuário marca V/E/D no ClubOS → altera pesos do próximo Pulse. |
| Banco 365+ | Completar cotas do PRD (Atleta 120, etc.) com a mesma qualidade dos ~117 atuais. |

---

## P2 — Conteúdo e narrativa

| Ideia | Descrição |
|-------|-----------|
| Notícias estilo jornal | Layout manchete + lead + “impacto” (já existe texto; falta apresentação). |
| Linha do tempo da temporada | Visual cronológico dos Pulses + momentos-chave. |
| Arcos de temporada | Temas sazonais (crise, lua de mel, reta final). |
| Eventos por mando/adversário | Casa/fora e rivalidade mudam pesos. |
| Eventos de elenco vazio/cheio | Narrativas quando há lesões em massa ou elenco curto. |
| Personalidade visível (opcional) | Toggle “mostrar personalidades” para power users. |

---

## P3 — Produto e polish

| Ideia | Descrição |
|-------|-----------|
| Estatísticas da temporada | Contagem por categoria, atletas mais citados, “semana caótica”. |
| Conquistas / badges | Ex.: “primeiro escândalo”, “10 Pulses sem repetir categoria”. |
| Temas claro/escuro | Alinhar ao design system do ClubOS. |
| Exportação PDF / print | Relatório da temporada para o usuário. |
| Multiclube / saves | Vários clubes no ClubOS sem misturar cooldowns. |
| i18n | Inglês (e outros) para o banco de eventos. |
| Acessibilidade avançada | Modal focus trap completo, leitores de tela nos impactos. |

---

## Integração ClubOS (além do MVP)

- Pulse automático ao abrir “próximo jogo” no calendário.
- Sincronizar `status` lesionado/indisponível com a lista de disponíveis do ClubOS.
- Feed unificado: transferências reais do ClubOS + Pulses narrativos.
- Painel admin interno (dev) para testar um `eventoId` forçado.
- Telemetria opcional local: eventos mais sorteados (só no device).

---

## Já entregue no protótipo (não repetir como “novo”)

- Setup clube/elenco, gerador, anti-repetição, cadeias, histórico, settings, export/import.
- Templates, impactos narrativos, modal do último evento, badges de status, elenco exemplo.

Quando uma melhoria for implementada no ClubOS, mova-a para uma seção **Feito** neste arquivo com data.
