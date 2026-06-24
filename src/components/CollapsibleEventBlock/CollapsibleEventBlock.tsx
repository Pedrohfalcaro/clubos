import styles from './CollapsibleEventBlock.module.css';

interface CollapsibleEventBlockProps {
  isComplete: boolean;
  expanded: boolean;
  summary: string;
  onEdit: () => void;
  onRemove?: () => void;
  children: React.ReactNode;
}

export default function CollapsibleEventBlock({
  isComplete,
  expanded,
  summary,
  onEdit,
  onRemove,
  children,
}: CollapsibleEventBlockProps) {
  if (isComplete && !expanded) {
    return (
      <div className={styles.collapsed}>
        <span className={styles.summary}>{summary}</span>
        <div className={styles.collapsedActions}>
          <button type="button" className={styles.editBtn} onClick={onEdit}>
            Editar
          </button>
          {onRemove && (
            <button type="button" className={styles.removeBtn} onClick={onRemove} aria-label="Remover">
              ×
            </button>
          )}
        </div>
      </div>
    );
  }

  return <div className={styles.expanded}>{children}</div>;
}
