# Manual Cursor — Portar **[NOME_MODULO]** para o ClubOS

> Leia `CLUBOS_CONEXAO.md` antes. Use a skill do projeto `clubos-novo-modulo`.

## 1. Objetivo

Integrar [descrição] no ClubOS reutilizando clube/elenco/temporada e preservando a lógica já validada neste protótipo.

## 2. O que ler (ordem)

1. `CLUBOS_CONEXAO.md`
2. Este manual
3. `MELHORIAS_FUTURAS.md` — o que **não** fazer no MVP
4. Código-fonte do protótipo

## 3. Núcleo a extrair (prioridade)

| Prioridade | Arquivo | Ação |
|------------|---------|------|
| 1 | … | … |
| 2 | … | … |

**Não portar** storage isolado — persistir no save ClubOS.

## 4. Checklist MVP

- [ ] Pasta `src/[slug]/`
- [ ] `generate()` / API pura com contexto injetado
- [ ] Estado no GameContext + storage
- [ ] Gatilho no fluxo ClubOS
- [ ] UI (aba / modal / tela)
- [ ] Build ok

## 5. Prompt curto

```text
Integre o módulo [Nome] neste repositório ClubOS.
Leia em modulos-em-desenvolvimento/[slug]/ CLUBOS_CONEXAO.md, CURSOR_MANUAL.md e MELHORIAS_FUTURAS.md.
Porte o motor puro; use clube/elenco do ClubOS como fonte da verdade.
Não implemente o backlog de MELHORIAS_FUTURAS.md.
```
