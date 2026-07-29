# ClubOS — Roadmap

Este documento lista as seções e funcionalidades planejadas para o ClubOS, incluindo o que já está disponível e o que está em construção.

> **Especificação detalhada do Modo Jogador:** ver [`modo-jogador.md`](./modo-jogador.md)

## Disponível agora

### Fluxo inicial — Treinador
- Splash com logo e carregamento
- Menu principal (Começar / Carregar)
- Seleção de país (Brasil disponível)
- Seleção de clube com barras visuais e informações do time
- Configuração de manager e competições
- Tutorial introdutório na primeira carreira

### Dashboard
- Visão geral do clube, próxima partida e estatísticas

### Clube
- **Elenco** — gestão de jogadores, números, idade, overall e status
- **Tática** — 15 formações e 10 estilos de jogo, com arraste para posições e banco, escalação automática e troca de formação preservando o time

### Jogos
- **Registro de partida** — agendar e registrar resultados
- **Calendário** — visualização de partidas
- **Competições** — competições da temporada
- **Jogar partida** — escalação com formação, eventos, notas e comentários

---

## Próxima entrega — Modo Jogador (v0.3.0)

### Fluxo inicial — Jogador
- [ ] Escolha de carreira após "Começar": **Jogador** ou **Treinador**
- [ ] Setup em 3 passos: criar jogador → clube atual (manual) → competições
- [ ] Sem base de clubes — dados 100% do usuário e do save
- [ ] Carregar save detecta o modo automaticamente

### Navegação do jogador
- [ ] Dashboard pessoal (OVR, stats, contrato, próxima partida)
- [ ] Registro de partida com foco no desempenho individual
- [ ] Calendário e competições da temporada
- [ ] Perfil, contrato, evolução e histórico de clubes

### Exclusivo do treinador (não aparece no jogador)
- Base de clubes (`teams.json` / `players.json`)
- Elenco, tática, finanças do clube, transferências, diretoria

### WIP futuro no jogador
- Relacionamentos (técnico, torcida, colegas)
- Manchetes e redes sociais pessoais
- Conquistas e seleção nacional

---

## Em construção — Clube (Treinador)

| Seção | Descrição prevista |
|-------|-------------------|
| Treinamento | Sessões de treino, evolução de atributos e condição física |
| Transferências | Mercado, negociações, empréstimos e vendas |
| Diretoria | Relacionamento com conselho, metas impostas e confiança |
| Finanças | Orçamento, salários, receitas de bilheteria e patrocínios |
| Sala de troféus | Histórico de conquistas do clube e do manager |

---

## Em construção — Social

| Seção | Descrição prevista |
|-------|-------------------|
| Redes sociais | Posts, engajamento da torcida e repercussão |
| Manchetes | Notícias simuladas sobre o clube e jogadores |
| Coletivas | Entrevistas coletivas pré e pós-jogo |
| Jogadores | Perfil social dos atletas, humor e relações |

---

## Em construção — Manager

| Seção | Descrição prevista |
|-------|-------------------|
| Pessoal | Perfil do técnico, estilo e reputação |
| Metas | Objetivos da diretoria e da torcida |
| Conquistas | Troféus pessoais e marcos da carreira |

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

## Versão atual do save

`0.2.0` — inclui táticas, tutorial, manager e competições da temporada.

`0.3.0` (planejado) — modo jogador com `careerMode` e `careerPlayer`; saves antigos migrados como treinador.
