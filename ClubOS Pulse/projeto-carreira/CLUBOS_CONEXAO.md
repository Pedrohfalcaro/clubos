# ClubOS ↔ Pulse — Conexão de Projeto

## Identidade do módulo

| Campo | Valor |
|--------|--------|
| **Nome do produto** | **ClubOS Pulse** |
| **Nome curto** | **Pulse** |
| **Slogan** | O pulso do clube antes de cada partida |
| **Papel no ClubOS** | Subsistema narrativo de pré-partida / bastidores |
| **Repo / pasta atual** | `projeto-carreira` (protótipo standalone) |
| **Destino** | Integração no **ClubOS** (gerenciador de carreira) |

**Pulse** é o gerador de eventos narrativos que nasceu como app offline independente e deve virar um **plano/módulo dentro do ClubOS**, reutilizando clube, elenco e temporada já existentes no ClubOS — sem cadastro duplicado.

---

## O que é cada projeto

### ClubOS
Gerenciador de carreira: clube, elenco, temporada, rotinas de gestão. É a **fonte da verdade** de dados (clube, atletas, calendário).

### ClubOS Pulse (este protótipo)
App vanilla (HTML/CSS/JS + LocalStorage) que:
- sorteia se “algo acontece” antes da partida (~28% evento / ~72% nada);
- escolhe categoria, raridade e evento do banco (~117 textos, expansível a 365+);
- personaliza com `{{atleta}}`, `{{clube}}`, `{{posicao}}`;
- aplica efeitos leves (moral, fadiga, status);
- registra histórico, cadeias e impactos narrativos (“fora da partida”, “torcida chateada”, etc.).

---

## Mapa de responsabilidade

```
ClubOS (core)
  ├── Club / Season / Squad          ← dono dos dados
  ├── Matchday / Calendar            ← “antes do jogo” dispara o Pulse
  └── Pulse (módulo)                 ← gera narrativa + impactos
        ├── Event bank
        ├── Probability engine
        ├── Chains / cooldowns
        └── History (feed do clube)
```

| Dado | Dono | Pulse |
|------|------|--------|
| Nome do clube | ClubOS | só lê |
| Elenco (id, nome, posição, idade) | ClubOS | lê; pode escrever moral/fadiga/status se ClubOS permitir |
| Temporada / nº da partida | ClubOS | lê |
| Banco de eventos | Pulse | dono |
| Histórico de eventos | Pulse (ou feed ClubOS) | escreve |
| Config chance/animações | Pulse settings (ou preferências ClubOS) | lê/escreve |

---

## Contrato de integração (API mental)

Quando o usuário abrir o fluxo **Pré-partida** no ClubOS:

```text
input:
  club: { id, nome }
  season: { id, label | numero }
  matchContext: { rodada?, adversario?, mando? }   // opcional no MVP
  athletes: [{ id, nome, posicao, idade, moral?, fadiga?, status? }]
  settings?: { chanceEvento, cooldownEventos }
  pulseState?: { cooldowns, chains, recentHistoryIds }

output:
  outcome: "nada" | "evento"
  event?: {
    id, categoria, raridade, titulo, descricao,
    impactos: string[],
    atletaId?, atletaNome?,
    cadeiaId?
  }
  athletePatches?: [{ id, moral?, fadiga?, status? }]
  pulseStateNext: { cooldowns, chains, ... }
```

O protótipo atual faz isso em `Generator.gerarEvento(state)` com estado monolítico em LocalStorage (`gerador_carreira_v1`). No ClubOS, o mesmo motor deve receber **contexto injetado** em vez de “dono” do clube/elenco.

---

## Arquivos-fonte do protótipo (o que portar)

```
index.html, style.css, script.js     → UI de referência (não copiar cegamente)
js/utils.js                          → utilitários
js/storage.js                        → substituir por store/API do ClubOS
js/probabilities.js                  → portar quase intacto
js/events.js                         → portar banco + IMPACTOS
js/athletes.js                       → adaptar ao modelo de jogador do ClubOS
js/generator.js                      → núcleo a extrair (funções puras)
js/history.js                        → adaptar ao feed/histórico ClubOS
js/settings.js                       → mapear para settings ClubOS
js/ui.js                             → reescrever na UI do ClubOS
```

Documentos de produto originais: `plano base/`.

Manual de portagem para o Cursor: **[CURSOR_MANUAL_PULSE.md](CURSOR_MANUAL_PULSE.md)**.  
Backlog pós-MVP: **[MELHORIAS_FUTURAS.md](MELHORIAS_FUTURAS.md)**.

---

## Estratégia de integração recomendada

1. **Extrair o motor** (`probabilities` + `events` + `generator` + resolução de impactos) como pacote/módulo `pulse/` sem DOM.
2. **Adaptar o modelo de atleta** ao schema do ClubOS (IDs reais, status, moral).
3. **Gatilho**: botão/tela “Pulse da partida” ou automático ao abrir o jogo no calendário.
4. **Persistência**: histórico e cooldowns no banco/store do ClubOS (não LocalStorage isolado).
5. **UI**: card de resultado + modal de detalhe + lista no feed (reaproveitar UX deste protótipo).
6. **Migração opcional**: importar JSON exportado pelo protótipo (`club`, `athletes`, `history`, `settings`).

---

## Branding na UI do ClubOS

- Módulo / aba: **Pulse**
- Título de tela: **ClubOS Pulse**
- CTA: **Gerar Pulse** ou **Consultar bastidores**
- Empty state: “Nenhum Pulse ainda nesta temporada.”

Evitar chamar só de “Gerador de Eventos” na UI final — o nome de produto é **Pulse**.

---

## Status deste repositório

Protótipo **standalone funcional** para validar narrativa, banco e UX.  
Não é o destino final: o destino é o **ClubOS**, com Pulse como plano interno.
