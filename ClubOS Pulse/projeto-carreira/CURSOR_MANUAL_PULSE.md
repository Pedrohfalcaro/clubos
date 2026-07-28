# Manual Cursor — Portar **ClubOS Pulse** para o ClubOS

> **Para o agente Cursor no repositório ClubOS:** leia este arquivo + `CLUBOS_CONEXAO.md` antes de integrar o gerador.  
> O protótipo standalone vive em `projeto-carreira`. O nome do módulo no ClubOS é **Pulse** (produto **ClubOS Pulse**).

---

## 1. Objetivo

Integrar o sistema de eventos narrativos pré-partida (**Pulse**) no **ClubOS**, reutilizando clube/elenco/temporada do ClubOS e preservando a lógica de sorteio, banco, impactos, cadeias e anti-repetição já validados no protótipo.

Não reinventar o banco de eventos do zero. Portar e adaptar.

---

## 2. O que ler primeiro (ordem)

1. `CLUBOS_CONEXAO.md` — visão, contrato de dados, branding  
2. Este manual — passos de implementação  
3. `MELHORIAS_FUTURAS.md` — o que **não** fazer no MVP de integração  
4. Código-fonte do protótipo (prioridade de portagem abaixo)  
5. `plano base/PRD_*.txt` e `Escopo_*.txt` — requisitos de produto originais  

---

## 3. Nome e UX no ClubOS

- Nome de produto: **ClubOS Pulse**  
- Nome curto / rota / pasta: **pulse**  
- CTA sugerido: **Gerar Pulse**  
- Evitar labels genéricos tipo “Gerador de Eventos” na UI final  

---

## 4. Núcleo a extrair (prioridade)

Portar **nesta ordem**, preferindo funções puras (sem `document` / LocalStorage):

| Prioridade | Arquivo protótipo | Ação no ClubOS |
|------------|-------------------|----------------|
| 1 | `js/probabilities.js` | Copiar pesos e modificadores |
| 2 | `js/events.js` | Copiar `BANK` + `IMPACTOS` + `resolverImpactos` |
| 3 | `js/generator.js` | Extrair `gerarEvento` para receber contexto injetado |
| 4 | `js/athletes.js` | Adaptar seleção/efeitos ao model de jogador ClubOS |
| 5 | `js/utils.js` | `template`, `pickWeighted`, `uid`, `clamp`, `ageBand` |
| 6 | `js/history.js` / `settings.js` | Mapear para store ClubOS |
| 7 | UI (`ui.js`, CSS do card/modal) | Reimplementar com design system ClubOS |

**Não portar como dono de dados:** `storage.js` com chave `gerador_carreira_v1` — no ClubOS a persistência é a do app.

---

## 5. Modelo de chamada alvo

```js
// Pseudocódigo — adaptar ao stack real do ClubOS
const result = Pulse.generate({
  club: clubOS.getClub(),
  season: clubOS.getSeason(),
  athletes: clubOS.getSquad(),
  settings: clubOS.getPulseSettings(),
  pulseState: clubOS.getPulseState(), // cooldowns, chains, recent
});

clubOS.applyAthletePatches(result.athletePatches);
clubOS.appendPulseHistory(result);
clubOS.savePulseState(result.pulseStateNext);
```

Regras que devem permanecer:
- Chance padrão ~28% evento (configurável)
- Pesos de categoria e raridade
- Anti-repetição (últimos N + cooldown por evento)
- Evitar mesma categoria 3× seguidas
- Cadeias com prioridade sobre o roll normal
- Templates `{{atleta}}` / `{{clube}}` / `{{posicao}}`
- Campo `impactos[]` sempre presente no resultado e no histórico

---

## 6. Checklist de integração MVP

- [ ] Pasta/módulo `pulse` (ou equivalente) no ClubOS  
- [ ] Banco de eventos + impactos importados  
- [ ] `generate()` usa elenco real do ClubOS (sem setup duplicado)  
- [ ] Tela/ação pré-partida chama o Pulse  
- [ ] Card de resultado mostra descrição + **O que isso impacta**  
- [ ] Detalhe em modal/drawer (como o protótipo)  
- [ ] Histórico filtrável por temporada/categoria/atleta  
- [ ] Patches de moral/fadiga/status aplicados no elenco ClubOS (se o model tiver esses campos)  
- [ ] Estado Pulse (cooldowns/chains) persistido junto do save da carreira  
- [ ] Settings: chance de evento + toggle de loading  

Fora do MVP de integração: ver `MELHORIAS_FUTURAS.md` (PDF, relacionamentos, meters globais, etc.).

---

## 7. Compatibilidade com o protótipo

Export JSON do protótipo contém: `version`, `club`, `athletes`, `settings`, `history`, `cooldowns`, `chains`.

Se o ClubOS quiser importar saves de teste do Pulse:
- mapear `athletes[]` → squad  
- mapear `history[]` → feed Pulse  
- ignorar/reescrever `club` se o ClubOS já tiver clube ativo  

---

## 8. Critérios de qualidade

- Motor testável sem DOM  
- Sem duplicar nomes de jogadores: sempre IDs do ClubOS  
- Eventos novos seguem o schema: `id`, `categoria`, `raridade`, `titulo`, `descricao`, `tags`, `efeitos`, `impactos` (via mapa), `cadeia`, `cooldown`  
- Textos em PT-BR no banco (a menos que o ClubOS peça i18n)  
- Não bloquear a integração esperando os 365 eventos — expandir depois  

---

## 9. Prompt curto para colar no chat do ClubOS

```text
Integre o ClubOS Pulse (gerador narrativo pré-partida) neste repositório.
Leia no pacote/protótipo: CLUBOS_CONEXAO.md, CURSOR_MANUAL_PULSE.md e MELHORIAS_FUTURAS.md.
Porte o motor de js/probabilities.js, js/events.js, js/generator.js e utils relevantes.
Use clube/elenco/temporada do ClubOS como fonte da verdade.
UI: card + impactos + modal de detalhe; CTA "Gerar Pulse".
Não implemente ainda o backlog P2/P3 de MELHORIAS_FUTURAS.md.
```

---

## 10. Glossário rápido

| Termo | Significado |
|-------|-------------|
| Pulse | Um sorteio/consulta narrativa pré-partida |
| Impacto | Frase curta do tipo “jogador fora”, “torcida chateada” |
| Cadeia | Evento que agenda outro com chance (`cadeia.nextId`) |
| Nada | Outcome sem acontecimento (~72%) |
