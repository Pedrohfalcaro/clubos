import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../../context/GameContext';
import type { Player, PlayerPosition, PlayerStatus } from '../../types/Player';
import { PLAYER_POSITIONS } from '../../types/Player';
import { createBlankTeam, createExampleSquad, createPlayerDraft } from '../../utils/customSquad';
import { downloadClubTemplate, parseClubImport } from '../../utils/clubImport';
import { PERSONALIDADES } from '../../pulse/utils';
import ClubCrest from '../../components/ClubCrest/ClubCrest';
import styles from './ClubCreate.module.css';

interface AthleteForm {
  name: string;
  position: PlayerPosition;
  age: number;
  overall: number;
  potential: number;
  number: string;
  status: PlayerStatus;
  salary: number;
  marketValue: number;
  personality: string;
}

const emptyForm = (): AthleteForm => ({
  name: '',
  position: 'CM',
  age: 24,
  overall: 70,
  potential: 75,
  number: '',
  status: 'Titular',
  salary: 560000,
  marketValue: 10_500_000,
  personality: 'Disciplinado',
});

export default function ClubCreate() {
  const { state, setCustomClub } = useGame();
  const navigate = useNavigate();
  const country = state.pendingCoachCountry ?? 'Brasil';

  const [clubName, setClubName] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#7c3aed');
  const [secondaryColor, setSecondaryColor] = useState('#e2e8f0');
  const [budget, setBudget] = useState(5_000_000);
  const [fans, setFans] = useState(50_000);
  const [description, setDescription] = useState<string | undefined>();
  const [players, setPlayers] = useState<Player[]>([]);
  const [form, setForm] = useState<AthleteForm>(emptyForm);
  const [error, setError] = useState('');

  function addAthlete(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Informe o nome do atleta.');
      return;
    }
    const draft = createPlayerDraft('pending', {
      name: form.name,
      position: form.position,
      age: form.age,
      overall: form.overall,
      potential: form.potential,
      number: form.number === '' ? null : Number(form.number),
      status: form.status,
      salary: form.salary,
      marketValue: form.marketValue,
      personality: form.personality,
    });
    setPlayers(prev => [...prev, draft]);
    setForm(emptyForm());
    setError('');
  }

  function fillExample() {
    const team = createBlankTeam(clubName.trim() || 'Meu Clube', country, {
      primaryColor,
      secondaryColor,
    });
    setClubName(prev => prev.trim() || 'Meu Clube');
    setPlayers(createExampleSquad(team.id));
    setError('');
  }

  function handleImportJson(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(String(reader.result));
        const { team, players: roster } = parseClubImport(raw, country);
        setClubName(team.name);
        setPrimaryColor(team.primaryColor ?? primaryColor);
        setSecondaryColor(team.secondaryColor ?? secondaryColor);
        setBudget(team.budget);
        setFans(team.fans);
        setDescription(team.description);
        setPlayers(roster);
        setError('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Falha ao importar JSON.');
      }
    };
    reader.onerror = () => setError('Não foi possível ler o arquivo.');
    reader.readAsText(file);
  }

  function removeAthlete(id: string) {
    setPlayers(prev => prev.filter(p => p.id !== id));
  }

  function handleContinue() {
    if (!clubName.trim()) {
      setError('Informe o nome do clube.');
      return;
    }
    if (players.length < 11) {
      setError('Adicione pelo menos 11 atletas (ou use o elenco de exemplo).');
      return;
    }
    const team = createBlankTeam(clubName, country, { primaryColor, secondaryColor });
    team.budget = budget;
    team.fans = fans;
    if (description) team.description = description;
    const roster = players.map(p => ({ ...p, teamId: team.id }));
    setCustomClub(team, roster);
    navigate('/setup/manager');
  }

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <button type="button" className={styles.back} onClick={() => navigate('/new/country')}>
            ← Voltar
          </button>
          <h1 className={styles.title}>Criar clube e elenco</h1>
          <p className={styles.subtitle}>
            Monte sua carreira do zero — {country}. Sem base de dados fixa.
          </p>
        </header>

        <section className={styles.clubBlock}>
          <label className={styles.label}>Nome do clube</label>
          <input
            className={styles.input}
            value={clubName}
            onChange={e => setClubName(e.target.value)}
            placeholder="Ex: Atlético Nacional"
          />
        </section>

        <section className={styles.colorsBlock}>
          <div className={styles.colorsHead}>
            <ClubCrest primary={primaryColor} secondary={secondaryColor} size={36} title="Escudo" />
            <div>
              <p className={styles.colorsTitle}>Cores do clube</p>
              <p className={styles.colorsSub}>Primária no menu e em casa · secundária fora de casa</p>
            </div>
          </div>
          <div className={styles.colorFields}>
            <label className={styles.colorField}>
              <span>Primária</span>
              <input
                type="color"
                value={primaryColor}
                onChange={e => setPrimaryColor(e.target.value)}
              />
              <input
                className={styles.colorHex}
                value={primaryColor}
                onChange={e => setPrimaryColor(e.target.value)}
              />
            </label>
            <label className={styles.colorField}>
              <span>Secundária</span>
              <input
                type="color"
                value={secondaryColor}
                onChange={e => setSecondaryColor(e.target.value)}
              />
              <input
                className={styles.colorHex}
                value={secondaryColor}
                onChange={e => setSecondaryColor(e.target.value)}
              />
            </label>
          </div>
        </section>

        <section className={styles.rosterBlock}>
          <div className={styles.rosterHead}>
            <h2 className={styles.sectionTitle}>Elenco ({players.length})</h2>
            <div className={styles.rosterActions}>
              <button type="button" className={styles.exampleBtn} onClick={downloadClubTemplate}>
                Baixar modelo JSON
              </button>
              <label className={styles.importBtn}>
                Importar JSON
                <input
                  type="file"
                  accept="application/json,.json"
                  hidden
                  onChange={e => {
                    handleImportJson(e.target.files?.[0] ?? null);
                    e.target.value = '';
                  }}
                />
              </label>
              <button type="button" className={styles.exampleBtn} onClick={fillExample}>
                Elenco de exemplo
              </button>
            </div>
          </div>
          <p className={styles.importHint}>
            Prefere montar fora? Baixe o modelo (inclui guia `_docs` com campos e personalidades do Pulse),
            edite e importe aqui. Mín. 11 jogadores — JSON inválido é rejeitado.
          </p>

          {players.length > 0 && (
            <ul className={styles.list}>
              {players.map(p => (
                <li key={p.id} className={styles.row}>
                  <span className={styles.num}>{p.number ?? '—'}</span>
                  <span className={styles.name}>{p.name}</span>
                  <span className={styles.meta}>
                    {p.position} · {p.age}a · OVR {p.overall}
                  </span>
                  <button type="button" className={styles.remove} onClick={() => removeAthlete(p.id)}>
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form className={styles.athleteForm} onSubmit={addAthlete}>
            <h3 className={styles.formTitle}>Adicionar atleta</h3>
            <div className={styles.grid}>
              <div className={styles.field}>
                <label>Nome</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Nome do jogador"
                />
              </div>
              <div className={styles.field}>
                <label>Posição</label>
                <select
                  value={form.position}
                  onChange={e => setForm(f => ({ ...f, position: e.target.value as PlayerPosition }))}
                >
                  {PLAYER_POSITIONS.map(pos => (
                    <option key={pos} value={pos}>{pos}</option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label>Idade</label>
                <input
                  type="number"
                  min={15}
                  max={45}
                  value={form.age}
                  onChange={e => setForm(f => ({ ...f, age: Number(e.target.value) }))}
                />
              </div>
              <div className={styles.field}>
                <label>Número</label>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={form.number}
                  onChange={e => setForm(f => ({ ...f, number: e.target.value }))}
                />
              </div>
              <div className={styles.field}>
                <label>Overall</label>
                <input
                  type="number"
                  min={40}
                  max={99}
                  value={form.overall}
                  onChange={e => setForm(f => ({ ...f, overall: Number(e.target.value) }))}
                />
              </div>
              <div className={styles.field}>
                <label>Potencial</label>
                <input
                  type="number"
                  min={40}
                  max={99}
                  value={form.potential}
                  onChange={e => setForm(f => ({ ...f, potential: Number(e.target.value) }))}
                />
              </div>
              <div className={styles.field}>
                <label>Status</label>
                <select
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value as PlayerStatus }))}
                >
                  {(['Titular', 'Reserva', 'Promessa', 'Transferível', 'Emprestado', 'Aposentado'] as PlayerStatus[]).map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label>Personalidade</label>
                <select
                  value={form.personality}
                  onChange={e => setForm(f => ({ ...f, personality: e.target.value }))}
                >
                  {PERSONALIDADES.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label>Salário</label>
                <input
                  type="number"
                  min={0}
                  value={form.salary}
                  onChange={e => setForm(f => ({ ...f, salary: Number(e.target.value) }))}
                />
              </div>
              <div className={styles.field}>
                <label>Valor de mercado</label>
                <input
                  type="number"
                  min={0}
                  value={form.marketValue}
                  onChange={e => setForm(f => ({ ...f, marketValue: Number(e.target.value) }))}
                />
              </div>
            </div>
            <button type="submit" className={styles.addBtn}>+ Adicionar atleta</button>
          </form>
        </section>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.actions}>
          <button type="button" className={styles.continueBtn} onClick={handleContinue}>
            Continuar →
          </button>
        </div>
      </div>
    </div>
  );
}
