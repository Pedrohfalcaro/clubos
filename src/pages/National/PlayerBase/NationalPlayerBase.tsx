import { useMemo, useState } from 'react';
import { useGame } from '../../../context/GameContext';
import SearchableSelect from '../../../components/SearchableSelect/SearchableSelect';
import { PLAYER_POSITIONS, type PlayerPosition, type Player } from '../../../types/Player';
import {
  downloadNationalImportTemplate,
  parseNationalImport,
} from '../../../utils/nationalImport';
// Reaproveita o CSS da antiga tela de Convocação — mesmo visual.
import styles from '../Squad/NationalSquad.module.css';

export default function NationalPlayerBase() {
  const {
    state,
    addNationalPlayer,
    importNationalPlayers,
    removeNationalPlayer,
    linkNationalPlayerToClub,
  } = useGame();
  const nationalTeam = state.nationalTeam;
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [importError, setImportError] = useState('');

  const filteredPool = useMemo(() => {
    if (!nationalTeam) return [];
    const q = search.toLowerCase();
    return nationalTeam.talentPool.filter(p => p.name.toLowerCase().includes(q));
  }, [nationalTeam, search]);

  if (!nationalTeam) return null;

  function handleImportJson(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(String(reader.result));
        const players = parseNationalImport(raw, state.players);
        importNationalPlayers(players);
        setImportError('');
      } catch (err) {
        setImportError(err instanceof Error ? err.message : 'Falha ao importar JSON.');
      }
    };
    reader.onerror = () => setImportError('Não foi possível ler o arquivo.');
    reader.readAsText(file);
  }

  const clubPlayerOptions = [
    { value: '', label: '— Nenhum —' },
    ...state.players.map(p => ({ value: p.id, label: p.name })),
  ];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Banco Recorrente</p>
          <h1 className={styles.title}>Base de Jogadores</h1>
        </div>
      </header>

      <div className={styles.toolbar}>
        <input
          className={styles.search}
          type="text"
          placeholder="Buscar atleta..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className={styles.toolbarActions}>
          <button type="button" className={styles.btnSecondary} onClick={downloadNationalImportTemplate}>
            Baixar modelo JSON
          </button>
          <label className={styles.btnSecondary}>
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
          <button type="button" className={styles.btnPrimary} onClick={() => setShowCreate(true)}>
            + Cadastrar atleta
          </button>
        </div>
      </div>

      {importError && <p className={styles.error}>{importError}</p>}

      {filteredPool.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Nenhum atleta na base ainda.</p>
          <p className={styles.emptyHint}>Cadastre manualmente ou importe uma pré-lista em JSON.</p>
        </div>
      ) : (
        <ul className={styles.poolList}>
          {filteredPool.map(p => (
            <li key={p.id} className={styles.baseRow}>
              <div className={styles.poolInfo}>
                <p className={styles.poolName}>
                  {p.name}
                  {p.caps > 0 && <span className={styles.capsBadge}>{p.caps}x convocado</span>}
                </p>
                <p className={styles.poolMeta}>
                  {p.position} · {p.age} anos · {p.club}
                  {p.overall != null ? ` · OVR ${p.overall}` : ''}
                </p>
              </div>
              <div className={styles.poolLink}>
                <SearchableSelect
                  options={clubPlayerOptions}
                  value={p.clubPlayerId ?? ''}
                  onChange={v => linkNationalPlayerToClub(p.id, v || null)}
                  placeholder="Vincular ao clube..."
                />
              </div>
              <button
                type="button"
                className={styles.removeBtn}
                onClick={() => removeNationalPlayer(p.id)}
                aria-label="Remover da base"
                title="Remover da Base de Jogadores"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {showCreate && (
        <CreatePlayerModal
          clubPlayers={state.players}
          linkedClubPlayerIds={new Set(
            nationalTeam.talentPool.map(p => p.clubPlayerId).filter((id): id is string => !!id),
          )}
          teamName={state.team?.name ?? ''}
          onSubmit={input => {
            addNationalPlayer(input);
            setShowCreate(false);
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}

interface CreatePlayerInput {
  name: string;
  position: PlayerPosition;
  age: number;
  club: string;
  overall?: number;
  clubPlayerId?: string;
}

function CreatePlayerModal({
  clubPlayers,
  linkedClubPlayerIds,
  teamName,
  onSubmit,
  onCancel,
}: {
  clubPlayers: Player[];
  linkedClubPlayerIds: Set<string>;
  teamName: string;
  onSubmit: (input: CreatePlayerInput) => void;
  onCancel: () => void;
}) {
  const [source, setSource] = useState<'novo' | 'clube'>('novo');
  const [clubSearch, setClubSearch] = useState('');
  const [name, setName] = useState('');
  const [position, setPosition] = useState<PlayerPosition>('CM');
  const [age, setAge] = useState('25');
  const [club, setClub] = useState('');
  const [overall, setOverall] = useState('');

  const positionOptions = PLAYER_POSITIONS.map(pos => ({ value: pos, label: pos }));
  const ageNum = parseInt(age, 10);
  const overallNum = overall.trim() ? parseInt(overall, 10) : undefined;
  const canSubmit =
    name.trim().length > 0 &&
    club.trim().length > 0 &&
    Number.isInteger(ageNum) &&
    ageNum >= 15 &&
    ageNum <= 45 &&
    (overallNum === undefined || (Number.isInteger(overallNum) && overallNum >= 1 && overallNum <= 99));

  function submit() {
    if (!canSubmit) return;
    onSubmit({
      name: name.trim(),
      position,
      age: ageNum,
      club: club.trim(),
      overall: overallNum,
    });
  }

  const availableClubPlayers = clubPlayers.filter(p => !linkedClubPlayerIds.has(p.id));
  const filteredClubPlayers = availableClubPlayers.filter(p =>
    p.name.toLowerCase().includes(clubSearch.toLowerCase()),
  );

  function pickClubPlayer(p: Player) {
    onSubmit({
      name: p.name,
      position: p.position,
      age: p.age,
      club: teamName,
      overall: p.overall,
      clubPlayerId: p.id,
    });
  }

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <p className={styles.modalTitle}>Cadastrar atleta</p>

        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tab} ${source === 'novo' ? styles.tabActive : ''}`}
            onClick={() => setSource('novo')}
          >
            Novo atleta
          </button>
          <button
            type="button"
            className={`${styles.tab} ${source === 'clube' ? styles.tabActive : ''}`}
            onClick={() => setSource('clube')}
          >
            Do elenco do clube
          </button>
        </div>

        {source === 'clube' ? (
          <>
            <input
              className={styles.formInput}
              type="text"
              value={clubSearch}
              onChange={e => setClubSearch(e.target.value)}
              placeholder="Buscar no elenco..."
              autoFocus
            />
            {filteredClubPlayers.length === 0 ? (
              <p className={styles.hint}>
                {availableClubPlayers.length === 0
                  ? 'Todos os jogadores do elenco já estão na base.'
                  : 'Nenhum jogador encontrado.'}
              </p>
            ) : (
              <ul className={styles.pickList}>
                {filteredClubPlayers.map(p => (
                  <li key={p.id}>
                    <button type="button" className={styles.pickRow} onClick={() => pickClubPlayer(p)}>
                      <span className={styles.poolName}>{p.name}</span>
                      <span className={styles.poolMeta}>
                        {p.position} · {p.age} anos{p.overall != null ? ` · OVR ${p.overall}` : ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <span className={styles.hint}>
              Clique em um jogador para adicioná-lo direto à base, já vinculado ao clube.
            </span>
            <div className={styles.actions}>
              <button type="button" className={styles.btnSecondary} onClick={onCancel}>
                Cancelar
              </button>
            </div>
          </>
        ) : (
          <>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Nome</label>
              <input
                className={styles.formInput}
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Nome do atleta"
                autoFocus
              />
            </div>

            <div className={styles.row}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Posição</label>
                <SearchableSelect options={positionOptions} value={position} onChange={v => setPosition(v as PlayerPosition)} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Idade</label>
                <input
                  className={styles.formInput}
                  type="number"
                  min={15}
                  max={45}
                  value={age}
                  onChange={e => setAge(e.target.value)}
                />
              </div>
            </div>

            <div className={styles.row}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Clube</label>
                <input
                  className={styles.formInput}
                  type="text"
                  value={club}
                  onChange={e => setClub(e.target.value)}
                  placeholder="ex.: Flamengo"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Overall (opcional)</label>
                <input
                  className={styles.formInput}
                  type="number"
                  min={1}
                  max={99}
                  value={overall}
                  onChange={e => setOverall(e.target.value)}
                />
              </div>
            </div>

            <div className={styles.actions}>
              <button type="button" className={styles.btnSecondary} onClick={onCancel}>
                Cancelar
              </button>
              <button type="button" className={styles.btnPrimary} onClick={submit} disabled={!canSubmit}>
                Cadastrar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
