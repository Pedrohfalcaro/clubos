import type { Player } from '../types/Player';
import type { Kit } from '../types/Kit';
import type { TacticalStyleKey } from '../types/Tactics';
import { trainingFit } from '../utils/formations';
import { DEFAULT_STYLE_KEY, TACTICAL_STYLES } from '../utils/tacticalStyles';
import type {
  TrainingMode,
  TrainingPlayerStats,
  TrainingSession,
  TrainingTeamKey,
  TrainingTeamSetup,
} from '../types/Training';
import type { SlotRole } from '../types/Tactics';
import { simulateMatch } from './engine';
import type { EnginePlayerInput, MatchResult, MatchSetup, SubRecord } from './engine';

export interface TrainingTeamDraft {
  name: string;
  kit: string;
  kitDesign?: Kit;
  formationKey: string;
  style: TacticalStyleKey;
  /** Um por slot, na ordem do preset; `null` = vazio. */
  playerIds: (string | null)[];
  slots: { x: number; y: number; role: SlotRole }[];
}

export interface TrainingDraft {
  date: string;
  season: number;
  open: boolean;
  mode: TrainingMode;
  controlledTeam?: TrainingTeamKey;
  format: 5 | 7 | 11;
  halfDurationSec: number;
  teams: Record<TrainingTeamKey, TrainingTeamDraft>;
}

/** Converte um atleta do elenco em jogador do motor (para substituições durante o jogo). */
export function toEnginePlayer(player: Player, role: SlotRole): EnginePlayerInput {
  return {
    id: player.id,
    position: player.position,
    overall: player.overall,
    fatigue: player.fatigue,
    morale: player.morale,
    personality: player.personality,
    trait: player.trait,
    fit: trainingFit(player, role),
    role,
    // o motor repete o slot de quem sai
    slotX: 0,
    slotY: 0,
  };
}

function toEngineTeam(draft: TrainingTeamDraft, byId: Map<string, Player>): EnginePlayerInput[] {
  const out: EnginePlayerInput[] = [];
  draft.playerIds.forEach((id, i) => {
    const player = id ? byId.get(id) : undefined;
    if (!id || !player) return;
    out.push({
      id,
      position: player.position,
      overall: player.overall,
      fatigue: player.fatigue,
      morale: player.morale,
      personality: player.personality,
      trait: player.trait,
      fit: trainingFit(player, draft.slots[i].role),
      role: draft.slots[i].role,
      slotX: draft.slots[i].x,
      slotY: draft.slots[i].y,
    });
  });
  return out;
}

function teamSetup(draft: TrainingTeamDraft, substitutes: string[] = []): TrainingTeamSetup {
  return {
    name: draft.name,
    kit: draft.kit,
    kitDesign: draft.kitDesign,
    formationKey: draft.formationKey,
    style: draft.style,
    lineup: draft.playerIds.flatMap((playerId, slot) => (playerId ? [{ slot, playerId }] : [])),
    substitutes: substitutes.length ? substitutes : undefined,
  };
}

/** Converte o resultado do motor no registro guardado no histórico. */
export function sessionFromResult(
  draft: TrainingDraft,
  result: MatchResult,
  roles: Map<string, SlotRole>,
  subs: SubRecord[] = [],
): TrainingSession {
  for (const s of subs) roles.set(s.inId, s.role);
  const subsOf = (team: TrainingTeamKey) => subs.filter(s => s.team === team).map(s => s.inId);
  const playerStats: Record<string, TrainingPlayerStats> = {};
  for (const [id, s] of Object.entries(result.stats)) {
    const role = roles.get(id);
    const keeperOrDefender = role === 'GOL' || role === 'ZAG' || role === 'LE' || role === 'LD';
    playerStats[id] = {
      goals: s.goals,
      assists: s.assists,
      saves: s.saves,
      clearances: s.clearances,
      cleanSheet: keeperOrDefender && s.cleanSheet,
      shotsOn: s.shotsOn,
      shotsOff: s.shotsOff,
      passesOk: s.passesOk,
      passesBad: s.passesBad,
      keyPasses: s.keyPasses,
      tackles: s.tackles,
      interceptions: s.interceptions,
      crosses: s.crosses,
      fouls: s.fouls,
      foulsWon: s.foulsWon,
      yellows: s.yellows,
      reds: s.reds,
      offsides: s.offsides,
      dribbles: s.dribbles,
      dribblesWon: s.dribblesWon,
    };
  }

  const goals = result.events
    .filter(e => e.type === 'goal' && e.team)
    .map(e => ({
      t: e.t,
      team: e.team as TrainingTeamKey,
      playerId: e.playerId,
      assistId: e.assistId,
      ownGoal: e.ownGoal,
    }));

  return {
    id: `trn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    date: draft.date,
    season: draft.season,
    open: draft.open,
    mode: draft.mode,
    controlledTeam: draft.controlledTeam,
    format: draft.format,
    halfDurationSec: draft.halfDurationSec,
    teams: { a: teamSetup(draft.teams.a, subsOf('a')), b: teamSetup(draft.teams.b, subsOf('b')) },
    score: { a: result.score.a, b: result.score.b },
    goals,
    playerStats,
    ratings: result.ratings,
    shares: result.shares,
    // Moral e lesões só entram na Fase 6.
    moraleDelta: {},
    injuries: [],
    mvpId: result.mvpId,
  };
}

function styleTraits(key: TacticalStyleKey) {
  const style = TACTICAL_STYLES.find(s => s.key === key) ?? TACTICAL_STYLES.find(s => s.key === DEFAULT_STYLE_KEY);
  return style?.traits;
}

export function buildMatchSetup(draft: TrainingDraft, players: Player[], seed?: number): MatchSetup {
  const byId = new Map(players.map(p => [p.id, p]));
  return {
    format: draft.format,
    halfDurationSec: draft.halfDurationSec,
    seed: seed ?? Math.floor(Math.random() * 2 ** 31),
    teams: { a: toEngineTeam(draft.teams.a, byId), b: toEngineTeam(draft.teams.b, byId) },
    styles: { a: styleTraits(draft.teams.a.style), b: styleTraits(draft.teams.b.style) },
  };
}

export function rolesOf(draft: TrainingDraft): Map<string, SlotRole> {
  const roles = new Map<string, SlotRole>();
  for (const team of ['a', 'b'] as const) {
    draft.teams[team].playerIds.forEach((id, i) => {
      if (id) roles.set(id, draft.teams[team].slots[i].role);
    });
  }
  return roles;
}

/** "Simular rápido": roda o motor inteiro sem desenhar e devolve a sessão pronta para o histórico. */
export function simulateTraining(draft: TrainingDraft, players: Player[]): TrainingSession {
  const result = simulateMatch(buildMatchSetup(draft, players));
  return sessionFromResult(draft, result, rolesOf(draft));
}
