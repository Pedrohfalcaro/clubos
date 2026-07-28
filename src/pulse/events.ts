import eventData from './eventBank.json';
import type { PulseEventDef } from './types';
import { template } from './utils';

const BANK = (eventData.BANK as PulseEventDef[]).map(e => ({
  ...e,
  impactos: (eventData.IMPACTOS as Record<string, string[]>)[e.id] || e.impactos || [],
}));

const IMPACTOS = eventData.IMPACTOS as Record<string, string[]>;
const byId = Object.fromEntries(BANK.map(e => [e.id, e]));

export function listarEventos(): PulseEventDef[] {
  return BANK.slice();
}

export function getEventById(id: string): PulseEventDef | null {
  return byId[id] || null;
}

export function filtrarPorCategoria(categoria: string): PulseEventDef[] {
  return BANK.filter(e => e.categoria === categoria);
}

export function resolverImpactos(
  evento: PulseEventDef,
  vars: Record<string, string | number | null | undefined>,
): string[] {
  if (!evento) return [];
  const raw =
    evento.impactos && evento.impactos.length
      ? evento.impactos
      : IMPACTOS[evento.id] || [];
  const list = raw.map(t => template(t, vars || {}));

  const efx = evento.efeitos || {};
  const joined = list.join(' ').toLowerCase();
  if (
    efx.status === 'lesionado' &&
    !joined.includes('lesionado') &&
    !joined.includes('fora da partida')
  ) {
    list.push(template('{{atleta}} lesionado — fora da partida', vars || {}));
  }
  if (
    efx.status === 'indisponivel' &&
    !joined.includes('fora da partida') &&
    !joined.includes('indispon')
  ) {
    list.push(template('{{atleta}} indisponível para a partida', vars || {}));
  }

  return list.filter(Boolean);
}

export { BANK, IMPACTOS };
