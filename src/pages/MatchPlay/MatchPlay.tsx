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
  TeamInjuryEntry,
} from '../../types/Match';
import type {
  FormationKey,
  FormationSlot,
  TacticsDraft,
} from '../../types/Tactics';
import { getHomeAway } from '../../utils/matchStats';
import {
  getFormationPreset,
  isLineupComplete,
  remapFormation,
  resolveTactics,
} from '../../utils/formations';
import { defaultMinute, uid } from '../../utils/matchEvents';
import {
  buildAssistEvents,
  buildCardEvents,
  buildGoalEvents,
  isOpponentGoalsValid,
  isTeamGoalsValid,
  opponentGoalsText,
  syncTeamGoalsCount,
} from '../../utils/matchPlayHelpers';
import { kitColorForLocation, DEFAULT_PRIMARY, DEFAULT_SECONDARY } from '../../utils/clubColors';
import MatchSummaryStep, { buildRatingsArray } from './MatchSummaryStep';
import ScoreStep from './steps/ScoreStep';
import TeamGoalsStep from './steps/TeamGoalsStep';
import OpponentGoalsStep from './steps/OpponentGoalsStep';
import PathChoiceStep from './steps/PathChoiceStep';
import EventsStep from './steps/EventsStep';
import MatchRecapStep from './steps/MatchRecapStep';
import styles from './MatchPlay.module.css';

type Step =
  | 'lineup'
  | 'score'
  | 'teamGoals'
  | 'pathChoice'
  | 'opponentGoals'
  | 'events'
  | 'ratings'
  | 'recap';

const STEP_ORDER: Step[] = [
  'lineup',
  'score',
  'teamGoals',
  'pathChoice',
  'opponentGoals',
  'events',
  'ratings',
  'recap',
];

function stepLabel(step: Step): string {
  switch (step) {
    case 'lineup':
      return 'Escalação';
    case 'score':
      return 'Placar';
    case 'teamGoals':
      return 'Gols';
    case 'pathChoice':
      return 'Próximo';
    case 'opponentGoals':
      return 'Adversário';
    case 'events':
      return 'Incidências';
    case 'ratings':
      return 'Notas';
    case 'recap':
      return 'Resumo';
  }
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

  // A escalação da partida parte do que já foi registrado nela, ou da tática salva
  const [lineup, setLineup] = useState<TacticsDraft>(() =>
    resolveTactics(match?.lineup ?? state.tactics, players),
  );
  const { formationKey, style, formation, bench } = lineup;
  const preset = getFormationPreset(formationKey);

  const [goalsFor, setGoalsFor] = useState(match?.goalsFor ?? 0);
  const [goalsAgainst, setGoalsAgainst] = useState(match?.goalsAgainst ?? 0);

  const [teamGoals, setTeamGoals] = useState<TeamGoalEntry[]>(() => {
    if (!match?.goals.length) return [];
    return match.goals.map(g => ({
      id: uid(),
      type: g.isOwnGoal ? ('own' as const) : ('team' as const),
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

  const [teamSubs, setTeamSubs] = useState<SubstitutionEvent[]>(
    () => (match?.substitutions ?? []).filter(s => s.side === 'team'),
  );
  const [injuries, setInjuries] = useState<TeamInjuryEntry[]>(() => match?.injuries ?? []);
  const [opponentGoals, setOpponentGoals] = useState<OpponentGoalEntry[]>([]);

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
  const lineupValid = isLineupComplete(formation, formationKey, players) && bench.length <= 9;

  const homeGoals = homeAway?.homeTeam === teamName ? goalsFor : goalsAgainst;
  const awayGoals = homeAway?.awayTeam === teamName ? goalsFor : goalsAgainst;
  const ourPitchSide: 'home' | 'away' =
    match?.location === 'away' ? 'away' : 'home';
  const lineupKitColor = kitColorForLocation(
    match?.location ?? 'home',
    state.team?.primaryColor ?? DEFAULT_PRIMARY,
    state.team?.secondaryColor ?? DEFAULT_SECONDARY,
  );

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

  function setFormation(next: FormationSlot[]) {
    setLineup(current => ({ ...current, formation: next }));
  }

  function setBench(next: string[]) {
    setLineup(current => ({ ...current, bench: next }));
  }

  function handleFormationChange(key: FormationKey) {
    setLineup(current => {
      if (current.formationKey === key) return current;
      return {
        ...current,
        formationKey: key,
        formation: remapFormation(current.formation, current.formationKey, key, players),
      };
    });
  }

  function applySavedTactics() {
    setLineup(resolveTactics(state.tactics, players));
  }

  function setHomeScore(v: number) {
    if (homeAway!.homeTeam === teamName) setGoalsFor(v);
    else setGoalsAgainst(v);
  }

  function setAwayScore(v: number) {
    if (homeAway!.awayTeam === teamName) setGoalsFor(v);
    else setGoalsAgainst(v);
  }

  function goAfterScore() {
    if (goalsFor > 0) setStep('teamGoals');
    else if (goalsAgainst > 0) setStep('pathChoice');
    else setStep('events');
  }

  function goAfterTeamGoals() {
    if (goalsAgainst > 0) setStep('pathChoice');
    else setStep('events');
  }

  function handleFinish() {
    if (!match) return;
    const starterIds = formation.map(f => f.playerId);
    const enteredIds = teamSubs.map(s => s.playerInId).filter(Boolean);
    const playerMatches = [...new Set([...starterIds, ...enteredIds])];

    const input = {
      matchId: match.id,
      goalsFor,
      goalsAgainst,
      goals: buildGoalEvents(teamGoals, players),
      assists: buildAssistEvents(teamGoals, players),
      cards: buildCardEvents(teamCards),
      playerMatches,
      lineup: { formation, bench, formationKey, style },
      substitutions: teamSubs,
      injuries,
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

  function canContinue(): boolean {
    if (step === 'lineup') return lineupValid;
    if (step === 'teamGoals') return isTeamGoalsValid(goalsFor, teamGoals);
    if (step === 'opponentGoals') return isOpponentGoalsValid(goalsAgainst, opponentGoals);
    return true;
  }

  function handleNext() {
    if (step === 'lineup') setStep('score');
    else if (step === 'score') goAfterScore();
    else if (step === 'teamGoals') goAfterTeamGoals();
    else if (step === 'opponentGoals') setStep('events');
    else if (step === 'events') setStep('ratings');
    else if (step === 'ratings') setStep('recap');
    else if (step === 'recap') handleFinish();
  }

  function handleBack() {
    if (step === 'lineup') navigate('/dashboard');
    else if (step === 'score') setStep('lineup');
    else if (step === 'teamGoals') setStep('score');
    else if (step === 'pathChoice') setStep(goalsFor > 0 ? 'teamGoals' : 'score');
    else if (step === 'opponentGoals') setStep('pathChoice');
    else if (step === 'events') {
      if (goalsAgainst > 0) setStep('pathChoice');
      else if (goalsFor > 0) setStep('teamGoals');
      else setStep('score');
    } else if (step === 'ratings') setStep('events');
    else if (step === 'recap') setStep('ratings');
  }

  const visibleDots = STEP_ORDER.filter(s => {
    if (s === 'teamGoals' && goalsFor === 0 && step !== 'teamGoals') return false;
    if (s === 'pathChoice' && goalsAgainst === 0 && step !== 'pathChoice') return false;
    if (s === 'opponentGoals' && goalsAgainst === 0 && step !== 'opponentGoals') return false;
    return true;
  });

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{isEdit ? 'Editar partida' : 'Registrar partida'}</h1>
          <p className={styles.sub}>
            {match.competition} · {new Date(match.date).toLocaleDateString('pt-BR')}
            {' · '}
            {stepLabel(step)}
          </p>
        </div>
        <div className={styles.steps} aria-hidden>
          {visibleDots.map(s => (
            <span
              key={s}
              className={`${styles.stepDot} ${step === s ? styles.stepActive : ''}`}
              title={stepLabel(s)}
            />
          ))}
        </div>
      </header>

      {step === 'lineup' && (
        <section className={styles.section}>
          <div className={styles.lineupHead}>
            <h2 className={styles.sectionTitle}>Escalação titular</h2>
            {state.tactics && (
              <button type="button" className={styles.tacticsBtn} onClick={applySavedTactics}>
                Usar tática salva
              </button>
            )}
          </div>
          <FormationPicker
            value={formationKey}
            onChange={handleFormationChange}
            showDescription={false}
          />
          <div className={styles.lineupCard}>
            <FormationField
              players={players}
              formation={formation}
              onFormationChange={setFormation}
              bench={bench}
              onBenchChange={setBench}
              showBench
              benchMin={0}
              benchMax={9}
              slotMode
              preset={preset}
              kitColor={lineupKitColor}
              primaryColor={state.team?.primaryColor ?? DEFAULT_PRIMARY}
              secondaryColor={state.team?.secondaryColor ?? DEFAULT_SECONDARY}
            />
          </div>
        </section>
      )}

      {step === 'score' && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Placar</h2>
          <ScoreStep
            homeTeam={homeAway.homeTeam}
            awayTeam={homeAway.awayTeam}
            homeGoals={homeGoals}
            awayGoals={awayGoals}
            onHomeGoalsChange={setHomeScore}
            onAwayGoalsChange={setAwayScore}
          />
        </section>
      )}

      {step === 'teamGoals' && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Gols — {teamName}</h2>
          <TeamGoalsStep
            teamName={teamName}
            players={players}
            starters={starters}
            bench={bench}
            teamGoals={teamGoals}
            onTeamGoalsChange={setTeamGoals}
            teamSubs={teamSubs}
            onTeamSubsChange={setTeamSubs}
            injuries={injuries}
          />
        </section>
      )}

      {step === 'pathChoice' && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Continuar</h2>
          <PathChoiceStep
            opponentName={match.opponent}
            onOpponent={() => setStep('opponentGoals')}
            onEvents={() => setStep('events')}
          />
        </section>
      )}

      {step === 'opponentGoals' && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Gols — {match.opponent}</h2>
          <OpponentGoalsStep
            opponentName={match.opponent}
            goals={opponentGoals}
            onChange={setOpponentGoals}
          />
        </section>
      )}

      {step === 'events' && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Incidências</h2>
          <EventsStep
            players={players}
            starters={starters}
            bench={bench}
            teamSubs={teamSubs}
            onTeamSubsChange={setTeamSubs}
            teamCards={teamCards}
            onTeamCardsChange={setTeamCards}
            injuries={injuries}
            onInjuriesChange={setInjuries}
          />
        </section>
      )}

      {step === 'ratings' && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Notas</h2>
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
        </section>
      )}

      {step === 'recap' && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Resumo da partida</h2>
          <MatchRecapStep
            teamName={teamName}
            opponentName={match.opponent}
            homeTeam={homeAway.homeTeam}
            awayTeam={homeAway.awayTeam}
            homeGoals={homeGoals}
            awayGoals={awayGoals}
            competition={match.competition}
            ourPitchSide={ourPitchSide}
            players={players}
            teamGoals={teamGoals}
            opponentGoals={opponentGoals}
            teamCards={teamCards}
            teamSubs={teamSubs}
            injuries={injuries}
          />
        </section>
      )}

      {step !== 'pathChoice' && (
        <div className={styles.actions}>
          <button type="button" className={styles.backBtn} onClick={handleBack}>
            {step === 'lineup' ? 'Cancelar' : 'Voltar'}
          </button>
          <button
            type="button"
            className={styles.nextBtn}
            disabled={!canContinue()}
            onClick={handleNext}
          >
            {step === 'recap'
              ? isEdit
                ? 'Salvar e continuar'
                : 'Continuar'
              : 'Continuar'}
          </button>
        </div>
      )}
    </div>
  );
}
