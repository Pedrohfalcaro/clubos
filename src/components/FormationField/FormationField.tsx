import { useState } from 'react';
import type { Player } from '../../types/Player';
import PlayerJersey from '../PlayerJersey/PlayerJersey';
import type { FormationPreset } from '../../utils/formations';
import styles from './FormationField.module.css';

export interface FieldSlot {
  playerId: string;
  x: number;
  y: number;
}

interface FormationFieldProps {
  players: Player[];
  formation: FieldSlot[];
  onFormationChange: (formation: FieldSlot[]) => void;
  maxOnField?: number;
  bench?: string[];
  onBenchChange?: (bench: string[]) => void;
  showBench?: boolean;
  benchMin?: number;
  benchMax?: number;
  slotMode?: boolean;
  preset?: FormationPreset | null;
}

export default function FormationField({
  players,
  formation,
  onFormationChange,
  maxOnField = 11,
  bench = [],
  onBenchChange,
  showBench = false,
  benchMin = 7,
  benchMax = 9,
  slotMode = false,
  preset = null,
}: FormationFieldProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [movingSlot, setMovingSlot] = useState<number | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [benchDragOver, setBenchDragOver] = useState(false);
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);

  const onFieldIds = new Set(formation.map(f => f.playerId));
  const benchIds = new Set(bench);
  const available = players.filter(p => !onFieldIds.has(p.id) && !benchIds.has(p.id));

  function getPlayer(id: string) {
    return players.find(p => p.id === id);
  }

  function findPlayerAtSlot(slotIndex: number): FieldSlot | undefined {
    if (!preset) return undefined;
    const slot = preset.slots[slotIndex];
    return formation.find(f =>
      Math.abs(f.x - slot.x) < 2 && Math.abs(f.y - slot.y) < 2,
    );
  }

  function assignToSlot(slotIndex: number, playerId: string) {
    if (!preset) return;
    const slot = preset.slots[slotIndex];
    const withoutPlayer = formation.filter(f => f.playerId !== playerId);
    const withoutSlot = withoutPlayer.filter(f =>
      !(Math.abs(f.x - slot.x) < 2 && Math.abs(f.y - slot.y) < 2),
    );
    onFormationChange([...withoutSlot, { playerId, x: slot.x, y: slot.y }]);
    if (bench.includes(playerId) && onBenchChange) {
      onBenchChange(bench.filter(id => id !== playerId));
    }
    setSelectedSlot(null);
    setDragOverSlot(null);
  }

  function handleSlotClick(slotIndex: number) {
    setSelectedSlot(prev => (prev === slotIndex ? null : slotIndex));
  }

  function handlePlayerPick(playerId: string) {
    if (slotMode && selectedSlot !== null) {
      assignToSlot(selectedSlot, playerId);
      return;
    }
    if (slotMode && preset) {
      const emptyIndex = preset.slots.findIndex((_, i) => !findPlayerAtSlot(i));
      if (emptyIndex >= 0) assignToSlot(emptyIndex, playerId);
    }
  }

  function handleSlotDrop(e: React.DragEvent, slotIndex: number) {
    e.preventDefault();
    e.stopPropagation();
    const playerId = e.dataTransfer.getData('playerId');
    if (!playerId) return;
    assignToSlot(slotIndex, playerId);
    setDraggingId(null);
    setMovingSlot(null);
    setDragOverSlot(null);
  }

  function handleBenchDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    const playerId = e.dataTransfer.getData('playerId');
    if (!playerId || !onBenchChange) return;
    if (bench.includes(playerId)) {
      setBenchDragOver(false);
      return;
    }
    if (bench.length >= benchMax) return;
    onFormationChange(formation.filter(f => f.playerId !== playerId));
    onBenchChange([...bench, playerId]);
    setDraggingId(null);
    setBenchDragOver(false);
  }

  function handleFieldDrop(e: React.DragEvent, x?: number, y?: number) {
    if (slotMode) return;
    e.preventDefault();
    const playerId = e.dataTransfer.getData('playerId');
    if (!playerId) return;

    const existing = formation.findIndex(f => f.playerId === playerId);
    if (existing >= 0) {
      if (x !== undefined && y !== undefined) {
        const updated = [...formation];
        updated[existing] = { ...updated[existing], x, y };
        onFormationChange(updated);
      }
      setDraggingId(null);
      setMovingSlot(null);
      return;
    }

    if (formation.length >= maxOnField) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const dropX = x ?? ((e.clientX - rect.left) / rect.width) * 100;
    const dropY = y ?? ((e.clientY - rect.top) / rect.height) * 100;

    onFormationChange([
      ...formation,
      { playerId, x: Math.min(92, Math.max(8, dropX)), y: Math.min(92, Math.max(8, dropY)) },
    ]);

    if (bench.includes(playerId) && onBenchChange) {
      onBenchChange(bench.filter(id => id !== playerId));
    }

    setDraggingId(null);
  }

  function removeFromField(playerId: string) {
    onFormationChange(formation.filter(f => f.playerId !== playerId));
  }

  function removeFromBench(playerId: string) {
    onBenchChange?.(bench.filter(id => id !== playerId));
  }

  function handleSlotDrag(i: number, e: React.DragEvent) {
    e.dataTransfer.setData('playerId', formation[i].playerId);
    e.dataTransfer.setData('slotIndex', String(i));
    setDraggingId(formation[i].playerId);
    setMovingSlot(i);
  }

  function handleBenchPlayerDrag(playerId: string, e: React.DragEvent) {
    e.dataTransfer.setData('playerId', playerId);
    e.dataTransfer.setData('fromBench', '1');
    setDraggingId(playerId);
  }

  function startListDrag(playerId: string, e: React.DragEvent) {
    e.dataTransfer.setData('playerId', playerId);
    setDraggingId(playerId);
  }

  const slotsFilled = preset ? preset.slots.filter((_, i) => findPlayerAtSlot(i)).length : formation.length;

  return (
    <div className={`${styles.wrapper} ${slotMode ? styles.wrapperSlot : ''}`}>
      <div
        className={styles.field}
        onDragOver={e => !slotMode && e.preventDefault()}
        onDrop={e => handleFieldDrop(e)}
      >
        <div className={styles.halfLine} />
        <div className={styles.centerCircle} />
        <div className={styles.penaltyTop} />
        <div className={styles.penaltyBottom} />

        {slotMode && preset ? (
          preset.slots.map((slot, i) => {
            const assigned = findPlayerAtSlot(i);
            const player = assigned ? getPlayer(assigned.playerId) : null;
            const isSelected = selectedSlot === i;
            const isDragOver = dragOverSlot === i;

            return (
              <div
                key={i}
                className={`${styles.slotMarker} ${isSelected ? styles.slotSelected : ''} ${player ? styles.slotFilled : ''} ${isDragOver ? styles.slotDragOver : ''}`}
                style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                onClick={() => handleSlotClick(i)}
                onDragOver={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragOverSlot(i);
                }}
                onDragLeave={() => setDragOverSlot(prev => (prev === i ? null : prev))}
                onDrop={e => handleSlotDrop(e, i)}
              >
                {player ? (
                  <div
                    draggable
                    onDragStart={e => {
                      const fi = formation.findIndex(f => f.playerId === player.id);
                      if (fi >= 0) handleSlotDrag(fi, e);
                    }}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setMovingSlot(null);
                      setDragOverSlot(null);
                    }}
                    onClick={e => e.stopPropagation()}
                    role="presentation"
                  >
                    <PlayerJersey
                      player={player}
                      size="sm"
                      onClick={() => removeFromField(player.id)}
                    />
                  </div>
                ) : (
                  <div className={styles.emptySlot}>
                    <span className={styles.slotRole}>{slot.role}</span>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          formation.map((slot, i) => {
            const player = getPlayer(slot.playerId);
            if (!player) return null;
            return (
              <div
                key={slot.playerId}
                className={styles.fieldPlayer}
                style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                draggable
                onDragStart={e => handleSlotDrag(i, e)}
                onDragEnd={() => setMovingSlot(null)}
              >
                <PlayerJersey
                  player={player}
                  size="sm"
                  onClick={() => removeFromField(slot.playerId)}
                />
              </div>
            );
          })
        )}

        {movingSlot !== null && !slotMode && (
          <div className={styles.dropHint}>Solte para reposicionar</div>
        )}

        {slotMode && (selectedSlot !== null || dragOverSlot !== null) && (
          <div className={styles.dropHint}>
            {dragOverSlot !== null
              ? `Solte em ${preset?.slots[dragOverSlot]?.role}`
              : `Posição ${preset?.slots[selectedSlot!]?.role} — arraste ou selecione um jogador`}
          </div>
        )}
      </div>

      <div className={styles.sidebar}>
        {slotMode && (
          <div className={styles.slotProgress}>
            <div className={styles.slotProgressBar}>
              <div
                className={styles.slotProgressFill}
                style={{ width: `${(slotsFilled / (preset?.slots.length ?? 11)) * 100}%` }}
              />
            </div>
            <span className={styles.slotProgressText}>
              {slotsFilled}/{preset?.slots.length ?? 11} titulares
            </span>
          </div>
        )}

        <p className={styles.sidebarTitle}>
          Elenco ({available.length} disponíveis)
        </p>
        <div className={styles.playerGrid}>
          {available.map(player => (
            <div
              key={player.id}
              draggable
              onDragStart={e => startListDrag(player.id, e)}
              onDragEnd={() => setDraggingId(null)}
              onClick={() => slotMode && handlePlayerPick(player.id)}
              className={`${styles.playerChip} ${draggingId === player.id ? styles.dragging : ''} ${slotMode ? styles.playerChipDraggable : ''}`}
              title={player.name}
            >
              <PlayerJersey player={player} size="xs" hideName />
              <span className={styles.playerChipName}>{player.name}</span>
            </div>
          ))}
          {available.length === 0 && (
            <p className={styles.emptyList}>Nenhum jogador disponível</p>
          )}
        </div>

        {showBench && onBenchChange && (
          <div className={styles.benchSection}>
            <p className={styles.sidebarTitle}>
              Banco ({bench.length}/{benchMax})
            </p>
            <div
              className={`${styles.benchDropZone} ${benchDragOver ? styles.benchDropZoneActive : ''}`}
              onDragOver={e => {
                e.preventDefault();
                setBenchDragOver(true);
              }}
              onDragLeave={() => setBenchDragOver(false)}
              onDrop={handleBenchDrop}
            >
              {bench.length === 0 ? (
                <span className={styles.benchPlaceholder}>
                  Arraste jogadores aqui
                </span>
              ) : (
                <div className={styles.benchGrid}>
                  {bench.map(id => {
                    const player = getPlayer(id);
                    if (!player) return null;
                    return (
                      <div
                        key={id}
                        className={styles.benchChip}
                        draggable
                        onDragStart={e => handleBenchPlayerDrag(id, e)}
                        onDragEnd={() => setDraggingId(null)}
                        title={player.name}
                      >
                        <PlayerJersey
                          player={player}
                          size="xs"
                          hideName
                          onClick={() => removeFromBench(id)}
                        />
                        <span className={styles.benchChipName}>{player.name}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {bench.length < benchMin && benchMin > 0 && (
              <p className={styles.warning}>Mínimo de {benchMin} no banco ({benchMin - bench.length} faltando)</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
