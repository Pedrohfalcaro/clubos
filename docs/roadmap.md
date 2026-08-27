# ClubOS — Roadmap

Este documento lista as seções e funcionalidades planejadas para o ClubOS, incluindo o que já está disponível e o que está em construção.

> **LiveLife (v1.2):** [`livelife-v1.2.md`](./livelife-v1.2.md)  
> **Modo Jogador:** [`modo-jogador.md`](./modo-jogador.md)  
> **Modo Seleção / Dual Career (v1.4):** [`selecao-nacional.md`](./selecao-nacional.md)

## Disponível agora

### Fluxo inicial — Treinador
- Splash com logo e carregamento
- Menu principal (Começar / Carregar)
- Seleção de país (Brasil disponível)
- Criação de clube (cores, elenco, import JSON)
- Configuração de manager e competições (data LiveLife, premiações, moeda)
- Tutorial introdutório na primeira carreira

### LiveLife (v1.2)
- [x] Calendário contínuo e **Avançar Dia**
- [x] Lesões / suspensões temporais (por competição)
- [x] Bilheteria + estádio + premiação automática
- [x] Folha no dia 5
- [x] Pulse diário
- [x] Onboarding e changelog na Diretoria
- [x] ClubOSocial, Coletivas, Manager, Sala de Troféus

### Dashboard
- Visão geral do clube, data do jogo, próxima partida e estatísticas

### Clube
- **Elenco** — gestão de jogadores, disponibilidade, moral/personalidade
- **Tática** — 15 formações e 10 estilos de jogo
- **Finanças** — caixa, extrato, folha, premiações, estádio
- **Diretoria** — confiança, metas, identidade, LiveLife
- **Transferências** — watchlist, compra/venda/empréstimo
- **Sala de troféus** — títulos e classificações

### Jogos
- Registro de partida, calendário, competições, Pulse, jogar partida

### Social / Manager
- ClubOSocial, Coletivas, página pessoal do técnico

### Modo Seleção / Dual Career (v1.4 — International Duty Update)
- [x] Alternar Clube ⇄ Seleção a qualquer momento, sem perder progresso de nenhum dos dois
- [x] Datas FIFA como hub — jogos, convocação (com numeração herdada da convocação anterior) e tática própria por janela
- [x] Desfalque automático no clube (`nationalDutyUntil`) quando um convocado é do seu elenco
- [x] Partida da seleção com o mesmo motor do clube — escalação, tática, eventos ao vivo
- [x] Dashboard com líderes de carreira, ranking FIFA dinâmico e variação
- [x] Diretoria da federação — metas e moral independentes do clube
- [x] Pulse Internacional — pedido de desconvocação do clube em amistosos

---

## Próxima entrega — Modo Jogador (aprofundamento)

### Fluxo e navegação
- [ ] Dashboard pessoal completo (OVR, stats, contrato, próxima partida)
- [ ] Registro de partida com foco no desempenho individual
- [ ] Calendário e competições da temporada
- [ ] Perfil, contrato, evolução e histórico de clubes

### WIP futuro no jogador
- Relacionamentos (técnico, torcida, colegas)
- Manchetes e redes sociais pessoais
- Conquistas e seleção nacional
- Clock LiveLife sincronizado com lesões do atleta

---

## Em construção — Clube (Treinador)

| Seção | Descrição prevista |
|-------|-------------------|
| Treinamento | Sessões de treino, evolução de atributos e condição física |
| Perfil social dos jogadores | Humor e relações além do painel do Elenco |

---

## Pós-MVP LiveLife

Ver [`MELHORIAS_FUTURAS.md`](../LiveLife%20-%20Desenvolvimento/MELHORIAS_FUTURAS.md): patrocínios dinâmicos, CT, empréstimos bancários, avançar até próximo evento, etc.

---

## Em construção — Países e ligas

| País | Ligas previstas |
|------|-----------------|
| Inglaterra | Premier League, Championship, FA Cup, Carabao Cup |
| Arábia Saudita | Saudi Pro League, King's Cup, Super Cup |
| Brasil | ✅ Campeonato Brasileiro, Copa do Brasil, Libertadores, Paulista, Sul-Americana |

---

## Melhorias técnicas planejadas

- Múltiplos slots de save
- Modo escuro/claro configurável
- Exportação de estatísticas da temporada
- Integração com mais clubes e divisões do futebol brasileiro

---

## Versão do produto / save

| Versão | Conteúdo |
|--------|----------|
| `0.2.x` | Base treinador: táticas, tutorial, manager, competições |
| `0.3.x` | Modo jogador (`careerMode` / `careerPlayer`) |
| `1.2` LiveLife | Clock contínuo, economia por partida, LIFE (social/coletivas/troféus) |
| `1.3` Financial Update | Dashboard financeiro, rating bancário, teto de gastos |
| **`1.4` International Duty Update** | Modo Seleção / Dual Career — Datas FIFA, convocação, tática e partidas próprias, ranking FIFA, Pulse Internacional |
