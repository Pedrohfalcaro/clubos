# ClubOS v1.2 — LiveLife Update

Guia da atualização **LiveLife** para compartilhar com o time: o que mudou, como jogar e o que veio depois no mesmo ciclo.

> Guia completo tela a tela: [`guia-de-uso.md`](./guia-de-uso.md)  
> Spec original: [`INSTRUCOES_LIVELIFE_V1_2.md`](./INSTRUCOES_LIVELIFE_V1_2.md)  
> Pasta técnica: [`LiveLife - Desenvolvimento/`](../LiveLife%20-%20Desenvolvimento/)

---

## Em uma frase

O ClubOS deixa de ser só um gerenciador de partidas manuais e passa a ter **um dia de jogo**. Você **Avança Dia**; o sistema cobra folha, recupera lesionados, gera bilheteria, dispara eventos e alimenta a narrativa (Pulse + ClubOSocial + coletivas + Story Arcs).

---

## Novidades — checklist para o time

### Motor LiveLife (MVP v1.2)
- [x] **Avançar Dia** no Dashboard (clock contínuo)
- [x] Lesões com dias restantes; vermelho suspende na **mesma competição**
- [x] Bilheteria + operação/viagem + premiações automáticas
- [x] Folha salarial no **dia 5** (modal)
- [x] Pulse diário em dias sem jogo
- [x] Clima: diretoria · torcida · mídia
- [x] **ClubOSocial** (manchetes + posts do técnico)
- [x] Coletivas pré/pós-jogo
- [x] Página do **Manager** e **Sala de Troféus**
- [x] Onboarding na Diretoria (tutorial / checklist / changelog)

### Expansões já no app (pós-MVP deste ciclo)
- [x] **Empréstimos bancários** (manual + ponte “Emprestar e pagar” na folha)
- [x] **Dívidas** com parcela obrigatória, dia do mês e juros se ignorar
- [x] **Patrocínios** Master / Manga (cota no dia escolhido, bônus, rescisão, renovar)
- [x] **Janela de transferências** (01/01–31/01 e 01/07–31/08); fora dela só **Renovar**
- [x] Coletivas extras: **convocação**, **lesão grave**, **crise financeira** + atrito com a imprensa
- [x] **Story Arcs** no ClubOSocial (capítulos encadeados ao Avançar Dia)

---

## LIVE — Dia a dia

### Avançar Dia
- CTA principal no **Dashboard**.
- Em dia de jogo → fluxo pré-jogo / Pulse; **Jogar** continua como atalho.
- Cada avanço: +1 dia, recupera lesões, pode abrir folha (dia 5), Pulse diário ou capítulo de Story Arc.

### Lesões e suspensões

| Situação | Comportamento |
|----------|----------------|
| Lesão | Indisponível + dias restantes (ou data de retorno na súmula) |
| Avançar Dia | Contador −1; ao zerar → disponível |
| Vermelho | Suspenso da **próxima partida da mesma competição** |
| Súmula | Lesionados/suspensos fora do XI e do banco |

### Bilheteria e premiações
Após finalizar partida (com estádio configurado): receita casa/fora − custos + premiação da tabela. Configure em **Finanças → Estádio** e **Premiações**.

### Folha no dia 5
Modal no Dashboard. Se o caixa não cobrir:
- **Emprestar e pagar** — crédito de **120% da folha** (juros 12%, 6 parcelas)
- **Pagar (vira dívida)** — caixa zera; faltante vira dívida
- **Depois** — adia e a **moral do elenco cai** (−15)

### Empréstimos e dívidas
- **Finanças → Empréstimos:** crédito manual; parcelas no calendário e popup ao vencer.
- **Finanças → Dívidas:** parcela **obrigatória** no dia do mês (1–28); **ignorar** aplica ~**2,5%** de juros sobre o restante. Eventos no Calendário.

### Patrocínios
- **Finanças → Patrocínios:** um contrato **Master** e um **Manga**.
- Cota mensal no **dia escolhido** (aparece no Calendário).
- Bônus (classificação, artilheiro do clube, título), cláusula de posição, rescisão e renovação.

### Pulse diário e clima
- Chance ~20% em dias sem jogo (configurável).
- Diretoria / torcida / mídia oscilam entre jogos e reagem a resultados e coletivas.

---

## LIFE — Social, coletivas e narrativa

### ClubOSocial (`/social`)
- Manchetes de jogos, transferências e coletivas.
- Posts do técnico (texto/imagem).
- **Story Arcs:** arcos de 3–4 capítulos (vestiário, cerco da imprensa, saga de lesão, ultimato da diretoria). Em dias sem jogo o Avançar Dia pode iniciar/avançar um arco. Banner + filtro **Arcos** no feed; alguns capítulos pedem coletiva.

### Coletivas (`/press-conference`)

| Contexto | Quando |
|----------|--------|
| Pré / pós-jogo | Dia de partida / após finalizar |
| Convocação | Partida importante nos próximos 3 dias |
| Lesão | Atleta com ≥14 dias fora |
| Crise financeira | Caixa crítico (1× por mês) |
| Arco narrativo | Quando o Story Arc pede resposta |

Respostas alteram torcida, elenco, diretoria e **mídia**. Respostas agressivas sobem o **atrito com a imprensa** — recuperar a mídia fica bem mais difícil.

### Manager e Sala de Troféus
- `/manager` — bio, notas, contatos.
- `/trofeus` — títulos; 1º ao avançar temporada vira conquista.

---

## Transferências e mercado

| Aba | Função |
|-----|--------|
| Observação | Watchlist |
| Negociar | Compra / venda / empréstimo / livre — **só com mercado aberto** |
| Renovar | Contrato o ano inteiro (também com mercado fechado) |
| Histórico | Movimentos da temporada |

**Janelas:** 01/01–31/01 e 01/07–31/08 (marcadas no Calendário). Fora delas: só renovação.

---

## Onboarding

**Diretoria → LiveLife:** tutorial, checklist, changelog, concluir onboarding.  
Carreiras antigas sem data: modal pede ativação do LiveLife.

---

## Rotas principais

| Rota | Uso |
|------|-----|
| `/dashboard` | Avançar Dia, folha, Pulse, coletivas, arcos |
| `/financas` | Caixa, empréstimos, dívidas, patrocínios, estádio, premiações |
| `/transferencias` | Mercado + renovar |
| `/calendario` | Jogos, folha, parcelas, janela, patrocínios |
| `/social` | ClubOSocial + Story Arcs |
| `/press-conference` | Coletivas |
| `/manager` · `/trofeus` | Pessoal e títulos |
| `/diretoria` | Confiança, metas, identidade, guia LiveLife |

---

## Status

| Bloco | Status |
|-------|--------|
| Fases 0–8 LiveLife (MVP) | Entregue |
| Empréstimos / dívidas / patrocínios | Entregue |
| Janela de transferências + renovar | Entregue |
| Coletivas expandidas + atrito imprensa | Entregue |
| Story Arcs | Entregue |

Backlog restante (UX/PWA, modo jogador com clock, relacionamentos, etc.): [`MELHORIAS_FUTURAS.md`](../LiveLife%20-%20Desenvolvimento/MELHORIAS_FUTURAS.md).

---

## Como apontar o pessoal

1. Este arquivo — visão da atualização.  
2. [`guia-de-uso.md`](./guia-de-uso.md) — como usar cada tela.  
3. App em produção / Pages: `https://pedrohfalcaro.github.io/clubos/` (após deploy da `main`).
