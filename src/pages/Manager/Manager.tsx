import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../../context/GameContext';
import styles from './Manager.module.css';

export default function ManagerPage() {
  const { state, updateManager } = useGame();
  const navigate = useNavigate();
  const manager = state.manager;

  const [bio, setBio] = useState(manager?.bio ?? '');
  const [tacticalNotes, setTacticalNotes] = useState(manager?.tacticalNotes ?? '');
  const [agentContacts, setAgentContacts] = useState(manager?.agentContacts ?? '');
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    setBio(manager?.bio ?? '');
    setTacticalNotes(manager?.tacticalNotes ?? '');
    setAgentContacts(manager?.agentContacts ?? '');
  }, [manager?.bio, manager?.tacticalNotes, manager?.agentContacts]);

  if (!manager) {
    return (
      <div className={styles.page}>
        <p className={styles.empty}>Nenhum manager definido nesta carreira.</p>
      </div>
    );
  }

  function save() {
    updateManager({
      bio: bio.trim(),
      tacticalNotes: tacticalNotes.trim(),
      agentContacts: agentContacts.trim(),
    });
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1600);
  }

  const awards = [...(manager.awards ?? [])].sort((a, b) => b.season - a.season);
  const titles = (state.team?.achievements ?? []).filter(a => a.isTitle).length;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>LiveLife · Manager</p>
          <h1 className={styles.brand}>{manager.name}</h1>
          <p className={styles.meta}>
            {manager.nationality} · {manager.age} anos
            {state.team ? ` · ${state.team.name}` : ''}
            {` · Temporada ${state.season}`}
          </p>
        </div>
        <div className={styles.statRow}>
          <div className={styles.stat}>
            <span>Títulos do clube</span>
            <strong>{titles}</strong>
          </div>
          <div className={styles.stat}>
            <span>Prêmios pessoais</span>
            <strong>{awards.length}</strong>
          </div>
        </div>
      </header>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Perfil</h2>
        <label className={styles.label}>
          Bio
          <textarea
            className={styles.textarea}
            rows={4}
            value={bio}
            onChange={e => setBio(e.target.value)}
            placeholder="Quem é você no banco? Estilo, história, ambição…"
          />
        </label>
        <label className={styles.label}>
          Notas táticas
          <textarea
            className={styles.textarea}
            rows={5}
            value={tacticalNotes}
            onChange={e => setTacticalNotes(e.target.value)}
            placeholder="Preferências de formação, padrões de pressão, observações do CT…"
          />
        </label>
        <label className={styles.label}>
          Contatos / agentes
          <textarea
            className={styles.textarea}
            rows={3}
            value={agentContacts}
            onChange={e => setAgentContacts(e.target.value)}
            placeholder="Empresários, olheiros, contatos úteis…"
          />
        </label>
        <div className={styles.actions}>
          <button type="button" className={styles.btnPrimary} onClick={save}>
            Salvar perfil
          </button>
          <button type="button" className={styles.btnGhost} onClick={() => navigate('/trofeus')}>
            Sala de Troféus
          </button>
          {savedFlash ? <span className={styles.saved}>Salvo</span> : null}
        </div>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Prêmios individuais</h2>
        {awards.length === 0 ? (
          <p className={styles.emptyInline}>
            Nenhum prêmio ainda. Campeonatos de liga/estadual/continental ao fechar a temporada
            podem render “Melhor Técnico”.
          </p>
        ) : (
          <ul className={styles.awardList}>
            {awards.map(a => (
              <li key={a.id} className={styles.awardItem}>
                <span className={styles.awardIcon} aria-hidden>
                  ★
                </span>
                <div>
                  <strong>{a.title}</strong>
                  <p>
                    Temporada {a.season}
                    {a.competition ? ` · ${a.competition}` : ''}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
