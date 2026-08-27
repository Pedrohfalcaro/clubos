import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import FormationField from '../../../components/FormationField/FormationField';
import FormationPicker from '../../../components/FormationPicker/FormationPicker';
import { useGame } from '../../../context/GameContext';
import type {
  SubstitutionEvent,
  TeamGoalEntry,
  TeamCardEntry,
  OpponentGoalEntry,
  OpponentCardEntry,
  OpponentSubEntry,
  TeamInjuryEntry,
  MatchLineup,
} from '../../../types/Match';
import type { FormationKey, FormationSlot, TacticsDraft } from '../../../types/Tactics';
import { getHomeAway } from '../../../utils/matchStats';
import { getFormationPreset, isLineupComplete, remapFormation, resolveTactics } from '../../../utils/formations';
import { defaultMinute, uid } from '../../../utils/matchEvents';
import {
  buildAssistEvents,
  buildCardEvents,
  buildGoalEvents,
  isOpponentGoalsValid,
  isTeamGoalsValid,
  syncTeamGoalsCount,
} from '../../../utils/matchPlayHelpers';
import { kitColorForLocation, DEFAULT_PRIMARY, DEFAULT_SECONDARY } from '../../../utils/clubColors';
import { nationalPlayerToPseudoPlayer, buildNationalPerformances } from '../../../utils/nationalMatchPlay';
import MatchSummaryStep, { buildRatingsArray } from '../../MatchPlay/MatchSummaryStep';
import MatchResultStep, { areInjuriesValid, isResultStepValid } from '../../MatchPlay/MatchResultStep';
import ScoreStep from '../../MatchPlay/steps/ScoreStep';
import TeamGoalsStep from '../../MatchPlay/steps/TeamGoalsStep';
import OpponentGoalsStep from '../../MatchPlay/steps/OpponentGoalsStep';
import PathChoiceStep from '../../MatchPlay/steps/PathChoiceStep';
import EventsStep from '../../MatchPlay/steps/EventsStep';
import MatchRecapStep from '../../MatchPlay/steps/MatchRecapStep';
// Reaproveita o CSS do MatchPlay.tsx do clube — mesma tela, mesmo visual.
import styles from '../../MatchPlay/MatchPlay.module.css';

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

export default function NationalMatchPlay() {
  const { windowId, gameId } = useParams<{ windowId: string; gameId: string }>();
  const navigate = useNavigate();
  const { state, updateFifaWindowGame } = useGame();

  const nationalTeam = state.nationalTeam;
  const activeWindow = nationalTeam?.windows.find(w => w.id === windowId) ?? null;
  const game = activeWindow?.games.find(g => g.id === gameId) ?? null;
  const isEdit = !!game?.played;
  const teamName = nationalTeam?.name ?? '';
  const players = useMemo(
    () =>
      (activeWindow?.callUpIds ?? [])
        .map(id => nationalTeam?.talentPool.find(p => p.id === id))
        .filter((p): p is NonNullable<typeof p> => !!p)
        .map(nationalPlayerToPseudoPlayer),
    [activeWindow, nationalTeam],
  );

  const [step, setStep] = useState<Step>('lineup');
  const gameDate = state.currentDate;

  const [lineup, setLineup] = useState<TacticsDraft>(() =>
    resolveTactics(game?.lineup ?? activeWindow?.tactics, players),
  );
  const { formationKey, style, formation, bench } = lineup;
  const preset = getFormationPreset(formationKey);

  const [goalsFor, setGoalsFor] = useState(game?.goalsFor ?? 0);
  const [goalsAgainst, setGoalsAgainst] = useState(game?.goalsAgainst ?? 0);

  const [teamGoals, setTeamGoals] = useState<TeamGoalEntry[]>(() => {
    if (!game?.goals?.length) return [];
    return game.goals.map(g => ({
      id: uid(),
      type: g.isOwnGoal ? ('own' as const) : ('team' as const),
      playerId: g.isOwnGoal ? undefined : g.playerId,
      opponentScorerName: g.opponentScorerName,
      assistPlayerId: g.assistPlayerId,
      minute: { base: g.minute, stoppage: g.stoppage },
      isPenalty: g.isPenalty,
    }));
  });

  const [teamCards, setTeamCards] = useState<TeamCardEntry[]>(() =>
    (game?.cards ?? []).map(c => ({
      id: uid(),
      playerId: c.playerId,
      playerName: c.playerName,
      type: c.type,
      minute: { base: c.minute, stoppage: c.stoppage },
    })),
  );

  const [teamSubs, setTeamSubs] = useState<SubstitutionEvent[]>(() => game?.substitutions ?? []);
  const [injuries, setInjuries] = useState<TeamInjuryEntry[]>(() => game?.injuries ?? []);
  const [opponentGoals, setOpponentGoals] = useState<OpponentGoalEntry[]>([]);
  const [opponentCards, setOpponentCards] = useState<OpponentCardEntry[]>([]);
  const [opponentSubs, setOpponentSubs] = useState<OpponentSubEntry[]>([]);
  const [liveMode, setLiveMode] = useState(false);

  const [ratings, setRatings] = useState<Record<string, number | null>>(() => {
    const map: Record<string, number | null> = {};
    for (const r of game?.playerRatings ?? []) map[r.playerId] = r.rating;
    return map;
  });
  const [motmPlayerId, setMotmPlayerId] = useState<string | null>(game?.motmNationalPlayerId ?? null);
  const [worstPlayerId, setWorstPlayerId] = useState<string | null>(game?.worstNationalPlayerId ?? null);
  const [description, setDescription] = useState(game?.description ?? '');

  const homeAway = game
    ? getHomeAway(teamName, { location: game.location, opponent: game.opponent, goalsFor, goalsAgainst })
    : null;
  const starters = formation.map(f => f.playerId);
  const lineupValid = isLineupComplete(formation, formationKey, players, null, gameDate) && bench.length <= 9;

  const homeGoals = homeAway?.homeTeam === teamName ? goalsFor : goalsAgainst;
  const awayGoals = homeAway?.awayTeam === teamName ? goalsFor : goalsAgainst;
  const ourPitchSide: 'home' | 'away' = game?.location === 'away' ? 'away' : 'home';
  const lineupKitColor = kitColorForLocation(
    game?.location ?? 'home',
    nationalTeam?.primaryColor ?? DEFAULT_PRIMARY,
    nationalTeam?.secondaryColor ?? DEFAULT_SECONDARY,
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

  if (!nationalTeam || !activeWindow || !game || !homeAway) {
    return (
      <div className={styles.notFound}>
        <p>Partida não encontrada.</p>
        <button onClick={() => navigate('/national/windows')}>Voltar</button>
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
    if (!activeWindow || !game) return;
    const starterIds = formation.map(f => f.playerId);
    const enteredIds = teamSubs.map(s => s.playerInId).filter(Boolean);
    const playerMatches = [...new Set([...starterIds, ...enteredIds])];
    const goals = buildGoalEvents(teamGoals, players);
    const assists = buildAssistEvents(teamGoals, players);
    const cards = buildCardEvents(teamCards);
    const validInjuries = injuries.filter(i => !!i.playerId && !!i.returnDate);
    const finishedLineup: MatchLineup = { formation, bench, formationKey, style };

    const performances = buildNationalPerformances({
      lineup: finishedLineup,
      substitutions: teamSubs,
      injuries: validInjuries,
      playerMatches,
      goals,
      assists,
      cards,
      ratings,
    });

    updateFifaWindowGame(activeWindow.id, game.id, {
      played: true,
      goalsFor,
      goalsAgainst,
      lineup: finishedLineup,
      goals,
      assists,
      cards,
      substitutions: teamSubs,
      injuries: validInjuries,
      opponentGoals: opponentGoals.length ? opponentGoals : undefined,
      opponentCards: opponentCards.length ? opponentCards : undefined,
      opponentSubs: opponentSubs.length ? opponentSubs : undefined,
      description: description.trim() || undefined,
      playerRatings: buildRatingsArray(ratings),
      motmNationalPlayerId: motmPlayerId ?? undefined,
      worstNationalPlayerId: worstPlayerId ?? undefined,
      performances,
    });
    navigate('/national/windows');
  }

  function canContinue(): boolean {
    if (step === 'lineup') return lineupValid;
    if (step === 'score' && liveMode) {
      return (
        isResultStepValid(goalsFor, teamGoals, injuries) &&
        isOpponentGoalsValid(goalsAgainst, opponentGoals)
      );
    }
    if (step === 'teamGoals') return isTeamGoalsValid(goalsFor, teamGoals);
    if (step === 'opponentGoals') return isOpponentGoalsValid(goalsAgainst, opponentGoals);
    if (step === 'events') return areInjuriesValid(injuries);
    if (step === 'ratings' || step === 'recap') return areInjuriesValid(injuries);
    return true;
  }

  function handleNext() {
    if (step === 'lineup') setStep('score');
    else if (step === 'score') {
      if (liveMode) setStep('ratings');
      else goAfterScore();
    } else if (step === 'teamGoals') goAfterTeamGoals();
    else if (step === 'opponentGoals') setStep('events');
    else if (step === 'events') setStep('ratings');
    else if (step === 'ratings') setStep('recap');
    else if (step === 'recap') handleFinish();
  }

  function handleBack() {
    if (step === 'lineup') navigate('/national/windows');
    else if (step === 'score') setStep('lineup');
    else if (step === 'teamGoals') setStep('score');
    else if (step === 'pathChoice') setStep(goalsFor > 0 ? 'teamGoals' : 'score');
    else if (step === 'opponentGoals') setStep('pathChoice');
    else if (step === 'events') {
      if (goalsAgainst > 0) setStep('pathChoice');
      else if (goalsFor > 0) setStep('teamGoals');
      else setStep('score');
    } else if (step === 'ratings') setStep(liveMode ? 'score' : 'events');
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
          <h1 className={styles.title}>{isEdit ? 'Editar partida' : 'Jogar partida'}</h1>
          <p className={styles.sub}>
            {activeWindow.label} · {new Date(game.date).toLocaleDateString('pt-BR')}
            {' · '}
            {liveMode && step === 'score' ? 'Ao vivo' : stepLabel(step)}
          </p>
        </div>
        <div className={styles.headerRight}>
          {step === 'score' && (
            <button
              type="button"
              className={`${styles.liveSwitch} ${liveMode ? styles.liveSwitchOn : ''}`}
              onClick={() => setLiveMode(v => !v)}
              aria-pressed={liveMode}
              title={liveMode ? 'Desativar modo ao vivo' : 'Ativar modo ao vivo'}
            >
              <span className={styles.liveKnob} />
              <span className={styles.liveLabel}>Ao Vivo</span>
            </button>
          )}
          {!liveMode && (
            <div className={styles.steps} aria-hidden>
              {visibleDots.map(s => (
                <span
                  key={s}
                  className={`${styles.stepDot} ${step === s ? styles.stepActive : ''}`}
                  title={stepLabel(s)}
                />
              ))}
            </div>
          )}
        </div>
      </header>

      {step === 'lineup' && (
        <section className={styles.section}>
          <div className={styles.lineupHead}>
            <h2 className={styles.sectionTitle}>Escalação titular</h2>
            {activeWindow.tacticsPresets.length > 0 && (
              <label className={styles.tacticsSelectWrap}>
                <span className={styles.tacticsSelectLabel}>Tática</span>
                <select
                  className={styles.tacticsSelect}
                  value=""
                  onChange={e => {
                    const id = e.target.value;
                    if (!id) return;
                    const found = activeWindow.tacticsPresets.find(p => p.id === id);
                    if (found) setLineup(resolveTactics(found, players));
                  }}
                >
                  <option value="">Usar tática…</option>
                  {activeWindow.tacticsPresets.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <FormationPicker value={formationKey} onChange={handleFormationChange} showDescription={false} />
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
              primaryColor={nationalTeam.primaryColor ?? DEFAULT_PRIMARY}
              secondaryColor={nationalTeam.secondaryColor ?? DEFAULT_SECONDARY}
            />
          </div>
        </section>
      )}

      {step === 'score' && (
        <section className={styles.section}>
          {!liveMode && <h2 className={styles.sectionTitle}>Placar</h2>}
          {liveMode ? (
            <MatchResultStep
              teamName={teamName}
              opponentName={game.opponent}
              homeTeam={homeAway.homeTeam}
              awayTeam={homeAway.awayTeam}
              isTeamHome={ourPitchSide === 'home'}
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
              injuries={injuries}
              onInjuriesChange={setInjuries}
              opponentGoals={opponentGoals}
              onOpponentGoalsChange={setOpponentGoals}
              opponentCards={opponentCards}
              onOpponentCardsChange={setOpponentCards}
              opponentSubs={opponentSubs}
              onOpponentSubsChange={setOpponentSubs}
            />
          ) : (
            <ScoreStep
              homeTeam={homeAway.homeTeam}
              awayTeam={homeAway.awayTeam}
              homeGoals={homeGoals}
              awayGoals={awayGoals}
              onHomeGoalsChange={setHomeScore}
              onAwayGoalsChange={setAwayScore}
            />
          )}
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
            opponentName={game.opponent}
            onOpponent={() => setStep('opponentGoals')}
            onEvents={() => setStep('events')}
          />
        </section>
      )}

      {step === 'opponentGoals' && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Gols — {game.opponent}</h2>
          <OpponentGoalsStep opponentName={game.opponent} goals={opponentGoals} onChange={setOpponentGoals} />
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
            opponentName={game.opponent}
            homeTeam={homeAway.homeTeam}
            awayTeam={homeAway.awayTeam}
            homeGoals={homeGoals}
            awayGoals={awayGoals}
            competition={activeWindow.label}
            ourPitchSide={ourPitchSide}
            players={players}
            teamGoals={teamGoals}
            opponentGoals={opponentGoals}
            teamCards={teamCards}
            teamSubs={teamSubs}
            injuries={injuries}
            opponentCards={opponentCards}
            opponentSubs={opponentSubs}
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
            {step === 'recap' ? (isEdit ? 'Salvar e continuar' : 'Continuar') : 'Continuar'}
          </button>
        </div>
      )}
    </div>
  );
}
