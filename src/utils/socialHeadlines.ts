import type {
  CardEvent,
  GoalEvent,
  Match,
  MatchResult,
  MatchSignificance,
} from '../types/Match';
import { matchSignificanceLabel } from '../types/Match';
import { newSocialPost, type HeadlineStyle, type SocialPost } from '../types/Social';

export interface HeadlineMatchInput {
  id: string;
  opponent: string;
  competition: string;
  goalsFor: number;
  goalsAgainst: number;
  location: Match['location'];
  result: MatchResult;
  significance?: MatchSignificance;
  goals?: GoalEvent[];
  assists?: { playerName: string }[];
  cards?: CardEvent[];
  motmPlayerId?: string;
  motmName?: string;
}

/** Gatilhos narrativos — prioridade na seleção do template. */
export type HeadlineTag =
  | 'hat_trick'
  | 'thrashing'
  | 'humiliation'
  | 'late_win'
  | 'late_draw'
  | 'shutout'
  | 'brace'
  | 'red_card'
  | 'goalless'
  | 'generic_win'
  | 'generic_draw'
  | 'generic_loss';

const TAG_PRIORITY: HeadlineTag[] = [
  'hat_trick',
  'thrashing',
  'humiliation',
  'late_win',
  'late_draw',
  'shutout',
  'brace',
  'red_card',
  'goalless',
  'generic_win',
  'generic_draw',
  'generic_loss',
];

export const HEADLINE_STYLE_META: Record<
  HeadlineStyle,
  { label: string; author: string }
> = {
  journalistic: { label: 'Jornalística', author: 'Gazeta ClubOS' },
  analytical: { label: 'Analítica', author: 'Radar Tático' },
  sensational: { label: 'Sensacionalista', author: 'Meia-Noite Esportiva' },
  chronicle: { label: 'Crônica', author: 'Crônica da Arquibancada' },
  flash: { label: 'Flash', author: 'ClubOS Flash' },
};

interface Ctx {
  team: string;
  opp: string;
  gf: number;
  ga: number;
  score: string;
  scoreFlip: string;
  comp: string;
  homeAway: string;
  sig: MatchSignificance;
  sigLabel: string;
  sigHook: string;
  scorers: string;
  assists: string;
  yellows: number;
  reds: number;
  cardsLine: string;
  motm: string;
  margin: number;
  hatTrickName: string;
  braceName: string;
  lateMinute: number;
  lateScorer: string;
  tags: HeadlineTag[];
}

type Template = {
  id: string;
  style: HeadlineStyle;
  result: MatchResult;
  tag: HeadlineTag;
  title: (c: Ctx) => string;
  body: (c: Ctx) => string;
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function scoreLine(
  teamName: string,
  match: Pick<HeadlineMatchInput, 'opponent' | 'goalsFor' | 'goalsAgainst' | 'location'>,
): { score: string; scoreFlip: string } {
  const us = match.goalsFor;
  const them = match.goalsAgainst;
  if (match.location === 'away') {
    return {
      score: `${match.opponent} ${them}×${us} ${teamName}`,
      scoreFlip: `${teamName} ${us}×${them} ${match.opponent}`,
    };
  }
  return {
    score: `${teamName} ${us}×${them} ${match.opponent}`,
    scoreFlip: `${match.opponent} ${them}×${us} ${teamName}`,
  };
}

function significanceHook(sig: MatchSignificance, result: MatchResult): string {
  const map: Record<MatchSignificance, Record<MatchResult, string[]>> = {
    normal: {
      win: ['na rodada', 'no compromisso da semana'],
      draw: ['na rodada', 'no jogo do fim de semana'],
      loss: ['na rodada', 'no compromisso da semana'],
    },
    derby: {
      win: ['no clássico', 'no derby da cidade'],
      draw: ['no clássico', 'no derby'],
      loss: ['no clássico', 'diante do rival histórico'],
    },
    rivalry: {
      win: ['na rivalidade', 'no duelo de rivais'],
      draw: ['na rivalidade', 'no embate entre rivais'],
      loss: ['para o rival', 'na rivalidade'],
    },
    decisive: {
      win: ['em jogo decisivo', 'quando a temporada pedia resposta'],
      draw: ['em duelo decisivo', 'quando cada ponto pesava'],
      loss: ['em jogo decisivo', 'no compromisso que valia muito'],
    },
    title: {
      win: ['na disputa pelo título', 'com a taça no horizonte'],
      draw: ['na briga pelo título', 'no caminho da ponta'],
      loss: ['na luta pelo título', 'quando o sonho do título vacilou'],
    },
    relegation: {
      win: ['na luta contra o Z-4', 'em partida vital pela permanência'],
      draw: ['na batalha contra o rebaixamento', 'quando a permanência tremia'],
      loss: ['na luta contra o rebaixamento', 'em duelo de sobrevivência'],
    },
    cup_final: {
      win: ['na final', 'com a glória máxima em jogo'],
      draw: ['na final', 'no jogo que decide o campeão'],
      loss: ['na final', 'no maior duelo da temporada'],
    },
    debut: {
      win: ['na estreia', 'no batismo vitorioso'],
      draw: ['na estreia', 'no jogo de apresentação'],
      loss: ['na estreia', 'no batismo de fogo'],
    },
    revenge: {
      win: ['na revanche', 'no acerto de contas'],
      draw: ['na revanche', 'no reencontro'],
      loss: ['na revanche', 'quando a desforra não veio'],
    },
  };
  return pick(map[sig][result]);
}

function goalMinute(g: GoalEvent): number {
  return g.minute + (g.stoppage ?? 0) * 0.01;
}

function detectTags(match: HeadlineMatchInput, result: MatchResult): {
  tags: HeadlineTag[];
  hatTrickName: string;
  braceName: string;
  lateMinute: number;
  lateScorer: string;
} {
  const goals = (match.goals ?? []).filter(g => !g.isOwnGoal);
  const byPlayer = new Map<string, { name: string; count: number; lastMin: number }>();
  for (const g of goals) {
    const key = g.playerId || g.playerName;
    const prev = byPlayer.get(key) ?? { name: g.playerName, count: 0, lastMin: 0 };
    prev.count += 1;
    prev.lastMin = Math.max(prev.lastMin, Math.floor(goalMinute(g)));
    byPlayer.set(key, prev);
  }
  let hatTrickName = '';
  let braceName = '';
  for (const p of byPlayer.values()) {
    if (p.count >= 3 && !hatTrickName) hatTrickName = p.name;
    if (p.count === 2 && !braceName) braceName = p.name;
  }

  const lateGoals = goals.filter(g => g.minute >= 80);
  const lateGoal = lateGoals.sort((a, b) => goalMinute(b) - goalMinute(a))[0];
  const lateMinute = lateGoal ? lateGoal.minute : 0;
  const lateScorer = lateGoal?.playerName ?? '';

  const margin = Math.abs(match.goalsFor - match.goalsAgainst);
  const reds = (match.cards ?? []).filter(c => c.type === 'red').length;
  const tags: HeadlineTag[] = [];

  if (hatTrickName) tags.push('hat_trick');
  if (result === 'win' && margin >= 3) tags.push('thrashing');
  if (result === 'loss' && margin >= 3) tags.push('humiliation');
  if (result === 'win' && lateGoal && margin <= 2) tags.push('late_win');
  if (result === 'draw' && lateGoal) tags.push('late_draw');
  if (result === 'win' && match.goalsAgainst === 0) tags.push('shutout');
  if (braceName && !hatTrickName) tags.push('brace');
  if (reds > 0) tags.push('red_card');
  if (match.goalsFor === 0 && match.goalsAgainst === 0) tags.push('goalless');

  if (result === 'win') tags.push('generic_win');
  else if (result === 'draw') tags.push('generic_draw');
  else tags.push('generic_loss');

  return { tags, hatTrickName, braceName, lateMinute, lateScorer };
}

function buildCtx(
  teamName: string,
  match: HeadlineMatchInput,
  result: MatchResult,
): Ctx {
  const { score, scoreFlip } = scoreLine(teamName, match);
  const sig = match.significance ?? 'normal';
  const detected = detectTags(match, result);
  const scorers = [...new Set(
    (match.goals ?? []).filter(g => !g.isOwnGoal).map(g => g.playerName).filter(Boolean),
  )];
  const assists = [...new Set((match.assists ?? []).map(a => a.playerName).filter(Boolean))];
  const yellows = (match.cards ?? []).filter(c => c.type === 'yellow').length;
  const reds = (match.cards ?? []).filter(c => c.type === 'red').length;
  const cardBits: string[] = [];
  if (yellows) cardBits.push(`${yellows} amarelo${yellows > 1 ? 's' : ''}`);
  if (reds) cardBits.push(`${reds} vermelho${reds > 1 ? 's' : ''}`);

  return {
    team: teamName,
    opp: match.opponent,
    gf: match.goalsFor,
    ga: match.goalsAgainst,
    score,
    scoreFlip,
    comp: match.competition || 'campeonato',
    homeAway:
      match.location === 'home' ? 'em casa' : match.location === 'away' ? 'fora de casa' : 'em campo neutro',
    sig,
    sigLabel: matchSignificanceLabel(sig),
    sigHook: significanceHook(sig, result),
    scorers: scorers.length ? scorers.join(', ') : match.goalsFor > 0 ? 'o ataque' : 'ninguém',
    assists: assists.length ? assists.join(', ') : 'poucas ligações ofensivas',
    yellows,
    reds,
    cardsLine: cardBits.length ? cardBits.join(' e ') : 'sem cartões',
    motm: match.motmName?.trim() || 'o destaque da partida',
    margin: Math.abs(match.goalsFor - match.goalsAgainst),
    hatTrickName: detected.hatTrickName || 'o artilheiro',
    braceName: detected.braceName || 'o atacante',
    lateMinute: detected.lateMinute,
    lateScorer: detected.lateScorer || 'um finalizador',
    tags: detected.tags,
  };
}

function T(
  id: string,
  style: HeadlineStyle,
  result: MatchResult,
  tag: HeadlineTag,
  title: string | ((c: Ctx) => string),
  body: string | ((c: Ctx) => string),
): Template {
  return {
    id,
    style,
    result,
    tag,
    title: typeof title === 'string' ? () => title : title,
    body: typeof body === 'string' ? () => body : body,
  };
}

/** Banco completo de manchetes. */
export const HEADLINE_TEMPLATES: Template[] = [
  // ─── HAT-TRICK ─────────────────────────────────────────────────────────────
  T('ht_j1', 'journalistic', 'win', 'hat_trick',
    c => `${c.hatTrickName} faz hat-trick e ${c.team} vence ${c.opp}`,
    c => `${c.score} ${c.homeAway} pelo ${c.comp}. Três gols de ${c.hatTrickName} ${c.sigHook}. Assistências: ${c.assists}. Cartões: ${c.cardsLine}.`),
  T('ht_j2', 'journalistic', 'win', 'hat_trick',
    c => `Hat-trick histórico: ${c.hatTrickName} decide contra ${c.opp}`,
    c => `O ${c.team} venceu por ${c.gf}×${c.ga}. ${c.hatTrickName} balançou as redes três vezes. MOTM: ${c.motm}. Contexto: ${c.sigLabel}.`),
  T('ht_a1', 'analytical', 'win', 'hat_trick',
    c => `Box score: hat-trick de ${c.hatTrickName} (${c.gf}×${c.ga})`,
    c => `Participação ofensiva concentrada: 3 gols de ${c.hatTrickName}. Total do time: ${c.gf}. Defesa sofreu ${c.ga}. Disciplina ${c.yellows}A/${c.reds}V. Local: ${c.homeAway}.`),
  T('ht_a2', 'analytical', 'win', 'hat_trick',
    c => `Eficiência máxima: ${c.hatTrickName} com 3 gols`,
    c => `Vitória ${c.score}. Contribuição individual dominante de ${c.hatTrickName}. Assistências do elenco: ${c.assists}. Tipo de jogo: ${c.sigLabel}.`),
  T('ht_s1', 'sensational', 'win', 'hat_trick',
    c => `É DELE! ${c.hatTrickName} DESTROI o ${c.opp} com TRÊS GOLS`,
    c => `Que show! ${c.score} e hat-trick de cinema. O ${c.team} não tomou conhecimento ${c.sigHook}. Arquibancada em delírio com ${c.hatTrickName}.`),
  T('ht_s2', 'sensational', 'win', 'hat_trick',
    c => `HAT-TRICK MONSTRO de ${c.hatTrickName}!`,
    c => `${c.team} ${c.gf}×${c.ga} ${c.opp}. Três golaços, zero piedade. ${c.sig !== 'normal' ? `Em ${c.sigLabel.toLowerCase()}, o feito ganha proporção épica.` : 'Noite para entrar nos livros do clube.'}`),
  T('ht_c1', 'chronicle', 'win', 'hat_trick',
    c => `A noite em que ${c.hatTrickName} virou lenda`,
    c => `Havia pressão, havia ${c.sigLabel.toLowerCase()}, e havia um homem. ${c.hatTrickName} marcou três vezes; o placar ${c.score} ainda parece pouco para descrever o domínio.`),
  T('ht_c2', 'chronicle', 'win', 'hat_trick',
    c => `Três gestos, um destino: ${c.hatTrickName}`,
    c => `O ${c.comp} viu um hat-trick completo. Entre o primeiro e o terceiro gol, o ${c.opp} foi se desfazendo. Vitória do ${c.team} ${c.homeAway}.`),
  T('ht_f1', 'flash', 'win', 'hat_trick',
    c => `FLASH: hat-trick de ${c.hatTrickName} — ${c.score}`,
    c => `${c.team} vence ${c.opp}. Três gols: ${c.hatTrickName}. ${c.sigHook}.`),
  T('ht_f2', 'flash', 'win', 'hat_trick',
    c => `${c.hatTrickName} ⚽⚽⚽ | ${c.team} supera ${c.opp}`,
    c => `Placar ${c.gf}-${c.ga}. MOTM ${c.motm}. ${c.comp}.`),

  // ─── GOLEADA (thrashing) ───────────────────────────────────────────────────
  T('th_j1', 'journalistic', 'win', 'thrashing',
    c => `Goleada! ${c.score}`,
    c => `O ${c.team} massacrou o ${c.opp} ${c.sigHook} (${c.gf}×${c.ga}). Marcadores: ${c.scorers}. Margem de ${c.margin} gols ${c.homeAway}.`),
  T('th_j2', 'journalistic', 'win', 'thrashing',
    c => `${c.team} aplica ${c.gf}×${c.ga} no ${c.opp}`,
    c => `Partida pelo ${c.comp} virou monólogo. Assistências: ${c.assists}. Cartões: ${c.cardsLine}. Destaque: ${c.motm}.`),
  T('th_a1', 'analytical', 'win', 'thrashing',
    c => `Domínio numérico: +${c.margin} no placar`,
    c => `Goleada ${c.score}. Ataque: ${c.gf} gols (${c.scorers}). Defesa: só ${c.ga} sofrido(s). Eficiência ofensiva alta ${c.sigHook}.`),
  T('th_a2', 'analytical', 'win', 'thrashing',
    c => `Radar: goleada ${c.gf}-${c.ga} e controle total`,
    c => `Saldo +${c.margin}. Passes para gol: ${c.assists}. Disciplina ${c.yellows}A/${c.reds}V. Contexto ${c.sigLabel} não impediu o atropelo.`),
  T('th_s1', 'sensational', 'win', 'thrashing',
    c => `PASSEIO! ${c.team} HUMILHA ${c.opp} — ${c.score}`,
    c => `Foi chorume! ${c.margin} gols de diferença e festa total. ${c.scorers} brilharam. O rival não soube onde se meter.`),
  T('th_s2', 'sensational', 'win', 'thrashing',
    c => `OLÉ OLÉ! Goleada histórica ${c.gf} a ${c.ga}`,
    c => `${c.team} transformou o jogo em treino ${c.sigHook}. Arquibancada cantou até o fim. MOTM: ${c.motm}.`),
  T('th_c1', 'chronicle', 'win', 'thrashing',
    `Quando o placar virou poesia cruel`,
    c => `${c.score}. A cada gol, o ${c.opp} encolhia. O ${c.team} jogou com folga e elegância ${c.homeAway}, ${c.sigHook}.`),
  T('th_c2', 'chronicle', 'win', 'thrashing',
    c => `Um atropelo sem pressa: ${c.team} ${c.gf}×${c.ga}`,
    c => `Não foi só vitória — foi demonstração. Marcadores ${c.scorers} escreveram o roteiro do ${c.comp}.`),
  T('th_f1', 'flash', 'win', 'thrashing',
    c => `GOLEADA: ${c.score}`,
    c => `${c.team} massacra ${c.opp} por ${c.margin} gols. ${c.comp}.`),
  T('th_f2', 'flash', 'win', 'thrashing',
    c => `${c.gf}×${c.ga}! ${c.team} não toma conhecimento`,
    c => `Gols: ${c.scorers}. ${c.sigHook}.`),

  // ─── DERROTA HUMILHANTE ────────────────────────────────────────────────────
  T('hu_j1', 'journalistic', 'loss', 'humiliation',
    c => `Constrangimento: ${c.score}`,
    c => `O ${c.team} sofreu goleada do ${c.opp} ${c.sigHook}. Margem de ${c.margin} gols. ${c.gf > 0 ? `Descontos: ${c.scorers}.` : 'Ataque em branco.'} Cartões: ${c.cardsLine}.`),
  T('hu_j2', 'journalistic', 'loss', 'humiliation',
    c => `${c.team} leva ${c.ga}×${c.gf} e afunda ${c.homeAway}`,
    c => `Resultado duro no ${c.comp}. A defesa falhou de forma coletiva. Destaque solitário: ${c.motm}.`),
  T('hu_a1', 'analytical', 'loss', 'humiliation',
    c => `Colapso: saldo −${c.margin} frente ao ${c.opp}`,
    c => `Gols sofridos: ${c.ga}. Marcados: ${c.gf}. Assistências: ${c.assists}. Disciplina ${c.yellows}A/${c.reds}V. Indicadores todos no vermelho.`),
  T('hu_a2', 'analytical', 'loss', 'humiliation',
    c => `Radar da goleada sofrida (${c.score})`,
    c => `Diferença de ${c.margin} gols. ${c.reds > 0 ? `Expulsão(ões) agravaram o quadro.` : 'Mesmo em igualdade numérica, o abismo foi grande.'} Tipo: ${c.sigLabel}.`),
  T('hu_s1', 'sensational', 'loss', 'humiliation',
    c => `VERGONHA! ${c.opp} PASEIA sobre o ${c.team}`,
    c => `${c.score} e silêncio no vestiário. Foi humilhação pura ${c.sigHook}. Torcida cobra respostas.`),
  T('hu_s2', 'sensational', 'loss', 'humiliation',
    c => `PAPELÃO DE ${c.ga} A ${c.gf}!`,
    c => `O ${c.team} virou piada da rodada. ${c.margin} gols de diferença — números que doem. ${c.comp} não perdoa.`),
  T('hu_c1', 'chronicle', 'loss', 'humiliation',
    `A noite em que tudo desabou`,
    c => `Não houve resistência. O placar ${c.score} é cicatriz. ${c.homeAway}, ${c.sigHook}, o ${c.team} apenas observou o próprio naufrágio.`),
  T('hu_c2', 'chronicle', 'loss', 'humiliation',
    c => `Entre o apito e o abismo: ${c.ga}×${c.gf}`,
    c => `Cada gol adversário soou mais alto. Sobrou ${c.motm} tentando segurar as pontas. O ${c.comp} registra uma derrota para esquecer.`),
  T('hu_f1', 'flash', 'loss', 'humiliation',
    c => `GOLEADA SOFRIDA: ${c.score}`,
    c => `${c.team} cai por ${c.margin} gols ante ${c.opp}.`),
  T('hu_f2', 'flash', 'loss', 'humiliation',
    c => `Alerta: derrota humilhante ${c.ga}-${c.gf}`,
    c => `${c.sigHook}. ${c.comp}.`),

  // ─── VITÓRIA NO FIM ────────────────────────────────────────────────────────
  T('lw_j1', 'journalistic', 'win', 'late_win',
    c => `Nos acréscimos da emoção: ${c.team} vence no fim`,
    c => `Gol decisivo de ${c.lateScorer} aos ${c.lateMinute}'. Placar final ${c.score} ${c.sigHook}. Drama puro no ${c.comp}.`),
  T('lw_j2', 'journalistic', 'win', 'late_win',
    c => `${c.lateScorer} marca aos ${c.lateMinute}' e decide`,
    c => `Vitória sofrida do ${c.team} sobre o ${c.opp} (${c.gf}×${c.ga}). ${c.homeAway}. Cartões: ${c.cardsLine}.`),
  T('lw_a1', 'analytical', 'win', 'late_win',
    c => `Gol decisivo após os 80': ${c.lateMinute}'`,
    c => `Janela final definiu ${c.score}. Autor: ${c.lateScorer}. Volume total: ${c.gf} gols a favor, ${c.ga} contra. ${c.sigLabel}.`),
  T('lw_a2', 'analytical', 'win', 'late_win',
    c => `Clutch: vitória apertada ${c.gf}-${c.ga}`,
    c => `Margem ${c.margin}. Gol tardio de ${c.lateScorer}. Assistências na partida: ${c.assists}. MOTM: ${c.motm}.`),
  T('lw_s1', 'sensational', 'win', 'late_win',
    c => `LOUCURA NOS MINUTOS FINAIS! ${c.score}`,
    c => `${c.lateScorer} AOS ${c.lateMinute}'!!! O estádio explodiu. ${c.team} rouba a vitória do ${c.opp} ${c.sigHook}.`),
  T('lw_s2', 'sensational', 'win', 'late_win',
    c => `HERÓI DO FIM: ${c.lateScorer} (${c.lateMinute}')`,
    c => `Coração na boca até o apito. ${c.gf} a ${c.ga} e festa histérica. É disso que a torcida é feita!`),
  T('lw_c1', 'chronicle', 'win', 'late_win',
    c => `O tempo quase acabava — e então ${c.lateScorer}`,
    c => `Aos ${c.lateMinute}', o destino mudou de lado. ${c.score}. Há vitórias que valem uma temporada; esta chegou no último suspiro.`),
  T('lw_c2', 'chronicle', 'win', 'late_win',
    `Silêncio, disparo, delírio`,
    c => `O ${c.team} buscou até o fim. ${c.lateScorer} encontrou o gol salvador. O ${c.opp} não teve tempo de reagir.`),
  T('lw_f1', 'flash', 'win', 'late_win',
    c => `GOL NOS MINUTOS FINAIS! ${c.lateScorer} ${c.lateMinute}'`,
    c => `${c.team} ${c.gf}×${c.ga} ${c.opp}. Vitória tardia.`),
  T('lw_f2', 'flash', 'win', 'late_win',
    c => `Virada emocional: ${c.score} (decisão aos ${c.lateMinute}')`,
    c => `${c.sigHook}. ${c.comp}.`),

  // ─── EMPATE NO FIM ─────────────────────────────────────────────────────────
  T('ld_j1', 'journalistic', 'draw', 'late_draw',
    c => `Empate nos minutos finais: ${c.score}`,
    c => `${c.lateScorer} igualou aos ${c.lateMinute}'. ${c.team} e ${c.opp} dividem pontos ${c.sigHook} no ${c.comp}.`),
  T('ld_j2', 'journalistic', 'draw', 'late_draw',
    c => `Salvo pelo gongo: ${c.team} arranca empate`,
    c => `Gol aos ${c.lateMinute}' de ${c.lateScorer}. Placar ${c.gf}×${c.ga} ${c.homeAway}. Cartões: ${c.cardsLine}.`),
  T('ld_a1', 'analytical', 'draw', 'late_draw',
    c => `Equalizer late: minuto ${c.lateMinute}`,
    c => `Empate ${c.score}. Gol tardio de ${c.lateScorer} zerou a diferença. Assistências: ${c.assists}. Contexto ${c.sigLabel}.`),
  T('ld_a2', 'analytical', 'draw', 'late_draw',
    `Ponto conquistado após os 80'`,
    c => `Distribuição: ${c.gf}-${c.ga}. Autor do empate: ${c.lateScorer}. Disciplina ${c.yellows}A/${c.reds}V.`),
  T('ld_s1', 'sensational', 'draw', 'late_draw',
    c => `GRITO NO FIM! Empate aos ${c.lateMinute}'`,
    c => `${c.lateScorer} É O CARA! ${c.score} e êxtase. O ${c.opp} já comemorava cedo demais.`),
  T('ld_s2', 'sensational', 'draw', 'late_draw',
    c => `ROUBOU NO FIM! ${c.team} empata no dramalhão`,
    c => `Aos ${c.lateMinute}', tudo mudou. Um ponto que sabe a três ${c.sigHook}.`),
  T('ld_c1', 'chronicle', 'draw', 'late_draw',
    `O empate que chegou sussurrando — e depois gritou`,
    c => `${c.lateScorer}, minuto ${c.lateMinute}'. Há empates burocráticos e há este: ${c.score}, com alma de vitória.`),
  T('ld_c2', 'chronicle', 'draw', 'late_draw',
    `Último fôlego, mesmo placar`,
    c => `Quando restava quase nada, o ${c.team} encontrou o caminho. ${c.opp} engoliu o gol do empate em silêncio.`),
  T('ld_f1', 'flash', 'draw', 'late_draw',
    c => `EMPATE NO FIM: ${c.lateScorer} ${c.lateMinute}'`,
    c => `${c.score}. ${c.team} × ${c.opp}.`),
  T('ld_f2', 'flash', 'draw', 'late_draw',
    c => `Ponto de ouro aos ${c.lateMinute}' — ${c.score}`,
    c => `${c.sigHook}.`),

  // ─── CLEAN SHEET ───────────────────────────────────────────────────────────
  T('sh_j1', 'journalistic', 'win', 'shutout',
    c => `Vitória e defesa de ferro: ${c.score}`,
    c => `${c.team} venceu ${c.opp} sem sofrer gols ${c.sigHook}. Marcadores: ${c.scorers}. ${c.homeAway}, pelo ${c.comp}.`),
  T('sh_j2', 'journalistic', 'win', 'shutout',
    c => `Clean sheet e três pontos para o ${c.team}`,
    c => `Placar ${c.gf}×0. Assistências: ${c.assists}. Destaque: ${c.motm}. Cartões: ${c.cardsLine}.`),
  T('sh_a1', 'analytical', 'win', 'shutout',
    c => `Defesa a zero + ${c.gf} gols = eficiência`,
    c => `GA=0. GF=${c.gf}. Shutout completo ${c.homeAway}. Participações: ${c.scorers}.`),
  T('sh_a2', 'analytical', 'win', 'shutout',
    `Radar: solidez defensiva decide`,
    c => `${c.score}. Nenhuma bola na rede. Disciplina ${c.yellows}A/${c.reds}V. ${c.sigLabel}.`),
  T('sh_s1', 'sensational', 'win', 'shutout',
    c => `CADEADO! ${c.team} zera e vence`,
    c => `Não passou nada! ${c.gf} a 0 no ${c.opp}. Muralha total ${c.sigHook}.`),
  T('sh_s2', 'sensational', 'win', 'shutout',
    c => `ZERO NO PLACAR ADVERSÁRIO — festa ${c.gf}×0`,
    c => `Ataque fez a parte (${c.scorers}) e a zaga não vacilou.`),
  T('sh_c1', 'chronicle', 'win', 'shutout',
    `A beleza de não ser vazado`,
    c => `Enquanto ${c.scorers} resolviam à frente, atrás reinava a ordem. ${c.score}. Vitória limpa.`),
  T('sh_f1', 'flash', 'win', 'shutout',
    c => `Clean sheet: ${c.score}`,
    c => `${c.team} vence sem sofrer gols.`),
  T('sh_f2', 'flash', 'win', 'shutout',
    c => `${c.gf}×0 — defesa impecável`,
    c => `${c.opp} em branco. ${c.comp}.`),

  // ─── BRACE (dois gols) ─────────────────────────────────────────────────────
  T('br_j1', 'journalistic', 'win', 'brace',
    c => `${c.braceName} marca dois e ${c.team} vence`,
    c => `Dobradinha de ${c.braceName} na vitória por ${c.gf}×${c.ga} sobre o ${c.opp} ${c.sigHook}.`),
  T('br_j2', 'journalistic', 'win', 'brace',
    c => `Dois gols de ${c.braceName}: ${c.score}`,
    c => `O atacante foi decisivo no ${c.comp}. Assistências: ${c.assists}. MOTM: ${c.motm}.`),
  T('br_a1', 'analytical', 'win', 'brace',
    c => `Brace de ${c.braceName} no box score`,
    c => `2 gols individuais / ${c.gf} do time. Placar ${c.score}. Contribuição: 67%+ da produção se gf≤3.`),
  T('br_s1', 'sensational', 'win', 'brace',
    c => `${c.braceName} FEZ DOIS! ${c.team} sobe o tom`,
    c => `Dupla dos sonhos num homem só. ${c.gf} a ${c.ga} e festa.`),
  T('br_c1', 'chronicle', 'win', 'brace',
    c => `Duas assinaturas de ${c.braceName}`,
    c => `Bastaram dois gestos para inclinar a noite. O ${c.team} venceu ${c.homeAway}: ${c.score}.`),
  T('br_f1', 'flash', 'win', 'brace',
    c => `${c.braceName} ⚽⚽ | ${c.score}`,
    c => `Vitória do ${c.team}.`),
  T('br_a2', 'analytical', 'draw', 'brace',
    c => `Brace de ${c.braceName} não basta — empate`,
    c => `${c.braceName} marcou duas vezes, mas o placar fechou ${c.gf}×${c.ga}. ${c.sigHook}.`),
  T('br_j3', 'journalistic', 'draw', 'brace',
    c => `${c.braceName} faz dois; ${c.team} só empata`,
    c => `Individualidade brilhante, resultado dividido: ${c.score}.`),
  T('br_s2', 'sensational', 'draw', 'brace',
    c => `${c.braceName} FEZ DOIS E NÃO GANHOU!`,
    c => `Hat-trick ficou perto, vitória ficou longe. Empate ${c.score} — revolta no fim.`),
  T('br_c2', 'chronicle', 'draw', 'brace',
    c => `Dois gols de ${c.braceName}, um ponto só`,
    c => `A noite pediu herói e ele apareceu — mas o placar pediu equilíbrio. ${c.score}.`),
  T('br_f2', 'flash', 'draw', 'brace',
    c => `${c.braceName} ⚽⚽ — empate ${c.score}`,
    c => `Dobradinha sem vitória. ${c.sigHook}.`),
  T('br_s3', 'sensational', 'win', 'brace',
    c => `DUPLO GOL DE ${c.braceName.toUpperCase()}!`,
    c => `${c.score} e o nome da noite é um só. ${c.team} vence ${c.sigHook}.`),
  T('br_c3', 'chronicle', 'win', 'brace',
    c => `${c.braceName}, duas vezes o mesmo destino`,
    c => `Repetiu o gesto, repetiu o impacto. Vitória ${c.homeAway}: ${c.score}.`),
  T('br_f3', 'flash', 'win', 'brace',
    c => `Brace! ${c.braceName} decide ${c.gf}-${c.ga}`,
    c => `${c.team} vence ${c.opp}. ${c.comp}.`),

  // ─── CARTÃO VERMELHO ───────────────────────────────────────────────────────
  T('rd_j1', 'journalistic', 'win', 'red_card',
    `Com um a menos? Não — vitória mesmo com vermelho`,
    c => `${c.team} venceu ${c.opp} (${c.score}) apesar de ${c.reds} expulsão(ões). ${c.cardsLine}. ${c.sigHook}.`),
  T('rd_j2', 'journalistic', 'loss', 'red_card',
    c => `Vermelho pesa e ${c.team} cai`,
    c => `Derrota ${c.score}. Expulsões: ${c.reds}. O desfalque numérico doeu ${c.homeAway}.`),
  T('rd_j3', 'journalistic', 'draw', 'red_card',
    c => `Jogo quente: vermelho e empate ${c.score}`,
    c => `Disciplina abalada (${c.cardsLine}). Ponto dividido no ${c.comp}.`),
  T('rd_j4', 'journalistic', 'win', 'red_card',
    c => `${c.team} resiste após expulsão e vence`,
    c => `${c.reds} vermelho(s) no caminho — mesmo assim ${c.score}. Gols: ${c.scorers}.`),
  T('rd_j5', 'journalistic', 'loss', 'red_card',
    c => `Inferioridade numérica e derrota ${c.score}`,
    c => `O cartão vermelho mudou o jogo. ${c.opp} aproveitou. ${c.sigHook}.`),
  T('rd_j6', 'journalistic', 'draw', 'red_card',
    `Após o vermelho, o empate foi o possível`,
    c => `${c.score}. Com ${c.reds} expulsão(ões), segurar o ponto teve mérito.`),
  T('rd_a1', 'analytical', 'win', 'red_card',
    c => `Vitória sob inferioridade/disciplina (${c.reds}V)`,
    c => `Placar ${c.gf}-${c.ga}. Amarelos ${c.yellows}. Contexto disciplinar alterou o desenho tático.`),
  T('rd_a2', 'analytical', 'loss', 'red_card',
    c => `Derrota correlacionada a ${c.reds} vermelho(s)`,
    c => `${c.score}. Com um a menos, os números desceram: GF ${c.gf} / GA ${c.ga}.`),
  T('rd_a3', 'analytical', 'draw', 'red_card',
    c => `Empate com fator disciplinar (${c.reds}V)`,
    c => `Box score ${c.gf}-${c.ga}. Amarelos ${c.yellows}. O vermelho comprimiu espaços e chances.`),
  T('rd_a4', 'analytical', 'win', 'red_card',
    c => `Resiliência numérica: win apesar de ${c.reds}V`,
    c => `Vitória ${c.score}. Taxa de conversão manteve-se sob estresse disciplinar.`),
  T('rd_s1', 'sensational', 'loss', 'red_card',
    c => `EXPULSO E DERROTADO! ${c.score}`,
    c => `Vermelho, confusão e derrota. O ${c.team} se complicou sozinho ${c.sigHook}.`),
  T('rd_s2', 'sensational', 'win', 'red_card',
    `VENCEU NO CAOS! Vermelho e vitória`,
    c => `Teve expulsão, teve drama, teve triunfo: ${c.score}. Sangue nos olhos!`),
  T('rd_s3', 'sensational', 'draw', 'red_card',
    `VERMELHO, BRIGA E EMPATE!`,
    c => `${c.score} depois da expulsão. Estádio pegando fogo.`),
  T('rd_s4', 'sensational', 'loss', 'red_card',
    `SE FODEU SOZINHO: vermelho e tombo`,
    c => `${c.cardsLine}. Placar ${c.score}. Evitável? A torcida acha que sim.`),
  T('rd_c1', 'chronicle', 'draw', 'red_card',
    `O cartão que mudou o silêncio do estádio`,
    c => `Depois do vermelho, o jogo virou outro. Empate ${c.score} — justo para o nervosismo que restou.`),
  T('rd_c2', 'chronicle', 'win', 'red_card',
    `Dez em campo, onze no caráter`,
    c => `Expulsão no caminho, vitória no fim: ${c.score}. O ${c.team} aprendeu a sofrer com propósito.`),
  T('rd_c3', 'chronicle', 'loss', 'red_card',
    `O vermelho abriu a porta — o placar entrou`,
    c => `Derrota ${c.score}. Há derrotas táticas e há derrotas disciplinares. Esta misturou as duas.`),
  T('rd_f1', 'flash', 'win', 'red_card',
    c => `Vitória com ${c.reds} vermelho(s): ${c.score}`,
    c => `${c.team} supera ${c.opp}.`),
  T('rd_f2', 'flash', 'loss', 'red_card',
    c => `Vermelho + derrota: ${c.score}`,
    c => `${c.cardsLine}.`),
  T('rd_f3', 'flash', 'draw', 'red_card',
    c => `Vermelho e empate ${c.score}`,
    c => `${c.reds}V no jogo. ${c.sigHook}.`),
  T('rd_f4', 'flash', 'win', 'red_card',
    c => `${c.score} | resistiu com expulsão`,
    c => `${c.team} vence mesmo assim.`),

  // ─── 0×0 ───────────────────────────────────────────────────────────────────
  T('nl_j1', 'journalistic', 'draw', 'goalless',
    c => `0×0: ${c.team} e ${c.opp} sem gols`,
    c => `Empate sem emoção no placar ${c.sigHook}. Cartões: ${c.cardsLine}. ${c.comp}.`),
  T('nl_j2', 'journalistic', 'draw', 'goalless',
    c => `Trava ofensiva: nulo ${c.homeAway}`,
    c => `Nenhuma rede balançou. Ponto cada. Destaque defensivo: ${c.motm}.`),
  T('nl_a1', 'analytical', 'draw', 'goalless',
    `xG implícito baixo: 0-0 fechado`,
    c => `GF=0 GA=0. Disciplina ${c.yellows}A/${c.reds}V. Jogo travado no ${c.comp}.`),
  T('nl_s1', 'sensational', 'draw', 'goalless',
    `TÉDIO! 0 a 0 e torcida vai embora cedo`,
    c => `Ninguém marcou. ${c.team} × ${c.opp} — noite para esquecer.`),
  T('nl_c1', 'chronicle', 'draw', 'goalless',
    `O placar que recusou a poesia`,
    c => `Havia tensão de ${c.sigLabel.toLowerCase()}, mas faltou o gol. 0×0 — ponto burocrático.`),
  T('nl_f1', 'flash', 'draw', 'goalless',
    `Fim: 0×0`,
    c => `${c.team} empata com ${c.opp} sem gols.`),
  T('nl_a2', 'analytical', 'draw', 'goalless',
    `Clean sheet mútuo — 1 ponto`,
    c => `Ambas as defesas venceram o duelo. Ataques: zero. ${c.sigHook}.`),
  T('nl_s2', 'sensational', 'draw', 'goalless',
    `TRAVOU TUDO! Nem cheiro de gol`,
    `0 a 0 ríspido. Próximo jogo precisa de mais fogo.`),

  // ─── GENERIC WIN (por estilo) ──────────────────────────────────────────────
  T('gw_j1', 'journalistic', 'win', 'generic_win',
    c => `${c.team} vence ${c.opp}: ${c.score}`,
    c => `Triunfo ${c.homeAway} pelo ${c.comp} ${c.sigHook}. Gols: ${c.scorers}. Assistências: ${c.assists}. Cartões: ${c.cardsLine}. MOTM: ${c.motm}.`),
  T('gw_j2', 'journalistic', 'win', 'generic_win',
    c => `Três pontos na conta do ${c.team}`,
    c => `${c.score}. Marcadores ${c.scorers}. O resultado reforça a campanha ${c.sigHook}.`),
  T('gw_j3', 'journalistic', 'win', 'generic_win',
    c => `${c.team} supera ${c.opp} ${c.homeAway}`,
    c => `Placar ${c.gf}×${c.ga} no ${c.comp}. Destaque para ${c.motm}. Disciplina: ${c.cardsLine}.`),
  T('gw_j4', 'journalistic', 'win', 'generic_win',
    c => `Vitória trabalhosa: ${c.score}`,
    c => `Não foi fácil, mas o ${c.team} levou. Gols de ${c.scorers}. Contexto: ${c.sigLabel}.`),
  T('gw_j5', 'journalistic', 'win', 'generic_win',
    c => `${c.sigLabel}: ${c.team} leva a melhor`,
    c => `Em jogo de ${c.sigLabel.toLowerCase()}, vitória por ${c.gf}×${c.ga}. Assistências: ${c.assists}.`),
  T('gw_j6', 'journalistic', 'win', 'generic_win',
    c => `Bom resultado contra o ${c.opp}`,
    c => `${c.score} ${c.sigHook}. A torcida comemora os três pontos.`),
  T('gw_a1', 'analytical', 'win', 'generic_win',
    c => `Radar: vitória ${c.gf}-${c.ga} e saldo +${c.margin}`,
    c => `Box score — gols: ${c.scorers}; assists: ${c.assists}; cartões ${c.yellows}A/${c.reds}V. Local ${c.homeAway}. ${c.sigLabel}.`),
  T('gw_a2', 'analytical', 'win', 'generic_win',
    c => `Eficiência: ${c.team} converte e fecha ${c.score}`,
    c => `Produção ofensiva ${c.gf}. Defesa sofreu ${c.ga}. MOTM estatístico: ${c.motm}.`),
  T('gw_a3', 'analytical', 'win', 'generic_win',
    c => `Indicadores positivos na vitória sobre ${c.opp}`,
    c => `Margem ${c.margin}. Participações ofensivas distribuídas (${c.scorers}). Competição: ${c.comp}.`),
  T('gw_a4', 'analytical', 'win', 'generic_win',
    c => `Leitura tática: controle e ${c.gf} gols`,
    c => `${c.score}. Assistências ${c.assists}. Disciplina estável o bastante para segurar o resultado.`),
  T('gw_a5', 'analytical', 'win', 'generic_win',
    c => `Plus/minus +${c.margin} ${c.sigHook}`,
    c => `Vitória quantificada. GF/GA = ${c.gf}/${c.ga}. Destaque: ${c.motm}.`),
  T('gw_s1', 'sensational', 'win', 'generic_win',
    c => `VENCEU! ${c.team} DERRUBA ${c.opp}`,
    c => `${c.score} e gritaria! ${c.scorers} na área. É TERÇA/SÁBADO de festa — escolha a sua.`),
  T('gw_s2', 'sensational', 'win', 'generic_win',
    c => `TRIUNFO GOSTOSO: ${c.score}`,
    c => `O ${c.opp} engoliu poeira. ${c.team} joga pra ganhar ${c.sigHook}!`),
  T('gw_s3', 'sensational', 'win', 'generic_win',
    c => `É TEU, ${c.team.toUpperCase()}! Três pontos`,
    c => `Placar ${c.gf} a ${c.ga}. MOTM ${c.motm} arrasou. Torcida em êxtase.`),
  T('gw_s4', 'sensational', 'win', 'generic_win',
    c => `MAIS UMA! ${c.team} não para`,
    c => `Vitória ${c.homeAway} no ${c.comp}. Alguém segura esse time?`),
  T('gw_s5', 'sensational', 'win', 'generic_win',
    c => `SHOW DE BOLA: ${c.score}`,
    c => `Gols de ${c.scorers} e alegria total ${c.sigHook}.`),
  T('gw_c1', 'chronicle', 'win', 'generic_win',
    `A vitória tinha cheiro de alívio`,
    c => `${c.score}. Entre erros e acertos, o ${c.team} encontrou o caminho ${c.homeAway}. ${c.motm} puxou a fila.`),
  T('gw_c2', 'chronicle', 'win', 'generic_win',
    `Três pontos e uma narrativa melhor`,
    c => `Não foi obra-prima, foi ofício. Gols de ${c.scorers}. O ${c.comp} segue, agora mais leve.`),
  T('gw_c3', 'chronicle', 'win', 'generic_win',
    c => `Sob o peso de ${c.sigLabel.toLowerCase()}, o ${c.team} respondeu`,
    c => `Vencer ${c.opp} por ${c.gf}×${c.ga} renovou a fé. Assistências: ${c.assists}.`),
  T('gw_c4', 'chronicle', 'win', 'generic_win',
    `O apito final soou como celebração`,
    c => `${c.score}. Há vitórias que emolduram a semana — esta é uma delas.`),
  T('gw_f1', 'flash', 'win', 'generic_win',
    c => `FIM: ${c.score}`,
    c => `${c.team} vence. Gols: ${c.scorers}.`),
  T('gw_f2', 'flash', 'win', 'generic_win',
    c => `Vitória ${c.gf}-${c.ga} | ${c.team}`,
    c => `${c.opp} derrotado. ${c.sigHook}.`),
  T('gw_f3', 'flash', 'win', 'generic_win',
    c => `${c.team} ✔️ ${c.opp} | ${c.score}`,
    c => `MOTM: ${c.motm}. ${c.comp}.`),
  T('gw_f4', 'flash', 'win', 'generic_win',
    c => `3 pontos! ${c.score}`,
    c => `${c.homeAway}. Cartões: ${c.cardsLine}.`),
  T('gw_f5', 'flash', 'win', 'generic_win',
    c => `Resultado: vitória do ${c.team}`,
    c => `${c.gf}×${c.ga} contra ${c.opp}.`),

  // ─── GENERIC DRAW ──────────────────────────────────────────────────────────
  T('gd_j1', 'journalistic', 'draw', 'generic_draw',
    c => `Empate: ${c.score}`,
    c => `${c.team} e ${c.opp} ficam iguais ${c.sigHook}. Gols do time: ${c.scorers}. Cartões: ${c.cardsLine}.`),
  T('gd_j2', 'journalistic', 'draw', 'generic_draw',
    c => `${c.team} divide pontos com ${c.opp}`,
    c => `Placar ${c.gf}×${c.ga} ${c.homeAway} no ${c.comp}. Assistências: ${c.assists}.`),
  T('gd_j3', 'journalistic', 'draw', 'generic_draw',
    c => `Um ponto cada em ${c.sigLabel.toLowerCase()}`,
    c => `${c.score}. Destaque: ${c.motm}. Resultado que pede leituras distintas.`),
  T('gd_j4', 'journalistic', 'draw', 'generic_draw',
    c => `Empate justo no ${c.comp}`,
    c => `${c.team} ${c.gf}×${c.ga} ${c.opp}. Disciplina: ${c.cardsLine}.`),
  T('gd_j5', 'journalistic', 'draw', 'generic_draw',
    c => `Sem vencedor: ${c.score}`,
    c => `O duelo ${c.sigHook} terminou equilibrado.`),
  T('gd_a1', 'analytical', 'draw', 'generic_draw',
    c => `Radar: empate ${c.gf}-${c.ga} (saldo 0)`,
    c => `Gols: ${c.scorers}. Assists: ${c.assists}. Cartões ${c.yellows}A/${c.reds}V. ${c.sigLabel}.`),
  T('gd_a2', 'analytical', 'draw', 'generic_draw',
    c => `Equilíbrio estatístico em ${c.score}`,
    c => `Nenhum lado quebrou o jogo. MOTM: ${c.motm}. Local: ${c.homeAway}.`),
  T('gd_a3', 'analytical', 'draw', 'generic_draw',
    `1 ponto — leitura neutra da rodada`,
    c => `GF/GA ${c.gf}/${c.ga}. Competição ${c.comp}.`),
  T('gd_a4', 'analytical', 'draw', 'generic_draw',
    c => `Box score empatado frente ao ${c.opp}`,
    c => `Distribuição ofensiva: ${c.scorers || 'nenhum gol'}. ${c.sigHook}.`),
  T('gd_s1', 'sensational', 'draw', 'generic_draw',
    c => `DEIXOU ESCAPAR? Empate ${c.score}`,
    `Podia ser mais — ficou no meio. Torcida mista no fim.`),
  T('gd_s2', 'sensational', 'draw', 'generic_draw',
    c => `AGARRADO! ${c.team} não vence o ${c.opp}`,
    c => `${c.gf} a ${c.ga} e ponto único. Queria três!`),
  T('gd_s3', 'sensational', 'draw', 'generic_draw',
    `EMPATE COM GOSTO AMARGO`,
    c => `${c.score} ${c.sigHook}. Próximo tem que ser vitória.`),
  T('gd_s4', 'sensational', 'draw', 'generic_draw',
    c => `TÁ BOM PRA QUEM? ${c.score}`,
    `Cada lado puxa a corda. Placar dividido.`),
  T('gd_c1', 'chronicle', 'draw', 'generic_draw',
    `O meio-termo que ninguém pediu — e todos aceitaram`,
    c => `${c.score}. Havia espaço para ousadia; sobrou cálculo. Um ponto ${c.homeAway}.`),
  T('gd_c2', 'chronicle', 'draw', 'generic_draw',
    `Empate com aroma de oportunidade perdida`,
    c => `O ${c.team} saiu com a sensação de que poderia ter sido seu. ${c.opp} pensa o mesmo.`),
  T('gd_c3', 'chronicle', 'draw', 'generic_draw',
    c => `Sob ${c.sigLabel.toLowerCase()}, o placar pediu calma`,
    c => `${c.gf}×${c.ga}. Às vezes empatar é sobreviver com elegância.`),
  T('gd_f1', 'flash', 'draw', 'generic_draw',
    c => `Empate ${c.score}`,
    c => `${c.team} × ${c.opp}.`),
  T('gd_f2', 'flash', 'draw', 'generic_draw',
    c => `Fim: ${c.gf}-${c.ga}`,
    c => `Ponto dividido. ${c.sigHook}.`),
  T('gd_f3', 'flash', 'draw', 'generic_draw',
    c => `${c.team} empata com ${c.opp}`,
    c => `${c.comp}. MOTM ${c.motm}.`),
  T('gd_f4', 'flash', 'draw', 'generic_draw',
    c => `1-1 na prática: ${c.score}`,
    c => `Cartões: ${c.cardsLine}.`),

  // ─── GENERIC LOSS ──────────────────────────────────────────────────────────
  T('gl_j1', 'journalistic', 'loss', 'generic_loss',
    c => `Derrota: ${c.score}`,
    c => `O ${c.team} caiu ante o ${c.opp} ${c.sigHook}. ${c.gf > 0 ? `Gols: ${c.scorers}.` : 'Ataque sem gols.'} Cartões: ${c.cardsLine}.`),
  T('gl_j2', 'journalistic', 'loss', 'generic_loss',
    c => `${c.team} sofre revés contra ${c.opp}`,
    c => `Placar ${c.score} ${c.homeAway} no ${c.comp}. MOTM: ${c.motm}.`),
  T('gl_j3', 'journalistic', 'loss', 'generic_loss',
    c => `Tropeço ${c.homeAway}: ${c.gf}×${c.ga}`,
    c => `Derrota em jogo de ${c.sigLabel.toLowerCase()}. Assistências: ${c.assists}.`),
  T('gl_j4', 'journalistic', 'loss', 'generic_loss',
    c => `${c.opp} leva a melhor sobre o ${c.team}`,
    c => `${c.score}. Hora de analisar e corrigir para a próxima.`),
  T('gl_j5', 'journalistic', 'loss', 'generic_loss',
    c => `Dia difícil no ${c.comp}`,
    c => `${c.team} sai derrotado. Destaque individual: ${c.motm}.`),
  T('gl_a1', 'analytical', 'loss', 'generic_loss',
    c => `Radar: derrota ${c.gf}-${c.ga} (saldo −${c.margin})`,
    c => `Gols pró ${c.scorers}. Assists ${c.assists}. Cartões ${c.yellows}A/${c.reds}V. ${c.sigLabel}.`),
  T('gl_a2', 'analytical', 'loss', 'generic_loss',
    c => `Indicadores negativos frente ao ${c.opp}`,
    c => `GA ${c.ga} > GF ${c.gf}. Local ${c.homeAway}. MOTM: ${c.motm}.`),
  T('gl_a3', 'analytical', 'loss', 'generic_loss',
    c => `Leitura: desvantagem de ${c.margin} gol(s)`,
    c => `${c.score}. Produção ofensiva insuficiente para o ponto.`),
  T('gl_a4', 'analytical', 'loss', 'generic_loss',
    c => `Plus/minus −${c.margin} ${c.sigHook}`,
    c => `Derrota quantificada no ${c.comp}. Disciplina: ${c.cardsLine}.`),
  T('gl_a5', 'analytical', 'loss', 'generic_loss',
    c => `Box score da derrota: ${c.score}`,
    c => `Participações: ${c.scorers || 'nenhuma'}. Próximo compromisso precisa de ajuste.`),
  T('gl_s1', 'sensational', 'loss', 'generic_loss',
    c => `PERDEU! ${c.team} FRACASSA contra ${c.opp}`,
    c => `${c.score} e humilhação moral. Torcida não perdoa.`),
  T('gl_s2', 'sensational', 'loss', 'generic_loss',
    c => `QUE FASE! Derrota ${c.ga} a ${c.gf}`,
    c => `O ${c.opp} fez a festa. ${c.team} some no segundo tempo — ou no primeiro.`),
  T('gl_s3', 'sensational', 'loss', 'generic_loss',
    c => `APITO FINAL E REVOLTA: ${c.score}`,
    c => `Mais uma que dói. ${c.sigHook}. Cobrança vem aí.`),
  T('gl_s4', 'sensational', 'loss', 'generic_loss',
    c => `NÃO DEU! ${c.team} deixa escapar`,
    c => `Derrota amarga ${c.homeAway}. Alguém tem que explicar.`),
  T('gl_s5', 'sensational', 'loss', 'generic_loss',
    c => `TOMBO NA RODADA: ${c.score}`,
    c => `${c.opp} agradece. ${c.comp} segue cruel.`),
  T('gl_c1', 'chronicle', 'loss', 'generic_loss',
    `A derrota veio sem pedir licença`,
    c => `${c.score}. O ${c.team} buscou, errou, e pagou. Há noites assim no futebol.`),
  T('gl_c2', 'chronicle', 'loss', 'generic_loss',
    `Quando o plano não encontra o gol`,
    c => `Diante do ${c.opp}, faltou precisão. Sobrou ${c.motm} tentando segurar o símbolo.`),
  T('gl_c3', 'chronicle', 'loss', 'generic_loss',
    c => `Sob ${c.sigLabel.toLowerCase()}, o tropeço dói mais`,
    c => `${c.gf}×${c.ga}. A temporada pede resiliência — e memória curta.`),
  T('gl_c4', 'chronicle', 'loss', 'generic_loss',
    `O estádio esvaziou mais cedo por dentro`,
    c => `Derrota ${c.homeAway}. Placar ${c.score}. Silêncio no caminho do ônibus.`),
  T('gl_f1', 'flash', 'loss', 'generic_loss',
    c => `FIM: ${c.score}`,
    c => `${c.team} perde para ${c.opp}.`),
  T('gl_f2', 'flash', 'loss', 'generic_loss',
    c => `Derrota ${c.gf}-${c.ga}`,
    c => `${c.sigHook}. ${c.comp}.`),
  T('gl_f3', 'flash', 'loss', 'generic_loss',
    c => `${c.opp} vence | ${c.score}`,
    c => `MOTM do ${c.team}: ${c.motm}.`),
  T('gl_f4', 'flash', 'loss', 'generic_loss',
    c => `Resultado negativo: ${c.score}`,
    c => `Cartões: ${c.cardsLine}.`),
  T('gl_f5', 'flash', 'loss', 'generic_loss',
    c => `${c.team} cai diante de ${c.opp}`,
    c => `${c.ga}×${c.gf} no marcador adversário.`),
];

function selectPrimaryTag(tags: HeadlineTag[]): HeadlineTag {
  for (const tag of TAG_PRIORITY) {
    if (tags.includes(tag) && !tag.startsWith('generic_')) return tag;
  }
  if (tags.includes('generic_win')) return 'generic_win';
  if (tags.includes('generic_draw')) return 'generic_draw';
  return 'generic_loss';
}

export function buildMatchHeadline(input: {
  match: HeadlineMatchInput;
  teamName: string;
  gameDate: string;
  result: MatchResult;
  style?: HeadlineStyle;
}): SocialPost {
  const { match, teamName, gameDate, result } = input;
  const ctx = buildCtx(teamName, match, result);
  const primary = selectPrimaryTag(ctx.tags);

  let pool = HEADLINE_TEMPLATES.filter(t => t.result === result && t.tag === primary);
  if (pool.length === 0) {
    const fallback =
      result === 'win' ? 'generic_win' : result === 'draw' ? 'generic_draw' : 'generic_loss';
    pool = HEADLINE_TEMPLATES.filter(t => t.result === result && t.tag === fallback);
  }

  if (input.style) {
    const styled = pool.filter(t => t.style === input.style);
    if (styled.length) pool = styled;
  }

  const template = pick(pool);
  const title = template.title(ctx);
  const body = template.body(ctx);

  return newSocialPost({
    date: gameDate.slice(0, 10),
    type: 'headline',
    content: title,
    body,
    headlineStyle: template.style,
    author: HEADLINE_STYLE_META[template.style].author,
    matchId: match.id,
    likes: result === 'win' ? 180 + Math.floor(Math.random() * 320) : 60 + Math.floor(Math.random() * 140),
  });
}

function harmonic(n: number): number {
  let h = 0;
  for (let i = 1; i <= n; i++) h += 1 / i;
  return h;
}

export interface HeadlineBankStats {
  totalTemplates: number;
  byStyle: Record<HeadlineStyle, number>;
  byTag: Partial<Record<HeadlineTag, number>>;
  byResult: Record<MatchResult, number>;
  /** Tamanho do pool e chance de repetir o mesmo template (sorteio uniforme). */
  pools: Array<{
    tag: HeadlineTag;
    result: MatchResult;
    size: number;
    pRepeatNext: number;
    pRepeatPercent: string;
    expectedGamesToSeeAll: number;
  }>;
  /** Média dos pools específicos (não genéricos). */
  avgSpecificPoolSize: number;
  /** Média P(repetir) nos pools específicos. */
  avgSpecificRepeatPercent: string;
  /** Chance média de “cair o mesmo de novo” num genérico win/draw/loss. */
  avgGenericRepeatPercent: string;
}

export function getHeadlineBankStats(): HeadlineBankStats {
  const byStyle = {
    journalistic: 0,
    analytical: 0,
    sensational: 0,
    chronicle: 0,
    flash: 0,
  } satisfies Record<HeadlineStyle, number>;
  const byTag: Partial<Record<HeadlineTag, number>> = {};
  const byResult: Record<MatchResult, number> = { win: 0, draw: 0, loss: 0 };

  for (const t of HEADLINE_TEMPLATES) {
    byStyle[t.style] += 1;
    byTag[t.tag] = (byTag[t.tag] ?? 0) + 1;
    byResult[t.result] += 1;
  }

  const pools: HeadlineBankStats['pools'] = [];
  for (const tag of TAG_PRIORITY) {
    for (const result of ['win', 'draw', 'loss'] as MatchResult[]) {
      const size = HEADLINE_TEMPLATES.filter(t => t.tag === tag && t.result === result).length;
      if (size === 0) continue;
      const p = 1 / size;
      pools.push({
        tag,
        result,
        size,
        pRepeatNext: p,
        pRepeatPercent: `${(p * 100).toFixed(2)}%`,
        expectedGamesToSeeAll: Math.round(size * harmonic(size)),
      });
    }
  }

  const specific = pools.filter(p => !p.tag.startsWith('generic_'));
  const generics = pools.filter(p => p.tag.startsWith('generic_'));
  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

  return {
    totalTemplates: HEADLINE_TEMPLATES.length,
    byStyle,
    byTag,
    byResult,
    pools,
    avgSpecificPoolSize: Math.round(avg(specific.map(p => p.size)) * 10) / 10,
    avgSpecificRepeatPercent: `${(avg(specific.map(p => p.pRepeatNext)) * 100).toFixed(2)}%`,
    avgGenericRepeatPercent: `${(avg(generics.map(p => p.pRepeatNext)) * 100).toFixed(2)}%`,
  };
}
