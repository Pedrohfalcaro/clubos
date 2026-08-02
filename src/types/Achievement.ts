/** Conquista do clube (título, classificação, etc.). */
export interface TeamAchievement {
  id: string;
  competition: string;
  season: number;
  /** Posição final (1 = campeão). */
  position: number;
  isTitle: boolean;
  note?: string;
  /** Data ISO em que foi registrado. */
  awardedAt?: string;
}

export function isTeamAchievement(value: unknown): value is TeamAchievement {
  if (!value || typeof value !== 'object') return false;
  const a = value as TeamAchievement;
  return (
    typeof a.competition === 'string' &&
    typeof a.season === 'number' &&
    typeof a.position === 'number' &&
    typeof a.isTitle === 'boolean'
  );
}

/** Migra saves antigos (`string[]`) e objetos incompletos. */
export function normalizeAchievements(
  raw: unknown,
  fallbackSeason = 1,
): TeamAchievement[] {
  if (!Array.isArray(raw)) return [];
  const out: TeamAchievement[] = [];
  raw.forEach((item, i) => {
    if (typeof item === 'string' && item.trim()) {
      out.push({
        id: `ach_legacy_${i}_${item.slice(0, 24)}`,
        competition: item.trim(),
        season: fallbackSeason,
        position: 1,
        isTitle: true,
        note: 'Importado do histórico',
      });
      return;
    }
    if (isTeamAchievement(item)) {
      out.push({
        ...item,
        id: item.id || `ach_${item.season}_${item.competition}_${item.position}`,
      });
    }
  });
  return out;
}
