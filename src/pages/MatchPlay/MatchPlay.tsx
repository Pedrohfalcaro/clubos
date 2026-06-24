import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import FormationField from '../../components/FormationField/FormationField';
import FormationPicker from '../../components/FormationPicker/FormationPicker';
import { useGame } from '../../context/GameContext';
import type {
  SubstitutionEvent,
  TeamGoalEntry,
  TeamCardEntry,
  OpponentGoalEntry,
  OpponentCardEntry,
  OpponentSubEntry,
} from '../../types/Match';
import { getHomeAway } from '../../utils/matchStats';
import {
  getFormationPreset,
  detectFormationKey,
  type FormationKey,
} from '../../utils/formations';
import { defaultMinute, uid } from '../../utils/matchEvents';
import {
  buildAssistEvents,
  buildCardEvents,
  buildGoalEvents,
  opponentGoalsText,
  syncTeamGoalsCount,
} from '../../utils/matchPlayHelpers';
import MatchResultStep, { isResultStepValid } from './MatchResultStep';
import MatchSummaryStep, { buildRatingsArray } from './MatchSummaryStep';
import styles from './MatchPlay.module.css';

type Step = 'lineup' | 'result' | 'summary';

function initialFormationKey(
  tactics: ReturnType<typeof useGame>['state']['tactics'],
  matchFormation?: { x: number; y: number }[],
): FormationKey {
  if (matchFormation?.length) return detectFormationKey(matchFormation) ?? '433';
  if (tactics?.formation?.length) return detectFormationKey(tactics.formation) ?? '433';
  return '433';
}

export default function MatchPlay() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const { state, getMatch, completeMatch, updateCompletedMatch } = useGame();

  const match = matchId ? getMatch(matchId) : undefined;
  const isEdit = match?.status === 'completed';
  const players = state.players;
  const teamName = state.team?.name ?? '';

  const [step, setStep] = useState<Step>('lineup');
  const [formationKey, setFormationKey] = useState<FormationKey>(() =>
    initialFormationKey(state.tactics, match?.lineup?.formation),
  );
  const preset = getFormationPreset(formationKey);

  const [formation, setFormation] = useState<{ playerId: string; x: number; y: number }[]>(() =>
    match?.lineup?.formation ?? state.tactics?.formation ?? [],
  );
  const [bench, setBench] = useState<string[]>(
    () => match?.lineup?.bench ?? state.tactics?.bench ?? [],
  );

  const [goalsFor, setGoalsFor] = useState(match?.goalsFor ?? 0);
  const [goalsAgainst, setGoalsAgainst] = useState(match?.goalsAgainst ?? 0);

  const [teamGoals, setTeamGoals] = useState<TeamGoalEntry[]>(() => {
    if (!match?.goals.length) return [];
    return match.goals.map(g => ({
      id: uid(),
      type: g.isOwnGoal ? 'own' as const : 'team' as const,
      playerId: g.isOwnGoal ? undefined : g.playerId,
      opponentScorerName: g.opponentScorerName,
      assistPlayerId: g.assistPlayerId,
      minute: { base: g.minute, stoppage: g.stoppage },
    }));
  });

  const [teamCards, setTeamCards] = useState<TeamCardEntry[]>(() =>
    (match?.cards ?? []).map(c => ({
      id: uid(),
      playerId: c.playerId,
      playerName: c.playerName,
      type: c.type,
      minute: { base: c.minute, stoppage: c.stoppage },
    })),
  );

  const [teamSubs, setTeamSubs] = useState<SubstitutionEvent[]>(() => match?.substitutions ?? []);
  const [opponentGoals, setOpponentGoals] = useState<OpponentGoalEntry[]>([]);
  const [opponentCards, setOpponentCards] = useState<OpponentCardEntry[]>([]);
  const [opponentSubs, setOpponentSubs] = useState<OpponentSubEntry[]>([]);

  const [ratings, setRatings] = useState<Record<string, number | null>>(() => {
    const map: Record<string, number | null> = {};
    for (const r of match?.playerRatings ?? []) map[r.playerId] = r.rating;
    return map;
  });
  const [motmPlayerId, setMotmPlayerId] = useState<string | null>(match?.motmPlayerId ?? null);
  const [worstPlayerId, setWorstPlayerId] = useState<string | null>(match?.worstPlayerId ?? null);
  const [description, setDescription] = useState(match?.description ?? '');

  const homeAway = match ? getHomeAway(teamName, { ...match, goalsFor, goalsAgainst }) : null;
  const starters = formation.map(f => f.playerId);
  const lineupValid = formation.length === 11 && bench.length >= 7 && bench.length <= 9;
  const isTeamHome = homeAway?.homeTeam === teamName;

  useEffect(() => {
    setTeamGoals(prev => syncTeamGoalsCount(prev, goalsFor, uid));
  }, [goalsFor]);

  useEffect(() => {
    setOpponentGoals(prev => {
      if (prev.length === goalsAgainst) return prev;
      if (prev.length < goalsAgainst) {
        return [
          ...prev,
          ...Array.from({ length: goalsAgainst - prev.length }, () => ({
            id: uid(),
            scorerName: '',
            minute: defaultMinute(),
          })),
        ];
      }
      return prev.slice(0, goalsAgainst);
    });
  }, [goalsAgainst]);

  if (!match || !homeAway) {
    return (
      <div className={styles.notFound}>
        <p>Partida não encontrada.</p>
        <button onClick={() => navigate('/dashboard')}>Voltar</button>
      </div>
    );
  }

  function handleFinish() {
    if (!match) return;
    const playerMatches = [...starters, ...bench];
    const allSubs: SubstitutionEvent[] = [
      ...teamSubs,
      ...opponentSubs.map(s => ({
        id: s.id,
        playerInId: '',
        playerInName: s.playerIn,
        playerOutId: '',
        playerOutName: s.playerOut,
        minute: s.minute,
        side: 'opponent' as const,
        opponentPlayerIn: s.playerIn,
        opponentPlayerOut: s.playerOut,
      })),
    ];

    const input = {
      matchId: match.id,
      goalsFor,
      goalsAgainst,
      goals: buildGoalEvents(teamGoals, players),
      assists: buildAssistEvents(teamGoals, players),
      cards: buildCardEvents(teamCards),
      playerMatches,
      lineup: { formation, bench },
      substitutions: allSubs,
      opponentGoalScorers: opponentGoalsText(opponentGoals) || undefined,
      description: description.trim() || undefined,
      playerRatings: buildRatingsArray(ratings),
      motmPlayerId: motmPlayerId ?? undefined,
      worstPlayerId: worstPlayerId ?? undefined,
    };

    if (isEdit) updateCompletedMatch(input);
    else completeMatch(input);
    navigate('/dashboard');
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{isEdit ? 'Editar Partida' : 'Jogar Partida'}</h1>
          <p className={styles.sub}>
            {match.competition} · {new Date(match.date).toLocaleDateString('pt-BR')}
          </p>
        </div>
        <div className={styles.steps}>
          {(['lineup', 'result', 'summary'] as Step[]).map((s, i) => (
            <span key={s} className={`${styles.stepDot} ${step === s ? styles.stepActive : ''}`}>
              {i + 1}
            </span>
          ))}
        </div>
      </header>

      {step === 'lineup' && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Escalação Titular</h2>
          <FormationPicker
            value={formationKey}
            onChange={key => {
              setFormationKey(key);
              setFormation([]);
            }}
          />
          <div className={styles.lineupCard}>
            <FormationField
              players={players}
              formation={formation}
              onFormationChange={setFormation}
              bench={bench}
              onBenchChange={setBench}
              showBench
              benchMin={7}
              benchMax={9}
              slotMode
              preset={preset}
            />
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.backBtn} onClick={() => navigate('/dashboard')}>
              Cancelar
            </button>
            <button
              type="button"
              className={styles.nextBtn}
              disabled={!lineupValid}
              onClick={() => setStep('result')}
            >
              Continuar
            </button>
          </div>
        </section>
      )}

      {step === 'result' && (
        <section className={styles.section}>
          <MatchResultStep
            teamName={teamName}
            opponentName={match.opponent}
            homeTeam={homeAway.homeTeam}
            awayTeam={homeAway.awayTeam}
            isTeamHome={!!isTeamHome}
            goalsFor={goalsFor}
            goalsAgainst={goalsAgainst}
            onGoalsForChange={setGoalsFor}
            onGoalsAgainstChange={setGoalsAgainst}
            starters={starters}
            bench={bench}
            players={players}
            teamGoals={teamGoals}
            onTeamGoalsChange={setTeamGoals}
            teamCards={teamCards}
            onTeamCardsChange={setTeamCards}
            teamSubs={teamSubs}
            onTeamSubsChange={setTeamSubs}
            opponentGoals={opponentGoals}
            onOpponentGoalsChange={setOpponentGoals}
            opponentCards={opponentCards}
            onOpponentCardsChange={setOpponentCards}
            opponentSubs={opponentSubs}
            onOpponentSubsChange={setOpponentSubs}
          />
          <div className={styles.actions}>
            <button type="button" className={styles.backBtn} onClick={() => setStep('lineup')}>
              Voltar
            </button>
            <button
              type="button"
              className={styles.nextBtn}
              disabled={!isResultStepValid(goalsFor, teamGoals)}
              onClick={() => setStep('summary')}
            >
              Continuar
            </button>
          </div>
        </section>
      )}

      {step === 'summary' && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Comentário & Notas</h2>
          <div className={styles.summaryScore}>
            {homeAway.homeTeam} {homeAway.homeTeam === teamName ? goalsFor : goalsAgainst} –{' '}
            {homeAway.awayTeam === teamName ? goalsFor : goalsAgainst} {homeAway.awayTeam}
          </div>
          <MatchSummaryStep
            players={players}
            starters={starters}
            bench={bench}
            teamSubs={teamSubs}
            teamCards={teamCards}
            ratings={ratings}
            onRatingsChange={setRatings}
            motmPlayerId={motmPlayerId}
            worstPlayerId={worstPlayerId}
            onMotmChange={setMotmPlayerId}
            onWorstChange={setWorstPlayerId}
            description={description}
            onDescriptionChange={setDescription}
          />
          <div className={styles.actions}>
            <button type="button" className={styles.backBtn} onClick={() => setStep('result')}>
              Voltar
            </button>
            <button type="button" className={styles.nextBtn} onClick={handleFinish}>
              {isEdit ? 'Salvar Alterações' : 'Finalizar Partida'}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
