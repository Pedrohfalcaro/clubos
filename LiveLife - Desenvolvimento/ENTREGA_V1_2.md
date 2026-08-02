# Entrega — LiveLife Update (v1.2)

**Status:** MVP das Fases 0–8 **entregue** (código no app).  
**Guia de usuário:** [`docs/livelife-v1.2.md`](../docs/livelife-v1.2.md)

---

## Escopo entregue

### LIVE
- Clock `GameState.currentDate` + action `ADVANCE_DAY`
- Ativação em carreiras novas (data de início) e antigas (modal / Diretoria)
- Lesões com countdown; suspensão por competição (vermelho)
- Bilheteria casa/fora + operação/viagem; premiação automática
- Folha no dia 5 (modal no Dashboard)
- Pulse diário parametrizado; clima de confiança entre jogos
- Templates de estádio/premiação por moeda + prompt ao carregar carreira

### LIFE
- ClubOSocial (feed, manchetes, posts do técnico)
- Coletivas pré/pós com deltas + manchete
- Manager (bio, notas, contatos)
- Sala de Troféus + títulos ao avançar temporada

### Onboarding
- Aba LiveLife na Diretoria (tutorial, checklist, changelog)
- Flag `livelife.onboardingComplete`

---

## Próximos passos (fora do código de feature)

1. Testes manuais de regressão (folha, bilheteria, coletivas, troféus).
2. Quando o produto pedir: branch/git da v1.2.
3. Backlog pós-MVP: [`MELHORIAS_FUTURAS.md`](./MELHORIAS_FUTURAS.md).

---

## Documentos desta pasta

| Arquivo | Papel |
|---------|--------|
| `plano_de_desenvolvimento.md` | Fases e critérios |
| `CLUBOS_CONEXAO.md` | Contratos de integração |
| `CURSOR_MANUAL.md` | Checklist de portagem para agentes |
| `MELHORIAS_FUTURAS.md` | Fora do MVP |
| `ENTREGA_V1_2.md` | Este resumo de entrega |
