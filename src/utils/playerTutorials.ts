import type { TutorialStep } from './tutorials';

export const PLAYER_WELCOME_TUTORIAL: TutorialStep[] = [
  {
    section: 'ClubOS',
    title: 'Bem-vindo, jogador!',
    body: 'Registre seu desempenho, acompanhe evolução, contrato e histórico da sua carreira no EA FC.',
  },
  {
    section: 'Carreira',
    title: 'Seu atleta',
    body: 'Sem base de clubes — você informa manualmente seu clube, stats e resultados após cada partida.',
  },
  {
    section: 'Partidas',
    title: 'Registrar jogos',
    body: 'Agende partidas e registre minutos, gols, assistências e nota. O ClubOS atualiza suas estatísticas.',
  },
];

export const PLAYER_WHATS_NEW_V16: TutorialStep[] = [
  {
    section: 'Locker Room Update',
    title: 'O que há de novo',
    body: 'Sua carreira ganhou um time de verdade ao redor: metas mensais, colegas de elenco e um jeito novo de jogar as partidas.',
  },
  {
    section: 'Time',
    title: 'Metas e Elenco',
    body: 'Nova aba "Time": defina uma meta por mês (gols, assistências ou jogos sem sofrer gol, de acordo com sua posição) e monte seu elenco de colegas — cada um com uma moral própria em relação a você.',
  },
  {
    section: 'Competições',
    title: 'Editar e remover',
    body: 'Agora dá pra editar o nome de uma competição ou remover, sem perder o histórico de partidas já jogadas nela.',
  },
  {
    section: 'Partidas',
    title: 'Novo motor de jogo',
    body: 'Sem escalação — a primeira tela é você: titular, reserva ou não relacionado. Gols e cartões agora têm autor de verdade entre você e seus colegas.',
  },
];

export const PLAYER_SECTION_TUTORIALS: Record<string, TutorialStep[]> = {
  '/player/dashboard': [
    {
      section: 'Dashboard',
      title: 'Painel do jogador',
      body: 'Veja overall, próxima partida, stats da temporada, confiança do técnico e contrato.',
    },
  ],
  '/player/matches': [
    {
      section: 'Registro',
      title: 'Suas partidas',
      body: 'Agende jogos e registre seu desempenho individual após disputar no EA FC.',
    },
  ],
  '/player/calendar': [
    {
      section: 'Calendário',
      title: 'Calendário mensal',
      body: 'Visualize partidas por dia. Toque em um dia para agendar um novo jogo.',
    },
  ],
  '/player/competitions': [
    {
      section: 'Competições',
      title: 'Suas competições',
      body: 'Acompanhe sua contribuição em cada competição da temporada.',
    },
  ],
  '/player/profile': [
    {
      section: 'Perfil',
      title: 'Dados do jogador',
      body: 'Veja e edite overall, potencial e estatísticas acumuladas da carreira.',
    },
  ],
  '/player/contract': [
    {
      section: 'Contrato',
      title: 'Seu contrato',
      body: 'Salário, anos restantes e transferências. Registre mudanças de clube manualmente.',
    },
  ],
  '/player/history': [
    {
      section: 'Histórico',
      title: 'Linha do tempo da carreira',
      body: 'Veja todos os clubes por onde passou, temporadas e os melhores momentos (notas altas, hat-tricks).',
    },
  ],
  '/player/trophies': [
    {
      section: 'Conquistas',
      title: 'Sala de troféus',
      body: 'Marcos de carreira desbloqueiam sozinhos (jogos, gols, assistências). Registre títulos e prêmios manualmente.',
    },
  ],
  '/player/social': [
    {
      section: 'Manchetes e redes',
      title: 'Sua vida pública',
      body: 'Manchetes automáticas pelo seu desempenho (gols, notas, hat-tricks) e posts seus para a torcida.',
    },
  ],
  '/player/press': [
    {
      section: 'Coletivas',
      title: 'Fale com a imprensa',
      body: 'Responda perguntas antes e depois das partidas. Suas respostas mexem na confiança do técnico, na torcida e na sua moral.',
    },
  ],
  '/player/team/goals': [
    {
      section: 'Metas',
      title: 'Metas mensais',
      body: 'No início do mês, defina uma meta de acordo com sua posição: gols pra atacante, assistências pra meia, jogos sem sofrer gol pra defensor/goleiro. Progresso conta sozinho a cada partida.',
    },
  ],
  '/player/team/squad': [
    {
      section: 'Elenco',
      title: 'Colegas de time',
      body: 'Cada colega tem uma moral em relação a você — sobe com seus gols e principalmente com assistências pra ele, cai com notas ruins. Colegas da mesma posição reagem como rivais.',
    },
  ],
  '/player/relations': [
    {
      section: 'Relacionamentos',
      title: 'Transparência total',
      body: 'Confiança do técnico, torcida e moral — com o motivo de cada ajuste, não só a barra.',
    },
  ],
};

const WELCOME_KEY = 'clubos_player_welcome_seen';
const SECTIONS_KEY = 'clubos_player_sections_seen';

export function hasSeenPlayerWelcome(): boolean {
  return localStorage.getItem(WELCOME_KEY) === '1';
}

export function markPlayerWelcomeSeen(): void {
  localStorage.setItem(WELCOME_KEY, '1');
}

export function hasSeenPlayerSection(path: string): boolean {
  try {
    const seen = JSON.parse(localStorage.getItem(SECTIONS_KEY) ?? '[]') as string[];
    return seen.includes(path);
  } catch {
    return false;
  }
}

export function markPlayerSectionSeen(path: string): void {
  try {
    const seen = JSON.parse(localStorage.getItem(SECTIONS_KEY) ?? '[]') as string[];
    if (!seen.includes(path)) {
      seen.push(path);
      localStorage.setItem(SECTIONS_KEY, JSON.stringify(seen));
    }
  } catch {
    localStorage.setItem(SECTIONS_KEY, JSON.stringify([path]));
  }
}
