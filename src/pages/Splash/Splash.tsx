import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Splash.module.css';

export default function Splash() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => navigate('/menu'), 2200);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <div className={styles.logo}>⬡</div>
        <h1 className={styles.title}>ClubOS</h1>
        <p className={styles.tagline}>Seu clube. Suas regras.</p>
        <div className={styles.loader}>
          <div className={styles.loaderBar} />
        </div>
        <span className={styles.loadingText}>Carregando...</span>
      </div>
    </div>
  );
}
