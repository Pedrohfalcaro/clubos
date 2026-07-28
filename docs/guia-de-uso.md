# Guia de uso — ClubOS

Companion do Modo Carreira (EA FC / FIFA): você joga a partida no console/PC e registra tudo aqui. O ClubOS cuida das consequências — elenco, caixa, diretoria, transferências e narrativa (Pulse).

---

## Começar

1. Abra o site e faça **Entrar com Google** (obrigatório — o save fica na nuvem).
2. **Começar** = nova carreira · **Carregar** = retomar o save da conta.
3. Escolha o modo:
   - **Treinador** — gerencia o clube inteiro
   - **Jogador** — carreira focada no atleta (contrato, partidas pessoais, evolução)

> Sem internet / sem login Google o menu não libera a carreira (modo online com Firebase).

Setup Firebase (dev): veja [firebase-setup.md](./firebase-setup.md).

---

## Modo Treinador

### Criar clube e elenco

Em **Criar clube**:

- Nome + **cores primária e secundária** (menu, escudo e camisas no campo)
- Monte o elenco à mão **ou**:
  - **Baixar modelo JSON** → edite fora → **Importar JSON**
  - **Elenco de exemplo** (preenche 13 jogadores)
- Mínimo: **11 atletas**
- Depois: manager + competições da temporada

**Cores no campo**

| Situação | Cor dos tokens (linha) |
|----------|-------------------------|
| Casa / neutro | Primária |
| Fora | Secundária |
| Goleiro | Amarelo clássico — **exceto** se primária/secundária forem amarelas (aí troca automaticamente) |

---

### Dashboard

Painel do clube:

- **Caixa** (clique) → Finanças
- **Confiança diretoria / torcida** (clique) → Diretoria
- Cards **Financeiro · Diretoria · Transferências** com resumo e atalho
- Próxima partida, V/E/D, artilharia, assistências, notas, últimos jogos
- Atalhos: Elenco, Agendar, Jogar, Finanças, Diretoria, Transferências, Tática, Pulse

---

### Elenco

- Lista por posição: número, idade, OVR, jogos, gols, assistências, status
- **Editar**: número, idade, OVR, status, salário, valor de mercado
- Status: Titular · Reserva · Promessa · Transferível · Emprestado
- Mostra salário e valor de mercado (mesma moeda do Financeiro)

---

### Tática

- Escolha formação (4-3-3, 4-4-2, etc.)
- Arraste / toque para escalar titulares e banco
- Tokens usam as cores do clube (ver tabela acima)
- Escalações salvas ficam no save

---

### Partidas

**Agendar** (Registro / Calendário)

- Data, adversário, competição, local (casa / fora / neutro)

**Jogar** (fluxo pós-partida no FIFA)

1. Pulse (eventos aleatórios entre jogos — opcional conforme settings)
2. Escalação (usa tática salva ou monta na hora)
3. Placar
4. Gols / assistências / cartões / adversário
5. Substituições e lesões
6. **Notas** — lista compacta com slider, +/−, Destaque ★ e Pior ↓
7. Resumo **cronológico** — eventos de cada time no lado do campo

Resultados atualizam estatísticas do elenco e **confiança da diretoria** (+ vitória / − derrota).

---

### Competições

Lista das competições da temporada (as que você escolheu no setup). Usadas em partidas e na tabela de premiações.

---

### Pulse

Narrativa dinâmica entre jogos: humor, fadiga, disponibilidade, manchetes.

- Rode o Pulse ligado a uma partida
- Ajuste intensidade / preferências na página Pulse
- Eventos podem afetar atletas; patches de caixa/confiança entram quando ligados ao sistema

---

### Financeiro (`/financas`)

| Aba | O que faz |
|-----|-----------|
| **Visão geral** | Caixa, folha/mês, runway (meses cobertos), receita/despesa da temporada, últimos lançamentos · **escolhe a moeda** |
| **Extrato** | Histórico filtrável (receitas, despesas, transferências, folha) |
| **Folha salarial** | Salário de cada um + edição rápida · **Pagar folha** debita o mês no extrato |
| **Premiações** | Valores por competição (vitória, empate, eliminatória, campeão) |

**Moedas:** Real (R$), Euro (€), Libra (£), Dólar (US$).

**Lançamento manual:** patrocínio, multa, ajuste, etc. — tudo vira linha no extrato. O caixa e o extrato sempre fecham juntos.

---

### Diretoria (`/diretoria`)

| Aba | O que faz |
|-----|-----------|
| **Confiança** | Medidor 0–100 · status Estável / Vigilante / Crise · histórico de variações |
| **Metas** | Objetivos da temporada (posição, limite de gasto, vendas, folha, título) |
| **Identidade** | Nome, cores, torcedores, descrição, **editar caixa/orçamento** (diferença = ajuste no extrato) · **Criar backup (ZIP)** do save |

Confiança reage a resultados de partida e à saúde financeira (conforme as regras ligadas no save).

---

### Transferências (`/transferencias`)

| Aba | O que faz |
|-----|-----------|
| **Observação** | Watchlist: jogadores no radar (clube, OVR, valor, notas) · **Contratar** puxa para Operar |
| **Operar** | Compra · venda · empréstimo (entra/sai) · livre · define taxa, salário, valor |
| **Histórico** | Movimentos da temporada |

Regras rápidas:

- **Compra** cria jogador no elenco e debita a taxa
- **Venda** remove e credita (não exige saldo — você está recebendo)
- **Empréstimo (sai)** marca `Emprestado`
- Toda taxa vira lançamento no Financeiro

---

## Modo Jogador

Carreira focada em **você** como atleta:

- Dashboard pessoal, partidas, calendário, competições
- Perfil, contrato, evolução, histórico de clubes
- Registro de desempenho (minutos, gols, notas) e moral / confiança do técnico / fama

Finanças/diretoria/mercado do clube são do modo treinador.

---

## Save e conta Google

- Save na **nuvem** (Firestore), ligado à conta Google
- Espelho local no navegador para velocidade
- No 1º login, se existir save local e a nuvem estiver vazia, o local sobe sozinho
- **Backup ZIP** na Diretoria → Identidade (arquivo `save.json` + README)
- **Sair da conta** no menu limpa a sessão local

---

## Dicas rápidas

1. Defina **moeda** e **premiações** cedo no Financeiro.
2. Use o **Dashboard** como hub — quase tudo tem clique direto.
3. Prefere elenco grande? Monte um **JSON** com o modelo e importe.
4. Faça **backup ZIP** antes de experimentos ou troca de dispositivo.
5. Clubes amarelos: o goleiro **não** fica amarelo (evita confusão visual).

---

## Atalhos de rota (treinador)

| Rota | Seção |
|------|--------|
| `/dashboard` | Painel |
| `/squad` | Elenco |
| `/tactics` | Tática |
| `/matches` | Registro de partida |
| `/calendar` | Calendário |
| `/competitions` | Competições |
| `/pulse` | Pulse |
| `/financas` | Financeiro |
| `/diretoria` | Diretoria |
| `/transferencias` | Transferências |

---

## Em construção (menu “soon”)

Treinamento, sala de troféus, redes sociais, manchetes, coletivas, área pessoal do manager, conquistas — marcados no menu como *soon*.
