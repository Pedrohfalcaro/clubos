import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useGame } from '../../context/GameContext';
import {
  buildPressSituation,
  pickPressQuestions,
  runPressConference,
} from '../../pressconference';
import type { PressConferenceResult, PressContext } from '../../types/PressConference';
import { wageBill } from '../../utils/finance';
import { contextLabel } from '../../utils/pressTriggers';
import styles from './PressConference.module.css';

function parseContext(raw: string | null): PressContext {
  if (raw === 'post' || raw === 'post_match') return 'post_match';
  if (raw === 'callup') return 'callup';
  if (raw === 'injury') return 'injury';
  if (raw === 'finance' || raw === 'finance_crisis') return 'finance_crisis';
  if (raw === 'arc' || raw === 'story_arc') return 'story_arc';
  return 'pre_match';
}

function deltaClass(n: number): string {
  if (n > 0) return styles.pos;
  if (n < 0) return styles.neg;
  return '';
}

function DeltaCell({ label, value }: { label: string; value: number }) {
  return (
    <div className={styles.delta}>
      {label}
      <strong className={deltaClass(value)}>
        {value >= 0 ? '+' : ''}
        {value}
      </strong>
    </div>
  );
}

export default function PressConference() {
  const { state, applyPressConference } = useGame();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const context = parseContext(params.get('ctx'));
  const matchId = params.get('matchId') ?? undefined;
  const playerId = params.get('playerId') ?? undefined;
  const specialKey = params.get('key') ?? undefined;

  const match = matchId ? state.matches.find(m => m.id === matchId) : null;
  const today = state.currentDate?.slice(0, 10);
  const todayMatch =
    match ??
    state.matches.find(
      m => m.status === 'scheduled' && m.date.slice(0, 10) === today,
    ) ??
    null;

  const targetMatch =
    context === 'post_match'
      ? match && match.status === 'completed'
        ? match
        : state.matches
            .filter(m => m.status === 'completed')
            .sort((a, b) => b.date.localeCompare(a.date))[0] ?? null
      : context === 'callup'
        ? match ?? todayMatch
        : context === 'pre_match'
          ? todayMatch
          : match;

  const isSpecial =
    context === 'callup' ||
    context === 'injury' ||
    context === 'finance_crisis';

  const alreadyDone = useMemo(() => {
    if (context === 'story_arc') {
      return false; // capítulos do arco podem repetir coletiva enquanto pending
    }
    if (isSpecial) {
      if (!specialKey) return false;
      return (state.livelife.pressSpecialDoneKeys ?? []).includes(specialKey);
    }
    if (!targetMatch) return false;
    if (context === 'pre_match') {
      return (state.livelife.pressPreDoneDates ?? []).includes(targetMatch.date.slice(0, 10));
    }
    return (state.livelife.pressPostDoneMatchIds ?? []).includes(targetMatch.id);
  }, [context, targetMatch, state.livelife, isSpecial, specialKey]);

  const recentResults = useMemo(
    () =>
      state.matches
        .filter(m => m.status === 'completed' && m.result)
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 5)
        .map(m => m.result!),
    [state.matches],
  );

  const pressFriction = state.livelife.pressFriction ?? 0;

  const situation = useMemo(() => {
    if (context === 'pre_match' && !targetMatch) return null;
    if (context === 'post_match' && !targetMatch) return null;
    if (context === 'callup' && !targetMatch) return null;
    if (context === 'injury' && !playerId) return null;
    // story_arc e finance_crisis não exigem partida

    return buildPressSituation({
      context,
      match: targetMatch,
      players: state.players,
      recentResults,
      boardConfidence: state.team?.boardConfidence ?? 50,
      supporterConfidence: state.team?.supporterConfidence ?? 50,
      mediaConfidence: state.team?.mediaConfidence ?? 50,
      transferHistory: state.transfers.history,
      currentDate: state.currentDate,
      injuredPlayerId: playerId,
      balance: state.finance.balance,
      wageBill: wageBill(state.players),
      pressFriction,
    });
  }, [
    context,
    targetMatch,
    state.players,
    recentResults,
    state.team,
    state.transfers.history,
    state.currentDate,
    playerId,
    state.finance.balance,
    pressFriction,
  ]);

  const questions = useMemo(() => {
    if (!situation) return [];
    return pickPressQuestions(situation, 3);
  }, [situation]);

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [result, setResult] = useState<PressConferenceResult | null>(null);

  function choose(optionId: string) {
    const nextAnswers = [...answers, optionId];
    setAnswers(nextAnswers);
    if (step + 1 >= questions.length) {
      const out = runPressConference({
        context,
        matchResult: targetMatch?.result ?? null,
        questions,
        answers: nextAnswers,
        teamName: state.team?.name ?? 'Clube',
        opponent: targetMatch?.opponent,
        managerName: state.manager?.name,
        recentSigningId: situation?.recentSigningId,
        recentSigningName: situation?.recentSigningName,
        injuredPlayerName: situation?.injuredPlayerName,
        pressFriction,
      });
      applyPressConference({
        context,
        matchId: targetMatch?.id,
        deltas: out.deltas,
        headline: out.headline,
        playerMorale: out.playerMorale,
        aggressiveCount: out.aggressiveCount,
        specialDoneKey: context === 'story_arc' ? undefined : specialKey,
      });
      setResult(out);
    } else {
      setStep(s => s + 1);
    }
  }

  if (!state.team) {
    return (
      <div className={styles.page}>
        <p className={styles.empty}>Coletivas disponíveis no modo técnico.</p>
      </div>
    );
  }

  if (context === 'pre_match' && !targetMatch) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>LiveLife · LIFE</p>
          <h1 className={styles.brand}>Coletiva</h1>
        </header>
        <div className={styles.empty}>
          Nenhuma partida agendada para hoje. Avance o calendário até um dia de jogo
          ou agende uma partida.
          <div className={styles.actions} style={{ marginTop: 16 }}>
            <button type="button" className={styles.btnGhost} onClick={() => navigate('/dashboard')}>
              Voltar
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (context === 'post_match' && !targetMatch) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>LiveLife · LIFE</p>
          <h1 className={styles.brand}>Coletiva</h1>
        </header>
        <div className={styles.empty}>
          Finalize uma partida para fazer a coletiva pós-jogo.
          <div className={styles.actions} style={{ marginTop: 16 }}>
            <button type="button" className={styles.btnGhost} onClick={() => navigate('/dashboard')}>
              Voltar
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (context === 'callup' && !targetMatch) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>LiveLife · LIFE</p>
          <h1 className={styles.brand}>Coletiva</h1>
        </header>
        <div className={styles.empty}>
          Nenhuma partida importante próxima para coletiva de convocação.
          <div className={styles.actions} style={{ marginTop: 16 }}>
            <button type="button" className={styles.btnGhost} onClick={() => navigate('/dashboard')}>
              Voltar
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (context === 'injury' && !playerId) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>LiveLife · LIFE</p>
          <h1 className={styles.brand}>Coletiva</h1>
        </header>
        <div className={styles.empty}>
          Nenhum atleta com lesão grave selecionado.
          <div className={styles.actions} style={{ marginTop: 16 }}>
            <button type="button" className={styles.btnGhost} onClick={() => navigate('/dashboard')}>
              Voltar
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (alreadyDone && !result) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>LiveLife · LIFE</p>
          <h1 className={styles.brand}>Coletiva</h1>
          <p className={styles.meta}>{contextLabel(context)}</p>
        </header>
        <div className={styles.empty}>
          Esta coletiva já foi realizada.
          <div className={styles.actions} style={{ marginTop: 16 }}>
            <button type="button" className={styles.btnPrimary} onClick={() => navigate('/social')}>
              Ver ClubOSocial
            </button>
            <button type="button" className={styles.btnGhost} onClick={() => navigate('/dashboard')}>
              Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (result) {
    const d = result.deltas;
    const nextFriction = Math.min(
      100,
      Math.max(
        0,
        (pressFriction ?? 0) +
          (result.aggressiveCount > 0 ? result.aggressiveCount * 14 : -3),
      ),
    );
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>LiveLife · LIFE</p>
          <h1 className={styles.brand}>Coletiva</h1>
        </header>
        <div className={styles.card}>
          <h2 className={styles.summaryTitle}>Encerrada</h2>
          <p className={styles.headline}>{result.headline}</p>
          <div className={styles.deltas}>
            <DeltaCell label="Torcida" value={d.supporterConfidence} />
            <DeltaCell label="Elenco" value={d.squadMorale} />
            <DeltaCell label="Diretoria" value={d.boardConfidence} />
            <DeltaCell label="Mídia" value={d.mediaConfidence} />
            {(result.playerMorale ?? []).map(pm => {
              const name =
                state.players.find(p => p.id === pm.playerId)?.name ?? 'Reforço';
              return (
                <DeltaCell key={pm.playerId} label={name} value={pm.delta} />
              );
            })}
          </div>
          <p className={styles.mediaHint}>
            A mídia sobe pouco e cai mais. Respostas agressivas aumentam o atrito
            {result.aggressiveCount > 0
              ? ` (+${result.aggressiveCount} nesta sessão)`
              : ''}
            — com atrito alto fica bem mais difícil recuperar a relação
            {nextFriction >= 30 ? ` (atrito agora ~${nextFriction})` : ''}.
          </p>
          <div className={styles.actions}>
            <button type="button" className={styles.btnPrimary} onClick={() => navigate('/social')}>
              Ver manchete
            </button>
            <button
              type="button"
              className={styles.btnGhost}
              onClick={() =>
                navigate(
                  context === 'pre_match' && targetMatch
                    ? `/match/${targetMatch.id}/pulse`
                    : '/dashboard',
                )
              }
            >
              {context === 'pre_match' ? 'Ir ao Pulse' : 'Dashboard'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const q = questions[step];
  if (!q) {
    return (
      <div className={styles.page}>
        <div className={styles.empty}>Sem perguntas disponíveis.</div>
      </div>
    );
  }

  const metaBits = [
    contextLabel(context),
    targetMatch ? `vs ${targetMatch.opponent}` : null,
    situation?.injuredPlayerName ?? null,
    state.manager?.name ?? null,
    pressFriction >= 30 ? `atrito ${pressFriction}` : null,
  ].filter(Boolean);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>LiveLife · LIFE</p>
        <h1 className={styles.brand}>Coletiva</h1>
        <p className={styles.meta}>{metaBits.join(' · ')}</p>
      </header>

      <div className={styles.progress} aria-hidden>
        {questions.map((_, i) => (
          <span key={i} className={`${styles.dot} ${i <= step ? styles.dotOn : ''}`} />
        ))}
      </div>

      <div className={styles.card}>
        <p className={styles.prompt}>
          <span style={{ opacity: 0.65, fontSize: 12, display: 'block', marginBottom: 6 }}>
            Pergunta {step + 1}/{questions.length}
          </span>
          {q.prompt}
        </p>
        <div className={styles.options}>
          {q.options.map(opt => (
            <button
              key={opt.id}
              type="button"
              className={styles.option}
              onClick={() => choose(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
