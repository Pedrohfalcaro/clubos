# ClubOS

Companion do Modo Carreira (EA FC / FIFA): gerencie elenco, táticas, partidas, finanças, diretoria, transferências e narrativa (Pulse). O jogo gera o placar — o ClubOS gera as consequências.

**Guia completo de uso:** [docs/guia-de-uso.md](docs/guia-de-uso.md)

## O que tem hoje

- Login **Google** + save na **nuvem** (Firebase)
- Carreira **treinador** e **jogador**
- Clube custom (cores, escudo, import JSON de elenco)
- Partidas com notas, recap cronológico e Pulse
- **Financeiro** (caixa, folha, extrato, premiações, moedas R$/€/£/$)
- **Diretoria** (confiança, metas, identidade, backup ZIP)
- **Transferências** (watchlist, compra/venda/empréstimo)
- Dashboard com atalhos clicáveis para tudo isso

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
| [firebase-setup.md](docs/firebase-setup.md) | Auth Google + Firestore |
| [documentacao.md](docs/documentacao.md) | Visão / filosofia do produto |
| [roadmap.md](docs/roadmap.md) | Roadmap |
| [modo-jogador.md](docs/modo-jogador.md) | Detalhes do modo jogador |
