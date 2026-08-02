export interface TutorialStep {
  section: string;
  title: string;
  body: string;
}

export const WELCOME_TUTORIAL: TutorialStep[] = [
  {
    section: 'ClubOS',
    title: 'Bem-vindo ao ClubOS!',
    body: 'Gerencie seu clube: elenco, táticas, partidas, finanças e a narrativa LiveLife — um dia de cada vez.',
  },
  {
    section: 'LiveLife',
    title: 'Avançar Dia',
    body: 'No Dashboard, o botão principal avança o calendário do jogo. No dia de partida você joga; no dia 5 paga a folha; em dias normais pode surgir um Pulse.',
  },
  {
    section: 'Começar',
    title: 'Nova carreira',
    body: 'Escolha clube, manager, data de início e competições. Premiações e estádio já vêm com templates — ajuste quando quiser.',
  },
];

export const SECTION_TUTORIALS: Record<string, TutorialStep[]> = {
  '/dashboard': [
    {
      section: 'Dashboard',
      title: 'Painel do clube',
      body: 'Acompanhe a data do jogo, próxima partida, indicadores e atalhos. O CTA principal é Avançar Dia.',
    },
    {
      section: 'LiveLife',
      title: 'Dia a dia',
      body: 'Em dia de jogo: Pulse e coletiva pré. No dia 5: modal de folha. Sem partida: chance de evento Pulse diário.',
    },
  ],
  '/squad': [
    {
      section: 'Elenco',
      title: 'Gestão do elenco',
      body: 'Veja jogadores, overall e status. Edite número, idade, salário, personalidade, moral e dias de lesão ou suspensão.',
    },
    {
      section: 'Disponibilidade',
      title: 'Lesões e suspensões',
      body: 'Lesionados e suspensos não entram na súmula. A cada Avançar Dia a lesão perde 1 dia; vermelho suspende só naquela competição.',
    },
  ],
  '/tactics': [
    {
      section: 'Tática',
      title: 'Montagem tática',
      body: 'Escolha entre 15 formações, defina o estilo de jogo e arraste ou toque nos jogadores para preencher as posições e o banco.',
    },
    {
      section: 'Atalhos',
      title: 'Escalação rápida',
      body: 'Use "Escalação automática" para montar o melhor time por posição e overall. Trocar de formação mantém os mesmos jogadores, reposicionados por função.',
    },
  ],
  '/matches': [
    {
      section: 'Registro',
      title: 'Registrar partidas',
      body: 'Agende jogos e, quando finalizados, registre escalação, gols, cartões, notas e comentários da partida.',
    },
  ],
  '/calendar': [
    {
      section: 'Calendário',
      title: 'Calendário mensal',
      body: 'Visualize partidas por dia. Toque em um dia para agendar um novo jogo naquela data.',
    },
  ],
  '/competitions': [
    {
      section: 'Competições',
      title: 'Suas competições',
      body: 'Cada torneio tem sua seção. Em pontos corridos a tabela cresce com os jogos; em copas avance fase a fase e receba a premiação no caixa.',
    },
  ],
  '/pulse': [
    {
      section: 'Pulse',
      title: 'Eventos imprevisíveis',
      body: 'O Pulse roda antes dos jogos e, com chance configurável, em dias normais ao Avançar Dia.',
    },
    {
      section: 'Configurações',
      title: 'Chance diária',
      body: 'Em Configurações, ajuste a chance de evento em dias sem jogo (0–50%).',
    },
  ],
  '/financas': [
    {
      section: 'Financeiro',
      title: 'Controle financeiro',
      body: 'Caixa, extrato, folha e premiações. Ao finalizar partidas, bilheteria e prêmios entram sozinhos no extrato.',
    },
    {
      section: 'Estádio',
      title: 'Parâmetros do estádio',
      body: 'Na aba Estádio configure capacidade, preços e custos. Sem isso configurado, a bilheteria automática não roda.',
    },
    {
      section: 'Folha',
      title: 'Folha salarial',
      body: 'No dia 5 do mês do jogo o Dashboard pede o pagamento. Você também pode pagar pela aba Folha a qualquer momento.',
    },
  ],
  '/diretoria': [
    {
      section: 'Diretoria',
      title: 'Confiança da diretoria',
      body: 'Sobe com vitórias e cai com derrotas. Quanto menor a confiança, mais eventos ruins no Pulse; quanto maior, mais chance de coisas boas.',
    },
    {
      section: 'LiveLife',
      title: 'Tutorial & checklist',
      body: 'Na aba LiveLife abra o guia, confira salários, premiações e estádio, e veja o changelog das versões.',
    },
    {
      section: 'Identidade',
      title: 'Editar o clube',
      body: 'Altere nome, cores, data base da carreira e faça backup ZIP do save.',
    },
  ],
  '/transferencias': [
    {
      section: 'Transferências',
      title: 'Mercado de transferências',
      body: 'Gerencie contratações, vendas e empréstimos. As operações atualizam o caixa e podem gerar manchete no ClubOSocial.',
    },
    {
      section: 'Observação',
      title: 'Lista de observação',
      body: 'Guarde jogadores que você está monitorando com clube, valor e notas. Converta em contratação quando a hora chegar.',
    },
  ],
  '/social': [
    {
      section: 'ClubOSocial',
      title: 'Feed do clube',
      body: 'Manchetes pós-jogo, transferências e coletivas aparecem aqui. Você também pode publicar como técnico.',
    },
  ],
  '/press-conference': [
    {
      section: 'Coletivas',
      title: 'Imprensa',
      body: 'Responda perguntas pré ou pós-jogo. Suas escolhas mexem em torcida, elenco e diretoria — e viram manchete.',
    },
  ],
  '/manager': [
    {
      section: 'Manager',
      title: 'Área pessoal',
      body: 'Edite biografia, notas táticas e contatos. Acompanhe prêmios individuais e acesse a Sala de Troféus.',
    },
  ],
  '/trofeus': [
    {
      section: 'Troféus',
      title: 'Sala de Troféus',
      body: 'Galeria de títulos e classificações. Ao avançar a temporada, o 1º lugar vira conquista registrada aqui.',
    },
  ],
};

const WELCOME_KEY = 'clubos_welcome_seen';
const SECTIONS_KEY = 'clubos_sections_seen';

export function hasSeenWelcome(): boolean {
  return localStorage.getItem(WELCOME_KEY) === '1';
}

export function markWelcomeSeen(): void {
  localStorage.setItem(WELCOME_KEY, '1');
}

export function hasSeenSection(path: string): boolean {
  try {
    const seen = JSON.parse(localStorage.getItem(SECTIONS_KEY) ?? '[]') as string[];
    return seen.includes(path);
  } catch {
    return false;
  }
}

export function markSectionSeen(path: string): void {
  try {
    const seen = JSON.parse(localStorage.getItem(SECTIONS_KEY) ?? '[]') as string[];
    if (!seen.includes(path)) {
      localStorage.setItem(SECTIONS_KEY, JSON.stringify([...seen, path]));
    }
  } catch {
    localStorage.setItem(SECTIONS_KEY, JSON.stringify([path]));
  }
}
