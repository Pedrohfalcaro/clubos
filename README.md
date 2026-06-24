# ClubOS

Sistema de gestão de clube de futebol — elenco, táticas, partidas, estatísticas e carreira.

## Desenvolvimento

```bash
npm install
npm run dev
```

Abra [http://localhost:5173](http://localhost:5173).

## Build

```bash
npm run build
```

## Deploy (GitHub Pages)

O site publica em `https://pedrohfalcaro.github.io/clubos/`.

1. Em **Settings → Pages → Build and deployment**, selecione **GitHub Actions** como fonte.
2. Cada push na `main` dispara o workflow que faz build do Vite e publica a pasta `dist`.

Veja [docs/ROADMAP.md](docs/ROADMAP.md) para funcionalidades planejadas e seções em construção.
