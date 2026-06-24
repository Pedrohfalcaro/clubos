import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame, allTeams } from '../../context/GameContext';
import type { Team } from '../../types/Team';
import styles from './TeamSelect.module.css';

function barWidth(value: number, max: number): number {
  return max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
}

interface TeamCardProps {
  team: Team;
  maxBudget: number;
  maxFans: number;
  isInfoOpen: boolean;
  onToggleInfo: () => void;
  onSelect: () => void;
}

function TeamCard({ team, maxBudget, maxFans, isInfoOpen, onToggleInfo, onSelect }: TeamCardProps) {
  return (
    <article className={`${styles.card} ${isInfoOpen ? styles.cardExpanded : ''}`}>
      <div
        className={styles.cardMain}
        onClick={onSelect}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && onSelect()}
      >
        <div className={styles.cardTop}>
          <div className={styles.shield}>⚽</div>
          <div className={styles.cardTitles}>
            <h2 className={styles.teamName}>{team.name}</h2>
            <span className={styles.nickname}>{team.nickname}</span>
          </div>
          <button
            type="button"
            className={`${styles.infoBtn} ${isInfoOpen ? styles.infoBtnActive : ''}`}
            onClick={e => {
              e.stopPropagation();
              onToggleInfo();
            }}
            aria-expanded={isInfoOpen}
            title="Sobre o clube"
          >
            ?
          </button>
        </div>

        <div className={styles.bars}>
          <div className={styles.barRow}>
            <span className={styles.barIcon} title="Orçamento">💰</span>
            <div className={styles.barTrack}>
              <div className={styles.barFill} style={{ width: `${barWidth(team.budget, maxBudget)}%` }} />
            </div>
          </div>
          <div className={styles.barRow}>
            <span className={styles.barIcon} title="Torcedores">👥</span>
            <div className={styles.barTrack}>
              <div className={styles.barFill} style={{ width: `${barWidth(team.fans, maxFans)}%` }} />
            </div>
          </div>
          <div className={styles.barRow}>
            <span className={styles.barIcon} title="Diretoria">🏛</span>
            <div className={styles.barTrack}>
              <div className={styles.barFill} style={{ width: `${team.boardConfidence}%` }} />
            </div>
          </div>
          <div className={styles.barRow}>
            <span className={styles.barIcon} title="Torcida">📣</span>
            <div className={styles.barTrack}>
              <div className={styles.barFill} style={{ width: `${team.supporterConfidence}%` }} />
            </div>
          </div>
        </div>

        <span className={styles.selectHint}>Selecionar clube →</span>
      </div>

      <div className={`${styles.infoPanel} ${isInfoOpen ? styles.infoPanelOpen : ''}`}>
        <div className={styles.infoInner}>
          <p className={styles.infoDesc}>{team.description}</p>
          {team.history && (
            <section className={styles.infoBlock}>
              <p className={styles.infoLabel}>História</p>
              <p className={styles.infoText}>{team.history}</p>
            </section>
          )}
          {team.achievements && team.achievements.length > 0 && (
            <section className={styles.infoBlock}>
              <p className={styles.infoLabel}>Conquistas</p>
              <ul className={styles.infoList}>
                {team.achievements.map(a => <li key={a}>{a}</li>)}
              </ul>
            </section>
          )}
          {team.currentMoment && (
            <section className={styles.infoBlock}>
              <p className={styles.infoLabel}>Momento atual</p>
              <p className={styles.infoText}>{team.currentMoment}</p>
            </section>
          )}
        </div>
      </div>
    </article>
  );
}

export default function TeamSelect() {
  const { selectTeam } = useGame();
  const navigate = useNavigate();
  const brazilTeams = allTeams.filter(t => t.country === 'brazil');
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);

  const maxBudget = Math.max(...brazilTeams.map(t => t.budget));
  const maxFans = Math.max(...brazilTeams.map(t => t.fans));

  function handleSelect(teamId: string) {
    selectTeam(teamId);
    navigate('/setup/manager');
  }

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <button type="button" className={styles.back} onClick={() => navigate('/new/country')}>
            ← Voltar
          </button>
          <h1 className={styles.title}>Escolha seu clube</h1>
          <p className={styles.subtitle}>🇧🇷 Brasil</p>
        </header>

        <div className={styles.grid}>
          {brazilTeams.map(team => (
            <TeamCard
              key={team.id}
              team={team}
              maxBudget={maxBudget}
              maxFans={maxFans}
              isInfoOpen={expandedTeamId === team.id}
              onToggleInfo={() => setExpandedTeamId(prev => (prev === team.id ? null : team.id))}
              onSelect={() => handleSelect(team.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
