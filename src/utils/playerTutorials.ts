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
