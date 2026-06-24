import { useState } from 'react';
import styles from './Tutorial.module.css';

const STEPS = [
  {
    title: 'Bem-vindo ao ClubOS!',
    body: 'Este é seu painel de controle. Aqui você acompanha a próxima partida, resultados recentes e estatísticas do clube.',
    section: 'Dashboard',
  },
  {
    title: 'Clube',
    body: 'Gerencie elenco, táticas e (em breve) treinamento, transferências, diretoria, finanças e sala de troféus.',
    section: 'Clube',
  },
  {
    title: 'Jogos',
    body: 'Registre partidas, consulte o calendário e acompanhe suas competições da temporada.',
    section: 'Jogos',
  },
  {
    title: 'Social & Manager',
    body: 'Seções de redes sociais, manchetes e gestão pessoal estão chegando em atualizações futuras.',
    section: 'Em breve',
  },
  {
    title: 'Pronto para começar!',
    body: 'Configure sua tática, escale o time e registre sua primeira partida. Boa sorte, técnico!',
    section: 'Dica',
  },
];

interface TutorialProps {
  onComplete: () => void;
}

export default function Tutorial({ onComplete }: TutorialProps) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <span className={styles.badge}>{current.section}</span>
        <h2 className={styles.title}>{current.title}</h2>
        <p className={styles.body}>{current.body}</p>

        <div className={styles.dots}>
          {STEPS.map((_, i) => (
            <span key={i} className={`${styles.dot} ${i === step ? styles.dotActive : ''}`} />
          ))}
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.skip} onClick={onComplete}>
            Pular
          </button>
          <button
            type="button"
            className={styles.next}
            onClick={() => (isLast ? onComplete() : setStep(s => s + 1))}
          >
            {isLast ? 'Começar' : 'Próximo'}
          </button>
        </div>
      </div>
    </div>
  );
}
