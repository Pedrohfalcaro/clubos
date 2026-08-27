import {
  aplicarEfeitos,
  rollPulseOutDays,
  candidatosParaEvento,
  getById,
  pesoEventoPorMoral,
  polaridadeEvento,
  selecionarAtleta,
  varsTemplate,
} from './athletes';
import { computeDynamicEventChance } from './chance';
import { filtrarPorCategoria, getEventById, resolverImpactos, eventTrigger } from './events';
import { escolherCategoria, escolherRaridade } from './probabilities';
import type {
  PulseAthlete,
  PulseClub,
  PulseEventDef,
  PulseEventEffects,
  PulseGenerateOutput,
  PulseGenerateResult,
  PulseHistoryEntry,
  PulseState,
} from './types';
import { DEFAULT_PULSE_SETTINGS } from './types';
import { pickWeighted, template, uid } from './utils';
import type { MatchResult } from '../types/Match';

function recentEventIds(history: PulseHistoryEntry[], n: number): string[] {
  return (history || [])
    .filter(h => h.eventoId)
    .slice(0, n)
    .map(h => h.eventoId!);
}

function recentCategories(history: PulseHistoryEntry[], n: number): string[] {
  return (history || [])
    .filter(h => h.categoria && h.categoria !== 'nenhum')
    .slice(0, n)
    .map(h => h.categoria)
    .reverse();
}

function eventoEmCooldown(
  state: PulseState,
  evento: PulseEventDef,
  history: PulseHistoryEntry[],
): boolean {
  const last = state.cooldowns?.[evento.id];
  if (last == null) return false;
  const cooldown = evento.cooldown || state.settings.cooldownEventos || 20;
  const usados = (history || []).filter(h => h.eventoId).length;
  return usados - last < cooldown;
}

function elegiveis(
  state: PulseState,
  athletes: PulseAthlete[],
  categoria: string,
  raridade: string,
  mode: 'match' | 'daily' = 'match',
): PulseEventDef[] {
  const recent = recentEventIds(state.history, state.settings.cooldownEventos || 20);
  let list = filtrarPorCategoria(categoria).filter(e => {
    if (mode === 'daily' && eventTrigger(e) === 'match_only') return false;
    if (e.raridade !== raridade) return false;
    if (recent.includes(e.id)) return false;
    if (eventoEmCooldown(state, e, state.history)) return false;
    const tags = e.tags || {};
    if (tags.precisaAtleta !== false) {
      const cands = candidatosParaEvento(athletes, e);
      if (
        tags.status ||
        tags.posicoes ||
        tags.idades ||
        tags.personalidades ||
        tags.formDryAttack ||
        tags.moralMax != null ||
        tags.moralMin != null
      ) {
        if (cands.length === 0) return false;
      }
    }
    return true;
  });

  if (list.length === 0) {
    list = filtrarPorCategoria(categoria).filter(e => {
      if (mode === 'daily' && eventTrigger(e) === 'match_only') return false;
      return !recent.includes(e.id);
    });
  }
  if (list.length === 0) {
    list = filtrarPorCategoria(categoria).filter(e =>
      mode === 'daily' ? eventTrigger(e) !== 'match_only' : true,
    );
  }
  return list;
}

function montarResultado(
  club: PulseClub,
  evento: PulseEventDef,
  atleta: PulseAthlete | null,
  opts: { cadeiaId?: string | null } = {},
): PulseGenerateResult {
  const vars = varsTemplate(club.nome, atleta);
  return {
    tipo: 'evento',
    eventoId: evento.id,
    categoria: evento.categoria,
    raridade: evento.raridade,
    titulo: template(evento.titulo, vars),
    descricao: template(evento.descricao, vars),
    impactos: resolverImpactos(evento, vars),
    atletaId: atleta ? atleta.id : null,
    atletaNome: atleta ? atleta.nome : null,
    cadeiaId: opts.cadeiaId || null,
    temporada: club.temporadaAtual,
  };
}

function ensureMoralEffect(evento: PulseEventDef): PulseEventEffects {
  const base = { ...(evento.efeitos || {}) };
  const pol = polaridadeEvento(evento);
  if (typeof base.moral !== 'number') {
    if (pol === 'bom') base.moral = 5;
    else if (pol === 'ruim') base.moral = -6;
  }
  // Clima do clube: preenche se o evento não declarou
  if (base.boardConfidence == null && base.supporterConfidence == null) {
    const cat = evento.categoria;
    if (cat === 'torcida') {
      base.supporterConfidence = pol === 'bom' ? 3 : pol === 'ruim' ? -4 : 0;
    } else if (cat === 'diretoria') {
      base.boardConfidence = pol === 'bom' ? 3 : pol === 'ruim' ? -4 : 0;
    } else if (cat === 'escandalo') {
      base.boardConfidence = -3;
      base.supporterConfidence = -4;
      if (base.mediaConfidence == null) base.mediaConfidence = -5;
    } else if (cat === 'imprensa' && pol === 'ruim') {
      base.supporterConfidence = -2;
      base.boardConfidence = -1;
      if (base.mediaConfidence == null) base.mediaConfidence = -4;
    } else if (cat === 'imprensa' && pol === 'bom') {
      base.supporterConfidence = 2;
      if (base.mediaConfidence == null) base.mediaConfidence = 1;
    } else if (cat === 'financeiro' && typeof base.caixa === 'number') {
      if (base.caixa >= 100_000) base.boardConfidence = 2;
      else if (base.caixa <= -50_000) base.boardConfidence = -2;
    } else if (cat === 'patrocinio' && pol === 'bom') {
      base.boardConfidence = 2;
      base.supporterConfidence = 1;
    }
  }
  // Imprensa sempre mexe um pouco na mídia se não declarado
  if (evento.categoria === 'imprensa' && base.mediaConfidence == null) {
    base.mediaConfidence = pol === 'bom' ? 1 : pol === 'ruim' ? -4 : -1;
  }
  return base;
}

export function generatePulse(input: {
  club: PulseClub;
  athletes: PulseAthlete[];
  pulseState: PulseState;
  matchId?: string;
  /** `daily` = dias sem jogo (filtra match_only; usa dailyEventChance se sem chanceOverride). */
  mode?: 'match' | 'daily';
  chanceOverride?: number;
  recentResults?: MatchResult[];
}): PulseGenerateOutput {
  const { club, athletes } = input;
  const mode = input.mode ?? 'match';
  let state: PulseState = {
    ...input.pulseState,
    history: [...(input.pulseState.history || [])],
    cooldowns: { ...(input.pulseState.cooldowns || {}) },
    chains: { active: [...(input.pulseState.chains?.active || [])] },
    settings: { ...DEFAULT_PULSE_SETTINGS, ...input.pulseState.settings },
    rolledMatchIds: [...(input.pulseState.rolledMatchIds || [])],
  };

  const athletesWorking = athletes.map(a => ({ ...a }));
  const athletePatches: PulseGenerateOutput['athletePatches'] = [];
  let financePatch: PulseGenerateOutput['financePatch'] = null;
  let climatePatch: PulseGenerateOutput['climatePatch'] = null;

  let resultado: PulseGenerateResult;
  let evento: PulseEventDef | null = null;
  let atleta: PulseAthlete | null = null;

  const nadaTitulo = 'Nada aconteceu';
  const nadaDesc =
    mode === 'daily'
      ? 'Dia tranquilo nos bastidores do clube.'
      : 'Nada aconteceu antes desta partida.';

  // 1) Chains first (skip match_only chains on daily)
  const active = state.chains.active;
  if (active.length) {
    const pending = active[0];
    state = {
      ...state,
      chains: { active: active.slice(1) },
    };
    const chainEvent = getEventById(pending.nextId);
    if (chainEvent && !(mode === 'daily' && eventTrigger(chainEvent) === 'match_only')) {
      evento = chainEvent;
      atleta = pending.atletaId ? getById(athletesWorking, pending.atletaId) : null;
      if ((evento.tags || {}).precisaAtleta !== false) {
        if (!atleta || !candidatosParaEvento([atleta], evento).length) {
          atleta = selecionarAtleta(athletesWorking, evento);
        }
      } else {
        atleta = null;
      }
      resultado = montarResultado(club, evento, atleta, { cadeiaId: pending.fromId });
    } else {
      resultado = { tipo: 'nada' };
    }
  } else {
    resultado = { tipo: 'nada' };
  }

  // 2) Normal roll if no chain event
  if (!evento) {
    const baseChance =
      input.chanceOverride ??
      (mode === 'daily'
        ? (state.settings.dailyEventChance ?? 0.2)
        : (state.settings.chanceEvento ?? 0.28));
    const chance = computeDynamicEventChance({
      base: baseChance,
      mode,
      athletes: athletesWorking,
      club,
      history: state.history,
      recentResults: input.recentResults,
    });
    if (Math.random() > chance) {
      resultado = { tipo: 'nada' };
    } else {
      const catsRecent = recentCategories(state.history, 5);
      const categoria = escolherCategoria(athletesWorking, catsRecent, club);
      const raridade = escolherRaridade();
      let pool = elegiveis(state, athletesWorking, categoria, raridade, mode);

      if (pool.length === 0) {
        const order = ['comum', 'incomum', 'raro', 'muito-raro'] as const;
        for (const r of order) {
          pool = elegiveis(state, athletesWorking, categoria, r, mode);
          if (pool.length) break;
        }
      }

      if (pool.length === 0) {
        resultado = { tipo: 'nada' };
      } else {
        evento = pickWeighted(pool, e => pesoEventoPorMoral(e, athletesWorking, club))!;
        atleta = selecionarAtleta(athletesWorking, evento);
        resultado = montarResultado(club, evento, atleta);
      }
    }
  }

  // Apply effects + history
  if (resultado.tipo === 'evento' && evento) {
    const usados = state.history.filter(h => h.eventoId).length;
    state.cooldowns[evento.id] = usados;
    const efeitos = ensureMoralEffect(evento);

    // Recalcula impactos com moral/caixa garantidos
    if (atleta || typeof efeitos.caixa === 'number') {
      resultado = {
        ...resultado,
        impactos: resolverImpactos({ ...evento, efeitos }, varsTemplate(club.nome, atleta)),
      };
    }

    if (atleta && (efeitos.moral != null || efeitos.fadiga != null || efeitos.status)) {
      const idx = athletesWorking.findIndex(a => a.id === atleta!.id);
      if (idx >= 0) {
        const patched = aplicarEfeitos(athletesWorking[idx], efeitos);
        athletesWorking[idx] = patched;
        const outDays = rollPulseOutDays(efeitos);
        athletePatches.push({
          id: patched.id,
          moral: patched.moral,
          fadiga: patched.fadiga,
          availability: patched.status,
          injuryDaysRemaining: outDays,
        });
      }
    }

    if (typeof efeitos.caixa === 'number' && efeitos.caixa !== 0) {
      financePatch = {
        amount: efeitos.caixa,
        label: `Pulse: ${resultado.titulo ?? evento.titulo}`,
      };
    }

    const boardD = efeitos.boardConfidence ?? 0;
    const fansD = efeitos.supporterConfidence ?? 0;
    const mediaD = efeitos.mediaConfidence ?? 0;
    if (boardD !== 0 || fansD !== 0 || mediaD !== 0) {
      climatePatch = {
        board: boardD || undefined,
        supporter: fansD || undefined,
        media: mediaD || undefined,
        reason: `Pulse: ${resultado.titulo ?? evento.titulo}`,
      };
      const bits = [...(resultado.impactos ?? [])];
      if (boardD) bits.push(`Diretoria ${boardD > 0 ? '+' : ''}${boardD}`);
      if (fansD) bits.push(`Torcida ${fansD > 0 ? '+' : ''}${fansD}`);
      if (mediaD) bits.push(`Mídia ${mediaD > 0 ? '+' : ''}${mediaD}`);
      resultado = { ...resultado, impactos: bits };
    }

    if (evento.cadeia?.nextId) {
      const chainChance = evento.cadeia.chance == null ? 0.3 : evento.cadeia.chance;
      if (Math.random() <= chainChance) {
        state.chains.active.push({
          nextId: evento.cadeia.nextId,
          atletaId: atleta ? atleta.id : null,
          fromId: evento.id,
          createdAt: new Date().toISOString(),
        });
      }
    }
  } else {
    resultado = {
      tipo: 'nada',
      categoria: 'nenhum',
      raridade: null,
      titulo: nadaTitulo,
      descricao: nadaDesc,
      impactos: ['Sem mudanças no elenco ou no clima do clube'],
      atletaId: null,
      atletaNome: null,
      temporada: club.temporadaAtual,
    };
  }

  const historyEntry: PulseHistoryEntry = {
    id: uid('hist'),
    data: new Date().toISOString(),
    temporada: resultado.temporada ?? club.temporadaAtual,
    categoria: resultado.categoria ?? 'nenhum',
    raridade: resultado.raridade ?? null,
    titulo: resultado.titulo ?? nadaTitulo,
    descricao: resultado.descricao ?? nadaDesc,
    impactos: resultado.impactos ?? [],
    atletaId: resultado.atletaId ?? null,
    atletaNome: resultado.atletaNome ?? null,
    eventoId: resultado.eventoId ?? null,
    cadeiaId: resultado.cadeiaId ?? null,
    matchId: input.matchId ?? null,
  };

  // Daily "nada" não polui o histórico — só eventos reais
  if (!(mode === 'daily' && resultado.tipo === 'nada')) {
    state.history = [historyEntry, ...state.history];
  }
  if (input.matchId && !state.rolledMatchIds.includes(input.matchId)) {
    state.rolledMatchIds = [...state.rolledMatchIds, input.matchId];
  }

  return {
    resultado,
    pulseState: state,
    athletePatches,
    financePatch,
    climatePatch,
    historyEntry,
  };
}
