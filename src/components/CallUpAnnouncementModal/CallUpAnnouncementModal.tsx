import type { NationalPlayer } from '../../types/NationalTeam';
import {
  POSITION_GROUP_LABELS,
  POSITION_GROUP_ORDER,
  groupByPositionGroup,
} from '../../utils/positionGroups';
import styles from './CallUpAnnouncementModal.module.css';

interface CallUpAnnouncementModalProps {
  open: boolean;
  teamName: string;
  windowLabel: string;
  windowTypeLabel: string;
  listSize: number;
  players: NationalPlayer[];
  callUpNumbers: Record<string, number>;
  onClose: () => void;
  onGoToTactics?: () => void;
}

export default function CallUpAnnouncementModal({
  open,
  teamName,
  windowLabel,
  windowTypeLabel,
  listSize,
  players,
  callUpNumbers,
  onClose,
  onGoToTactics,
}: CallUpAnnouncementModalProps) {
  if (!open) return null;

  const grouped = groupByPositionGroup(players);

  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div
        className={styles.modal}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="callup-announcement-title"
      >
        <header className={styles.header}>
          <div className={styles.headerTop}>
            <p className={styles.eyebrow}>Convocação oficial</p>
            <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Fechar">
              ×
            </button>
          </div>
          <h2 id="callup-announcement-title" className={styles.title}>
            {teamName} divulga a lista para {windowLabel}
          </h2>
          <p className={styles.meta}>
            <span>{windowTypeLabel}</span>
            <span>·</span>
            <span>{players.length}/{listSize} convocados</span>
          </p>
        </header>

        {POSITION_GROUP_ORDER.map(group => {
          const list = grouped[group]
            .slice()
            .sort((a, b) => (callUpNumbers[a.id] ?? 99) - (callUpNumbers[b.id] ?? 99));
          if (list.length === 0) return null;
          return (
            <section key={group} className={styles.groupSection}>
              <h3 className={styles.sectionTitle}>
                {POSITION_GROUP_LABELS[group]} <span className={styles.groupCount}>{list.length}</span>
              </h3>
              <ul className={styles.playerList}>
                {list.map(p => (
                  <li key={p.id} className={styles.playerRow}>
                    <span className={styles.shirtNumber}>{callUpNumbers[p.id] ?? '—'}</span>
                    <span className={styles.playerName}>{p.name}</span>
                    <span className={styles.playerClub}>{p.club}</span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        <div className={styles.actions}>
          <button type="button" className={styles.closeAction} onClick={onClose}>
            Fechar
          </button>
          {onGoToTactics && (
            <button type="button" className={styles.primaryAction} onClick={onGoToTactics}>
              Ir para Tática
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
