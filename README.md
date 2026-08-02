# ClubOS

Companion do Modo Carreira (EA FC / FIFA): gerencie elenco, táticas, partidas, finanças, diretoria, transferências e narrativa (Pulse). O jogo gera o placar — o ClubOS gera as consequências.

**Guia completo de uso:** [docs/guia-de-uso.md](docs/guia-de-uso.md)  
**Novidades LiveLife (v1.2) — manda este pro time:** [docs/livelife-v1.2.md](docs/livelife-v1.2.md)

## O que tem hoje

- Login **Google** + save na **nuvem** (Firebase)
- Carreira **treinador** e **jogador**
- Clube custom (cores, escudo, import JSON de elenco)
- Partidas com notas, recap cronológico e Pulse
- **LiveLife** — Avançar Dia, bilheteria, lesões temporais, folha no dia 5, Pulse diário
- **Competições** — pontos corridos, mata-mata e liga + mata-mata, com premiação ao avançar de fase
- **ClubOSocial** + **Story Arcs**, coletivas (pré/pós + convocação/lesão/crise), Manager e Sala de Troféus
- **Financeiro** — caixa, folha, empréstimos, dívidas, patrocínios Master/Manga, premiações, estádio
- **Diretoria** (confiança, metas, identidade, guia LiveLife, backup ZIP)
- **Transferências** com janela de mercado + renovação fora da janela
- Dashboard com atalhos para tudo isso

## Desenvolvimento

```bash
npm install
cp .env.example .env   # preencha as chaves Firebase
npm run dev
```

Abra [http://localhost:5173](http://localhost:5173).

Setup Firebase: [docs/firebase-setup.md](docs/firebase-setup.md)

## Build

```bash
npm run build
```

## Deploy (GitHub Pages)

Publica em `https://pedrohfalcaro.github.io/clubos/`.

1. **Settings → Pages → Build and deployment** → fonte **GitHub Actions**
2. Push na `main` dispara o build do Vite e publica `dist`

## Documentação

| Doc | Conteúdo |
|-----|----------|
| [guia-de-uso.md](docs/guia-de-uso.md) | Como usar cada tela do jogo |
| [livelife-v1.2.md](docs/livelife-v1.2.md) | Atualização LiveLife (v1.2) |
| [firebase-setup.md](docs/firebase-setup.md) | Auth Google + Firestore |
| [documentacao.md](docs/documentacao.md) | Visão / filosofia do produto |
| [roadmap.md](docs/roadmap.md) | Roadmap |
| [modo-jogador.md](docs/modo-jogador.md) | Detalhes do modo jogador |
| [LiveLife - Desenvolvimento/](LiveLife%20-%20Desenvolvimento/) | Plano, contratos e entrega técnica |
