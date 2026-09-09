import {
  candidatosParaEvento,
  pesoEventoPorMoral,
  rollPulseOutDays,
  varsTemplate,
} from './athletes';
import { computeDynamicEventChance } from './chance';
import { filtrarPorCategoriaPlayer, getEventByIdPlayer, resolverImpactosPlayer } from './playerEvents';
import { escolherCategoriaPlayer, escolherRaridadePlayer } from './probabilitiesPlayer';
import type {
  PulseAthlete,
  PulseClub,
  PulseEventDef,
  PulseEventEffects,
  PulseGenerateResult,
  PulseHistoryEntry,
  PulseState,
} from './types';
import { DEFAULT_PULSE_SETTINGS } from './types';
import { pickWeighted, template, uid } from './utils';
import type { MatchResult } from '../types/Match';

export interface PlayerPulseGenerateOutput {
  resultado: PulseGenerateResult;
  pulseState: PulseState;
  moraleDelta: number;
  coachConfidenceDelta: number;
  fanReputationDelta: number;
  injuryOutDays?: number;
  injuryType?: string;
  historyEntry: PulseHistoryEntry;
}

function recentEventIds(history: PulseHistoryEntry[], n: number): string[] {
  return (history || []).filter(h => h.eventoId).slice(0, n).map(h => h.eventoId!);
}

function recentCategories(history: PulseHistoryEntry[], n: number): string[] {
  return (history || [])
    .filter(h => h.categoria && h.categoria !== 'nenhum')
    .slice(0, n)
    .map(h => h.categoria)
    .reverse();
}

function eventoEmCooldown(state: PulseState, evento: PulseEventDef): boolean {
  const last = state.cooldowns?.[evento.id];
  if (last == null) return false;
  const cooldown = evento.cooldown || state.settings.cooldownEventos || 20;
  const usados = (state.history || []).filter(h => h.eventoId).length;
  return usados - last < cooldown;
}

function elegiveisPlayer(
  state: PulseState,
  athlete: PulseAthlete,
  categoria: string,
  raridade: string,
): PulseEventDef[] {
  const recent = recentEventIds(state.history, state.settings.cooldownEventos || 20);
  let list = filtrarPorCategoriaPlayer(categoria).filter(e => {
    if (e.raridade !== raridade) return false;
    if (recent.includes(e.id)) return false;
    if (eventoEmCooldown(state, e)) return false;
    const tags = e.tags || {};
    if (tags.status || tags.idades || tags.formDryAttack || tags.moralMax != null || tags.moralMin != null) {
      if (candidatosParaEvento([athlete], e).length === 0) return false;
    }
    return true;
  });
  if (list.length === 0) {
    list = filtrarPorCategoriaPlayer(categoria).filter(e => !recent.includes(e.id));
  }
  if (list.length === 0) {
    list = filtrarPorCategoriaPlayer(categoria);
  }
  return list;
}

function montarResultadoPlayer(
  club: PulseClub,
  evento: PulseEventDef,
  atleta: PulseAthlete,
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
    impactos: resolverImpactosPlayer(evento, vars),
    atletaId: atleta.id,
    atletaNome: atleta.nome,
    cadeiaId: opts.cadeiaId || null,
    temporada: club.temporadaAtual,
  };
}

export function generatePlayerPulse(input: {
  club: PulseClub;
  athlete: PulseAthlete;
  pulseState: PulseState;
  chanceOverride?: number;
  recentResults?: MatchResult[];
}): PlayerPulseGenerateOutput {
  const { club, athlete } = input;
  let state: PulseState = {
    ...input.pulseState,
    history: [...(input.pulseState.history || [])],
    cooldowns: { ...(input.pulseState.cooldowns || {}) },
    chains: { active: [...(input.pulseState.chains?.active || [])] },
    settings: { ...DEFAULT_PULSE_SETTINGS, ...input.pulseState.settings },
    rolledMatchIds: [...(input.pulseState.rolledMatchIds || [])],
  };

  let resultado: PulseGenerateResult;
  let evento: PulseEventDef | null = null;

  const nadaTitulo = 'Nada aconteceu';
  const nadaDesc = 'Dia tranquilo na rotina do atleta.';

  // 1) Cadeias pendentes primeiro
  const active = state.chains.active;
  if (active.length) {
    const pending = active[0];
    state = { ...state, chains: { active: active.slice(1) } };
    const chainEvent = getEventByIdPlayer(pending.nextId);
    if (chainEvent) {
      evento = chainEvent;
      resultado = montarResultadoPlayer(club, evento, athlete, { cadeiaId: pending.fromId });
    } else {
      resultado = { tipo: 'nada' };
    }
  } else {
    resultado = { tipo: 'nada' };
  }

  // 2) Sorteio normal se não veio de cadeia
  if (!evento) {
    const baseChance = input.chanceOverride ?? (state.settings.dailyEventChance ?? 0.2);
    const chance = computeDynamicEventChance({
      base: baseChance,
      mode: 'daily',
      athletes: [athlete],
      club,
      history: state.history,
      recentResults: input.recentResults,
    });
    if (Math.random() > chance) {
      resultado = { tipo: 'nada' };
    } else {
      const catsRecent = recentCategories(state.history, 5);
      const categoria = escolherCategoriaPlayer(athlete, catsRecent, club);
      const raridade = escolherRaridadePlayer();
      let pool = elegiveisPlayer(state, athlete, categoria, raridade);

      if (pool.length === 0) {
        const order = ['comum', 'incomum', 'raro', 'muito-raro'] as const;
        for (const r of order) {
          pool = elegiveisPlayer(state, athlete, categoria, r);
          if (pool.length) break;
        }
      }

      if (pool.length === 0) {
        resultado = { tipo: 'nada' };
      } else {
        evento = pickWeighted(pool, e => pesoEventoPorMoral(e, [athlete], club))!;
        resultado = montarResultadoPlayer(club, evento, athlete);
      }
    }
  }

  // Aplica efeitos + histórico
  let moraleDelta = 0;
  let coachConfidenceDelta = 0;
  let fanReputationDelta = 0;
  let injuryOutDays: number | undefined;
  let injuryType: string | undefined;

  if (resultado.tipo === 'evento' && evento) {
    const usados = state.history.filter(h => h.eventoId).length;
    state.cooldowns[evento.id] = usados;
    const efeitos: PulseEventEffects = evento.efeitos ?? {};

    moraleDelta = efeitos.moral ?? 0;
    coachConfidenceDelta = efeitos.boardConfidence ?? 0;
    fanReputationDelta = efeitos.supporterConfidence ?? 0;

    if (efeitos.status === 'lesionado') {
      injuryOutDays = rollPulseOutDays(efeitos);
      injuryType = resultado.titulo ?? evento.titulo;
    }

    if (evento.cadeia?.nextId) {
      const chainChance = evento.cadeia.chance == null ? 0.3 : evento.cadeia.chance;
      if (Math.random() <= chainChance) {
        state.chains.active.push({
          nextId: evento.cadeia.nextId,
          atletaId: athlete.id,
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
      impactos: [],
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
    matchId: null,
  };

  // "Nada" não polui o histórico — só eventos reais.
  if (resultado.tipo !== 'nada') {
    state.history = [historyEntry, ...state.history];
  }

  return {
    resultado,
    pulseState: state,
    moraleDelta,
    coachConfidenceDelta,
    fanReputationDelta,
    injuryOutDays,
    injuryType,
    historyEntry,
  };
}
