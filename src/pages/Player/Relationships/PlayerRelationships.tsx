import { useGame } from '../../../context/GameContext';
import shared from '../PlayerShared.module.css';
import styles from '../../Dashboard/Dashboard.module.css';
import extra from './PlayerRelationships.module.css';

function deltaText(n: number): string {
  if (n === 0) return '—';
  return n > 0 ? `+${n}` : `${n}`;
}

function formatDate(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR');
}

function deltaClass(n: number, cls: typeof extra): string {
  if (n > 0) return cls.pos;
  if (n < 0) return cls.neg;
  return '';
}

export default function PlayerRelationships() {
  const { state } = useGame();
  const player = state.careerPlayer;

  if (!player) return null;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Relacionamentos</h1>
          <p className={styles.sub}>Confiança do técnico, torcida e moral — com o motivo de cada ajuste</p>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        <div className={shared.confidenceBar}>
          <p className={shared.confidenceLabel}>Confiança do técnico</p>
          <div className={shared.confidenceTrack}>
            <div className={shared.confidenceFill} style={{ width: `${player.coachConfidence}%` }} />
          </div>
          <p className={shared.confidenceValue}>{player.coachConfidence}%</p>
        </div>
        <div className={shared.confidenceBar}>
          <p className={shared.confidenceLabel}>Reputação com a torcida</p>
          <div className={shared.confidenceTrack}>
            <div className={shared.confidenceFill} style={{ width: `${player.fanReputation}%` }} />
          </div>
          <p className={shared.confidenceValue}>{player.fanReputation}%</p>
        </div>
        <div className={shared.confidenceBar}>
          <p className={shared.confidenceLabel}>Moral</p>
          <div className={shared.confidenceTrack}>
            <div className={shared.confidenceFill} style={{ width: `${player.morale}%` }} />
          </div>
          <p className={shared.confidenceValue}>{player.morale}%</p>
        </div>
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Histórico de ajustes</h2>
        {player.relationshipHistory.length === 0 ? (
          <div className={styles.empty}>
            Nenhum ajuste registrado ainda. Partidas, Pulse e coletivas vão aparecer aqui, com o motivo de cada mudança.
          </div>
        ) : (
          <div className={extra.list}>
            {player.relationshipHistory.map(entry => (
              <div key={entry.id} className={extra.item}>
                <div className={extra.itemMain}>
                  <strong>{entry.reason}</strong>
                  <span className={extra.itemDate}>{formatDate(entry.date)}</span>
                </div>
                <div className={extra.itemDeltas}>
                  <span className={deltaClass(entry.coachDelta, extra)}>Técnico {deltaText(entry.coachDelta)}</span>
                  <span className={deltaClass(entry.fanDelta, extra)}>Torcida {deltaText(entry.fanDelta)}</span>
                  <span className={deltaClass(entry.moraleDelta, extra)}>Moral {deltaText(entry.moraleDelta)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
