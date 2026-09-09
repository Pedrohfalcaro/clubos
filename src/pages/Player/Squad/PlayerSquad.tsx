import { useMemo, useState } from 'react';
import { useGame } from '../../../context/GameContext';
import type { PlayerPosition } from '../../../types/Player';
import { PLAYER_POSITIONS } from '../../../types/Player';
import type { Teammate } from '../../../types/Teammate';
import { downloadClubTemplate, parseTeammatesImport } from '../../../utils/teammateImport';
import shared from '../PlayerShared.module.css';
import styles from '../../Dashboard/Dashboard.module.css';
import extra from './PlayerSquad.module.css';

const POSITION_ORDER: PlayerPosition[] = ['GK', 'CB', 'RB', 'LB', 'CDM', 'CM', 'CAM', 'RW', 'LW', 'ST', 'CF'];

const POSITION_LABELS: Record<PlayerPosition, string> = {
  GK: 'Goleiro', CB: 'Zagueiro', RB: 'Lateral Dir.', LB: 'Lateral Esq.',
  CDM: 'Volante', CM: 'Meia', CAM: 'Meia Atac.', RW: 'Ponta Dir.',
  LW: 'Ponta Esq.', ST: 'Atacante', CF: 'Centroavante',
};

function moraleColor(value: number): string {
  if (value >= 70) return 'var(--success)';
  if (value >= 40) return 'var(--warning)';
  return 'var(--danger)';
}

interface FormState {
  name: string;
  position: PlayerPosition;
  age: string;
  number: string;
}

const BLANK_FORM: FormState = { name: '', position: 'CM', age: '24', number: '' };

export default function PlayerSquad() {
  const { state, addTeammate, updateTeammate, removeTeammate, importTeammates } = useGame();
  const player = state.careerPlayer;

  const [form, setForm] = useState<FormState>(BLANK_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(BLANK_FORM);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const groups = useMemo(() => {
    if (!player) return [];
    return POSITION_ORDER
      .map(pos => ({
        position: pos,
        teammates: player.teammates.filter(t => t.position === pos).sort((a, b) => a.number - b.number),
      }))
      .filter(g => g.teammates.length > 0);
  }, [player]);

  if (!player) return null;

  function numberTaken(n: number, excludeId?: string): boolean {
    if (n === player!.number) return true;
    return player!.teammates.some(t => t.number === n && t.id !== excludeId);
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const name = form.name.trim();
    const age = Number(form.age);
    const number = Number(form.number);
    if (!name) { setError('Informe o nome do colega.'); return; }
    if (!Number.isInteger(age) || age < 15 || age > 50) { setError('Idade deve ser um número entre 15 e 50.'); return; }
    if (!Number.isInteger(number) || number < 1 || number > 99) { setError('Número da camisa deve ser entre 1 e 99.'); return; }
    if (numberTaken(number)) { setError(`Camisa ${number} já está em uso (por você ou outro colega).`); return; }

    addTeammate({ name, position: form.position, age, number, moraleTowardsPlayer: 60 });
    setForm({ ...BLANK_FORM, position: form.position });
  }

  function startEdit(t: Teammate) {
    setEditingId(t.id);
    setEditForm({ name: t.name, position: t.position, age: String(t.age), number: String(t.number) });
    setError('');
  }

  function saveEdit(t: Teammate) {
    setError('');
    const name = editForm.name.trim();
    const age = Number(editForm.age);
    const number = Number(editForm.number);
    if (!name) { setError('Informe o nome do colega.'); return; }
    if (!Number.isInteger(age) || age < 15 || age > 50) { setError('Idade deve ser um número entre 15 e 50.'); return; }
    if (!Number.isInteger(number) || number < 1 || number > 99) { setError('Número da camisa deve ser entre 1 e 99.'); return; }
    if (numberTaken(number, t.id)) { setError(`Camisa ${number} já está em uso (por você ou outro colega).`); return; }

    updateTeammate(t.id, { name, position: editForm.position, age, number });
    setEditingId(null);
  }

  function handleImportJson(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(String(reader.result));
        const teammates = parseTeammatesImport(raw, player!.currentClub.country || 'Brasil', player!.number);
        importTeammates(teammates);
        setError('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Falha ao importar JSON.');
      }
    };
    reader.onerror = () => setError('Não foi possível ler o arquivo.');
    reader.readAsText(file);
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Elenco</h1>
          <p className={styles.sub}>{player.currentClub.name} — monte seus colegas de time e acompanhe o clima do vestiário</p>
        </div>
      </header>

      <section className={styles.section}>
        <div className={extra.importRow}>
          <button type="button" className={extra.ghostBtn} onClick={downloadClubTemplate}>
            Baixar modelo JSON
          </button>
          <label className={extra.importBtn}>
            Importar JSON (substitui o elenco atual)
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
        </div>
        <p className={extra.importHint}>
          O modelo é o mesmo usado na criação de clube do treinador (com overall, potencial, salário e
          personalidade) — esses campos extras são só ignorados aqui, o que importa pra você é nome,
          posição, idade e número.
        </p>

        <form onSubmit={handleAdd} className={extra.addForm}>
          <div className={extra.addFormRow}>
            <input
              className={extra.input}
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Nome do colega"
            />
            <select
              className={extra.input}
              value={form.position}
              onChange={e => setForm(f => ({ ...f, position: e.target.value as PlayerPosition }))}
            >
              {PLAYER_POSITIONS.map(p => (
                <option key={p} value={p}>{POSITION_LABELS[p]}</option>
              ))}
            </select>
            <input
              className={extra.numInput}
              type="number"
              min={15}
              max={50}
              value={form.age}
              onChange={e => setForm(f => ({ ...f, age: e.target.value }))}
              placeholder="Idade"
            />
            <input
              className={extra.numInput}
              type="number"
              min={1}
              max={99}
              value={form.number}
              onChange={e => setForm(f => ({ ...f, number: e.target.value }))}
              placeholder="Nº"
            />
            <button type="submit" className={extra.addBtn}>+ Adicionar</button>
          </div>
          {error && <p className={extra.error}>{error}</p>}
        </form>
      </section>

      {groups.length === 0 ? (
        <div className={styles.empty}>Nenhum colega no elenco ainda — adicione um pelo formulário acima ou importe um JSON.</div>
      ) : (
        groups.map(group => (
          <section key={group.position} className={styles.section}>
            <h2 className={styles.sectionTitle}>
              {POSITION_LABELS[group.position]}
              {group.position === player.position && (
                <span className={extra.rivalTag}>Sua posição</span>
              )}
            </h2>
            <div className={extra.grid}>
              {group.teammates.map(t => {
                const isRival = t.position === player.position;
                const isEditing = editingId === t.id;
                return (
                  <div key={t.id} className={extra.card}>
                    {isEditing ? (
                      <div className={extra.editRow}>
                        <input
                          className={extra.input}
                          value={editForm.name}
                          onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                          autoFocus
                        />
                        <select
                          className={extra.input}
                          value={editForm.position}
                          onChange={e => setEditForm(f => ({ ...f, position: e.target.value as PlayerPosition }))}
                        >
                          {PLAYER_POSITIONS.map(p => (
                            <option key={p} value={p}>{POSITION_LABELS[p]}</option>
                          ))}
                        </select>
                        <div className={extra.editRowNums}>
                          <input
                            className={extra.numInput}
                            type="number"
                            value={editForm.age}
                            onChange={e => setEditForm(f => ({ ...f, age: e.target.value }))}
                          />
                          <input
                            className={extra.numInput}
                            type="number"
                            value={editForm.number}
                            onChange={e => setEditForm(f => ({ ...f, number: e.target.value }))}
                          />
                        </div>
                        <div className={extra.editActions}>
                          <button type="button" className={extra.ghostBtn} onClick={() => setEditingId(null)}>Cancelar</button>
                          <button type="button" className={extra.ghostBtn} onClick={() => saveEdit(t)}>Salvar</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className={extra.cardTop}>
                          <span className={extra.number}>{t.number}</span>
                          <div className={extra.identity}>
                            <span className={extra.name}>{t.name}</span>
                            <span className={extra.meta}>
                              {POSITION_LABELS[t.position]} · {t.age} anos
                            </span>
                          </div>
                          {isRival && <span className={extra.rivalTag}>Rival</span>}
                        </div>
                        <div className={shared.confidenceTrack}>
                          <div
                            className={shared.confidenceFill}
                            style={{
                              width: `${t.moraleTowardsPlayer}%`,
                              background: moraleColor(t.moraleTowardsPlayer),
                            }}
                          />
                        </div>
                        <div className={extra.cardBottom}>
                          <span className={extra.moraleValue}>Moral com você: {t.moraleTowardsPlayer}%</span>
                          <div className={extra.cardActions}>
                            <button type="button" className={extra.ghostBtn} onClick={() => startEdit(t)}>Editar</button>
                            {confirmRemoveId === t.id ? (
                              <>
                                <button type="button" className={extra.ghostBtn} onClick={() => setConfirmRemoveId(null)}>Cancelar</button>
                                <button
                                  type="button"
                                  className={extra.dangerBtn}
                                  onClick={() => { removeTeammate(t.id); setConfirmRemoveId(null); }}
                                >
                                  Confirmar
                                </button>
                              </>
                            ) : (
                              <button type="button" className={extra.dangerBtn} onClick={() => setConfirmRemoveId(t.id)}>
                                Remover
                              </button>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
