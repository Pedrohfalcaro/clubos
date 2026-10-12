import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { contrastText, gkShirtColor } from '../../utils/clubColors';
import {
  buildResult,
  computeRatings,
  createWorld,
  isFinished,
  runShootout,
  stepWorld,
  substitute,
  teamStats,
  TUNING,
} from '../../training/engine';
import type { Agent, MatchEvent, ShootoutResult, Team, TeamStats, World } from '../../training/engine';
import {
  buildMatchSetup,
  rolesOf,
  sessionFromResult,
  toEnginePlayer,
  type TrainingDraft,
} from '../../training/session';
import type { Player } from '../../types/Player';
import { computeView, drawPitch, type View } from '../../training/render/drawPitch';
import { drawWorld, takeSnapshot, type AgentLook, type Snapshot } from '../../training/render/drawWorld';
import type { TrainingSession } from '../../types/Training';
import KitPreview from '../../components/KitEditor/KitPreview';
import { createSolidKit, kitNumberColor, type Kit } from '../../types/Kit';
import { useTrainingScope, type TrainingScope, type TrainingScopeKind } from '../TrainingPit/useTrainingScope';
import SummaryModal from '../TrainingPit/SummaryModal';
import BenchModal from './BenchModal';
import ShootoutPanel from './ShootoutPanel';
import StatsPanel from './StatsPanel';
import styles from './TrainingMatch.module.css';

const SPEEDS = [1, 2, 4] as const;
const AWAY_GK_COLOR = '#38bdf8';

function clockText(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] ?? name;
}

interface LiveRow {
  id: string;
  number: string;
  name: string;
  rating: number;
  /** já levou cartão amarelo (nome em amarelo para lembrar) */
  yellow: boolean;
  /** variação recente da nota (para a seta de tendência) */
  delta: number;
}

interface Hud {
  scoreA: number;
  scoreB: number;
  half: string;
  clock: string;
}

/** Uniforme completo de um time do treino (treinos antigos só têm a cor base). */
function kitOf(t: { kit: string; kitDesign?: Kit }): Kit {
  return t.kitDesign ?? createSolidKit(t.kit);
}

function MatchScreen({ draft, scope, free }: { draft: TrainingDraft; scope: TrainingScope; free: boolean }) {
  const navigate = useNavigate();
  // a sessão é registrada pelo escopo mais recente (o loop do jogo não pode reiniciar a cada render)
  const scopeRef = useRef(scope);
  useEffect(() => {
    scopeRef.current = scope;
  }, [scope]);

  const [world] = useState<World>(() => createWorld(buildMatchSetup(draft, scope.players)));

  const names = useMemo(() => new Map(scope.players.map(p => [p.id, p.name])), [scope.players]);
  const nameOf = useCallback((id: string) => names.get(id) ?? 'Jogador', [names]);

  const playersById = useMemo(() => new Map(scope.players.map(p => [p.id, p])), [scope.players]);
  const lookCache = useRef(new Map<string, AgentLook>());
  const lookOf = useCallback(
    (a: Agent): AgentLook => {
      const hit = lookCache.current.get(a.id);
      if (hit) return hit;
      const p = playersById.get(a.id);
      const isGk = a.group === 'GK';
      const color = isGk
        ? a.team === 'a'
          ? gkShirtColor(scope.primary, scope.secondary)
          : AWAY_GK_COLOR
        : draft.teams[a.team].kit;
      const look: AgentLook = {
        color,
        kit: isGk ? undefined : kitOf(draft.teams[a.team]),
        textColor: isGk ? contrastText(color) : kitNumberColor(kitOf(draft.teams[a.team])),
        // sem número de camisa cadastrado, mostra a função (ZAG, MC, ATA...)
        number: p?.number != null ? String(p.number) : a.role,
        label: shortName(p?.name ?? ''),
      };
      lookCache.current.set(a.id, look);
      return look;
    },
    [playersById, scope.primary, scope.secondary, draft.teams],
  );

  const [hud, setHud] = useState<Hud>({ scoreA: 0, scoreB: 0, half: '1º tempo', clock: clockText(draft.halfDurationSec) });
  const [banner, setBanner] = useState<string | null>(null);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [paused, setPaused] = useState(false);
  const [portrait, setPortrait] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [finished, setFinished] = useState<TrainingSession | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  /** Empate: o usuário escolhe encerrar ou decidir nos pênaltis (só exibição, não altera o placar salvo). */
  const [drawResolved, setDrawResolved] = useState(false);
  const [shootout, setShootout] = useState<ShootoutResult | null>(null);
  const [showRatings, setShowRatings] = useState(true);
  const [showStats, setShowStats] = useState(false);
  const [benchOpen, setBenchOpen] = useState(false);
  const [, setSubVersion] = useState(0);
  const [liveStats, setLiveStats] = useState<Record<Team, TeamStats> | null>(null);
  const [live, setLive] = useState<{ a: LiveRow[]; b: LiveRow[] } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef<View>({ ox: 0, oy: 0, ppm: 1 });
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });
  const panelRef = useRef<HTMLDivElement>(null);
  const speedRef = useRef<number>(1);
  const pausedRef = useRef(false);
  const recordedRef = useRef(false);
  const eventsSeenRef = useRef(0);
  const bannerTimerRef = useRef<number | null>(null);

  const hold = paused || portrait || confirmExit || benchOpen || finished !== null;
  useEffect(() => {
    pausedRef.current = hold;
    speedRef.current = speed;
  }, [hold, speed]);

  const finish = useCallback(() => {
    if (recordedRef.current) return;
    recordedRef.current = true;
    // o escopo aplica moral/lesão (clube) e grava no histórico certo (clube ou Seleção)
    // treino livre não grava nada: sem histórico, sem moral, sem lesão
    const built = sessionFromResult(draft, buildResult(world), rolesOf(draft), world.subs);
    const session = free ? built : scopeRef.current.register(built);
    setFinished(session);
  }, [draft, world, free]);

  const showBanner = useCallback((text: string) => {
    setBanner(text);
    if (bannerTimerRef.current) window.clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = window.setTimeout(() => setBanner(null), 2400);
  }, []);

  const handleEvents = useCallback(
    (events: MatchEvent[]) => {
      for (let i = eventsSeenRef.current; i < events.length; i++) {
        const e = events[i];
        if (e.type === 'goal') {
          const who = e.playerId ? nameOf(e.playerId) : '';
          showBanner(e.ownGoal ? `GOL CONTRA · ${who}` : `GOL! ${who}`);
        } else if (e.type === 'half-time') {
          showBanner('Fim do 1º tempo');
        } else if (e.type === 'penalty') {
          showBanner('PÊNALTI!');
        } else if (e.type === 'corner') {
          showBanner('Escanteio');
        } else if (e.type === 'offside') {
          showBanner(`Impedimento · ${e.playerId ? nameOf(e.playerId) : ''}`);
        } else if (e.type === 'card') {
          const who = e.playerId ? nameOf(e.playerId) : '';
          showBanner(
            e.card === 'red'
              ? `Cartão vermelho · ${who}`
              : e.card === 'second-yellow'
                ? `Segundo amarelo — expulso · ${who}`
                : `Cartão amarelo · ${who}`,
          );
        } else if (e.type === 'foul') {
          showBanner(`Falta · ${e.playerId ? nameOf(e.playerId) : ''}`);
        }
      }
      eventsSeenRef.current = events.length;
    },
    [nameOf, showBanner],
  );

  // Orientação e tamanho
  useEffect(() => {
    const el = containerRef.current;
    const canvas = canvasRef.current;
    if (!el || !canvas) return;

    function resize() {
      const rect = el!.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      sizeRef.current = { w: rect.width, h: rect.height, dpr };
      canvas!.width = Math.round(rect.width * dpr);
      canvas!.height = Math.round(rect.height * dpr);
      const panelH = panelRef.current?.offsetHeight ?? 0;
      viewRef.current = computeView(rect.width, rect.height, world.pitch, {
        top: rect.height < 520 ? 52 : 66,
        bottom: panelH + 6,
      });
      setPortrait(window.innerHeight > window.innerWidth && window.innerWidth < 900);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    window.addEventListener('resize', resize);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, [world]);

  // Loop do jogo: passo fixo do motor + desenho interpolado
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let prev: Snapshot = takeSnapshot(world);
    let lastHud = '';
    let lastLive = -Infinity;
    let trendBase: Record<string, number> = {};
    let trendAt = 0;

    function frame(now: number) {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;

      if (!pausedRef.current && !isFinished(world)) {
        acc += dt * speedRef.current;
        let guard = 0;
        while (acc >= TUNING.dt && !isFinished(world) && guard++ < 600) {
          prev = takeSnapshot(world);
          stepWorld(world);
          acc -= TUNING.dt;
        }
        handleEvents(world.events);
        if (isFinished(world)) finish();
      }

      const { w, h, dpr } = sizeRef.current;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.fillStyle = '#0a1a0f';
      ctx!.fillRect(0, 0, w, h);
      drawPitch(ctx!, viewRef.current, draft.format, world.pitch);
      drawWorld(ctx!, viewRef.current, world, prev, Math.min(1, acc / TUNING.dt), lookOf, true, world.phase === 'h2');

      const half =
        world.phase === 'h1' ? '1º tempo' : world.phase === 'h2' ? '2º tempo' : 'Fim de jogo';
      const remaining = world.phase === 'ft' ? 0 : draft.halfDurationSec - world.clock;
      const key = `${world.score.a}|${world.score.b}|${half}|${clockText(remaining)}`;
      if (key !== lastHud) {
        lastHud = key;
        setHud({ scoreA: world.score.a, scoreB: world.score.b, half, clock: clockText(remaining) });
      }

      // Notas ao vivo (2x por segundo): a seta compara com a nota de ~4 s atrás
      if (now - lastLive > 500) {
        lastLive = now;
        const ratings = computeRatings(world);
        if (now - trendAt > 4000) {
          trendBase = { ...ratings };
          trendAt = now;
        }
        const row = (a: Agent): LiveRow => ({
          id: a.id,
          number: lookOf(a).number,
          name: lookOf(a).label,
          rating: ratings[a.id],
          yellow: a.stats.yellows > 0,
          delta: ratings[a.id] - (trendBase[a.id] ?? ratings[a.id]),
        });
        setLive({
          a: world.byTeam.a.map(row),
          b: world.byTeam.b.map(row),
        });
        setLiveStats(teamStats(world));
      }

      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [world, draft.format, draft.halfDurationSec, lookOf, handleEvents, finish]);

  // Pausa automática ao sair da aba e atalhos de teclado
  useEffect(() => {
    const onHide = () => {
      if (document.hidden) setPaused(true);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setPaused(v => !v);
      } else if (e.key === 'Escape') {
        setConfirmExit(v => !v);
      }
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('keydown', onKey);
      if (bannerTimerRef.current) window.clearTimeout(bannerTimerRef.current);
    };
  }, []);

  function toggleFullscreen() {
    const root = document.documentElement;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    root
      .requestFullscreen()
      .then(() => {
        const orientation = screen.orientation as ScreenOrientation & {
          lock?: (o: string) => Promise<void>;
        };
        return orientation.lock?.('landscape');
      })
      .catch(() => {});
  }

  /** Substituição pelo banco: o reserva assume a função e a posição de quem sai. */
  function handleSub(team: Team, outId: string, incoming: Player) {
    const out = world.agents.find(a => a.id === outId);
    if (!out) return;
    if (!substitute(world, outId, toEnginePlayer(incoming, out.role))) return;
    handleEvents(world.events);
    showBanner(`Substituição · ${nameOf(outId)} ↔ ${incoming.name}`);
    setLiveStats(teamStats(world));
    // atualiza o painel de notas já com o reserva (nota 6,0), sem esperar o próximo ciclo
    const ratings = computeRatings(world);
    const row = (a: Agent): LiveRow => ({
      id: a.id,
      number: lookOf(a).number,
      name: lookOf(a).label,
      rating: ratings[a.id],
      yellow: a.stats.yellows > 0,
      delta: 0,
    });
    setLive({ a: world.byTeam.a.map(row), b: world.byTeam.b.map(row) });
    setSubVersion(v => v + 1);
    void team;
  }

  /** Sair: depois do intervalo o resto é simulado e registrado; antes, nada é gravado. */
  function confirmLeave() {
    setConfirmExit(false);
    if (world.phase === 'h2') {
      let guard = 0;
      while (!isFinished(world) && guard++ < 200000) stepWorld(world);
      handleEvents(world.events);
      finish();
      return;
    }
    navigate(scope.routes.base, { replace: true, state: free ? { tab: 'livre' } : undefined });
  }

  const nameA = draft.teams.a.name;
  const nameB = draft.teams.b.name;
  const mvpName = finished?.mvpId ? nameOf(finished.mvpId) : null;

  return (
    <div className={styles.screen}>
      <div ref={containerRef} className={styles.stage}>
        <canvas ref={canvasRef} className={styles.canvas} />
      </div>

      <div className={styles.hud}>
        <div className={styles.hudSide}>
          <button type="button" className={styles.iconBtn} onClick={() => setConfirmExit(true)}>
            ✕ Sair
          </button>
        </div>

        <div className={styles.scoreboard}>
          <div className={styles.team}>
            <KitPreview kit={kitOf(draft.teams.a)} size={28} />
            <span className={styles.teamName}>{nameA}</span>
          </div>
          <div className={styles.score}>
            <b>{hud.scoreA}</b>
            <span>x</span>
            <b>{hud.scoreB}</b>
          </div>
          <div className={`${styles.team} ${styles.teamRight}`}>
            <span className={styles.teamName}>{nameB}</span>
            <KitPreview kit={kitOf(draft.teams.b)} size={28} />
          </div>
          <div className={styles.clock}>
            {hud.half} · {hud.clock}
          </div>
        </div>

        <div className={`${styles.hudSide} ${styles.hudRight}`}>
          <div className={styles.speed} role="group" aria-label="Velocidade">
            {SPEEDS.map(s => (
              <button
                key={s}
                type="button"
                className={`${styles.speedBtn} ${speed === s ? styles.speedActive : ''}`}
                onClick={() => setSpeed(s)}
              >
                {s}x
              </button>
            ))}
          </div>
          <button type="button" className={styles.iconBtn} onClick={() => setPaused(v => !v)}>
            {paused ? '▶' : '❚❚'}
          </button>
          <button
            type="button"
            className={`${styles.iconBtn} ${showRatings ? styles.iconBtnOn : ''}`}
            onClick={() => setShowRatings(v => !v)}
            title="Notas ao vivo"
          >
            ★ Notas
          </button>
          <button type="button" className={styles.iconBtn} onClick={() => setBenchOpen(true)} title="Substituições">
            ⇄ Banco
          </button>
          <button
            type="button"
            className={`${styles.iconBtn} ${showStats ? styles.iconBtnOn : ''}`}
            onClick={() => setShowStats(v => !v)}
            title="Estatísticas da partida"
          >
            ▦ Stats
          </button>
          <button type="button" className={styles.iconBtn} onClick={toggleFullscreen} title="Tela cheia">
            ⛶
          </button>
        </div>
      </div>

      <div ref={panelRef} className={styles.panel} hidden={!showRatings}>
        {live &&
          (['a', 'b'] as const).map(side => (
            <div key={side} className={styles.panelRow}>
              <span className={styles.chip} style={{ background: draft.teams[side].kit }} />
              <div className={styles.players}>
                {live[side].map(r => (
                  <span
                    key={r.id}
                    className={`${styles.pChip} ${r.rating >= 7 ? styles.good : r.rating < 5.5 ? styles.bad : ''}`}
                  >
                    <i>{r.number}</i>
                    <em className={r.yellow ? styles.yellowName : undefined}>{r.name}</em>
                    <b>{r.rating.toFixed(1)}</b>
                    <u className={r.delta > 0.05 ? styles.up : r.delta < -0.05 ? styles.down : styles.flat}>
                      {r.delta > 0.05 ? '▲' : r.delta < -0.05 ? '▼' : '·'}
                    </u>
                  </span>
                ))}
              </div>
            </div>
          ))}
      </div>

      {showStats && liveStats && (
        <StatsPanel
          stats={liveStats}
          kit={{ a: draft.teams.a.kit, b: draft.teams.b.kit }}
          teamName={{ a: nameA, b: nameB }}
        />
      )}

      {banner && <div className={styles.banner}>{banner}</div>}

      {benchOpen && (
        <BenchModal
          world={world}
          players={scope.players}
          gameDate={scope.currentDate}
          kit={{ a: draft.teams.a.kit, b: draft.teams.b.kit }}
          teamName={{ a: nameA, b: nameB }}
          onSub={handleSub}
          onClose={() => setBenchOpen(false)}
        />
      )}

      {paused && !finished && !confirmExit && !portrait && !benchOpen && (
        <div className={styles.overlay}>
          <div className={styles.card}>
            <h2>Pausado</h2>
            <p>Espaço ou P para continuar.</p>
            <button type="button" className={styles.primaryBtn} onClick={() => setPaused(false)}>
              Continuar
            </button>
          </div>
        </div>
      )}

      {portrait && (
        <div className={`${styles.overlay} ${styles.rotate}`}>
          <div className={styles.card}>
            <div className={styles.phone} aria-hidden="true" />
            <h2>Gire o aparelho</h2>
            <p>O Training Pit é jogado na horizontal. O jogo está em pausa.</p>
          </div>
        </div>
      )}

      {confirmExit && (
        <div className={styles.overlay}>
          <div className={styles.card}>
            <h2>Sair do treino?</h2>
            <p>
              {world.phase === 'h2'
                ? 'O restante da partida será simulado agora e o treino será registrado.'
                : 'Antes do intervalo, o treino é descartado e não conta como o treino da semana.'}
            </p>
            <div className={styles.row}>
              <button type="button" className={styles.ghostBtn} onClick={() => setConfirmExit(false)}>
                Continuar jogando
              </button>
              <button type="button" className={styles.primaryBtn} onClick={confirmLeave}>
                Sair
              </button>
            </div>
          </div>
        </div>
      )}

      {finished && finished.score.a === finished.score.b && !drawResolved && !shootout && (
        <div className={styles.overlay}>
          <div className={styles.card}>
            <h2>Empate</h2>
            <p className={styles.final}>
              {nameA} <b>{finished.score.a}</b> x <b>{finished.score.b}</b> {nameB}
            </p>
            <p>Encerrar a partida ou decidir nos pênaltis?</p>
            <div className={styles.row}>
              <button type="button" className={styles.ghostBtn} onClick={() => setDrawResolved(true)}>
                Encerrar partida
              </button>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => setShootout(runShootout(world, computeRatings(world), world.setup.seed))}
              >
                Decisão por pênaltis
              </button>
            </div>
          </div>
        </div>
      )}

      {finished && shootout && !drawResolved && (
        <ShootoutPanel
          result={shootout}
          nameA={nameA}
          nameB={nameB}
          nameOf={nameOf}
          onDone={() => setDrawResolved(true)}
        />
      )}

      {finished && !showSummary && (finished.score.a !== finished.score.b || drawResolved) && (
        <div className={styles.overlay}>
          <div className={styles.card}>
            <h2>{free ? 'Fim de jogo' : 'Fim de treino'}</h2>
            <p className={styles.final}>
              {nameA} <b>{finished.score.a}</b> x <b>{finished.score.b}</b> {nameB}
            </p>
            {shootout && (
              <p>
                Pênaltis: <strong>{shootout.winner === 'a' ? nameA : nameB}</strong> venceu por{' '}
                {shootout.score.a} x {shootout.score.b}
              </p>
            )}
            {free && <p>Treino livre: nada foi salvo no histórico, no elenco ou na moral.</p>}
            {mvpName && (
              <p>
                Melhor em campo: <strong>{mvpName}</strong> ({finished.ratings[finished.mvpId ?? '']?.toFixed(1)})
              </p>
            )}
            {finished.open && (
              <p>
                Treino aberto: a imprensa publicou as escalações e os destaques no <strong>Pulse</strong>.
              </p>
            )}
            {finished.injuries.length > 0 && (
              <p>
                Lesão no treino:{' '}
                <strong>
                  {finished.injuries.map(i => `${nameOf(i.playerId)} (${i.days} dias)`).join(', ')}
                </strong>
              </p>
            )}
            <div className={styles.row}>
              <button type="button" className={styles.ghostBtn} onClick={() => setShowSummary(true)}>
                Ver notas
              </button>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => navigate(scope.routes.base, { replace: true, state: free ? { tab: 'livre' } : undefined })}
              >
                Voltar ao treinamento
              </button>
            </div>
          </div>
        </div>
      )}

      {finished && showSummary && (
        <SummaryModal session={finished} onClose={() => setShowSummary(false)} nameOf={nameOf} />
      )}
    </div>
  );
}

export default function TrainingMatch({ kind }: { kind: TrainingScopeKind }) {
  const scope = useTrainingScope(kind);
  const location = useLocation();
  const navState = location.state as { draft?: TrainingDraft; free?: boolean } | null;
  const draft = navState?.draft;
  const free = navState?.free === true;
  if (!draft) return <Navigate to={scope.routes.base} replace />;
  // `key` garante um motor novo se o usuário iniciar outro treino na mesma sessão
  return <MatchScreen key={draft.date + draft.teams.a.playerIds.join('')} draft={draft} scope={scope} free={free} />;
}
