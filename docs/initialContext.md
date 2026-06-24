# ClubOS - Initial Context

## Visão do Projeto

ClubOS é uma plataforma complementar para modos carreira de jogos de futebol como EA FC (FIFA), Football Manager e eFootball.

O objetivo não é substituir o jogo, mas expandir a imersão da carreira através de sistemas de gestão e narrativa.

O jogador continua disputando as partidas dentro do jogo principal. O ClubOS é responsável pelas consequências e gerenciamento do clube.

---

# Conceito Principal

O jogo gera o resultado da partida.

O ClubOS gera as consequências.

Exemplos:

* Controle financeiro
* Gestão do elenco
* Estatísticas de temporada
* Diretoria
* Moral dos jogadores
* Eventos aleatórios
* Transferências
* Notícias automáticas
* Histórico da carreira

---

# MVP (Versão Inicial)

A primeira versão deve permitir:

1. Selecionar um clube
2. Visualizar elenco
3. Registrar partidas
4. Atualizar estatísticas dos jogadores
5. Atualizar classificação
6. Registrar artilharia
7. Salvar progresso em LocalStorage

---

# Estrutura de Dados

## Team

```ts
interface Team {
  id: string;
  name: string;
  nickname: string;

  budget: number;

  boardConfidence: number;
  supporterConfidence: number;

  statistics: {
    matches: number;
    wins: number;
    draws: number;
    losses: number;

    goalsFor: number;
    goalsAgainst: number;

    points: number;
  };
}
```

## Player

```ts
interface Player {
  id: string;

  teamId: string;

  name: string;

  position: string;

  number: number | null;

  age: number;

  overall: number;

  potential: number;

  morale: number;

  salary: number;

  marketValue: number;

  status:
    | "Titular"
    | "Reserva"
    | "Promessa"
    | "Transferível";

  stats: {
    matches: number;
    goals: number;
    assists: number;

    yellowCards: number;
    redCards: number;
  };
}
```

---

# Estrutura de Arquivos

```text
src/
│
├── data/
│   ├── teams.json
│   ├── players.json
│   ├── competitions.json
│   ├── events.json
│   └── save.json
│
├── types/
│   ├── Team.ts
│   ├── Player.ts
│   └── Competition.ts
│
├── pages/
│   ├── Dashboard/
│   ├── Squad/
│   ├── Matches/
│   ├── Competitions/
│   ├── Finances/
│   └── Settings/
│
├── components/
│
├── services/
│
└── hooks/
```

---

# Clubes Iniciais

## Corinthians

Orçamento Inicial: 100.000.000

### Goleiros

* Hugo Souza (#1) - 27 anos
* Felipe Longo (#40) - 21 anos
* Kauê - 22 anos

### Zagueiros

* André Ramalho (#5) - 34 anos
* Gabriel Paulista (#4) - 35 anos
* Gustavo Henrique (#13) - 33 anos
* João Pedro - 22 anos

### Laterais Direitos

* Matheuzinho (#2) - 25 anos
* Pedro Milans - 24 anos

### Laterais Esquerdos

* Hugo (#46) - 28 anos
* Matheus Bidu - 27 anos
* Fabrizio Angileri - 32 anos

### Meio-campistas

* Rodrigo Garro (#16) - 28 anos
* Breno Bidon (#27) - 21 anos
* Raniele (#14) - 29 anos
* Alex Santana - 31 anos
* André Carrillo - 35 anos
* Charles - 30 anos
* Allan - 29 anos

### Atacantes

* Memphis Depay (#7) - 32 anos
* Yuri Alberto (#9) - 25 anos
* Pedro Raul (#20) - 29 anos
* Kaio César - 22 anos
* Kayke (#31) - 21 anos

---

## São Paulo

Orçamento Inicial: 100.000.000

### Goleiros

* Rafael (#23) - 36 anos
* Jandrei (#93) - 33 anos

### Zagueiros

* Arboleda (#5) - 34 anos
* Alan Franco (#28) - 29 anos
* Rafael Toloi (#2) - 35 anos
* Matheus Dória (#4) - 31 anos
* Sabino (#35) - 29 anos

### Laterais Direitos

* Igor Vinícius (#2) - 29 anos
* Lucas Ramon (#19) - 32 anos

### Laterais Esquerdos

* Welington (#6) - 25 anos
* Wendell (#18) - 32 anos
* Érick Díaz (#13) - 23 anos

### Meio-campistas

* Luiz Gustavo (#17) - 38 anos
* Marcos Antônio (#8) - 26 anos
* Damian Bobadilla (#16) - 25 anos
* Pablo Maia (#29) - 24 anos
* Alisson (#25) - 32 anos

### Atacantes

* Lucas Moura (#7) - 33 anos
* Jonathan Calleri (#9) - 32 anos
* Ferreira (#11) - 28 anos
* Tetê (#34) - 26 anos
* Luciano (#10) - 33 anos

---

## Santos

Orçamento Inicial: 80.000.000

### Goleiros

* João Paulo (#1) - 30 anos
* Gabriel Brazão (#77) - 25 anos
* Diógenes - 25 anos

### Defensores

* Gil (#4) - 39 anos
* Luan Peres (#14) - 31 anos
* Zé Ivaldo - 29 anos
* Alexis Duarte - 26 anos
* JP Chermont (#31) - 20 anos
* Hayner (#32) - 30 anos
* Gonzalo Escobar (#33) - 29 anos
* João Victor - 21 anos

### Meio-campistas

* João Schmidt (#5) - 33 anos
* Zé Rafael (#6) - 33 anos
* Willian Arão (#15) - 34 anos
* Thaciano (#16) - 31 anos
* Gabriel Menino (#25) - 25 anos
* Álvaro Barreal (#22) - 25 anos
* Tomás Rincón (#8) - 38 anos
* Miguelito (#30) - 22 anos

### Atacantes

* Neymar (#10) - 34 anos
* Gabigol (#9) - 29 anos
* Rony (#11) - 31 anos
* Benjamín Rollheiser (#32) - 26 anos
* Pedrinho (#27) - 26 anos

---

## XV de Piracicaba

Orçamento Inicial: 15.000.000

### Goleiros

* Victor Golas - 35 anos
* André Luiz - 31 anos
* Filipe Costa - 30 anos
* Gabriel Coutinho - 29 anos

### Defensores

* Andrés Robles - 32 anos
* Almir Luan - 24 anos
* Kawan - 23 anos
* Lucas Ramires - 24 anos
* Luiz Gustavo - 21 anos
* Júnior Caiçara - 37 anos
* Thales Oleques - 32 anos
* Arlen - 30 anos
* Rennan Siqueira - 31 anos
* João Victor - 27 anos
* Gustavo Kuhn - 22 anos

### Meio-campistas

* Carlos Manuel - 25 anos
* Djavan - 30 anos
* Richard Almeyda - 37 anos
* Gustavo Hebling - 30 anos
* Dudu Vieira - 32 anos
* Mossoró - 30 anos
* Gabriel Chagas - 25 anos
* Serginho - 22 anos

### Atacantes

* Léo Santos - 30 anos
* David Ribeiro - 28 anos
* Robson Duarte - 32 anos
* Erik Bessa - 30 anos
* Paulo Marcelo - 30 anos
* Henry - 27 anos
* Antônio Gabriel - 24 anos

---

# Próximas Versões

## V0.2

* Finanças
* Transferências
* Salários
* Valor de Mercado

## V0.3

* Diretoria
* Moral
* Categoria de Base

## V0.4

* Eventos Aleatórios

## V0.5

* Notícias Automáticas

## V1.0

* IA para geração de notícias
* IA para entrevistas
* IA para coletivas
* IA para narrativas de temporada

```
```
