import eventData from './eventBankPlayer.json';
import type { PulseEventDef } from './types';
import { resolverImpactos } from './events';

type BankFile = {
  BANK: PulseEventDef[];
  IMPACTOS: Record<string, string[]>;
};

const bank = eventData as BankFile;

const BANK_PLAYER: PulseEventDef[] = bank.BANK.map(e => ({
  ...e,
  impactos: bank.IMPACTOS[e.id] || e.impactos || [],
}));

const byId = Object.fromEntries(BANK_PLAYER.map(e => [e.id, e]));

export function listarEventosPlayer(): PulseEventDef[] {
  return BANK_PLAYER.slice();
}

export function getEventByIdPlayer(id: string): PulseEventDef | null {
  return byId[id] || null;
}

export function filtrarPorCategoriaPlayer(categoria: string): PulseEventDef[] {
  return BANK_PLAYER.filter(e => e.categoria === categoria);
}

/** Todo evento pessoal pode sair no Pulse diário — sem variante de pré-partida ainda. */
export function eventTriggerPlayer(): 'any' {
  return 'any';
}

export { resolverImpactos as resolverImpactosPlayer };
export { BANK_PLAYER };

/** Rótulos de categoria em 1ª pessoa — "diretoria" no motor vira "técnico" na tela. */
export const CATEGORIA_LABELS_PLAYER: Record<string, string> = {
  atleta: 'Vida do atleta',
  diretoria: 'Técnico',
  torcida: 'Torcida',
  imprensa: 'Imprensa',
  lesao: 'Lesão',
  familia: 'Família',
  transferencia: 'Mercado',
  escandalo: 'Escândalo',
  nenhum: 'Nada',
};
