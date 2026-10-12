import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PlayerJersey from '../../components/PlayerJersey/PlayerJersey';
import { isPlayerBlockedFromLineup, sortByPosition, type Player } from '../../types/Player';
import { ROLE_NAMES, roleFit } from '../../utils/formations';
import {
  TRAINING_FAMILIES,
  TRAINING_FORMATS,
  defaultTrainingVariant,
  findTrainingFamily,
  findTrainingVariant,
  slotOnFullPitch,
  type TrainingFormat,
  type TrainingFormationVariant,
  type TrainingSide,
} from '../../utils/trainingFormations';
import type { TrainingScope } from './useTrainingScope';
import SummaryModal from './SummaryModal';
import type { TrainingSession } from '../../types/Training';
import { simulateTraining, type TrainingDraft, type TrainingTeamDraft } from '../../training/session';
import KitChooser from '../../components/KitEditor/KitChooser';
import { posAbbr, ringOf } from '../../utils/positions';
import type { Kit } from '../../types/Kit';
import type { TacticalStyleKey } from '../../types/Tactics';
import { DEFAULT_STYLE_KEY, TACTICAL_STYLES } from '../../utils/tacticalStyles';
import styles from './TrainingPit.module.css';

type Placed = Record<TrainingSide, (string | null)[]>;

const SIDES: TrainingSide[] = ['north', 'south'];

function emptyPlaced(format: TrainingFormat): Placed {
  return {
    north: Array(format).fill(null),
    south: Array(format).fill(null),
  };
}

/** Mantém os jogadores ao trocar de formação, reencaixando por função e proximidade. */
function remapSlots(
  current: (string | null)[],
  from: TrainingFormationVariant,
  to: TrainingFormationVariant,
  byId: Map<string, Player>,
): (string | null)[] {
  const pairs: { from: number; to: number; score: number }[] = [];
  current.forEach((id, fi) => {
    if (!id) return;
    const player = byId.get(id);
    const prev = from.slots[fi];
    to.slots.forEach((slot, ti) => {
      const fit = roleFit(slot.role, player?.position);
      const sameRole = prev.role === slot.role ? 40 : 0;
      const drift = Math.hypot(prev.x - slot.x, prev.y - slot.y);
      pairs.push({ from: fi, to: ti, score: fit * 100 + sameRole - drift });
    });
  });
  pairs.sort((a, b) => b.score - a.score);

  const next: (string | null)[] = Array(to.slots.length).fill(null);
  const moved = new Set<number>();
  for (const pair of pairs) {
    if (moved.has(pair.from) || next[pair.to]) continue;
    next[pair.to] = current[pair.from];
    moved.add(pair.from);
  }
  return next;
}

export default function PartidaTab({
  scope,
  onSessionCreated,
  free = false,
}: {
  scope: TrainingScope;
  onSessionCreated: () => void;
  /** Treino livre: quantas vezes quiser, sem histórico, sem moral e sem efeitos. */
  free?: boolean;
}) {
  const navigate = useNavigate();
  const gameDate = scope.currentDate;

  const { primary, secondary } = scope;
  const clubName = scope.teamName;
  const sideName: Record<TrainingSide, string> = {
    north: `${clubName} A`,
    south: `${clubName} B`,
  };
  // Cada time escolhe um dos uniformes (padrão: 1º no norte, 2º no sul)
  const [kitId, setKitId] = useState<Record<TrainingSide, string>>(() => ({
    north: scope.kits[0].id,
    south: (scope.kits[1] ?? scope.kits[0]).id,
  }));
  const kitDesign: Record<TrainingSide, Kit> = {
    north: scope.kits.find(k => k.id === kitId.north) ?? scope.kits[0],
    south: scope.kits.find(k => k.id === kitId.south) ?? scope.kits[1] ?? scope.kits[0],
  };
  const kit: Record<TrainingSide, string> = { north: kitDesign.north.base, south: kitDesign.south.base };

  const squad = useMemo(() => sortByPosition(scope.players), [scope.players]);
  const byId = useMemo(() => new Map(squad.map(p => [p.id, p])), [squad]);

  const [format, setFormat] = useState<TrainingFormat>(11);
  const [variantKey, setVariantKey] = useState<Record<TrainingSide, string>>(() => {
    const key = defaultTrainingVariant(11).key;
    return { north: key, south: key };
  });
  const [styleKey, setStyleKey] = useState<Record<TrainingSide, TacticalStyleKey>>({
    north: DEFAULT_STYLE_KEY,
    south: DEFAULT_STYLE_KEY,
  });
  const [placed, setPlaced] = useState<Placed>(() => emptyPlaced(11));
  const [picked, setPicked] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [squadOver, setSquadOver] = useState(false);

  const [showOpenModal, setShowOpenModal] = useState(false);
  const [openTraining, setOpenTraining] = useState(false);
  const [freeResult, setFreeResult] = useState<TrainingSession | null>(null);
  /** Duração de cada tempo: 2:00 ou 2:30 (padrão vem da configuração do treino). */
  const [halfSec, setHalfSec] = useState<120 | 150>(scope.settings.halfDurationSec);

  const variants: Record<TrainingSide, TrainingFormationVariant> = {
    north: findTrainingVariant(format, variantKey.north),
    south: findTrainingVariant(format, variantKey.south),
  };

  const placedIds = new Set([...placed.north, ...placed.south].filter((id): id is string => !!id));
  const available = squad.filter(
    p => !placedIds.has(p.id) && !isPlayerBlockedFromLineup(p, null, gameDate),
  );
  const unavailable = squad.filter(
    p => !placedIds.has(p.id) && isPlayerBlockedFromLineup(p, null, gameDate),
  );
  const filled: Record<TrainingSide, number> = {
    north: placed.north.filter(Boolean).length,
    south: placed.south.filter(Boolean).length,
  };
  const ready = filled.north === format && filled.south === format;
  const squadShort = squad.length - unavailable.length < format * 2;

  function changeFormat(next: TrainingFormat) {
    if (next === format) return;
    const key = defaultTrainingVariant(next).key;
    setFormat(next);
    setVariantKey({ north: key, south: key });
    setPlaced(emptyPlaced(next));
    setPicked(null);
  }

  function changeVariant(side: TrainingSide, key: string) {
    if (key === variantKey[side]) return;
    const from = variants[side];
    const to = findTrainingVariant(format, key);
    setPlaced(prev => ({ ...prev, [side]: remapSlots(prev[side], from, to, byId) }));
    setVariantKey(prev => ({ ...prev, [side]: key }));
  }

  function locate(playerId: string): { side: TrainingSide; idx: number } | null {
    for (const side of SIDES) {
      const idx = placed[side].indexOf(playerId);
      if (idx >= 0) return { side, idx };
    }
    return null;
  }

  function place(playerId: string, side: TrainingSide, idx: number) {
    const player = byId.get(playerId);
    if (!player || isPlayerBlockedFromLineup(player, null, gameDate)) return;
    const origin = locate(playerId);
    const occupant = placed[side][idx];
    if (occupant === playerId) return;

    const next: Placed = { north: [...placed.north], south: [...placed.south] };
    if (origin) next[origin.side][origin.idx] = null;
    next[side][idx] = playerId;
    // Dois jogadores em campo trocam de lugar em vez de um sair
    if (occupant && origin) next[origin.side][origin.idx] = occupant;
    setPlaced(next);
  }

  function remove(playerId: string) {
    const origin = locate(playerId);
    if (!origin) return;
    setPlaced(prev => ({
      ...prev,
      [origin.side]: prev[origin.side].map(id => (id === playerId ? null : id)),
    }));
    setPicked(null);
  }

  function handleSlotClick(side: TrainingSide, idx: number) {
    const occupant = placed[side][idx];
    if (picked) {
      place(picked, side, idx);
      setPicked(null);
    } else if (occupant) {
      setPicked(occupant);
    }
  }

  function handleSlotDrop(e: React.DragEvent, side: TrainingSide, idx: number) {
    e.preventDefault();
    const playerId = e.dataTransfer.getData('playerId');
    setDragOver(null);
    if (playerId) place(playerId, side, idx);
    setPicked(null);
  }

  function handleSquadDrop(e: React.DragEvent) {
    e.preventDefault();
    setSquadOver(false);
    const playerId = e.dataTransfer.getData('playerId');
    if (playerId) remove(playerId);
  }

  function startDrag(e: React.DragEvent, playerId: string) {
    e.dataTransfer.setData('playerId', playerId);
    e.dataTransfer.effectAllowed = 'move';
  }

  function clearAll() {
    setPlaced(emptyPlaced(format));
    setPicked(null);
  }

  /** Monta o rascunho do treino a partir do que está na tela. */
  function buildDraft(): TrainingDraft {
    const team = (side: TrainingSide): TrainingTeamDraft => ({
      name: sideName[side],
      kit: kit[side],
      kitDesign: kitDesign[side],
      formationKey: variantKey[side],
      style: styleKey[side],
      playerIds: placed[side],
      slots: variants[side].slots,
    });
    return {
      date: (gameDate ?? new Date().toISOString()).slice(0, 10),
      season: scope.season,
      open: free ? false : openTraining,
      // O modo de treino é de treinador: você assiste e acompanha as notas
      mode: 'cpu-cpu',
      format,
      halfDurationSec: halfSec,
      teams: { a: team('north'), b: team('south') },
    };
  }

  /** Abre a tela do jogo em 2D. */
  function playNow() {
    setShowOpenModal(false);
    navigate(scope.routes.play, { state: { draft: buildDraft(), free } });
  }

  /** Simular rápido: roda o motor sem tela e registra o treino já com placar e notas. */
  function simulateNow() {
    const session = simulateTraining(buildDraft(), scope.players);
    setShowOpenModal(false);
    if (free) {
      setFreeResult(session);
      return;
    }
    scope.register(session);
    onSessionCreated();
  }

  return (
    <div className={styles.tabBody}>
      <section className={styles.config}>
        <div className={styles.configBlock}>
          <span className={styles.configLabel}>Jogadores por time</span>
          <div className={styles.segment} role="group" aria-label="Jogadores por time">
            {TRAINING_FORMATS.map(n => (
              <button
                key={n}
                type="button"
                className={`${styles.segBtn} ${format === n ? styles.segBtnActive : ''}`}
                onClick={() => changeFormat(n)}
              >
                {n} x {n}
              </button>
            ))}
          </div>
        </div>

        {SIDES.map(side => {
          const family = findTrainingFamily(format, variantKey[side]);
          const hasVariants = family.variants.length > 1;
          return (
            <div key={side} className={styles.configBlock}>
              <span className={styles.configLabel}>
                <span className={styles.swatch} style={{ background: kit[side] }} />
                {sideName[side]}
                <em>{side === 'north' ? 'norte' : 'sul'}</em>
              </span>
              <div className={styles.selects}>
                <select
                  className={styles.select}
                  aria-label={`Formação — ${sideName[side]}`}
                  value={family.id}
                  onChange={e => {
                    const f = TRAINING_FAMILIES[format].find(x => x.id === e.target.value);
                    if (!f) return;
                    const current = variants[side];
                    const keep = f.variants.find(v => v.variantLabel === current.variantLabel);
                    changeVariant(side, (keep ?? f.variants[0]).key);
                  }}
                >
                  {TRAINING_FAMILIES[format].map(f => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
                {hasVariants && (
                  <select
                    className={styles.select}
                    aria-label={`Variante — ${sideName[side]}`}
                    value={variantKey[side]}
                    onChange={e => changeVariant(side, e.target.value)}
                  >
                    {family.variants.map(v => (
                      <option key={v.key} value={v.key}>
                        {v.variantLabel}
                      </option>
                    ))}
                  </select>
                )}
                <select
                  className={styles.select}
                  aria-label={`Estilo tático — ${sideName[side]}`}
                  title={TACTICAL_STYLES.find(s => s.key === styleKey[side])?.tagline}
                  value={styleKey[side]}
                  onChange={e => setStyleKey(prev => ({ ...prev, [side]: e.target.value as TacticalStyleKey }))}
                >
                  {TACTICAL_STYLES.map(s => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <KitChooser
                kits={scope.kits}
                value={kitDesign[side].id}
                onChange={id => setKitId(prev => ({ ...prev, [side]: id }))}
                size={26}
              />
            </div>
          );
        })}
      </section>

      <div className={styles.board}>
        <div className={styles.fieldCol}>
          <div className={styles.field}>
            <div className={styles.halfLine} />
            <div className={styles.centerCircle} />
            <div className={`${styles.box} ${styles.boxTop}`} />
            <div className={`${styles.box} ${styles.boxBottom}`} />
            <div className={`${styles.sixYard} ${styles.sixTop}`} />
            <div className={`${styles.sixYard} ${styles.sixBottom}`} />
            <span className={`${styles.sideTag} ${styles.sideTagNorth}`}>
              {sideName.north} · {filled.north}/{format}
            </span>
            <span className={`${styles.sideTag} ${styles.sideTagSouth}`}>
              {sideName.south} · {filled.south}/{format}
            </span>

            {SIDES.map(side =>
              variants[side].slots.map((slot, idx) => {
                const pos = slotOnFullPitch(slot, side);
                const id = placed[side][idx];
                const player = id ? byId.get(id) : undefined;
                const slotId = `${side}-${idx}`;
                return (
                  <div
                    key={slotId}
                    className={`${styles.slot} ${player ? styles.slotFilled : ''} ${dragOver === slotId ? styles.slotOver : ''} ${player && picked === player.id ? styles.slotPicked : ''}`}
                    style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                    onClick={() => handleSlotClick(side, idx)}
                    onDragOver={e => {
                      e.preventDefault();
                      setDragOver(slotId);
                    }}
                    onDragLeave={() => setDragOver(prev => (prev === slotId ? null : prev))}
                    onDrop={e => handleSlotDrop(e, side, idx)}
                  >
                    {player ? (
                      <div
                        draggable
                        onDragStart={e => startDrag(e, player.id)}
                        onDragEnd={() => setDragOver(null)}
                        title={`${player.name} — ${ROLE_NAMES[slot.role]}`}
                      >
                        <PlayerJersey
                          player={player}
                          size="sm"
                          kitColor={kit[side]}
                          kit={kitDesign[side]}
                          ring={ringOf(player, slot.role)}
                          primaryColor={primary}
                          secondaryColor={secondary}
                        />
                        <button
                          type="button"
                          className={styles.removeBtn}
                          aria-label={`Remover ${player.name}`}
                          onClick={e => {
                            e.stopPropagation();
                            remove(player.id);
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <div className={styles.emptySlot} title={ROLE_NAMES[slot.role]}>
                        <span>{slot.role}</span>
                      </div>
                    )}
                  </div>
                );
              }),
            )}
          </div>
        </div>

        <aside
          className={`${styles.squad} ${squadOver ? styles.squadOver : ''}`}
          onDragOver={e => {
            e.preventDefault();
            setSquadOver(true);
          }}
          onDragLeave={() => setSquadOver(false)}
          onDrop={handleSquadDrop}
        >
          <p className={styles.squadTitle}>Elenco ({available.length} disponíveis)</p>
          <p className={styles.hint}>
            {picked
              ? 'Toque em uma posição do campo para colocar o jogador.'
              : 'Arraste para o campo — ou toque no jogador e depois na posição.'}
          </p>

          <div className={styles.playerGrid}>
            {available.map(player => (
              <div
                key={player.id}
                draggable
                onDragStart={e => startDrag(e, player.id)}
                onClick={() => setPicked(prev => (prev === player.id ? null : player.id))}
                className={`${styles.playerChip} ${picked === player.id ? styles.playerChipPicked : ''}`}
                title={player.name}
              >
                <PlayerJersey
                  player={player}
                  size="xs"
                  hideName
                  kitColor={primary}
                  kit={scope.kits[0]}
                  primaryColor={primary}
                  secondaryColor={secondary}
                />
                <span className={styles.playerName}>{player.name}</span>
                <span className={styles.playerPos}>{posAbbr(player.position)}</span>
              </div>
            ))}
            {available.length === 0 && <p className={styles.empty}>Nenhum jogador disponível</p>}
          </div>

          {unavailable.length > 0 && (
            <p className={styles.unavailable}>
              <strong>Indisponíveis: </strong>
              {unavailable.map(p => p.name).join(' · ')}
            </p>
          )}

          {squadShort && (
            <p className={styles.warning}>
              Elenco disponível insuficiente para {format} x {format} (precisa de {format * 2}).
            </p>
          )}

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.ghostBtn}
              onClick={clearAll}
              disabled={filled.north + filled.south === 0}
            >
              Limpar times
            </button>
            <button
              type="button"
              className={styles.primaryBtn}
              disabled={!ready}
              onClick={() => setShowOpenModal(true)}
            >
              Continuar
            </button>
            {!ready && (
              <p className={styles.hint}>
                Complete os dois times para continuar ({filled.north + filled.south}/{format * 2}).
              </p>
            )}
          </div>
        </aside>
      </div>

      {showOpenModal && (
        <div
          className={styles.overlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="open-training-title"
          onClick={() => setShowOpenModal(false)}
        >
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h2 id="open-training-title" className={styles.modalTitle}>
              {free ? 'Treino livre' : 'Tipo de treino'}
            </h2>
            <p className={styles.modalText}>
              {format} x {format} · {sideName.north} contra {sideName.south}
            </p>

            <div className={styles.durationBlock}>
              <span className={styles.configLabel}>Duração de cada tempo</span>
              <div className={styles.segment} role="group" aria-label="Duração de cada tempo">
                {([120, 150] as const).map(sec => (
                  <button
                    key={sec}
                    type="button"
                    className={`${styles.segBtn} ${halfSec === sec ? styles.segBtnActive : ''}`}
                    onClick={() => setHalfSec(sec)}
                  >
                    {sec === 120 ? '2:00' : '2:30'}
                  </button>
                ))}
              </div>
            </div>

            {!free && (
            <div className={styles.switchRow}>
              <div>
                <strong>{openTraining ? 'Treino aberto' : 'Treino fechado'}</strong>
                <span>
                  {openTraining
                    ? 'Torcida e imprensa podem acompanhar a atividade.'
                    : 'Apenas elenco e comissão técnica.'}
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={openTraining}
                aria-label="Treino aberto"
                className={`${styles.switch} ${openTraining ? styles.switchOn : ''}`}
                onClick={() => setOpenTraining(v => !v)}
              >
                <span className={styles.switchKnob} />
              </button>
            </div>
            )}
            {free && (
              <p className={styles.modalText}>
                Só por diversão: não salva histórico e não conta para o elenco nem para a moral.
              </p>
            )}

            <div className={styles.modalActions}>
              <button type="button" className={styles.ghostBtn} onClick={() => setShowOpenModal(false)}>
                Voltar
              </button>
              <button type="button" className={styles.ghostBtn} onClick={simulateNow}>
                Simular rápido
              </button>
              <button type="button" className={styles.primaryBtn} onClick={playNow}>
                Assistir ao treino
              </button>
            </div>
          </div>
        </div>
      )}

      {freeResult && (
        <SummaryModal
          session={freeResult}
          onClose={() => setFreeResult(null)}
          nameOf={id => scope.players.find(p => p.id === id)?.name ?? 'Jogador'}
        />
      )}
    </div>
  );
}
