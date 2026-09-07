import type { PressConferenceDeltas, PressContext } from '../types/PressConference';
import type { RecordAlert } from '../types/Records';
import { RECORD_METRIC_LABELS } from '../types/Records';
import type { SocialPost } from '../types/Social';
import { newSocialPost } from '../types/Social';
import { contextLabel } from './pressTriggers';

function moraleTone(total: number): string {
  if (total >= 6) return 'o clima ao redor do clube melhorou visivelmente após as respostas';
  if (total > 0) return 'a repercussão inicial foi positiva entre torcida e diretoria';
  if (total === 0) return 'a repercussão foi neutra — nem elogios, nem cobranças novas';
  if (total > -6) return 'as respostas não agradaram totalmente e deixaram um clima de cobrança';
  return 'o tom da entrevista irritou parte do ambiente e acendeu um alerta';
}

/**
 * Corpo de verdade para o post de coletiva — antes disso o ClubOSocial só mostrava os
 * deltas numéricos (ex.: "Torcida +3 · Elenco -2"). Reaproveita os `headlineHint` das
 * opções escolhidas (já variados e descritivos) em vez de inventar um banco de templates
 * do zero, seguindo o mesmo espírito de `socialHeadlines.ts`.
 */
export function buildPressConferenceBody(input: {
  context: PressContext;
  teamName: string;
  opponent?: string;
  summary: string[];
  deltas: PressConferenceDeltas;
  aggressiveCount: number;
  pressFriction: number;
}): string {
  const { context, teamName, opponent, summary, deltas, aggressiveCount, pressFriction } = input;
  const vs = opponent && context === 'pre_match' ? ` antes do duelo com o ${opponent}` : '';
  const intro = `Em coletiva de ${contextLabel(context)}${vs}, o comando do ${teamName} respondeu à imprensa e tocou em pontos que devem repercutir nos próximos dias.`;

  const highlights = summary.length
    ? summary.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('. ') + '.'
    : 'As respostas foram cautelosas, sem grandes declarações em nenhuma das perguntas.';

  const totalMorale = deltas.squadMorale + deltas.supporterConfidence + deltas.boardConfidence;
  const reaction =
    aggressiveCount > 0
      ? `O tom mais duro em ${aggressiveCount} resposta${aggressiveCount === 1 ? '' : 's'} gerou desconforto com parte da imprensa${
          pressFriction >= 60 ? ', que já vinha de atrito com o departamento de comunicação' : ''
        }.`
      : `De modo geral, ${moraleTone(totalMorale)}.`;

  return `${intro} ${highlights} ${reaction}`;
}

/** Manchete própria quando um jogador atual bate ou se aproxima de um recorde do clube. */
export function buildRecordHeadline(
  alert: RecordAlert,
  teamName: string,
  gameDate: string,
  matchId?: string,
): SocialPost {
  const metricLabel = RECORD_METRIC_LABELS[alert.metric].toLowerCase();
  const title = alert.isTop
    ? `${alert.playerName} é o novo dono do recorde de ${alert.tableName}`
    : `${alert.playerName} sobe ao ${alert.position}º lugar em ${alert.tableName}`;
  const body = alert.isTop
    ? `Com ${alert.value} ${metricLabel}, ${alert.playerName} ultrapassou a marca anterior e agora lidera sozinho a tabela de "${alert.tableName}" do ${teamName} — um novo capítulo na história do clube, construído partida após partida. A torcida já celebra o feito nas redes.`
    : `${alert.playerName} chegou aos ${alert.value} ${metricLabel} e subiu para a ${alert.position}ª posição na tabela de "${alert.tableName}" do ${teamName}, se aproximando cada vez mais do topo da lista.`;
  return newSocialPost({
    date: gameDate,
    type: 'headline',
    content: title,
    body,
    headlineStyle: alert.isTop ? 'sensational' : 'journalistic',
    author: 'Gazeta ClubOS',
    matchId,
    likes: 60 + Math.floor(Math.random() * 200),
  });
}
