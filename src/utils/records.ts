import type { Match } from '../types/Match';
import type { Player } from '../types/Player';
import type { RecordAlert, RecordEntry, RecordMetric, RecordTable } from '../types/Records';
import { recordMetricValue } from '../types/Records';
import { uid } from './matchEvents';

const MAX_RECORD_ENTRIES = 10;

/** true = jogador tem nacionalidade definida e diferente da nacionalidade oficial do clube. */
export function isForeignPlayer(player: Player, homeNationality?: string | null): boolean {
  const nat = player.nationality?.trim();
  if (!nat || !homeNationality) return false;
  return nat.toLowerCase() !== homeNationality.trim().toLowerCase();
}

function homeGoalsForPlayer(playerId: string, matches: Match[]): number {
  let total = 0;
  for (const m of matches) {
    if (m.status !== 'completed' || m.location !== 'home') continue;
    total += m.goals.filter(g => g.playerId === playerId && !g.isOwnGoal).length;
  }
  return total;
}

/**
 * Valor acumulado de um jogador atual para uma métrica — anterior (pré-temporada 1) + carreira
 * + temporada atual para as métricas de `PlayerStats` (mesma soma de `playerCareerTotal` em
 * `utils/historyScope.ts`, ou seja, igual ao "Total da carreira" do Histórico), ou soma direta
 * dos jogos em casa para `homeGoals` (Artilheiros do Estádio), que não é um total de `PlayerStats`.
 */
export function playerCumulativeValue(player: Player, metric: RecordMetric, matches: Match[]): number {
  if (metric === 'homeGoals') return homeGoalsForPlayer(player.id, matches);
  const prior = player.priorStats;
  const career = player.careerStats;
  const current = player.stats;
  return recordMetricValue(metric, {
    goals: (prior?.goals ?? 0) + (career?.goals ?? 0) + (current.goals ?? 0),
    assists: (prior?.assists ?? 0) + (career?.assists ?? 0) + (current.assists ?? 0),
    matches: (prior?.matches ?? 0) + (career?.matches ?? 0) + (current.matches ?? 0),
    starts: (prior?.starts ?? 0) + (career?.starts ?? 0) + (current.starts ?? 0),
  });
}

export function sortAndCapEntries(entries: RecordEntry[]): RecordEntry[] {
  return [...entries].sort((a, b) => b.value - a.value).slice(0, MAX_RECORD_ENTRIES);
}

function computeTableEntries(
  table: RecordTable,
  playerById: Map<string, Player>,
  matches: Match[],
  homeNationality?: string | null,
): RecordEntry[] {
  const recalculated = table.entries
    .map(entry => {
      if (!entry.playerId) return entry;
      const player = playerById.get(entry.playerId);
      if (!player) return entry; // saiu do elenco — mantém o último valor conhecido
      return {
        ...entry,
        label: player.name,
        value: playerCumulativeValue(player, table.metric, matches),
      };
    })
    .filter(entry => {
      if (!entry.playerId || table.scope !== 'foreign' || !homeNationality) return true;
      const player = playerById.get(entry.playerId);
      if (!player) return true;
      return isForeignPlayer(player, homeNationality);
    });
  return sortAndCapEntries(recalculated);
}

/**
 * Valores ao vivo de uma tabela — para exibir na Sala de Troféus sempre em dia com o
 * Histórico (edições manuais de stats/"Anterior" refletem na hora, sem esperar o próximo
 * jogo). Não dispara alertas nem grava nada; só recalcula pra tela.
 */
export function liveTableEntries(
  table: RecordTable,
  players: Player[],
  matches: Match[],
  homeNationality?: string | null,
): RecordEntry[] {
  const playerById = new Map(players.map(p => [p.id, p]));
  return computeTableEntries(table, playerById, matches, homeNationality);
}

/**
 * Recalcula o valor de toda entrada vinculada a um jogador atual, reordena o top 10 de
 * cada tabela e detecta subidas de posição / novas entradas no top 10 / troca de líder —
 * usado após cada partida concluída para congelar o resultado e alimentar o popup do
 * Dashboard. Em tabelas com `scope: 'foreign'`, entradas vinculadas a jogadores que
 * deixaram de ser estrangeiros (ou cuja nacionalidade nunca foi preenchida) são removidas.
 */
export function recalcRecordTables(
  tables: RecordTable[],
  players: Player[],
  matches: Match[],
  homeNationality?: string | null,
): { tables: RecordTable[]; alerts: RecordAlert[] } {
  const playerById = new Map(players.map(p => [p.id, p]));
  const alerts: RecordAlert[] = [];

  const updatedTables = tables.map(table => {
    const prevPositions = new Map<string, number>();
    table.entries.forEach((entry, i) => {
      if (entry.playerId) prevPositions.set(entry.playerId, i);
    });

    const sorted = computeTableEntries(table, playerById, matches, homeNationality);

    sorted.forEach((entry, i) => {
      if (!entry.playerId) return;
      const prevPos = prevPositions.get(entry.playerId);
      if (prevPos === undefined || prevPos > i) {
        const player = playerById.get(entry.playerId);
        alerts.push({
          id: uid(),
          tableId: table.id,
          tableName: table.name,
          metric: table.metric,
          playerId: entry.playerId,
          playerName: player?.name ?? entry.label,
          value: entry.value,
          position: i + 1,
          isTop: i === 0,
        });
      }
    });

    return { ...table, entries: sorted };
  });

  return { tables: updatedTables, alerts };
}
