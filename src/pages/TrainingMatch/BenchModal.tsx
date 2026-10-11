import { useState } from 'react';
import { computeRatings } from '../../training/engine';
import type { Team, World } from '../../training/engine';
import { ROLE_NAMES } from '../../utils/formations';
import { isPlayerBlockedFromLineup, sortByPosition, type Player } from '../../types/Player';
import styles from './TrainingMatch.module.css';

interface BenchModalProps {
  world: World;
  players: Player[];
  gameDate: string | null;
  kit: Record<Team, string>;
  teamName: Record<Team, string>;
  onSub: (team: Team, outId: string, incoming: Player) => void;
  onClose: () => void;
}

/** Banco de reservas: escolha quem entra e quem sai — o jogo fica pausado enquanto isso. */
export default function BenchModal({ world, players, gameDate, kit, teamName, onSub, onClose }: BenchModalProps) {
  const [side, setSide] = useState<Team>('a');
  const [picked, setPicked] = useState<string | null>(null);

  const used = new Set([...world.agents, ...world.subbedOut].map(a => a.id));
  const bench = sortByPosition(
    players.filter(p => !used.has(p.id) && !isPlayerBlockedFromLineup(p, null, gameDate)),
  );
  const ratings = computeRatings(world);
  const byId = new Map(players.map(p => [p.id, p]));
  const pickedPlayer = picked ? byId.get(picked) : undefined;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" onClick={onClose}>
      <div className={styles.benchCard} onClick={e => e.stopPropagation()}>
        <div className={styles.benchHead}>
          <h2>Banco de reservas</h2>
          <button type="button" className={styles.iconBtn} onClick={onClose}>
            Voltar ao jogo
          </button>
        </div>
        <p className={styles.benchHint}>
          {pickedPlayer
            ? `${pickedPlayer.name} escolhido — agora toque em quem sai.`
            : 'Escolha um reserva e depois o jogador que ele vai substituir. O jogo está pausado.'}
        </p>

        <div className={styles.benchCols}>
          <div className={styles.benchCol}>
            <h3>Reservas ({bench.length})</h3>
            <div className={styles.benchList}>
              {bench.map(p => (
                <button
                  key={p.id}
                  type="button"
                  className={`${styles.benchRow} ${picked === p.id ? styles.benchRowOn : ''}`}
                  onClick={() => setPicked(prev => (prev === p.id ? null : p.id))}
                >
                  <i>{p.number ?? '—'}</i>
                  <span>{p.name}</span>
                  <em>{p.position}</em>
                  <b>{p.overall}</b>
                </button>
              ))}
              {bench.length === 0 && <p className={styles.benchEmpty}>Nenhum reserva disponível.</p>}
            </div>
          </div>

          <div className={styles.benchCol}>
            <div className={styles.benchTabs}>
              {(['a', 'b'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  className={`${styles.benchTab} ${side === t ? styles.benchTabOn : ''}`}
                  onClick={() => setSide(t)}
                >
                  <span className={styles.chip} style={{ background: kit[t] }} />
                  {teamName[t]}
                </button>
              ))}
            </div>
            <div className={styles.benchList}>
              {world.byTeam[side].map(a => {
                const p = byId.get(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    disabled={!pickedPlayer}
                    className={styles.benchRow}
                    onClick={() => {
                      if (!pickedPlayer) return;
                      onSub(side, a.id, pickedPlayer);
                      setPicked(null);
                    }}
                    title={pickedPlayer ? `Sai ${p?.name ?? ''}, entra ${pickedPlayer.name}` : 'Escolha um reserva primeiro'}
                  >
                    <i>{p?.number ?? '—'}</i>
                    <span>{p?.name ?? a.id}</span>
                    <em>{ROLE_NAMES[a.role]}</em>
                    <b>{ratings[a.id]?.toFixed(1)}</b>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
