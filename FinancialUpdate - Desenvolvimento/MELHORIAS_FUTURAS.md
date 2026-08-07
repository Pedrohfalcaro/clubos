# MELHORIAS_FUTURAS — Financial Update (v1.3)

> Itens fora do escopo das Fases 1–9 deste épico. Revisitar após estabilização/release da v1.3.
> Ver [`plano_de_desenvolvimento.md`](./plano_de_desenvolvimento.md) §4.

---

## Fora de escopo desta versão (decisão consciente)

### Conversão cambial real
- Moeda (BRL/EUR/GBP/USD) continua só símbolo/formatação — decisão já tomada no handoff financeiro (`docs/HANDOFF_FINANCEIRO_CLAUDE.md` §11) e reafirmada aqui: não há necessidade de câmbio simulado no curto prazo.

### Ofertas dinâmicas de patrocínio
- Hoje o patrocínio Master/Manga é contratado manualmente pelo usuário em Finanças. A spec v1.3 não pediu isso, mas apareceu como ideia adjacente ao rating bancário ("melhores propostas com AAA/AA").
- Expansão futura: gerar ofertas de patrocínio via Pulse/narrativa, com termos melhores conforme `finance.health.rating` — reaproveitaria o contrato de `ClubSponsor` já existente, só mudaria a origem da oferta.

### CT / infraestrutura como investimento
- Não implementado em nenhuma versão até aqui. Ficaria como um novo tipo de ativo/gasto de capital (diferente de despesa corrente), fora do escopo de analytics/rating desta v1.3.

### `recharts` (ou lib de gráfico equivalente)
- Fase 6 usa SVG custom para não adicionar dependência. Se o gráfico de fluxo de caixa precisar de interações mais ricas (zoom, brush, múltiplas séries simultâneas) depois do MVP, reavaliar uma lib dedicada — não é um requisito da v1.3, é uma porta aberta.

---

## Expansões de gameplay adjacentes (não pedidas pela spec, mas conectadas)

### Avançar Dia em lote + pausa por estouro de teto
- O backlog geral (`LiveLife - Desenvolvimento/MELHORIAS_FUTURAS.md`) já lista "Avançar Dia em lote". Quando isso for implementado, o motor de teto (Fase 4 desta v1.3) precisa ser um dos gatilhos de pausa automática, junto com jogos e dia 5.

### Notificações de rating
- PWA/notificações (já no backlog geral) poderia avisar quando o rating cai de faixa (ex.: A → BBB), não só folha/jogo.

### Metas de diretoria ligadas ao rating
- `BoardGoalKind` (`types/Board.ts`) já tem `wage_bill_cap`. Poderia ganhar um tipo `credit_rating_target` (ex.: "terminar a temporada com rating ≥ A") usando `finance.health.rating` como fonte — não pedido pela spec, mas natural depois que o rating existir.

---

## Histórico de mudanças desta lista

| Data | Item adicionado |
|------|----------------|
| 2026-08-07 | Baseline — itens identificados durante o planejamento da Fase 0 (ofertas de patrocínio dinâmicas, CT/infra, câmbio real, lib de gráfico, avançar dia em lote + teto, notificações de rating, meta de diretoria por rating) |
