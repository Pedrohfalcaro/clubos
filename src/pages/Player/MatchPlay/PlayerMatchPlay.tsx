import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGame } from '../../../context/GameContext';
import type { PlayerMatchRole, CompletePlayerMatchInput } from '../../../types/PlayerMatchPerformance';
import type { TeamGoalEntry, TeamCardEntry, OpponentGoalEntry, MatchMinute } from '../../../types/Match';
import { getHomeAway, locationLabel } from '../../../utils/matchStats';
import { getPlayerMatchClubName } from '../../../utils/playerMatch';
import { buildPseudoSquad } from '../../../utils/playerMatchBridge';
import { defaultMinute, uid } from '../../../utils/matchEvents';
import {
  buildGoalEvents,
  buildAssistEvents,
  buildCardEvents,
  syncTeamGoalsCount,
  isTeamGoalsValid,
  isOpponentGoalsValid,
} from '../../../utils/matchPlayHelpers';
import ScoreStep from '../../MatchPlay/steps/ScoreStep';
import OpponentGoalsStep from '../../MatchPlay/steps/OpponentGoalsStep';
import MatchRecapStep from '../../MatchPlay/steps/MatchRecapStep';
import PlayerGoalsStep from './steps/PlayerGoalsStep';
import PlayerIncidentsStep, { type PlayerInjuryDraft, type SubOutDraft } from './steps/PlayerIncidentsStep';
import PlayerRatingStep from './steps/PlayerRatingStep';
import PlayerReserveModal from './steps/PlayerReserveModal';
import PlayerMatchResultStep from './steps/PlayerMatchResultStep';
import pageStyles from '../../MatchPlay/MatchPlay.module.css';
import extra from './PlayerMatchPlay.module.css';

type Step = 'role' | 'score' | 'teamGoals' | 'opponentGoals' | 'incidents' | 'rating' | 'recap';

function stepLabel(step: Step): string {
  switch (step) {
    case 'role': return 'Você';
    case 'score': return 'Placar';
    case 'teamGoals': return 'Gols';
    case 'opponentGoals': return 'Adversário';
    case 'incidents': return 'Incidências';
    case 'rating': return 'Nota';
    case 'recap': return 'Resumo';
  }
}

export default function PlayerMatchPlay() {
  const { matchId } = useParams<{ matchId: string }>();
  const { state, getMatch, completePlayerMatch, updatePlayerMatch } = useGame();
  const navigate = useNavigate();

  const match = matchId ? getMatch(matchId) : undefined;
  const player = state.careerPlayer;
  const isEdit = match?.status === 'completed';
  const existing = match?.playerPerformance;

  const [step, setStep] = useState<Step>('role');
  const [role, setRole] = useState<PlayerMatchRole>(existing?.role ?? 'starter');
  const [entered, setEntered] = useState<boolean>(() => {
    if (!existing) return true;
    if (existing.role !== 'substitute') return true;
    return existing.minutesPlayed > 0;
  });
  const [entryMinute, setEntryMinute] = useState<MatchMinute>(() => {
    if (existing?.role === 'substitute' && existing.minutesPlayed > 0) {
      return { base: Math.max(1, 90 - existing.minutesPlayed) };
    }
    return { base: 60 };
  });
  const [reserveModalOpen, setReserveModalOpen] = useState(false);
  const [replacedTeammateId, setReplacedTeammateId] = useState<string | undefined>(undefined);
  const [liveMode, setLiveMode] = useState(false);

  const [goalsFor, setGoalsFor] = useState(match?.goalsFor ?? 0);
  const [goalsAgainst, setGoalsAgainst] = useState(match?.goalsAgainst ?? 0);

  const [teamGoals, setTeamGoals] = useState<TeamGoalEntry[]>(() => {
    const hydrated: TeamGoalEntry[] = (match?.goals ?? []).map(g => ({
      id: uid(),
      type: 'team' as const,
      playerId: g.playerId || undefined,
      assistPlayerId: g.assistPlayerId,
      minute: { base: g.minute, stoppage: g.stoppage },
    }));
    // Partida antiga (pré-redesenho) com goalsFor > 0 mas sem `goals[]` estruturado —
    // completa com slots vazios pro usuário preencher, em vez de travar a validação.
    return syncTeamGoalsCount(hydrated, match?.goalsFor ?? 0, uid);
  });

  const [opponentGoals, setOpponentGoals] = useState<OpponentGoalEntry[]>(() =>
    growOpponentGoals(match?.opponentGoals ?? [], match?.goalsAgainst ?? 0),
  );

  const [cards, setCards] = useState<TeamCardEntry[]>(() =>
    (match?.cards ?? []).map(c => ({
      id: uid(),
      playerId: c.playerId,
      playerName: c.playerName,
      type: c.type,
      minute: { base: c.minute, stoppage: c.stoppage },
    })),
  );

  const [injury, setInjury] = useState<PlayerInjuryDraft | null>(null);
  const [subOut, setSubOut] = useState<SubOutDraft | null>(null);
  const [rating, setRating] = useState<number | ''>(existing?.rating ?? '');

  function growOpponentGoals(prev: OpponentGoalEntry[], count: number): OpponentGoalEntry[] {
    if (prev.length === count) return prev;
    if (prev.length < count) {
      return [
        ...prev,
        ...Array.from({ length: count - prev.length }, () => ({
          id: uid(),
          scorerName: '',
          minute: defaultMinute(),
        })),
      ];
    }
    return prev.slice(0, count);
  }

  function setGoalsForSynced(v: number) {
    setGoalsFor(v);
    setTeamGoals(prev => syncTeamGoalsCount(prev, v, uid));
  }

  function setGoalsAgainstSynced(v: number) {
    setGoalsAgainst(v);
    setOpponentGoals(prev => growOpponentGoals(prev, v));
  }

  const clubName = match && player ? getPlayerMatchClubName(match, player.currentClub.name) : '';
  const homeAway = match ? getHomeAway(clubName, { ...match, goalsFor, goalsAgainst }) : null;
  const played = role === 'starter' || (role === 'substitute' && entered);
  const pseudoSquad = player ? buildPseudoSquad(player) : [];

  if (!match || !player || !homeAway) {
    navigate('/player/matches');
    return null;
  }

  const homeGoals = homeAway.homeTeam === clubName ? goalsFor : goalsAgainst;
  const awayGoals = homeAway.awayTeam === clubName ? goalsFor : goalsAgainst;
  const ourPitchSide: 'home' | 'away' = match.location === 'away' ? 'away' : 'home';

  function setHomeScore(v: number) {
    if (homeAway!.homeTeam === clubName) setGoalsForSynced(v);
    else setGoalsAgainstSynced(v);
  }

  function setAwayScore(v: number) {
    if (homeAway!.awayTeam === clubName) setGoalsForSynced(v);
    else setGoalsAgainstSynced(v);
  }

  function pickRole(next: PlayerMatchRole) {
    if (next === 'starter') {
      setRole('starter');
      setEntered(true);
      setStep('score');
    } else if (next === 'substitute') {
      setReserveModalOpen(true);
    } else {
      setRole('notCalled');
      setEntered(false);
      setStep('score');
    }
  }

  function handleReserveEntered(minute: MatchMinute, replacedId: string) {
    setRole('substitute');
    setEntered(true);
    setEntryMinute(minute);
    setReplacedTeammateId(replacedId);
    setReserveModalOpen(false);
    setStep('score');
  }

  function handleReserveNotEntered() {
    setRole('substitute');
    setEntered(false);
    setReserveModalOpen(false);
    setStep('score');
  }

  function goAfterScore() {
    if (liveMode) return setStep('rating');
    if (goalsFor > 0) return setStep('teamGoals');
    if (played) return setStep(goalsAgainst > 0 ? 'opponentGoals' : 'incidents');
    handleFinish();
  }

  function goAfterTeamGoals() {
    if (played) return setStep(goalsAgainst > 0 ? 'opponentGoals' : 'incidents');
    handleFinish();
  }

  function handleNext() {
    if (step === 'score') goAfterScore();
    else if (step === 'teamGoals') goAfterTeamGoals();
    else if (step === 'opponentGoals') setStep('incidents');
    else if (step === 'incidents') setStep('rating');
    else if (step === 'rating') setStep('recap');
    else if (step === 'recap') handleFinish();
  }

  function handleBack() {
    if (step === 'score') setStep('role');
    else if (step === 'teamGoals') setStep('score');
    else if (step === 'opponentGoals') setStep('teamGoals');
    else if (step === 'incidents') setStep(goalsAgainst > 0 && played ? 'opponentGoals' : goalsFor > 0 ? 'teamGoals' : 'score');
    else if (step === 'rating') setStep(liveMode ? 'score' : 'incidents');
    else if (step === 'recap') setStep('rating');
  }

  function canContinue(): boolean {
    if (!player) return true;
    if (step === 'score' && liveMode) {
      const eligibleScorers = (played ? 1 : 0) + player.teammates.length;
      const teamGoalsOk = eligibleScorers === 0 || isTeamGoalsValid(goalsFor, teamGoals);
      const subOk = !injury || !!subOut || player.teammates.length === 0;
      return teamGoalsOk && isOpponentGoalsValid(goalsAgainst, opponentGoals) && subOk;
    }
    if (step === 'teamGoals') {
      // Sem ninguém elegível pra marcar (elenco vazio e você não jogou) — nada a validar, deixa seguir.
      const eligibleScorers = (played ? 1 : 0) + player.teammates.length;
      if (eligibleScorers === 0) return true;
      return isTeamGoalsValid(goalsFor, teamGoals);
    }
    if (step === 'opponentGoals') return isOpponentGoalsValid(goalsAgainst, opponentGoals);
    // Lesão obriga substituir — a menos que o elenco esteja vazio (ninguém pra entrar no seu lugar).
    if (step === 'incidents') return !injury || !!subOut || player.teammates.length === 0;
    return true;
  }

  function handleFinish() {
    if (!match) return;
    const startMinute = role === 'starter' ? 0 : entryMinute.base;
    const endMinute = subOut ? subOut.minute.base : 90;
    const minutesPlayed = played ? Math.max(1, endMinute - startMinute) : 0;
    const goals = buildGoalEvents(teamGoals, pseudoSquad);
    const assists = buildAssistEvents(teamGoals, pseudoSquad);
    const cardEvents = buildCardEvents(cards);

    const input: CompletePlayerMatchInput = {
      matchId: match.id,
      goalsFor,
      goalsAgainst,
      role,
      minutesPlayed,
      rating: played && rating !== '' ? Number(rating) : null,
      goals,
      assists,
      cards: cardEvents,
      opponentGoals: opponentGoals.length ? opponentGoals : undefined,
      injury: injury ?? undefined,
    };

    if (isEdit) updatePlayerMatch(input);
    else completePlayerMatch(input);
    navigate('/player/matches');
  }

  const nextIsFinish =
    step === 'recap' ||
    (step === 'score' && goalsFor === 0 && !played) ||
    (step === 'teamGoals' && !played);

  const visibleSteps: Step[] = ['role', 'score'];
  if (!liveMode && goalsFor > 0) visibleSteps.push('teamGoals');
  if (played) {
    if (!liveMode && goalsAgainst > 0) visibleSteps.push('opponentGoals');
    if (!liveMode) visibleSteps.push('incidents');
    visibleSteps.push('rating', 'recap');
  }

  return (
    <div className={pageStyles.page}>
      <header className={pageStyles.header}>
        <div>
          <h1 className={pageStyles.title}>{isEdit ? 'Editar partida' : 'Registrar partida'}</h1>
          <p className={pageStyles.sub}>
            {match.competition} · {new Date(`${match.date.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR')} · {stepLabel(step)}
          </p>
        </div>
        <div className={pageStyles.headerRight}>
          {step === 'score' && played && (
            <button
              type="button"
              className={`${pageStyles.liveSwitch} ${liveMode ? pageStyles.liveSwitchOn : ''}`}
              onClick={() => setLiveMode(v => !v)}
              aria-pressed={liveMode}
              title={liveMode ? 'Desativar modo ao vivo' : 'Ativar modo ao vivo'}
            >
              <span className={pageStyles.liveKnob} />
              <span className={pageStyles.liveLabel}>Ao Vivo</span>
            </button>
          )}
          {!(step === 'score' && liveMode) && (
            <div className={pageStyles.steps} aria-hidden>
              {visibleSteps.map(s => (
                <span
                  key={s}
                  className={`${pageStyles.stepDot} ${step === s ? pageStyles.stepActive : ''}`}
                  title={stepLabel(s)}
                />
              ))}
            </div>
          )}
        </div>
      </header>

      <div className={extra.matchInfo}>
        <span className={extra.matchTeams}>{clubName} × {match.opponent}</span>
        <span className={extra.matchMeta}>{locationLabel(match.location)}</span>
      </div>

      {step === 'role' && (
        <section className={pageStyles.section}>
          <h2 className={pageStyles.sectionTitle}>Sua participação</h2>
          <div className={extra.roleGrid}>
            <button type="button" className={extra.roleCard} onClick={() => pickRole('starter')}>
              <span className={extra.roleIcon}>⚽</span>
              <h3 className={extra.roleTitle}>Titular</h3>
              <p className={extra.roleDesc}>Jogou desde o início.</p>
            </button>
            <button type="button" className={extra.roleCard} onClick={() => pickRole('substitute')}>
              <span className={extra.roleIcon}>🔄</span>
              <h3 className={extra.roleTitle}>Reserva</h3>
              <p className={extra.roleDesc}>Ficou no banco — entrou ou não.</p>
            </button>
            <button type="button" className={extra.roleCard} onClick={() => pickRole('notCalled')}>
              <span className={extra.roleIcon}>🚫</span>
              <h3 className={extra.roleTitle}>Não relacionado</h3>
              <p className={extra.roleDesc}>Nem ficou no banco.</p>
            </button>
          </div>
        </section>
      )}

      {step === 'score' && (
        <section className={pageStyles.section}>
          {!liveMode && <h2 className={pageStyles.sectionTitle}>Placar</h2>}
          {liveMode ? (
            <PlayerMatchResultStep
              teamName={clubName}
              opponentName={match.opponent}
              homeTeam={homeAway.homeTeam}
              awayTeam={homeAway.awayTeam}
              isTeamHome={ourPitchSide === 'home'}
              goalsFor={goalsFor}
              goalsAgainst={goalsAgainst}
              onGoalsForChange={setGoalsForSynced}
              onGoalsAgainstChange={setGoalsAgainstSynced}
              selfId={player.id}
              selfName={player.name}
              teammates={player.teammates}
              teamGoals={teamGoals}
              onTeamGoalsChange={setTeamGoals}
              cards={cards}
              onCardsChange={setCards}
              injury={injury}
              onInjuryChange={setInjury}
              subOut={subOut}
              onSubOutChange={setSubOut}
              opponentGoals={opponentGoals}
              onOpponentGoalsChange={setOpponentGoals}
              currentDate={state.currentDate}
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
        <section className={pageStyles.section}>
          <h2 className={pageStyles.sectionTitle}>Gols — {clubName}</h2>
          <PlayerGoalsStep
            teamName={clubName}
            selfId={player.id}
            selfName={player.name}
            includeSelf={played}
            teammates={player.teammates}
            teamGoals={teamGoals}
            onTeamGoalsChange={setTeamGoals}
          />
        </section>
      )}

      {step === 'opponentGoals' && (
        <section className={pageStyles.section}>
          <h2 className={pageStyles.sectionTitle}>Gols — {match.opponent}</h2>
          <OpponentGoalsStep
            opponentName={match.opponent}
            goals={opponentGoals}
            onChange={setOpponentGoals}
          />
        </section>
      )}

      {step === 'incidents' && (
        <section className={pageStyles.section}>
          <h2 className={pageStyles.sectionTitle}>Incidências</h2>
          <PlayerIncidentsStep
            selfId={player.id}
            selfName={player.name}
            currentDate={state.currentDate}
            teammates={player.teammates}
            cards={cards}
            onCardsChange={setCards}
            injury={injury}
            onInjuryChange={setInjury}
            subOut={subOut}
            onSubOutChange={setSubOut}
          />
        </section>
      )}

      {step === 'rating' && (
        <section className={pageStyles.section}>
          <h2 className={pageStyles.sectionTitle}>Sua nota</h2>
          <PlayerRatingStep selfName={player.name} rating={rating} onRatingChange={setRating} />
        </section>
      )}

      {step === 'recap' && (
        <section className={pageStyles.section}>
          <h2 className={pageStyles.sectionTitle}>Resumo da partida</h2>
          <MatchRecapStep
            teamName={clubName}
            opponentName={match.opponent}
            homeTeam={homeAway.homeTeam}
            awayTeam={homeAway.awayTeam}
            homeGoals={homeGoals}
            awayGoals={awayGoals}
            competition={match.competition}
            ourPitchSide={ourPitchSide}
            players={pseudoSquad}
            teamGoals={teamGoals}
            opponentGoals={opponentGoals}
            teamCards={cards}
            teamSubs={[
              ...(role === 'substitute' && entered && replacedTeammateId
                ? [{
                    id: 'self-sub-in',
                    playerInId: player.id,
                    playerInName: player.name,
                    playerOutId: replacedTeammateId,
                    playerOutName: player.teammates.find(t => t.id === replacedTeammateId)?.name ?? '—',
                    minute: entryMinute,
                    side: 'team' as const,
                  }]
                : []),
              ...(subOut
                ? [{
                    id: 'self-sub-out',
                    playerInId: subOut.replacementId,
                    playerInName: subOut.replacementName,
                    playerOutId: player.id,
                    playerOutName: player.name,
                    minute: subOut.minute,
                    side: 'team' as const,
                  }]
                : []),
            ]}
            injuries={injury ? [{
              id: 'self-injury',
              playerId: player.id,
              playerName: player.name,
              minute: injury.minute,
              note: injury.type,
              returnDate: injury.returnDate,
            }] : []}
          />
        </section>
      )}

      <div className={pageStyles.actions}>
        <button type="button" className={pageStyles.backBtn} onClick={step === 'role' ? () => navigate('/player/matches') : handleBack}>
          {step === 'role' ? 'Cancelar' : 'Voltar'}
        </button>
        {step !== 'role' && (
          <button
            type="button"
            className={pageStyles.nextBtn}
            disabled={!canContinue()}
            onClick={handleNext}
          >
            {nextIsFinish ? (isEdit ? 'Salvar alterações' : 'Registrar partida') : 'Continuar'}
          </button>
        )}
      </div>

      {reserveModalOpen && (
        <PlayerReserveModal
          teammates={player.teammates}
          onEntered={handleReserveEntered}
          onNotEntered={handleReserveNotEntered}
          onClose={() => setReserveModalOpen(false)}
        />
      )}
    </div>
  );
}
