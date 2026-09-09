import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useGame } from '../../../context/GameContext';
import {
  buildPlayerPressSituation,
  pickPlayerPressQuestions,
  runPlayerPressConference,
} from '../../../pressconference/playerEngine';
import type { PlayerPressConferenceResult, PlayerPressContext } from '../../../types/PlayerPressConference';
import styles from '../../PressConference/PressConference.module.css';

function parseContext(raw: string | null): PlayerPressContext {
  return raw === 'post' || raw === 'post_match' ? 'post_match' : 'pre_match';
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

export default function PlayerPressConference() {
  const { state, applyPlayerPressConference } = useGame();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const player = state.careerPlayer;

  const context = parseContext(params.get('ctx'));

  const today = state.currentDate?.slice(0, 10);
  const targetMatch =
    context === 'pre_match'
      ? state.matches.find(m => m.status === 'scheduled' && m.date.slice(0, 10) === today) ?? null
      : state.matches
          .filter(m => m.status === 'completed')
          .sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;

  const alreadyDone = useMemo(() => {
    if (!targetMatch) return false;
    if (context === 'pre_match') {
      return (state.livelife.pressPreDoneDates ?? []).includes(targetMatch.date.slice(0, 10));
    }
    return (state.livelife.pressPostDoneMatchIds ?? []).includes(targetMatch.id);
  }, [context, targetMatch, state.livelife]);

  const situation = useMemo(() => {
    if (!player || !targetMatch) return null;
    const perf = targetMatch.playerPerformance;
    return buildPlayerPressSituation({
      context,
      result: targetMatch.result,
      goals: perf?.goals ?? 0,
      assists: perf?.assists ?? 0,
      rating: perf?.rating ?? null,
      wasStarter: perf?.role === 'starter',
      wasBenched: perf?.role === 'notCalled',
      opponent: targetMatch.opponent,
      morale: player.morale,
      coachConfidence: player.coachConfidence,
      fanReputation: player.fanReputation,
    });
  }, [context, targetMatch, player]);

  const questions = useMemo(() => {
    if (!situation) return [];
    return pickPlayerPressQuestions(situation, 3);
  }, [situation]);

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [result, setResult] = useState<PlayerPressConferenceResult | null>(null);

  function choose(optionId: string) {
    if (!player) return;
    const nextAnswers = [...answers, optionId];
    setAnswers(nextAnswers);
    if (step + 1 >= questions.length) {
      const out = runPlayerPressConference({
        context,
        questions,
        answers: nextAnswers,
        playerName: player.name,
        opponent: targetMatch?.opponent,
      });
      applyPlayerPressConference({
        context,
        matchId: targetMatch?.id,
        deltas: out.deltas,
        headline: out.headline,
      });
      setResult(out);
    } else {
      setStep(s => s + 1);
    }
  }

  if (!player) {
    return (
      <div className={styles.page}>
        <p className={styles.empty}>Coletivas disponíveis no modo jogador.</p>
      </div>
    );
  }

  if (!targetMatch) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>ClubOS</p>
          <h1 className={styles.brand}>Coletiva</h1>
        </header>
        <div className={styles.empty}>
          {context === 'pre_match'
            ? 'Nenhuma partida agendada para hoje.'
            : 'Registre o desempenho de uma partida para fazer a coletiva pós-jogo.'}
          <div className={styles.actions} style={{ marginTop: 16 }}>
            <button type="button" className={styles.btnGhost} onClick={() => navigate('/player/dashboard')}>
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
          <p className={styles.eyebrow}>ClubOS</p>
          <h1 className={styles.brand}>Coletiva</h1>
        </header>
        <div className={styles.empty}>
          Esta coletiva já foi realizada.
          <div className={styles.actions} style={{ marginTop: 16 }}>
            <button type="button" className={styles.btnPrimary} onClick={() => navigate('/player/social')}>
              Ver redes sociais
            </button>
            <button type="button" className={styles.btnGhost} onClick={() => navigate('/player/dashboard')}>
              Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (result) {
    const d = result.deltas;
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>ClubOS</p>
          <h1 className={styles.brand}>Coletiva</h1>
        </header>
        <div className={styles.card}>
          <h2 className={styles.summaryTitle}>Encerrada</h2>
          <p className={styles.headline}>{result.headline}</p>
          <div className={styles.deltas}>
            <DeltaCell label="Técnico" value={d.coachConfidence} />
            <DeltaCell label="Torcida" value={d.fanReputation} />
            <DeltaCell label="Moral" value={d.morale} />
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.btnPrimary} onClick={() => navigate('/player/social')}>
              Ver manchete
            </button>
            <button type="button" className={styles.btnGhost} onClick={() => navigate('/player/dashboard')}>
              Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const question = questions[step];
  if (!question) {
    return (
      <div className={styles.page}>
        <p className={styles.empty}>Nenhuma pergunta disponível agora.</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>ClubOS</p>
        <h1 className={styles.brand}>Coletiva {context === 'pre_match' ? 'pré-jogo' : 'pós-jogo'}</h1>
        <p className={styles.meta}>Pergunta {step + 1} de {questions.length}</p>
      </header>
      <div className={styles.card}>
        <p className={styles.prompt}>{question.prompt}</p>
        <div className={styles.options}>
          {question.options.map(opt => (
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
