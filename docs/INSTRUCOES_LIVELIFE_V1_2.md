# 🚀 ClubOS — Prompt & Instruções de Desenvolvimento: Versão 1.2 (LiveLife Update)

> **Status:** especificação histórica — o MVP foi **entregue**.  
> Guia atual: [`livelife-v1.2.md`](./livelife-v1.2.md) · Entrega: [`../LiveLife - Desenvolvimento/ENTREGA_V1_2.md`](../LiveLife%20-%20Desenvolvimento/ENTREGA_V1_2.md)

> **INSTRUÇÃO PARA A IA / CURSOR (arquivo original):**
> Leia atentamente este documento de especificação técnica e estratégica.
> **SUA PRIMEIRA TAREFA:**
> 1. Crie uma pasta chamada `LiveLife - Desenvolvimento` na raiz do repositório/projeto.
> 2. Dentro dessa pasta, crie um arquivo chamado `plano_de_desenvolvimento.md`.
> 3. Escreva nesse arquivo um **Plano de Desenvolvimento Modular e Incremental** (passo a passo em fases) baseado nesta especificação.
> 4. Adicione uma seção especial de **"Brainstorming & Novas Sugestões da IA"** no plano, sugerindo ideias inovadoras, melhorias de UX/UI ou novas mecânicas de gameplay que complementem o *LiveLife Update*.

---

## 📋 ESPECIFICAÇÃO TÉCNICA E FUNCIONAL (v1.2 — LiveLife Update)

### 1. Visão Geral da Atualização
A versão 1.2 **"LiveLife Update"** transforma o ClubOS de um simples gerenciador de partidas manuais em um ecossistema completo de gestão imersiva e contínua. 
A atualização divide-se em dois grandes pilares:
- **Parte LIVE:** Passagem de tempo dia a dia, dinamismo financeiro (bilheteria mandante/visitante, despesas operacionais), lesões com contagem regressiva temporal e cobrança automática de folha salarial.
- **Parte LIFE:** Redes sociais internas (`ClubOSocial`), gerenciamento pessoal do técnico, coletivas de imprensa interativas e aspectos humanos/comportamentais dos atletas.

---

### 2. Módulo LIVE (Dia a Dia & Economia do Clube)

#### 2.1. Sistema LiveLife & Calendário Contínuo
* **Início de Carreira:** Ao criar uma nova carreira, o usuário define a data inicial oficial (ex: `01/01/2026`).
* **Carreiras Existentes:** Em *Diretoria > Editar Time*, haverá um campo de data base. Se estiver vazio, exibe o modal do *LiveLife* solicitando o preenchimento para ativar o modo contínuo.
* **Ação "Avançar Dia":** No Dashboard, o botão principal passa a ser **"Avançar Dia"**.
  * Dias normais: Avança +1 dia na data atual.
  * Dias de jogo: Transiciona o fluxo para a tela de Pré-Jogo/Súmula.
* **Gatilho Diário do Pulse:** A cada avanço diário, há uma probabilidade parametrizada de disparar um evento do motor *Pulse* (em pop-up modal).

#### 2.2. Módulo de Lesões & Status Temporal do Elenco
* **Atribuição de Status:** Lesões geradas pelo *Pulse*, treinos ou jogos atribuem a tag `Lesionado` e o ícone de lesão ao atleta.
* **Contagem Regressiva:** Cada lesão define uma duração em dias (ex: 14 dias). A cada clique em "Avançar Dia", decrementa-se 1 dia da contagem.
* **Bloqueio de Escalação:** Atletas lesionados ou suspensos pelo STJD ficam permanentemente desabilitados para seleção na súmula da partida.

#### 2.3. Modelo Financeiro Evoluído & Bilheteria
A economia passa a rodar em fluxo contínuo e por partida:
* **Premiações de Jogos:** Configuradas por competição (Vitória, Empate, Avanço de fase em copas e Campeão).
* **Constantes de estádio (base do jogo, não editáveis na UI):**
  * Estádio adversário padrão: **40.000** lugares
  * Campo neutro padrão: **60.000** lugares
  * Casa: torcida ocupa até **90%** da capacidade do estádio do clube
  * Visitante: cota de até **10%** do estádio adversário (= **4.000** lugares)
  * Neutro: até **50%** do estádio neutro (= **30.000** lugares)
  * Em todos os casos a **moral da torcida** define a lotação da cota (quanto maior a moral, mais cheio).
* **Jogo em Casa (Mandante):**
  * `Público = min(Capacidade × 0,9, Capacidade × 0,9 × Moral × jitter)`
  * `Receita Bruta = Público * ValorIngressoCasa`
  * `Custo Operacional = CustoManutençãoJogo`
  * *Entrada no caixa: Receita Bruta - Custo Manutenção*
* **Jogo Fora (Visitante):**
  * `Público = min(4.000, 4.000 × Moral × jitter)`
  * `Receita = Público * ValorIngressoVisitante`
  * `Custo de Viagem = GastoMédioViagem`
  * *Entrada no caixa: Receita - Custo Viagem*
* **Campo Neutro:**
  * `Público = min(30.000, 30.000 × Moral × jitter)`
  * `Receita = Público * ValorIngressoCasa`
  * `Custo de Viagem = GastoMédioViagem`
  * *Entrada no caixa: Receita - Custo Viagem*
* **Folha Salarial Mensal:** Pop-up modal no **dia 5 de cada mês** para realizar o débito da soma dos salários de todos os atletas do elenco.

#### 2.4. Ideias de Expansão para o Live Mode
* **Patrocínios Dinâmicos:** Contratos Master/Manga com bônus por metas e cláusulas de rescisão.
* **Nível de Infraestrutura & DM:** Investimento no Centro de Treinamento reduz tempo de recuperação e chance de lesões graves.
* **Empréstimos Bancários:** Opção para cobrir caixa negativo no dia 5 com parcelamento diário/mensal e juros.

---

### 3. Módulo LIFE (Social & Vida de Manager)

#### 3.1. Redes Sociais: ClubOSocial
* **Perfil do Clube:** `@nomedotime_oficial` (com selo verificado).
* **Postagens do Treinador:** Publicação de textos, fotos de treino e seleção de hashtags institucionais.
* **Manchetes Pós-Jogo:** Notícias e reação da imprensa/torcida geradas automaticamente com base no placar e destaques da partida.
* **Página Social dos Jogadores:** Visualização dos atributos comportamentais:
  * Personalidade (ex: *Líder, Polêmico, Perfil Baixo, Vaidoso*).
  * Moral & Satisfação (ações diretas do técnico alteram a relação com o atleta).

#### 3.2. Coletivas de Imprensa Interativas
* Entrevistas pré/pós-jogo afetando 3 eixos:
  1. **Moral da Torcida:** Aumenta apoio e público no estádio.
  2. **Moral do Elenco:** Defender jogadores gera lealdade; críticas públicas reduzem a confiança.
  3. **Pressão da Diretoria:** Transferir culpas reduz a estabilidade no cargo.

#### 3.3. Manager Pessoal & Sala de Troféus
* **Vida Pessoal:** Biografia, anotações táticas, contatos de empresários e agenda.
* **Sala de Troféus:** Galeria visual com títulos conquistados, prêmios individuais de técnico e marcos históricos.

---

### 4. Central de Onboarding & Documentação

#### 4.1. Tutorial & Checklist na Diretoria
Botão fixo em Diretoria: `[ Tutorial & Guia LiveLife ]`, contendo o checklist obrigatorio:
1. **Verificação de Salários:** Confirmar os salários individuais de todo o elenco.
2. **Premiação de Competiações:** Preencher valores de vitórias, empates e títulos.
3. **Parâmetros do Estádio:** Capacidade, preço dos ingressos (mandante/visitante) e custos de jogo.

#### 4.2. Histórico de Versões (Changelog na Diretoria)
Navegação interna com o resumo dos updates:
* **v1.0 (Lançamento Base):** Elenco, escalação, criação de time e registro manual de partidas.
* **v1.1 (Pulse Update):** Eventos imprevisíveis, dilemas morais e cobranças da diretoria.
* **v1.2 (LiveLife Update):** Calendário contínuo, avanço diário, bilheteria mandante/visitante, lesões temporais, folha no dia 5, ClubOSocial, Coletivas e Sala de Troféus.

---

## 🎯 INSTRUÇÕES FINAIS PARA O CURSOR / IA

Ao criar o arquivo `LiveLife - Desenvolvimento/plano_de_desenvolvimento.md`, estruture-o em **Sprints / Fases lógicas de desenvolvimento** (ex: *Fase 1: Estrutura de Datas & Calendário*, *Fase 2: Motor Financeiro & Bilheteria*, *Fase 3: Módulo Social & Coletivas*, etc.).

Não se limite apenas a repetir os pontos acima. **Pense criticamente como um Lead Developer & Game Designer**:
- Identifique possíveis gargalos de código/estado no projeto atual.
- Proponha melhorias de arquitetura.
- Sugira 3 a 5 ideias inéditas que deixariam o *LiveLife* ainda mais espetacular!
