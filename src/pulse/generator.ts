import {
  aplicarEfeitos,
  candidatosParaEvento,
  getById,
  selecionarAtleta,
  varsTemplate,
} from './athletes';
import { filtrarPorCategoria, getEventById, resolverImpactos } from './events';
import { escolherCategoria, escolherRaridade } from './probabilities';
import type {
  PulseAthlete,
  PulseClub,
  PulseEventDef,
  PulseGenerateOutput,
  PulseGenerateResult,
  PulseHistoryEntry,
  PulseState,
} from './types';
import { clamp, pickRandom, template, uid } from './utils';

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
): PulseEventDef[] {
  const recent = recentEventIds(state.history, state.settings.cooldownEventos || 20);
  let list = filtrarPorCategoria(categoria).filter(e => {
    if (e.raridade !== raridade) return false;
    if (recent.includes(e.id)) return false;
    if (eventoEmCooldown(state, e, state.history)) return false;
    const tags = e.tags || {};
    if (tags.precisaAtleta !== false) {
      const cands = candidatosParaEvento(athletes, e);
      if (tags.status || tags.posicoes || tags.idades || tags.personalidades) {
        if (cands.length === 0 && athletes.length === 0) return false;
      }
    }
    return true;
  });

  if (list.length === 0) {
    list = filtrarPorCategoria(categoria).filter(e => !recent.includes(e.id));
  }
  if (list.length === 0) {
    list = filtrarPorCategoria(categoria);
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

export function generatePulse(input: {
  club: PulseClub;
  athletes: PulseAthlete[];
  pulseState: PulseState;
  matchId?: string;
}): PulseGenerateOutput {
  const { club, athletes } = input;
  let state: PulseState = {
    ...input.pulseState,
    history: [...(input.pulseState.history || [])],
    cooldowns: { ...(input.pulseState.cooldowns || {}) },
    chains: { active: [...(input.pulseState.chains?.active || [])] },
    settings: { ...input.pulseState.settings },
    rolledMatchIds: [...(input.pulseState.rolledMatchIds || [])],
  };

  let athletesWorking = athletes.map(a => ({ ...a }));
  const athletePatches: PulseGenerateOutput['athletePatches'] = [];

  let resultado: PulseGenerateResult;
  let evento: PulseEventDef | null = null;
  let atleta: PulseAthlete | null = null;

  // 1) Chains first
  const active = state.chains.active;
  if (active.length) {
    const pending = active[0];
    state = {
      ...state,
      chains: { active: active.slice(1) },
    };
    const chainEvent = getEventById(pending.nextId);
    if (chainEvent) {
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
      // invalid chain → fall through
      resultado = { tipo: 'nada' };
    }
  } else {
    resultado = { tipo: 'nada' };
  }

  // 2) Normal roll if no chain event
  if (!evento) {
    const chance = clamp(state.settings.chanceEvento ?? 0.28, 0.1, 0.6);
    if (Math.random() > chance) {
      resultado = { tipo: 'nada' };
    } else {
      const catsRecent = recentCategories(state.history, 5);
      const categoria = escolherCategoria(athletesWorking, catsRecent);
      let raridade = escolherRaridade();
      let pool = elegiveis(state, athletesWorking, categoria, raridade);

      if (pool.length === 0) {
        const order = ['comum', 'incomum', 'raro', 'muito-raro'] as const;
        for (const r of order) {
          pool = elegiveis(state, athletesWorking, categoria, r);
          if (pool.length) {
            raridade = r;
            break;
          }
        }
      }

      if (pool.length === 0) {
        resultado = { tipo: 'nada' };
      } else {
        evento = pickRandom(pool)!;
        atleta = selecionarAtleta(athletesWorking, evento);
        resultado = montarResultado(club, evento, atleta);
      }
    }
  }

  // Apply effects + history
  if (resultado.tipo === 'evento' && evento) {
    const usados = state.history.filter(h => h.eventoId).length;
    state.cooldowns[evento.id] = usados;

    if (atleta && evento.efeitos) {
      const idx = athletesWorking.findIndex(a => a.id === atleta!.id);
      if (idx >= 0) {
        const patched = aplicarEfeitos(athletesWorking[idx], evento.efeitos);
        athletesWorking[idx] = patched;
        athletePatches.push({
          id: patched.id,
          moral: patched.moral,
          fadiga: patched.fadiga,
          availability: patched.status,
        });
      }
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
      titulo: 'Nada aconteceu',
      descricao: 'Nada aconteceu antes desta partida.',
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
    titulo: resultado.titulo ?? 'Nada aconteceu',
    descricao: resultado.descricao ?? 'Nada aconteceu antes desta partida.',
    impactos: resultado.impactos ?? [],
    atletaId: resultado.atletaId ?? null,
    atletaNome: resultado.atletaNome ?? null,
    eventoId: resultado.eventoId ?? null,
    cadeiaId: resultado.cadeiaId ?? null,
    matchId: input.matchId ?? null,
  };

  state.history = [historyEntry, ...state.history];
  if (input.matchId && !state.rolledMatchIds.includes(input.matchId)) {
    state.rolledMatchIds = [...state.rolledMatchIds, input.matchId];
  }

  return { resultado, pulseState: state, athletePatches, historyEntry };
}
