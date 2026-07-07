import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../../context/GameContext';
import type { PlayerPosition } from '../../types/Player';
import type { PreferredFoot } from '../../types/CareerPlayer';
import styles from '../Setup/Setup.module.css';
import extra from './PlayerSetup.module.css';

const POSITIONS: { value: PlayerPosition; label: string }[] = [
  { value: 'GK', label: 'Goleiro' },
  { value: 'CB', label: 'Zagueiro' },
  { value: 'RB', label: 'Lateral Direito' },
  { value: 'LB', label: 'Lateral Esquerdo' },
  { value: 'CDM', label: 'Volante' },
  { value: 'CM', label: 'Meia' },
  { value: 'CAM', label: 'Meia Atacante' },
  { value: 'RW', label: 'Ponta Direita' },
  { value: 'LW', label: 'Ponta Esquerda' },
  { value: 'ST', label: 'Atacante' },
  { value: 'CF', label: 'Centroavante' },
];

const FEET: PreferredFoot[] = ['Direito', 'Esquerdo', 'Ambidestro'];

export default function PlayerCreate() {
  const { state, setCareerPlayer } = useGame();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [nationality, setNationality] = useState('Brasil');
  const [age, setAge] = useState(20);
  const [position, setPosition] = useState<PlayerPosition>('ST');
  const [overall, setOverall] = useState(65);
  const [potential, setPotential] = useState(80);
  const [number, setNumber] = useState<number | ''>('');
  const [height, setHeight] = useState('');
  const [preferredFoot, setPreferredFoot] = useState<PreferredFoot>('Direito');

  if (state.careerMode !== 'player') {
    navigate('/new/mode');
    return null;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCareerPlayer({
      name: name.trim(),
      nationality: nationality.trim(),
      age,
      position,
      overall,
      potential,
      number: number === '' ? null : number,
      height: height.trim() || undefined,
      preferredFoot,
    });
    navigate('/setup/player-club');
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <p className={styles.step}>Passo 1 de 2</p>
        <h1 className={styles.title}>Criar Jogador</h1>
        <p className={styles.sub}>Defina seu atleta — os dados espelham o que você vê no EA FC</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label>Nome</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome" required />
          </div>

          <div className={extra.fieldRow}>
            <div className={styles.field}>
              <label>Nacionalidade</label>
              <input value={nationality} onChange={e => setNationality(e.target.value)} placeholder="Ex: Brasil" required />
            </div>
            <div className={styles.field}>
              <label>Idade</label>
              <input type="number" min={15} max={40} value={age} onChange={e => setAge(Number(e.target.value))} />
            </div>
          </div>

          <div className={extra.fieldRow}>
            <div className={`${styles.field} ${extra.field}`}>
              <label>Posição</label>
              <select value={position} onChange={e => setPosition(e.target.value as PlayerPosition)}>
                {POSITIONS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label>Número</label>
              <input type="number" min={1} max={99} value={number} onChange={e => setNumber(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Opcional" />
            </div>
          </div>

          <div className={extra.fieldRow}>
            <div className={styles.field}>
              <label>Overall</label>
              <input type="number" min={40} max={99} value={overall} onChange={e => setOverall(Math.min(99, Number(e.target.value)))} />
            </div>
            <div className={styles.field}>
              <label>Potencial</label>
              <input type="number" min={40} max={99} value={potential} onChange={e => setPotential(Math.min(99, Number(e.target.value)))} />
            </div>
          </div>

          <div className={extra.fieldRow}>
            <div className={styles.field}>
              <label>Altura</label>
              <input value={height} onChange={e => setHeight(e.target.value)} placeholder="Ex: 1,78m" />
            </div>
            <div className={`${styles.field} ${extra.field}`}>
              <label>Pé preferido</label>
              <select value={preferredFoot} onChange={e => setPreferredFoot(e.target.value as PreferredFoot)}>
                {FEET.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.backBtn} onClick={() => navigate('/new/mode')}>Voltar</button>
            <button type="submit" className={styles.nextBtn}>Continuar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
