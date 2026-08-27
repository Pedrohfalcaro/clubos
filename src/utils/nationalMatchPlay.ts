/**
 * Ponte entre a Seleção Nacional e o motor de partida do clube (Fase 6.1 —
 * "jogar a partida como no clube": escalação, tática, eventos ao vivo).
 *
 * Em vez de duplicar `FormationField`/`utils/formations.ts`/os steps de
 * `pages/MatchPlay`, convertemos `NationalPlayer` num `Player` "de mentirinha"
 * com os campos que esse código já lê (id/nome/posição/overall/status) e nunca
 * bloqueado por lesão/suspensão/empréstimo — a Seleção não tem esse conceito,
 * só "está ou não convocado". IDs são preservados, então tudo que essas
 * funções devolvem (escalação, eventos, minutos) já vem com o `NationalPlayer.id`.
 */

import type { Player } from '../types/Player';
import { emptyPlayerStats } from '../types/Player';
import type {
  AssistEvent,
  CardEvent,
  GoalEvent,
  MatchLineup,
  SubstitutionEvent,
  TeamInjuryEntry,
} from '../types/Match';
import type { NationalMatchPerformance, NationalPlayer } from '../types/NationalTeam';
import { getMatchPlayingTime } from './playingTime';

export function nationalPlayerToPseudoPlayer(np: NationalPlayer): Player {
  return {
    id: np.id,
    teamId: '',
    name: np.name,
    position: np.position,
    number: null,
    age: np.age,
    overall: np.overall ?? 60,
    potential: np.overall ?? 60,
    morale: 70,
    salary: 0,
    marketValue: 0,
    status: 'Titular',
    stats: emptyPlayerStats(),
    availability: 'disponivel',
  };
}

export function buildNationalPerformances(input: {
  lineup: MatchLineup;
  substitutions: SubstitutionEvent[];
  injuries: TeamInjuryEntry[];
  playerMatches: string[];
  goals: GoalEvent[];
  assists: AssistEvent[];
  cards: CardEvent[];
  ratings: Record<string, number | null>;
}): NationalMatchPerformance[] {
  const minutesByPlayer = getMatchPlayingTime({
    lineup: input.lineup,
    substitutions: input.substitutions,
    injuries: input.injuries,
    playerMatches: input.playerMatches,
  });

  return input.playerMatches.map(pid => {
    const yellowCard = input.cards.some(c => c.playerId === pid && c.type === 'yellow');
    const redCard = input.cards.some(c => c.playerId === pid && c.type === 'red');
    return {
      nationalPlayerId: pid,
      minutes: minutesByPlayer.get(pid) ?? 0,
      goals: input.goals.filter(g => g.playerId === pid).length,
      assists: input.assists.filter(a => a.playerId === pid).length,
      rating: input.ratings[pid] ?? undefined,
      yellowCard: yellowCard || undefined,
      redCard: redCard || undefined,
    };
  });
}
