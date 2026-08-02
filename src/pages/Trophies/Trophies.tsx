import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../../context/GameContext';
import type { TeamAchievement } from '../../types/Achievement';
import styles from './Trophies.module.css';

function positionLabel(a: TeamAchievement): string {
  if (a.isTitle) return 'Campeão';
  if (a.position === 2) return 'Vice';
  if (a.position === 3) return '3º lugar';
  return `${a.position}º lugar`;
}

export default function Trophies() {
  const { state, addAchievement, removeAchievement } = useGame();
  const navigate = useNavigate();
  const team = state.team;

  const [showForm, setShowForm] = useState(false);
  const [competition, setCompetition] = useState('');
  const [season, setSeason] = useState(String(state.season));
  const [position, setPosition] = useState('1');
  const [note, setNote] = useState('');

  const list = useMemo(() => {
    const raw = [...(team?.achievements ?? [])];
    return raw.sort((a, b) => b.season - a.season || a.position - b.position);
  }, [team?.achievements]);

  const titles = list.filter(a => a.isTitle);
  const others = list.filter(a => !a.isTitle);

  const compOptions = state.seasonCompetitions.map(c => c.name);

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    const pos = Math.max(1, Math.round(Number(position) || 1));
    const seasonN = Math.max(1, Math.round(Number(season) || state.season));
    const name = competition.trim();
    if (!name) return;
    addAchievement({
      competition: name,
      season: seasonN,
      position: pos,
      isTitle: pos === 1,
      note: note.trim() || undefined,
    });
    setCompetition('');
    setNote('');
    setPosition('1');
    setShowForm(false);
  }

  if (!team) {
    return (
      <div className={styles.page}>
        <p className={styles.empty}>Sala de Troféus disponível no modo técnico.</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>LiveLife · Clube</p>
          <h1 className={styles.brand}>Sala de Troféus</h1>
          <p className={styles.meta}>
            {team.name} · {titles.length} título{titles.length === 1 ? '' : 's'} · {list.length}{' '}
            registro{list.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.btnGhost} onClick={() => navigate('/manager')}>
            Perfil do técnico
          </button>
          <button type="button" className={styles.btnPrimary} onClick={() => setShowForm(v => !v)}>
            {showForm ? 'Cancelar' : 'Registrar'}
          </button>
        </div>
      </header>

      {showForm && (
        <form className={styles.form} onSubmit={submitManual}>
          <h2 className={styles.formTitle}>Registrar conquista</h2>
          <p className={styles.formHint}>
            Títulos também entram automaticamente ao avançar temporada (1º na classificação da
            competição).
          </p>
          <label className={styles.label}>
            Competição
            <input
              className={styles.input}
              list="comp-list"
              value={competition}
              onChange={e => setCompetition(e.target.value)}
              placeholder="Nome da competição"
              required
            />
            <datalist id="comp-list">
              {compOptions.map(n => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </label>
          <div className={styles.row}>
            <label className={styles.label}>
              Temporada
              <input
                className={styles.input}
                type="number"
                min={1}
                value={season}
                onChange={e => setSeason(e.target.value)}
              />
            </label>
            <label className={styles.label}>
              Posição
              <input
                className={styles.input}
                type="number"
                min={1}
                value={position}
                onChange={e => setPosition(e.target.value)}
              />
            </label>
          </div>
          <label className={styles.label}>
            Nota (opcional)
            <input
              className={styles.input}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Ex.: final nos pênaltis"
            />
          </label>
          <button type="submit" className={styles.btnPrimary}>
            Adicionar à sala
          </button>
        </form>
      )}

      <section>
        <h2 className={styles.sectionTitle}>Títulos</h2>
        {titles.length === 0 ? (
          <p className={styles.emptyInline}>
            Nenhum título ainda. Feche a temporada em 1º ou registre manualmente.
          </p>
        ) : (
          <div className={styles.gallery}>
            {titles.map(a => (
              <article key={a.id} className={styles.trophyCard}>
                <div className={styles.cup} aria-hidden>
                  <span className={styles.cupTop} />
                  <span className={styles.cupBody} />
                  <span className={styles.cupBase} />
                </div>
                <h3>{a.competition}</h3>
                <p className={styles.trophyMeta}>
                  Temporada {a.season} · {positionLabel(a)}
                </p>
                {a.note ? <p className={styles.trophyNote}>{a.note}</p> : null}
                <button
                  type="button"
                  className={styles.removeBtn}
                  onClick={() => removeAchievement(a.id)}
                >
                  Remover
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      {others.length > 0 && (
        <section>
          <h2 className={styles.sectionTitle}>Outras classificações</h2>
          <ul className={styles.list}>
            {others.map(a => (
              <li key={a.id} className={styles.listItem}>
                <div>
                  <strong>{a.competition}</strong>
                  <p>
                    Temporada {a.season} · {positionLabel(a)}
                    {a.note ? ` · ${a.note}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  className={styles.removeBtn}
                  onClick={() => removeAchievement(a.id)}
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
