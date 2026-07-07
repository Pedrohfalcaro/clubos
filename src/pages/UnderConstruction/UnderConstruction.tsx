import { useNavigate, useParams, useLocation } from 'react-router-dom';
import styles from './UnderConstruction.module.css';

const TITLES: Record<string, string> = {
  treinamento: 'Treinamento',
  transferencias: 'Transferências',
  diretoria: 'Diretoria',
  financas: 'Finanças',
  trofeus: 'Sala de Troféus',
  'redes-sociais': 'Redes Sociais',
  manchetes: 'Manchetes',
  coletivas: 'Coletivas',
  'social-jogadores': 'Jogadores',
  pessoal: 'Pessoal',
  metas: 'Metas',
  conquistas: 'Conquistas',
  redes: 'Redes Sociais',
  relations: 'Relacionamentos',
};

export default function UnderConstruction() {
  const { section } = useParams<{ section: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const title = TITLES[section ?? ''] ?? 'Seção';
  const isPlayer = location.pathname.startsWith('/player');
  const dashboardPath = isPlayer ? '/player/dashboard' : '/dashboard';

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <span className={styles.icon}>🚧</span>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.text}>Em construção</p>
        <p className={styles.sub}>
          Esta seção estará disponível em uma atualização futura do ClubOS.
        </p>
        <button type="button" className={styles.back} onClick={() => navigate(dashboardPath)}>
          Voltar ao Dashboard
        </button>
      </div>
    </div>
  );
}
