# Guia de uso — ClubOS

Companion do Modo Carreira (EA FC / FIFA): você joga a partida no console/PC e registra tudo aqui. O ClubOS cuida das consequências — elenco, caixa, diretoria, transferências e narrativa (Pulse + LiveLife).

**LiveLife (v1.2)** — calendário contínuo, bilheteria, lesões no tempo do jogo, ClubOSocial e coletivas: [livelife-v1.2.md](./livelife-v1.2.md).

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
- Depois: manager + **competições** (data de início LiveLife, premiações, moeda)

**Cores no campo**

| Situação | Cor dos tokens (linha) |
|----------|-------------------------|
| Casa / neutro | Primária |
| Fora | Secundária |
| Goleiro | Amarelo clássico — **exceto** se primária/secundária forem amarelas (aí troca automaticamente) |

---

### Dashboard

Painel do clube + hub do **LiveLife**:

- Badge da **data do jogo** e CTA principal **Avançar Dia**
- Em dia de partida: fluxo para Pulse/jogo; atalho **Jogar** e coletiva pré-jogo
- No **dia 5**: modal de **folha salarial**
- Em dias sem jogo: chance de **Pulse diário** (modal)
- **Caixa** (clique) → Finanças · confiança → Diretoria
- Cards **Financeiro · Diretoria · Transferências**, próxima partida, V/E/D, artilharia, etc.

---

### Elenco

- Lista por posição: número, idade, OVR, jogos, gols, assistências, status
- **Editar**: número, idade, OVR, status, salário, valor de mercado, **personalidade**, **moral**
- Disponibilidade: lesão (dias restantes) e suspensão (partidas + competição) editáveis
- Status: Titular · Reserva · Promessa · Transferível · Emprestado
- Mostra salário e valor de mercado (mesma moeda do Financeiro)

---

### Tática

- **15 formações** agrupadas por linha defensiva:
  - 4 defensores: 4-4-2, 4-4-2 Losango, 4-4-1-1, 4-3-3, 4-2-3-1, 4-1-4-1, 4-2-2-2, 4-3-1-2, 4-5-1, 4-2-4
  - 3 defensores: 3-5-2, 3-4-3, 3-4-2-1
  - 5 defensores: 5-3-2, 5-4-1
- **10 estilos de jogo**: Padrão, Ofensivo, Ultra-ofensivo, Defensivo, Retranca, Contra-ataque, Posse de bola, Jogo direto, Pressão alta, Jogo aberto
  - Cada estilo mostra mentalidade, ritmo, amplitude, pressão e linha defensiva
  - Estilos que combinam com a formação escolhida recebem o selo **combina**
- Arraste / toque para escalar titulares e banco. Arrastar um titular sobre outro **troca os dois de lugar**
- **Trocar de formação mantém os mesmos jogadores**, reposicionados por função
- **Escalação automática** monta o melhor XI por posição e overall, com goleiro reserva no banco
- Avisos de lesionados escalados, jogadores fora de posição e banco sem goleiro
- Tokens usam as cores do clube (ver tabela acima)
- A tática salva guarda formação, estilo, titulares e banco no save, com data da última alteração

---

### Partidas

**Agendar** (Registro / Calendário)

- Data, adversário, competição, local (casa / fora / neutro)

**Jogar** (fluxo pós-partida no FIFA)

1. Pulse (eventos aleatórios — pré-partida ou diário)
2. Escalação (usa tática salva ou monta na hora; lesionados/suspensos bloqueados)
3. Placar
4. Gols / assistências / cartões / adversário
5. Substituições e lesões (com **data de retorno** opcional)
6. **Notas** — lista compacta com slider, +/−, Destaque ★ e Pior ↓
7. Resumo **cronológico** — eventos de cada time no lado do campo

Ao finalizar: estatísticas, confiança, **bilheteria/premiação** no extrato, manchete no ClubOSocial e (se fizer) coletiva pós-jogo. Vermelho → suspenso na **mesma competição**.

---

### Competições (`/competitions`)

Cada competição da temporada tem **sua seção**: dados editáveis (nome, cor, tipo, formato), premiação da Finance e o fluxo do torneio.

| Formato | Comportamento |
|--------|----------------|
| **Pontos corridos** | Tabela que cresce com os adversários dos jogos; editável; dá para adicionar times |
| **Mata-mata** | Fase a fase (nome editável): adversário + placar → avançar cria a próxima fase e credita premiação de eliminatória |
| **Liga / grupos + mata-mata** | Tabela primeiro; depois **Iniciar mata-mata** e segue o eliminatório |

Na última fase, marque **“Esta é a final”** para a premiação de campeão. Usadas também em partidas, suspensões por competição e artilharia/assistências do torneio.

No setup: **Campeonato Nacional** e **Copa Nacional** pré-marcados; opcionais Estadual / Continental; cada uma com **formato** + campos de premiação.

---

### Pulse

Narrativa dinâmica: humor, fadiga, disponibilidade, manchetes.

- Pré-partida no fluxo do jogo
- **Diário** ao Avançar Dia (chance em Pulse → Configurações)
- Eventos podem afetar atletas, caixa e confiança

---

### Financeiro (`/financas`)

| Aba | O que faz |
|-----|-----------|
| **Visão geral** | Caixa, folha/mês, runway, receita/despesa, últimos lançamentos · **moeda** |
| **Extrato** | Histórico filtrável (inclui bilheteria, viagem, operação de estádio) |
| **Folha salarial** | Salário de cada um · **Pagar folha** (dia 5 no Dashboard). **Adiar** baixa a moral do elenco; pagar sem caixa vira **dívida** (caixa zera) |
| **Empréstimos** | Crédito bancário (entra no caixa) + parcelas no calendário |
| **Dívidas** | Passivo do clube; parcela obrigatória no dia escolhido (calendário); ignorar gera ~2,5% de juros |
| **Patrocínios** | Master / Manga: cota no dia escolhido (calendário), bônus, rescisão, renovação |
| **Premiações** | Valores por competição (vitória, empate, eliminatória, campeão) — aplicadas ao finalizar jogo |
| **Estádio** | Capacidade, preços casa/fora, manutenção e viagem (bilheteria automática) |

**Moedas:** Real (R$), Euro (€), Libra (£), Dólar (US$). Templates realistas por moeda quando estádio/premiações estão vazios.

**Lançamento manual:** patrocínio, multa, ajuste, etc. — tudo vira linha no extrato.

---

### Diretoria (`/diretoria`)

| Aba | O que faz |
|-----|-----------|
| **Confiança** | Medidor 0–100 · status Estável / Vigilante / Crise · histórico |
| **Metas** | Objetivos da temporada |
| **Identidade** | Nome, cores, torcedores, **data base** LiveLife, caixa/orçamento · **backup ZIP** |
| **LiveLife** | Tutorial & checklist, changelog v1.0–v1.2 (inclui Competições), concluir onboarding |

Confiança reage a resultados, clima do save e saúde financeira.

---

### Transferências (`/transferencias`)

| Aba | O que faz |
|-----|-----------|
| **Observação** | Watchlist: jogadores no radar |
| **Negociar** | Compra · venda · empréstimo · livre (só com mercado aberto) |
| **Renovar** | Contrato do elenco o ano inteiro (fora da janela também) |
| **Histórico** | Movimentos da temporada |

Janelas oficiais: **01/01–31/01** e **01/07–31/08** (aparecem no Calendário).

Regras rápidas:

- **Compra** cria jogador no elenco e debita a taxa
- **Venda** remove e credita (não exige saldo — você está recebendo)
- **Empréstimo (sai)** marca `Emprestado`
- Fora da janela: só **Renovar**
- Toda taxa vira lançamento no Financeiro; movimentos relevantes geram manchete no ClubOSocial

---

### ClubOSocial (`/social`)

Feed do clube: manchetes automáticas (jogos, transferências, coletivas) e posts do técnico.

**Story Arcs** — em dias sem jogo, o Avançar Dia pode iniciar um arco narrativo (vestiário, imprensa, lesão, diretoria). Cada capítulo vira manchete encadeada; alguns pedem coletiva. Acompanhe no banner do feed ou no filtro **Arcos**.

---

### Coletivas (`/press-conference`)

Entrevistas que alteram torcida, elenco, diretoria e **mídia**, com manchete no ClubOSocial.

| Contexto | Quando aparece no Dashboard |
|----------|----------------------------|
| **Pré / pós-jogo** | Dia de partida / após finalizar |
| **Convocação** | Partida importante nos próximos 3 dias |
| **Lesão** | Atleta com ≥14 dias de lesão |
| **Crise financeira** | Caixa crítico (1× por mês) |

Respostas agressivas sobem o **atrito com a imprensa** — ganhos de mídia ficam bem mais difíceis de recuperar.

---

### Manager e Sala de Troféus

- **Pessoal** (`/manager`): bio, notas táticas, contatos
- **Sala de Troféus** (`/trofeus`): títulos e classificações; 1º lugar ao avançar temporada vira conquista

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

1. Use **Avançar Dia** no Dashboard — é o motor do LiveLife.
2. Confira **estádio**, **premiações** e **salários** (Diretoria → LiveLife tem o checklist).
3. Prefere elenco grande? Monte um **JSON** com o modelo e importe.
4. Faça **backup ZIP** antes de experimentos ou troca de dispositivo.
5. Clubes amarelos: o goleiro **não** fica amarelo (evita confusão visual).

---

## Atalhos de rota (treinador)

| Rota | Seção |
|------|--------|
| `/dashboard` | Painel / Avançar Dia |
| `/squad` | Elenco |
| `/tactics` | Tática |
| `/matches` | Registro de partida |
| `/calendar` | Calendário |
| `/competitions` | Competições |
| `/pulse` | Pulse |
| `/financas` | Financeiro |
| `/diretoria` | Diretoria |
| `/transferencias` | Transferências |
| `/social` | ClubOSocial |
| `/press-conference` | Coletivas |
| `/manager` | Manager (pessoal) |
| `/trofeus` | Sala de Troféus |

---

## Em construção (menu “soon”)

Ainda marcados como *soon*: **Treinamento**, perfil social detalhado de **Jogadores**, **Metas** no menu Manager (as metas da Diretoria já existem).
