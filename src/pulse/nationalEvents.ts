import type { NationalTeamState } from '../types/NationalTeam';
import type { Player } from '../types/Player';
import { isDateWithinWindow } from '../utils/nationalWindows';

/**
 * Pulse Internacional (Fase 8) — narrativa mínima e independente do Pulse do
 * clube (`src/pulse/*`), que é todo construído em cima de conceitos só do
 * clube (moral do elenco, imprensa, LiveLife). Aqui é só uma oportunidade
 * simples: o clube do próprio usuário pede de volta um convocado numa Data
 * FIFA de amistoso, já que amistosos não valem o risco de lesão/fadiga.
 */
export interface DeconvocationOpportunity {
  windowId: string;
  windowLabel: string;
  nationalPlayerId: string;
  nationalPlayerName: string;
  clubPlayerId: string;
  clubPlayerName: string;
}

/**
 * Só dispara em Data FIFA tipo `amistoso` ativa na data atual, para o primeiro
 * convocado ainda não resolvido nesta janela que tenha `clubPlayerId` (ou
 * seja, que seja de fato um jogador do elenco do usuário).
 */
export function findNationalDeconvocationOpportunity(
  nationalTeam: NationalTeamState,
  players: Player[],
  currentDate: string | null,
): DeconvocationOpportunity | null {
  if (!currentDate) return null;

  const window = nationalTeam.windows.find(
    w => w.type === 'amistoso' && isDateWithinWindow(w, currentDate),
  );
  if (!window) return null;

  const resolved = new Set(window.deconvocationResolvedIds);
  for (const nationalPlayerId of window.callUpIds) {
    if (resolved.has(nationalPlayerId)) continue;
    const nationalPlayer = nationalTeam.talentPool.find(p => p.id === nationalPlayerId);
    if (!nationalPlayer?.clubPlayerId) continue;
    const clubPlayer = players.find(p => p.id === nationalPlayer.clubPlayerId);
    if (!clubPlayer) continue;

    return {
      windowId: window.id,
      windowLabel: window.label,
      nationalPlayerId,
      nationalPlayerName: nationalPlayer.name,
      clubPlayerId: clubPlayer.id,
      clubPlayerName: clubPlayer.name,
    };
  }

  return null;
}
