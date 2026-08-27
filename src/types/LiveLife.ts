/** Metadados LiveLife persistidos no save. */
export interface LiveLifeMeta {
  onboardingComplete: boolean;
  /** Datas de jogo (ISO) em que a coletiva pré já foi feita. */
  pressPreDoneDates?: string[];
  /** Match IDs com coletiva pós concluída. */
  pressPostDoneMatchIds?: string[];
  /**
   * Atrito com a imprensa (0–100).
   * Sobe com respostas agressivas; ganhos de mídia ficam mais difíceis.
   */
  pressFriction?: number;
  /** Chaves de coletivas especiais já feitas (callup:/injury:/finance:). */
  pressSpecialDoneKeys?: string[];
}

export function createDefaultLiveLifeMeta(): LiveLifeMeta {
  return {
    onboardingComplete: false,
    pressPreDoneDates: [],
    pressPostDoneMatchIds: [],
    pressFriction: 0,
    pressSpecialDoneKeys: [],
  };
}

export const LIVELIFE_CHANGELOG = [
  {
    version: 'v1.4',
    title: 'International Duty Update',
    body: 'Modo Seleção / Dual Career: assuma a seleção nacional em paralelo ao clube — Datas FIFA, convocação, tática e partidas próprias, desfalque automático no clube, ranking FIFA dinâmico e Pulse Internacional.',
  },
  {
    version: 'v1.3',
    title: 'Financial Update',
    body: 'Dashboard financeiro redesenhado (KPIs, fluxo de caixa projetado, orçamento mensal, categorização de despesas, ranking de lançamentos), rating bancário do clube e teto de gastos com impacto na diretoria.',
  },
  {
    version: 'v1.2',
    title: 'LiveLife',
    body: 'Calendário contínuo, bilheteria, lesões temporais, folha no dia 5, Pulse diário, ClubOSocial, Coletivas, Manager, Sala de Troféus e Competições com pontos corridos, mata-mata e premiação ao avançar de fase.',
  },
  {
    version: 'v1.1',
    title: 'Pulse',
    body: 'Eventos imprevisíveis, dilemas morais e cobranças da diretoria antes das partidas.',
  },
  {
    version: 'v1.0',
    title: 'Base',
    body: 'Elenco, escalação, criação de time e partidas manuais.',
  },
] as const;
