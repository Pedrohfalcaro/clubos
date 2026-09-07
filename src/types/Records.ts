/** Métrica calculada a partir de `PlayerStats` (temporada atual + carreira). */
export type RecordMetric = 'goals' | 'assists' | 'goalContributions' | 'appearances' | 'starts';

export const RECORD_METRIC_LABELS: Record<RecordMetric, string> = {
  goals: 'Gols',
  assists: 'Assistências',
  goalContributions: 'Participações em gol',
  appearances: 'Jogos',
  starts: 'Jogos como titular',
};

export interface RecordEntry {
  id: string;
  /** Nome exibido — texto livre ou nome do jogador vinculado. */
  label: string;
  /** Se vinculado a um jogador atual do elenco — recalculado a cada partida. */
  playerId?: string;
  value: number;
}

export interface RecordTable {
  id: string;
  name: string;
  metric: RecordMetric;
  /** Ordenado desc por `value`, máx. 10 entradas. */
  entries: RecordEntry[];
}

/** Evento de mudança relevante numa tabela, para o popup do Dashboard. */
export interface RecordAlert {
  id: string;
  tableId: string;
  tableName: string;
  metric: RecordMetric;
  playerId: string;
  playerName: string;
  value: number;
  position: number;
  /** true = acabou de assumir a 1ª posição. */
  isTop: boolean;
}

export function recordMetricValue(
  metric: RecordMetric,
  stats: { goals: number; assists: number; matches: number; starts?: number },
): number {
  switch (metric) {
    case 'goals':
      return stats.goals;
    case 'assists':
      return stats.assists;
    case 'goalContributions':
      return stats.goals + stats.assists;
    case 'appearances':
      return stats.matches;
    case 'starts':
      return stats.starts ?? 0;
    default:
      return 0;
  }
}
