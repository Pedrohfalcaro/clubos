# MELHORIAS_FUTURAS — LiveLife Update

> Itens fora do MVP das Fases 1–8 (já entregues). Revisitar após estabilização / release da v1.2.  
> Ver [`ENTREGA_V1_2.md`](./ENTREGA_V1_2.md) e [`docs/livelife-v1.2.md`](../docs/livelife-v1.2.md).

---

## Expansões econômicas (spec 2.4)

### Patrocínios dinâmicos ✅
- [x] Contratos Master e Manga (um de cada ativo) com duração em temporadas
- [x] Cota mensal creditada no dia 5
- [x] Bônus por classificação, artilheiro do clube e título (ao avançar temporada)
- [x] Cláusula de posição mínima + multa de rescisão
- [x] Renovar (+1 temporada) / rescindir antecipado em Finanças → Patrocínios

### Empréstimos bancários ✅
- [x] Empréstimos manuais em Finanças (principal, juros, parcelas no calendário)
- [x] Parcelas vencidas com modal no Dashboard ao Avançar Dia
- [x] Opção **Emprestar e pagar** no modal da folha (dia 5) quando `balance < folha`
- [x] Valor do ponte = **120% da folha**, juros 12%, 6 parcelas mensais (1ª no mês seguinte)
- [x] Saldo / parcelas ativos na aba Empréstimos de Finanças

---

## Expansões de gameplay

### Modo Player com clock contínuo
- Sincronizar `CareerPlayer.InjuryEntry` com o mesmo `currentDate` da carreira do jogador.
- Avançar Dia disponível no modo jogador com eventos de treino e relacionamento com técnico.

### Relacionamentos interpessoais
- Grafo simples de `relation` entre atletas e entre atleta↔técnico.
- Jogadores com alta afinidade boosteiam moral um do outro; rivalidades internas geram eventos Pulse.

### Transferências com janela temporal ✅
- [x] Janelas oficiais: 01/01–31/01 e 01/07–31/08 (marcadas no Calendário)
- [x] Compra / venda / empréstimo / livre só com mercado aberto
- [x] Fora da janela: aba Renovar (contrato + salário + bônus opcional)

### Escalas de coletiva expandidas ✅
- [x] Coletivas extras no Dashboard: convocação (jogo importante), lesão grave (≥14 dias), crise financeira
- [x] Atrito com a imprensa (`pressFriction`): respostas agressivas dificultam ganhos de mídia; recuperação lenta
- [x] Banco de perguntas dedicado por contexto + manchete no ClubOSocial

### Story Arcs no ClubOSocial ✅
- [x] Arcos de 3–4 capítulos (vestiário, cerco da imprensa, saga de lesão, ultimato da diretoria)
- [x] Avançam ao Avançar Dia (dias sem jogo); manchetes encadeadas no feed
- [x] Passos podem sugerir coletiva (`story_arc` / lesão) e alterar clima/moral
- [x] Banner + filtro “Arcos” no ClubOSocial; CTA no Dashboard

---

## UX / PWA

### Notificações push
- PWA com service worker: notificação quando há partida hoje ou folha a pagar.

### Modo offline robusto
- Sync de save via Firestore quando online; cache local quando offline (Firestore já existe no projeto).

### Avançar Dia em lote
- Configuração para avançar automaticamente X dias (com pausa obrigatória em jogos e dia 5).

---

## Histórico de mudanças desta lista

| Data | Item adicionado |
|------|----------------|
| 2026-07-30 | Todos os itens acima (baseline v1.2 MVP) |
| 2026-08-02 | Empréstimos bancários: ponte no modal da folha (120% da folha) |
| 2026-08-02 | Patrocínios dinâmicos Master/Manga; moral atraso folha −15 |
| 2026-08-02 | Dívidas/patrocínios: dia da parcela + calendário |
| 2026-08-02 | Janela de transferências + renovações (propostas e CT removidos) |
| 2026-08-02 | Coletivas expandidas + atrito com a imprensa |
| 2026-08-02 | Story Arcs no ClubOSocial |
