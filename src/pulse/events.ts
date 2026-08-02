import eventData from './eventBank.json';
import eventCustom from './eventBankCustom.json';
import type { PulseEventDef } from './types';
import { template } from './utils';

type BankFile = {
  BANK: PulseEventDef[];
  IMPACTOS: Record<string, string[]>;
};

const base = eventData as BankFile;
const custom = eventCustom as BankFile;

const IMPACTOS: Record<string, string[]> = {
  ...base.IMPACTOS,
  ...custom.IMPACTOS,
};

const mergedDefs = [...base.BANK, ...custom.BANK];
const seen = new Set<string>();
const BANK = mergedDefs
  .filter(e => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  })
  .map(e => ({
    ...e,
    impactos: IMPACTOS[e.id] || e.impactos || [],
  }));

const byId = Object.fromEntries(BANK.map(e => [e.id, e]));

/** IDs explicitamente só de pré-partida. */
const MATCH_ONLY_IDS = new Set([
  'tor_faixa_estadio',
  'tor_protesto_portao',
  'imp_escalacao_vazada',
  'imp_coletiva_prejogo',
]);

/**
 * Resolve se o evento pode sair em dia sem jogo.
 * `match_only` = exclusivo do Pulse de partida.
 */
export function eventTrigger(evento: PulseEventDef): 'any' | 'match_only' {
  if (evento.trigger === 'match_only' || evento.trigger === 'any') return evento.trigger;
  if (MATCH_ONLY_IDS.has(evento.id)) return 'match_only';
  const blob = `${evento.id} ${evento.titulo} ${evento.descricao ?? ''}`.toLowerCase();
  if (
    /warmup|pr[eé]-?jogo|vesti[aá]rio|aquecimento|advers[aá]rio|antes do (jogo|kick)|concentra[cç]|escala[cç][aã]o vazad|pr[eé][- ]jogo/.test(
      blob,
    )
  ) {
    return 'match_only';
  }
  return 'any';
}

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
  if (typeof efx.caixa === 'number' && efx.caixa !== 0) {
    const sign = efx.caixa > 0 ? '+' : '−';
    const abs = Math.abs(efx.caixa).toLocaleString('pt-BR');
    if (!joined.includes('caixa')) {
      list.push(`Caixa ${sign} R$ ${abs}`);
    }
  }
  if (
    typeof efx.moral === 'number' &&
    efx.moral !== 0 &&
    !joined.includes('moral') &&
    vars?.atleta &&
    vars.atleta !== 'um atleta'
  ) {
    list.push(
      efx.moral > 0
        ? template('Moral de {{atleta}} sobe', vars || {})
        : template('Moral de {{atleta}} cai', vars || {}),
    );
  }

  return list.filter(Boolean);
}

export { BANK, IMPACTOS };
