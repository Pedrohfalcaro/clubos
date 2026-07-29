export interface TutorialStep {
  section: string;
  title: string;
  body: string;
}

export const WELCOME_TUTORIAL: TutorialStep[] = [
  {
    section: 'ClubOS',
    title: 'Bem-vindo ao ClubOS!',
    body: 'Gerencie seu clube de futebol: escalação, táticas, partidas e estatísticas da temporada.',
  },
  {
    section: 'Começar',
    title: 'Nova carreira',
    body: 'Escolha país, clube e manager para iniciar. Sua progressão fica salva automaticamente no navegador.',
  },
  {
    section: 'Carregar',
    title: 'Continuar',
    body: 'Use Carregar para retomar a última carreira salva. Cada seção do menu tem um guia na primeira visita.',
  },
];

export const SECTION_TUTORIALS: Record<string, TutorialStep[]> = {
  '/dashboard': [
    {
      section: 'Dashboard',
      title: 'Painel do clube',
      body: 'Acompanhe a próxima partida, indicadores da temporada, artilheiros, assistências e resultados recentes.',
    },
  ],
  '/squad': [
    {
      section: 'Elenco',
      title: 'Gestão do elenco',
      body: 'Veja todos os jogadores, posições, overall e status. Edite número, idade e defina titulares ou reservas.',
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
      body: 'Confira os campeonatos e torneios em que seu clube disputa na temporada atual.',
    },
  ],
  '/financas': [
    {
      section: 'Financeiro',
      title: 'Controle financeiro',
      body: 'Acompanhe o caixa, registre receitas e despesas, veja a folha salarial e configure premiações por competição.',
    },
    {
      section: 'Folha',
      title: 'Folha salarial',
      body: 'Na aba Folha salarial você vê o custo mensal de cada jogador. Use "Pagar folha" para registrar o débito no extrato.',
    },
    {
      section: 'Premiações',
      title: 'Premiações',
      body: 'Configure valores de premiação por competição (vitória, empate, fase eliminatória, campeonato) e registre quando conquistar cada resultado.',
    },
  ],
  '/diretoria': [
    {
      section: 'Diretoria',
      title: 'Relacionamento com a diretoria',
      body: 'Acompanhe a confiança da diretoria, que reage a resultados, saúde financeira e cumprimento de metas.',
    },
    {
      section: 'Metas',
      title: 'Metas da temporada',
      body: 'Defina objetivos que a diretoria espera — posição no campeonato, limite de gastos, vendas de jogadores. Metas cumpridas aumentam a confiança.',
    },
    {
      section: 'Identidade',
      title: 'Editar o clube',
      body: 'Altere nome, cores e descrição do clube a qualquer momento em Identidade do clube.',
    },
  ],
  '/transferencias': [
    {
      section: 'Transferências',
      title: 'Mercado de transferências',
      body: 'Gerencie contratações, vendas e empréstimos. Todas as operações atualizam o caixa automaticamente.',
    },
    {
      section: 'Observação',
      title: 'Lista de observação',
      body: 'Guarde jogadores que você está monitorando com clube, valor e notas. Converta em contratação quando a hora chegar.',
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
