# ClubOS ↔ [NOME_MODULO] — Conexão de Projeto

## Identidade do módulo

| Campo | Valor |
|--------|--------|
| **Nome do produto** | **ClubOS [Nome]** |
| **Nome curto** | **[slug]** |
| **Slogan** | … |
| **Papel no ClubOS** | … |
| **Repo / pasta atual** | `modulos-em-desenvolvimento/[slug]/` |
| **Destino** | Integração no **ClubOS** |

---

## O que é cada projeto

### ClubOS
Gerenciador de carreira: clube, elenco, temporada, partidas. **Fonte da verdade**.

### Este módulo
Descreva o que o protótipo faz, inputs/outputs e o que **não** é responsabilidade dele.

---

## Contrato de integração (API mental)

```text
input:
  club: { id, nome }
  season: number
  athletes: [{ id, nome, posicao, idade, ... }]
  settings?: { ... }
  moduleState?: { ... }

output:
  resultado: { ... }
  athletePatches?: [{ id, ... }]
  moduleStateNext: { ... }
```

---

## Branding na UI do ClubOS

- Módulo / aba: **[Nome]**
- Título: **ClubOS [Nome]**
- CTA: …
- Empty state: …

---

## Status

Protótipo standalone para validar. Destino: plano interno do ClubOS.
