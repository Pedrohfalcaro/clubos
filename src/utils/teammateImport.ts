/**
 * Import de colegas de elenco pro Modo Jogador — reaproveita literalmente o parser e o
 * modelo JSON do treinador (`clubImport.ts`, `club` + `players[]` com overall/potential/
 * salário/personalidade/status). Campos que o `Teammate` não usa são só descartados aqui;
 * o modelo de download continua o mesmo `CLUB_IMPORT_TEMPLATE`/`downloadClubTemplate`.
 */
import type { Teammate } from '../types/Teammate';
import { uid } from '../pulse/utils';
import { parseClubImport } from './clubImport';

export { downloadClubTemplate } from './clubImport';

export function parseTeammatesImport(
  raw: unknown,
  country: string,
  playerNumber: number | null,
): Teammate[] {
  const { players } = parseClubImport(raw, country);

  const used = new Set<number>(playerNumber != null ? [playerNumber] : []);
  function resolveNumber(preferred: number | null): number {
    if (preferred != null && !used.has(preferred)) {
      used.add(preferred);
      return preferred;
    }
    let n = 1;
    while (used.has(n)) n++;
    used.add(n);
    return n;
  }

  return players.map(p => ({
    id: uid('mate'),
    name: p.name,
    position: p.position,
    age: p.age,
    number: resolveNumber(p.number ?? null),
    moraleTowardsPlayer: 60,
  }));
}
