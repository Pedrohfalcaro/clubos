import { useState } from 'react';
import FormationField from '../../components/FormationField/FormationField';
import FormationPicker from '../../components/FormationPicker/FormationPicker';
import { useGame } from '../../context/GameContext';
import {
  getFormationPreset,
  detectFormationKey,
  type FormationKey,
} from '../../utils/formations';
import styles from './Tactics.module.css';

export default function Tactics() {
  const { state, saveTactics } = useGame();
  const players = state.players;

  const [formationKey, setFormationKey] = useState<FormationKey>(() => {
    if (state.tactics?.formation?.length) {
      return detectFormationKey(state.tactics.formation) ?? '433';
    }
    return '433';
  });

  const preset = getFormationPreset(formationKey);

  const [formation, setFormation] = useState<{ playerId: string; x: number; y: number }[]>(() => {
    if (state.tactics?.formation?.length) return state.tactics.formation;
    return [];
  });

  const [bench, setBench] = useState<string[]>(() => state.tactics?.bench ?? []);
  const [saved, setSaved] = useState(false);

  function handleFormationChange(key: FormationKey) {
    setFormationKey(key);
    setFormation([]);
  }

  function handleSave() {
    saveTactics({ formation, bench });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const filledCount = formation.length;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Táticas</h1>
          <p className={styles.sub}>
            Escolha a formação e arraste os jogadores para as posições ou para o banco.
          </p>
        </div>
        <button
          type="button"
          className={styles.saveBtn}
          onClick={handleSave}
          disabled={filledCount < 11}
        >
          {saved ? 'Salvo!' : 'Salvar Tática'}
        </button>
      </header>

      <FormationPicker value={formationKey} onChange={handleFormationChange} />

      <div className={styles.fieldCard}>
        <FormationField
          players={players}
          formation={formation}
          onFormationChange={setFormation}
          bench={bench}
          onBenchChange={setBench}
          showBench
          benchMin={0}
          benchMax={9}
          slotMode
          preset={preset}
        />
      </div>

      <p className={styles.hint}>
        Arraste jogadores do elenco para posições no campo ou para a área do banco.
        Clique em um jogador em campo para removê-lo.
      </p>
    </div>
  );
}
