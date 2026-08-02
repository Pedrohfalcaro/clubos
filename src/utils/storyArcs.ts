import type { Player } from '../types/Player';
import type { MatchResult } from '../types/Match';
import type {
  ActiveStoryArc,
  StoryArcDef,
  StoryArcHistoryEntry,
  StoryArcId,
  StoryArcStepDef,
} from '../types/StoryArc';
import type { SocialPost } from '../types/Social';
import { newSocialPost } from '../types/Social';
import { boardStatus } from '../types/Board';

export const STORY_ARC_DEFS: StoryArcDef[] = [
  {
    id: 'dressing_room_rift',
    title: 'Racha no vestiário',
    cooldownDays: 45,
    steps: [
      {
        headline: 'Clima pesado no vestiário após a derrota',
        body: 'Fontes internas relatam discussão acalorada entre titulares. A diretoria monitora o ambiente.',
        deltas: { squadMorale: -4, media: -2 },
      },
      {
        headline: 'Imprensa amplia crise: “grupo dividido”',
        body: 'Colunas esportivas cobram posição do técnico. Bastidores falam em reunião de emergência.',
        deltas: { media: -3, supporter: -2 },
        pressHint: 'story_arc',
      },
      {
        headline: 'Coletiva decisiva: técnico responde à pressão',
        body: 'A resposta pública define se o episódio esfria ou vira novela de semana.',
        deltas: { board: -1 },
        pressHint: 'story_arc',
      },
      {
        headline: 'Vestiário busca trégua — ou o racha permanece',
        body: 'Dependendo do tom das últimas declarações, o grupo tenta virar a página ou atraindo mais ruído.',
        deltas: { squadMorale: 2, media: 1 },
      },
    ],
  },
  {
    id: 'media_siege',
    title: 'Cerco da imprensa',
    cooldownDays: 40,
    steps: [
      {
        headline: 'Relação com a imprensa no limite',
        body: 'Tom das coberturas azeda. Qualquer declaração vira manchete hostil.',
        deltas: { media: -3 },
      },
      {
        headline: 'Campanha de pressão: “técnico sob fogo”',
        body: 'Programas e portais elevam o tom. A diretoria sente o calor externo.',
        deltas: { media: -2, board: -2, supporter: -1 },
        pressHint: 'story_arc',
      },
      {
        headline: 'Clube tenta controlar a narrativa',
        body: 'Assessoria e técnico alinham discurso. Ainda há espaço para reconstruir a ponte — com calma.',
        deltas: { media: 1, board: 1 },
        pressHint: 'story_arc',
      },
      {
        headline: 'Atrito com a mídia: página vira (ou cicatriz fica)',
        body: 'O ciclo de pressão perde força, mas a memória da imprensa é longa.',
        deltas: { media: 1 },
      },
    ],
  },
  {
    id: 'injury_saga',
    title: 'Saga da lesão',
    cooldownDays: 50,
    steps: [
      {
        headline: 'Desfalque longo: {{player}} fora do radar',
        body: 'O departamento médico confirma quadro delicado. Planejamento tático terá de mudar.',
        deltas: { squadMorale: -2, supporter: -1 },
        pressHint: 'injury',
      },
      {
        headline: 'Especulação sobre retorno de {{player}}',
        body: 'Prazos circulam sem confirmação. O técnico pede paciência e foco no elenco disponível.',
        deltas: { media: -1 },
      },
      {
        headline: 'Grupo se adapta sem {{player}}',
        body: 'Companheiros assumem protagonismo. A torcida ainda sente falta do desfalque.',
        deltas: { squadMorale: 2, supporter: 1 },
        pressHint: 'injury',
      },
      {
        headline: 'Capítulo da lesão de {{player}} perde força na pauta',
        body: 'O assunto esfria no feed — até o próximo boletim médico.',
        deltas: { media: 1 },
      },
    ],
  },
  {
    id: 'board_ultimatum',
    title: 'Ultimato da diretoria',
    cooldownDays: 55,
    steps: [
      {
        headline: 'Diretoria em alerta máximo',
        body: 'Reunião tensa no alto escalão. Resultados e gestão sob a lupa.',
        deltas: { board: -3, media: -1 },
      },
      {
        headline: 'Recado interno: “precisa virar o jogo”',
        body: 'Fontes falam em prazo curto para resposta em campo e discurso público.',
        deltas: { board: -2, squadMorale: -2 },
        pressHint: 'story_arc',
      },
      {
        headline: 'Técnico na corda bamba perante a mesa',
        body: 'Qualquer nova derrota ou declaração mal medida pode precipitar decisão drástica.',
        deltas: { board: -1, media: -2, supporter: -2 },
        pressHint: 'story_arc',
      },
      {
        headline: 'Ciclo de pressão da diretoria perde urgência',
        body: 'O ultimato não some da memória, mas a pauta externa muda de foco.',
        deltas: { board: 1 },
      },
    ],
  },
];

const DEF_BY_ID = Object.fromEntries(STORY_ARC_DEFS.map(d => [d.id, d])) as Record<
  StoryArcId,
  StoryArcDef
>;

export function getStoryArcDef(id: StoryArcId): StoryArcDef | undefined {
  return DEF_BY_ID[id];
}

function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso.slice(0, 10)}T12:00:00`);
  const b = new Date(`${toIso.slice(0, 10)}T12:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function fillPlayer(text: string, name?: string): string {
  if (!name) return text.replace(/\{\{player\}\}/g, 'o atleta');
  return text.replace(/\{\{player\}\}/g, name);
}

function avgMorale(players: Player[]): number {
  const active = players.filter(p => p.status !== 'Aposentado' && p.status !== 'Emprestado');
  if (!active.length) return 50;
  return active.reduce((s, p) => s + (p.morale ?? 70), 0) / active.length;
}

export function pickEligibleArcId(input: {
  recentResults: MatchResult[];
  players: Player[];
  boardConfidence: number;
  mediaConfidence: number;
  pressFriction: number;
  history: StoryArcHistoryEntry[];
  today: string;
}): { id: StoryArcId; playerId?: string; playerName?: string } | null {
  const losses = input.recentResults.slice(0, 5).filter(r => r === 'loss').length;
  const morale = avgMorale(input.players);
  const boardCrisis = boardStatus(input.boardConfidence) === 'crisis';
  const injured = input.players
    .filter(p => p.availability === 'lesionado' && (p.injuryDaysRemaining ?? 0) >= 21)
    .sort((a, b) => (b.injuryDaysRemaining ?? 0) - (a.injuryDaysRemaining ?? 0))[0];

  const cooled = (id: StoryArcId) => {
    const def = DEF_BY_ID[id];
    const last = input.history.filter(h => h.id === id).sort((a, b) => b.completedAt.localeCompare(a.completedAt))[0];
    if (!last) return true;
    return daysBetween(last.completedAt, input.today) >= def.cooldownDays;
  };

  const candidates: { id: StoryArcId; score: number; playerId?: string; playerName?: string }[] = [];

  if (losses >= 2 && morale < 58 && cooled('dressing_room_rift')) {
    candidates.push({ id: 'dressing_room_rift', score: 3 + losses });
  }
  if (
    (input.pressFriction >= 45 || input.mediaConfidence < 38) &&
    cooled('media_siege')
  ) {
    candidates.push({
      id: 'media_siege',
      score: 2 + Math.floor(input.pressFriction / 20),
    });
  }
  if (injured && cooled('injury_saga')) {
    candidates.push({
      id: 'injury_saga',
      score: 3,
      playerId: injured.id,
      playerName: injured.name,
    });
  }
  if ((boardCrisis || input.boardConfidence < 38) && cooled('board_ultimatum')) {
    candidates.push({ id: 'board_ultimatum', score: boardCrisis ? 4 : 2 });
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0];
}

/** Chance de iniciar arco quando elegível (dia sem partida). */
export const STORY_ARC_START_CHANCE = 0.38;

export function buildArcPost(input: {
  step: StoryArcStepDef;
  arc: ActiveStoryArc;
  stepIndex: number;
  date: string;
}): SocialPost {
  const name = input.arc.playerName;
  return newSocialPost({
    date: input.date,
    type: 'headline',
    content: fillPlayer(input.step.headline, name),
    body: fillPlayer(input.step.body, name),
    headlineStyle: 'chronicle',
    author: 'Gazeta ClubOS',
    arcId: input.arc.id,
    arcStep: input.stepIndex + 1,
    arcTitle: input.arc.title,
    likes: 110 + Math.floor(Math.random() * 180),
  });
}

export interface StoryArcTickResult {
  activeArc: ActiveStoryArc | null;
  history: StoryArcHistoryEntry[];
  newPost: SocialPost | null;
  deltas: { board: number; media: number; supporter: number; squadMorale: number };
  started: boolean;
  completed: boolean;
}

/**
 * Avança ou inicia arco no Avançar Dia.
 * - Se há arco ativo e ainda não publicou passo hoje → publica o próximo.
 * - Se não há arco e elegível → chance de iniciar (passo 0 no mesmo dia).
 */
export function tickStoryArc(input: {
  today: string;
  activeArc: ActiveStoryArc | null | undefined;
  history: StoryArcHistoryEntry[] | undefined;
  recentResults: MatchResult[];
  players: Player[];
  boardConfidence: number;
  mediaConfidence: number;
  pressFriction: number;
  /** Evita iniciar arco em dia de jogo. */
  hasMatchToday?: boolean;
  rng?: () => number;
}): StoryArcTickResult {
  const rng = input.rng ?? Math.random;
  const history = [...(input.history ?? [])];
  let active = input.activeArc ? { ...input.activeArc } : null;
  const emptyDeltas = { board: 0, media: 0, supporter: 0, squadMorale: 0 };

  if (active && active.status === 'active') {
    const def = DEF_BY_ID[active.id];
    if (!def) {
      return {
        activeArc: null,
        history,
        newPost: null,
        deltas: emptyDeltas,
        started: false,
        completed: false,
      };
    }
    if (active.lastStepAt === input.today) {
      return {
        activeArc: active,
        history,
        newPost: null,
        deltas: emptyDeltas,
        started: false,
        completed: false,
      };
    }
    if (active.step >= def.steps.length) {
      const completedAt = input.today;
      history.unshift({ id: active.id, title: active.title, completedAt });
      return {
        activeArc: null,
        history: history.slice(0, 20),
        newPost: null,
        deltas: emptyDeltas,
        started: false,
        completed: true,
      };
    }

    const stepDef = def.steps[active.step];
    const stepIndex = active.step;
    const post = buildArcPost({
      step: stepDef,
      arc: active,
      stepIndex,
      date: input.today,
    });
    const deltas = {
      board: stepDef.deltas?.board ?? 0,
      media: stepDef.deltas?.media ?? 0,
      supporter: stepDef.deltas?.supporter ?? 0,
      squadMorale: stepDef.deltas?.squadMorale ?? 0,
    };
    active = {
      ...active,
      step: stepIndex + 1,
      lastStepAt: input.today,
      pendingPress: Boolean(stepDef.pressHint),
      pendingPressContext: stepDef.pressHint,
    };

    let completed = false;
    if (active.step >= def.steps.length) {
      history.unshift({
        id: active.id,
        title: active.title,
        completedAt: input.today,
      });
      return {
        activeArc: null,
        history: history.slice(0, 20),
        newPost: post,
        deltas,
        started: false,
        completed: true,
      };
    }

    return {
      activeArc: active,
      history,
      newPost: post,
      deltas,
      started: false,
      completed,
    };
  }

  // Sem arco ativo — tentar iniciar
  if (input.hasMatchToday) {
    return {
      activeArc: null,
      history,
      newPost: null,
      deltas: emptyDeltas,
      started: false,
      completed: false,
    };
  }

  const pick = pickEligibleArcId({
    recentResults: input.recentResults,
    players: input.players,
    boardConfidence: input.boardConfidence,
    mediaConfidence: input.mediaConfidence,
    pressFriction: input.pressFriction,
    history,
    today: input.today,
  });
  if (!pick || rng() > STORY_ARC_START_CHANCE) {
    return {
      activeArc: null,
      history,
      newPost: null,
      deltas: emptyDeltas,
      started: false,
      completed: false,
    };
  }

  const def = DEF_BY_ID[pick.id];
  const newArc: ActiveStoryArc = {
    id: pick.id,
    title: def.title,
    step: 0,
    startedAt: input.today,
    lastStepAt: null,
    status: 'active',
    playerId: pick.playerId,
    playerName: pick.playerName,
  };

  // Publica passo 0 imediatamente
  const stepDef = def.steps[0];
  const post = buildArcPost({
    step: stepDef,
    arc: newArc,
    stepIndex: 0,
    date: input.today,
  });
  const deltas = {
    board: stepDef.deltas?.board ?? 0,
    media: stepDef.deltas?.media ?? 0,
    supporter: stepDef.deltas?.supporter ?? 0,
    squadMorale: stepDef.deltas?.squadMorale ?? 0,
  };
  const startedArc: ActiveStoryArc = {
    ...newArc,
    step: 1,
    lastStepAt: input.today,
    pendingPress: Boolean(stepDef.pressHint),
    pendingPressContext: stepDef.pressHint,
  };

  return {
    activeArc: startedArc,
    history,
    newPost: post,
    deltas,
    started: true,
    completed: false,
  };
}

export function clearArcPendingPress(arc: ActiveStoryArc | null | undefined): ActiveStoryArc | null {
  if (!arc) return null;
  if (!arc.pendingPress) return arc;
  return { ...arc, pendingPress: false, pendingPressContext: undefined };
}
