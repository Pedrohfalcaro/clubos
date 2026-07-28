import type { Player, PlayerPosition } from '../types/Player';
import type { PulseAthlete, PulseAvailability, PulseEventDef, PulsePosition } from './types';
import { ageBand, clamp, pickRandom, pickWeighted, PERSONALIDADES } from './utils';

const CLUBOS_TO_PULSE: Record<PlayerPosition, PulsePosition> = {
  GK: 'GOL',
  CB: 'ZAG',
  LB: 'LE',
  RB: 'LD',
  CDM: 'VOL',
  CM: 'MC',
  CAM: 'ME',
  LW: 'PE',
  RW: 'PD',
  ST: 'ATA',
  CF: 'ATA',
};

const PULSE_TO_CLUBOS: Record<PulsePosition, PlayerPosition> = {
  GOL: 'GK',
  ZAG: 'CB',
  LE: 'LB',
  LD: 'RB',
  VOL: 'CDM',
  MC: 'CM',
  ME: 'CAM',
  MD: 'CAM',
  PE: 'LW',
  PD: 'RW',
  ATA: 'ST',
};

export function toPulsePosition(pos: PlayerPosition): PulsePosition {
  return CLUBOS_TO_PULSE[pos] ?? 'MC';
}

export function fromPulsePosition(pos: string): PlayerPosition {
  return PULSE_TO_CLUBOS[pos as PulsePosition] ?? 'CM';
}

export function playerToPulseAthlete(player: Player): PulseAthlete {
  return {
    id: player.id,
    nome: player.name,
    posicao: toPulsePosition(player.position),
    idade: player.age,
    personalidade: player.personality ?? 'Disciplinado',
    moral: player.morale ?? 70,
    fadiga: player.fatigue ?? 0,
    status: player.availability ?? 'disponivel',
  };
}

export function eventoCombinaTags(evento: PulseEventDef, atleta: PulseAthlete): boolean {
  const tags = evento.tags || {};
  if (tags.status?.length && !tags.status.includes(atleta.status)) return false;
  if (tags.posicoes?.length && !tags.posicoes.includes(atleta.posicao as PulsePosition)) {
    return false;
  }
  if (tags.personalidades?.length && !tags.personalidades.includes(atleta.personalidade)) {
    return false;
  }
  if (tags.idades?.length) {
    const band = ageBand(atleta.idade);
    if (band === 'qualquer' || !tags.idades.includes(band)) return false;
  }
  return true;
}

export function candidatosParaEvento(athletes: PulseAthlete[], evento: PulseEventDef): PulseAthlete[] {
  const tags = evento.tags || {};
  if (tags.precisaAtleta === false) return [];
  return (athletes || []).filter(a => eventoCombinaTags(evento, a));
}

export function selecionarAtleta(athletes: PulseAthlete[], evento: PulseEventDef): PulseAthlete | null {
  const tags = evento.tags || {};
  if (tags.precisaAtleta === false) return null;

  let pool = candidatosParaEvento(athletes, evento);
  if (pool.length === 0 && tags.precisaAtleta) {
    pool = (athletes || []).slice();
    if (tags.status?.length) {
      const filtered = pool.filter(a => tags.status!.includes(a.status));
      if (filtered.length) pool = filtered;
    }
  }
  if (pool.length === 0) return null;

  return pickWeighted(pool, a => {
    let w = 1;
    w += (100 - (a.moral || 100)) / 100;
    w += (a.fadiga || 0) / 200;
    return Math.max(0.1, w);
  });
}

export function aplicarEfeitos(
  atleta: PulseAthlete,
  efeitos: PulseEventDef['efeitos'],
): PulseAthlete {
  if (!atleta || !efeitos) return atleta;
  const next = { ...atleta };
  if (typeof efeitos.moral === 'number') {
    next.moral = clamp((next.moral || 100) + efeitos.moral, 0, 100);
  }
  if (typeof efeitos.fadiga === 'number') {
    next.fadiga = clamp((next.fadiga || 0) + efeitos.fadiga, 0, 100);
  }
  if (efeitos.status) {
    next.status = efeitos.status;
  }
  return next;
}

export function varsTemplate(clubName: string, atleta: PulseAthlete | null) {
  return {
    clube: clubName || 'clube',
    atleta: atleta ? atleta.nome : 'um atleta',
    posicao: atleta ? atleta.posicao : '',
  };
}

export function getById(athletes: PulseAthlete[], id: string): PulseAthlete | null {
  return athletes.find(a => a.id === id) || null;
}

export function randomPersonality(): string {
  return pickRandom([...PERSONALIDADES]) ?? 'Disciplinado';
}

export function defaultAvailability(): PulseAvailability {
  return 'disponivel';
}
