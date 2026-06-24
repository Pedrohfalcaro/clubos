import { useState } from 'react';
import type { TutorialStep } from '../../utils/tutorials';
import styles from './Tutorial.module.css';

interface TutorialProps {
  steps: TutorialStep[];
  onComplete: () => void;
}

export default function Tutorial({ steps, onComplete }: TutorialProps) {
  const [step, setStep] = useState(0);
  const current = steps[step];
  const isLast = step === steps.length - 1;

  if (!current) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <span className={styles.badge}>{current.section}</span>
        <h2 className={styles.title}>{current.title}</h2>
        <p className={styles.body}>{current.body}</p>

        {steps.length > 1 && (
          <div className={styles.dots}>
            {steps.map((_, i) => (
              <span key={i} className={`${styles.dot} ${i === step ? styles.dotActive : ''}`} />
            ))}
          </div>
        )}

        <div className={styles.actions}>
          <button type="button" className={styles.skip} onClick={onComplete}>
            Pular
          </button>
          <button
            type="button"
            className={styles.next}
            onClick={() => (isLast ? onComplete() : setStep(s => s + 1))}
          >
            {isLast ? 'Entendi' : 'Próximo'}
          </button>
        </div>
      </div>
    </div>
  );
}
