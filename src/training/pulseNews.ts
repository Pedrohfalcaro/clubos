import type { PulseHistoryEntry } from '../pulse/types';
import type { TrainingSession, TrainingTeamKey } from '../types/Training';

/**
 * Treino aberto vira notícia no Pulse (Fase 9): a imprensa mostra as escalações do treino, os
 * destaques e quem decepcionou. A repercussão na moral dos destacados é calculada em
 * `applyTrainingEffects` (efeito amplificado quando o treino é aberto).
 */

function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : name;
}

function listTeam(session: TrainingSession, key: TrainingTeamKey, nameOf: (id: string) => string): string {
  const ids = [...session.teams[key].lineup.map(l => l.playerId), ...(session.teams[key].substitutes ?? [])];
  return ids.map(id => shortName(nameOf(id))).join(', ');
}

function performanceLine(session: TrainingSession, id: string): string {
  const st = session.playerStats[id];
  const parts: string[] = [`nota ${session.ratings[id].toFixed(1)}`];
  if (st?.goals) parts.push(`${st.goals} gol${st.goals > 1 ? 's' : ''}`);
  if (st?.assists) parts.push(`${st.assists} assistência${st.assists > 1 ? 's' : ''}`);
  if (st?.saves) parts.push(`${st.saves} defesa${st.saves > 1 ? 's' : ''}`);
  if (st?.clearances && st.clearances >= 3) parts.push(`${st.clearances} cortes`);
  if (st?.fouls && st.fouls >= 3) parts.push(`${st.fouls} faltas`);
  if (st?.reds) parts.push('expulso');
  return parts.join(', ');
}

function moraleImpact(session: TrainingSession, id: string, name: string): string[] {
  const d = session.moraleDelta[id];
  return d ? [`Moral de ${name} ${d > 0 ? '+' : ''}${d}`] : [];
}

/** Notícias do Pulse geradas por um treino aberto (da mais para a menos importante). */
export function buildTrainingPulse(
  session: TrainingSession,
  nameOf: (id: string) => string,
): PulseHistoryEntry[] {
  if (!session.open || session.placeholder) return [];
  const date = `${session.date.slice(0, 10)}T12:00:00`;
  const entries: PulseHistoryEntry[] = [];
  const base = {
    data: date,
    temporada: session.season,
    raridade: null,
    eventoId: null,
    cadeiaId: null,
    matchId: null,
  } as const;
  let n = 0;
  const nextId = () => `${session.id}-p${n++}`;

  const a = session.teams.a.name;
  const b = session.teams.b.name;
  const result =
    session.score.a === session.score.b
      ? `empate em ${session.score.a} a ${session.score.b}`
      : `${session.score.a > session.score.b ? a : b} venceu por ${Math.max(session.score.a, session.score.b)} a ${Math.min(session.score.a, session.score.b)}`;

  entries.push({
    ...base,
    id: nextId(),
    categoria: 'imprensa',
    titulo: `Treino aberto: ${a} x ${b} — ${result}`,
    descricao:
      `A imprensa acompanhou o treino e anotou as escalações. ` +
      `${a}: ${listTeam(session, 'a', nameOf)}. ` +
      `${b}: ${listTeam(session, 'b', nameOf)}.`,
    impactos: ['As escalações do treino ficaram públicas'],
    atletaId: null,
    atletaNome: null,
  });

  for (const id of session.highlights?.best ?? []) {
    const name = nameOf(id);
    entries.push({
      ...base,
      id: nextId(),
      categoria: 'atleta',
      titulo: `${name} é o destaque do treino aberto`,
      descricao: `${name} foi muito bem no treino aberto (${performanceLine(session, id)}) e saiu elogiado por quem assistiu.`,
      impactos: moraleImpact(session, id, name),
      atletaId: id,
      atletaNome: name,
    });
  }

  for (const id of session.highlights?.worst ?? []) {
    const name = nameOf(id);
    entries.push({
      ...base,
      id: nextId(),
      categoria: 'imprensa',
      titulo: `${name} decepciona no treino aberto`,
      descricao: `${name} teve um treino abaixo do esperado (${performanceLine(session, id)}) e virou assunto entre os presentes.`,
      impactos: moraleImpact(session, id, name),
      atletaId: id,
      atletaNome: name,
    });
  }

  return entries;
}
