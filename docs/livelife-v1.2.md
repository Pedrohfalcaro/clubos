# ClubOS v1.2 — LiveLife Update

Guia oficial da atualização **LiveLife**: calendário contínuo, economia por partida, lesões no tempo do jogo, Pulse diário, ClubOSocial, coletivas, manager e Sala de Troféus.

> Spec original de desenvolvimento: [`INSTRUCOES_LIVELIFE_V1_2.md`](./INSTRUCOES_LIVELIFE_V1_2.md)  
> Plano técnico e contratos: pasta [`LiveLife - Desenvolvimento/`](../LiveLife%20-%20Desenvolvimento/)

---

## O que mudou

O ClubOS deixa de ser só um gerenciador de partidas manuais e passa a ter **um dia de jogo** (`currentDate`). Você avança o calendário; o sistema cobra folha, recupera lesionados, gera bilheteria, dispara eventos e alimenta a narrativa social.

| Pilar | Conteúdo |
|-------|----------|
| **LIVE** | Avançar Dia, lesões/suspensões temporais, bilheteria, folha no dia 5, Pulse diário, clima de confiança |
| **LIFE** | ClubOSocial, coletivas pré/pós, página do manager, Sala de Troféus |

---

## Checklist rápido (primeira carreira)

1. Criar carreira com **data de início** (passo de competições).
2. Conferir **moeda**, **premiações** e **estádio** (templates já vêm preenchidos; ajuste se quiser).
3. Preencher **salários** do elenco (folha do dia 5 usa isso).
4. No Dashboard, usar **Avançar Dia** como ação principal.
5. Em **Diretoria → LiveLife**, abrir o tutorial e marcar o onboarding quando estiver ok.

Carreiras antigas sem data: ao abrir, o ClubOS pede ativação do LiveLife (data base). Enquanto `currentDate` estiver vazio, o modo contínuo não roda.

---

## LIVE — Dia a dia

### Avançar Dia

- No **Dashboard**, o CTA principal é **Avançar Dia**.
- Em **dia de jogo**, o fluxo leva ao pré-jogo / Pulse da partida; **Jogar** permanece como atalho.
- Cada avanço:
  - soma 1 dia no calendário do jogo;
  - decrementa lesões;
  - no **dia 5**, abre o modal de **folha salarial**;
  - em dias **sem partida**, pode rolar um **Pulse diário** (chance configurável).

### Lesões e suspensões

| Situação | Comportamento |
|----------|----------------|
| Lesão (partida / Pulse) | `Lesionado` + dias restantes (ou data de retorno na súmula) |
| Avançar Dia | Contador −1; ao zerar → disponível |
| Cartão vermelho | Suspenso da **próxima partida da mesma competição** |
| Súmula | Lesionados e suspensos **não entram** no XI nem no banco |

No **Elenco**, dá para ajustar dias/partidas ou retirar a indisponibilidade manualmente.

### Bilheteria e premiações

Após **finalizar partida** (com estádio configurado):

- **Casa:** receita de bilheteria − custo de operação do estádio  
- **Fora:** receita visitante − custo médio de viagem  
- **Premiação** da `prizeTable` (vitória/empate etc.) entra sozinha no extrato  

Configure em **Finanças → Estádio** e **Finanças → Premiações**. Valores template por moeda (BRL / EUR / GBP / USD) são aplicados se estiver vazio.

### Folha no dia 5

Ao avançar para o **dia 5** do mês do jogo, o Dashboard pede confirmação para pagar a soma dos salários. Você pode pagar ou adiar; o lembrete volta enquanto a folha estiver pendente.

Se o **caixa não cobrir** a folha:
- **Emprestar e pagar** — crédito de **120% da folha** (juros 12%, 6 parcelas)
- **Pagar (vira dívida)** — caixa zera e o faltante vira dívida em **Finanças → Dívidas**
- **Depois** — adia a folha e a **moral do elenco cai** (−6)

Dívidas também podem ser criadas no setup da carreira ou em **Diretoria → Identidade**, com parcela mensal opcional (dia 5) ou amortização livre.

### Pulse diário

- Chance padrão ~**20%** em dias sem jogo (ajuste em **Pulse → Configurações**).
- Eventos só de pré-partida (`match_only`) **não** aparecem nesses dias.
- O modal aparece no Dashboard quando um evento rola.

### Clima (confiança)

Vitórias, derrotas e eventos Pulse podem alterar confiança da **diretoria**, **torcida** e **mídia**. Em dias sem jogo há oscilação leve — o LiveLife mantém o “termômetro” vivo entre as partidas.

---

## LIFE — Social e manager

### ClubOSocial (`/social`)

- Feed com manchetes automáticas pós-jogo (e de transferências / coletivas quando aplicável).
- O técnico pode publicar posts (hashtag do clube se não informar outra).
- No **Elenco**, personalidade e moral do atleta aparecem no painel de edição.

### Coletivas (`/press-conference`)

- **Pré-jogo:** atalho no Dashboard em dia de partida.  
- **Pós-jogo:** após finalizar a partida (e atalho no Dashboard).  
- Respostas mexem em torcida, moral do elenco e diretoria, e geram manchete no ClubOSocial.

### Manager (`/manager`)

Bio, notas táticas e contatos editáveis; atalho para a Sala de Troféus e prêmios individuais do técnico.

### Sala de Troféus (`/trofeus`)

Galeria de títulos e classificações. Ao **avançar temporada**, posição 1º em competição vira título (e pode gerar prêmio de Melhor Técnico + manchete).

---

## Onboarding na Diretoria

**Diretoria → aba LiveLife:**

- Botão **Tutorial & Guia LiveLife**
- Checklist derivado do save (salários, premiações, estádio…)
- **Changelog** in-app (v1.0 / v1.1 / v1.2)
- Flag `onboardingComplete` ao concluir o guia

Ao carregar a carreira, um modal pode lembrar dados que melhoram o LiveLife; dá para fechar e seguir jogando.

---

## Rotas novas / atualizadas

| Rota | Seção |
|------|--------|
| `/dashboard` | Avançar Dia, folha, Pulse diário, coletivas do dia |
| `/financas` | Aba **Estádio** + bilheteria no extrato |
| `/diretoria` | Aba **LiveLife** |
| `/social` | ClubOSocial |
| `/press-conference` | Coletivas |
| `/manager` | Pessoal do técnico |
| `/trofeus` | Sala de Troféus |

---

## Status das fases de desenvolvimento

| Fase | Nome | Status |
|------|------|--------|
| 0 | Fundação documental | Entregue |
| 1 | Calendário contínuo | Entregue |
| 2 | Lesões e status temporal | Entregue |
| 3 | Motor financeiro e bilheteria | Entregue |
| 4 | Onboarding na Diretoria | Entregue |
| 5 | Pulse diário | Entregue |
| 6 | ClubOSocial | Entregue |
| 7 | Coletivas | Entregue |
| 8 | Manager e Sala de Troféus | Entregue |

Itens fora do MVP (patrocínios dinâmicos, CT, empréstimos bancários, etc.): [`MELHORIAS_FUTURAS.md`](../LiveLife%20-%20Desenvolvimento/MELHORIAS_FUTURAS.md).

---

## Para desenvolvedores

| Arquivo | Uso |
|---------|-----|
| [`CLUBOS_CONEXAO.md`](../LiveLife%20-%20Desenvolvimento/CLUBOS_CONEXAO.md) | Contratos LIVE / LIFE (input → output) |
| [`CURSOR_MANUAL.md`](../LiveLife%20-%20Desenvolvimento/CURSOR_MANUAL.md) | Ordem de portagem e checklists |
| [`plano_de_desenvolvimento.md`](../LiveLife%20-%20Desenvolvimento/plano_de_desenvolvimento.md) | Fases e critérios de pronto |
| `src/livelife/` | Motor puro (`advanceDay`, `tickInjuries`, …) |
| `src/pressconference/` | Motor de coletivas |
| `GameState.currentDate` | Único clock do jogo (ISO `YYYY-MM-DD`) |

Regra: novos campos no save **sempre** com `migrateSave` em `storage.ts`.
