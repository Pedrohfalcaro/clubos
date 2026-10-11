import { useMemo, useState } from 'react';
import PlayerJersey from '../PlayerJersey/PlayerJersey';
import type { Player } from '../../types/Player';
import { KIT_PATTERNS, kitNumberColor, type Kit, type KitDesign, type KitPatternId } from '../../types/Kit';
import KitPainter from './KitPainter';
import KitPreview, { KitToken } from './KitPreview';
import styles from './KitEditor.module.css';

type Mode = 'preset' | 'custom';
type PatternChoice = KitPatternId | 'solid';

interface KitEditorModalProps {
  /** Uniforme existente (edição) ou um rascunho novo (criação). */
  kit: Kit;
  title: string;
  onSave: (kit: Kit) => void;
  onClose: () => void;
  /** Só o terceiro uniforme pode ser removido. */
  onDelete?: () => void;
}

const HEX = /^#[0-9a-fA-F]{6}$/;

export default function KitEditorModal({ kit, title, onSave, onClose, onDelete }: KitEditorModalProps) {
  const [base, setBase] = useState(kit.base);
  const [mode, setMode] = useState<Mode>(kit.design.type === 'custom' ? 'custom' : 'preset');
  const [pattern, setPattern] = useState<PatternChoice>(kit.design.type === 'preset' ? kit.design.pattern : 'solid');
  const [color2, setColor2] = useState(kit.design.type === 'preset' ? kit.design.color2 : '#ffffff');
  const [customImage, setCustomImage] = useState<string | null>(kit.design.type === 'custom' ? kit.design.image : null);
  /** Cor do número escolhida (vazio = automática pelo contraste). */
  const [numberColor, setNumberColor] = useState<string | undefined>(kit.numberColor);

  const design: KitDesign = useMemo(() => {
    if (mode === 'custom' && customImage) return { type: 'custom', image: customImage };
    if (mode === 'preset' && pattern !== 'solid') return { type: 'preset', pattern, color2 };
    return { type: 'solid' };
  }, [mode, pattern, color2, customImage]);

  const draft: Kit = { id: kit.id, base: HEX.test(base) ? base : kit.base, design, numberColor };
  // jogador de mentira só para mostrar o uniforme como aparece nas escalações
  const sample = { number: 10, position: 'CM', name: 'Camisa 10' } as Player;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2 className={styles.title}>{title}</h2>

        <div className={styles.cols}>
          <div className={styles.previewCol}>
            <KitPreview kit={draft} size={180} number="10" />
            <div className={styles.fieldRow}>
              <span className={styles.fieldLabel}>Em campo e na escalação</span>
              <div className={styles.samples}>
                <KitToken kit={draft} size={44} number="10" />
                <PlayerJersey player={sample} size="sm" hideName kit={draft} kitColor={draft.base} />
                <PlayerJersey player={{ ...sample, number: 7 } as Player} size="xs" hideName kit={draft} kitColor={draft.base} />
              </div>
            </div>
            <label className={styles.field}>
              <span>Cor base</span>
              <div className={styles.colorRow}>
                <input type="color" value={draft.base} onChange={e => setBase(e.target.value)} />
                <input
                  className={styles.hex}
                  value={base}
                  maxLength={7}
                  onChange={e => setBase(e.target.value)}
                  aria-label="Cor base em hexadecimal"
                />
              </div>
            </label>
          </div>

          <div className={styles.controls}>
            <div className={styles.field}>
              <span>Cor do número</span>
              <div className={styles.colorRow}>
                <input
                  type="color"
                  value={kitNumberColor(draft)}
                  onChange={e => setNumberColor(e.target.value)}
                  aria-label="Cor do número"
                />
                <button type="button" className={styles.miniBtn} onClick={() => setNumberColor('#ffffff')}>
                  Branco
                </button>
                <button type="button" className={styles.miniBtn} onClick={() => setNumberColor('#111111')}>
                  Preto
                </button>
                <button
                  type="button"
                  className={styles.miniBtn}
                  onClick={() => setNumberColor(undefined)}
                  disabled={numberColor === undefined}
                  title="Escolhe preto ou branco conforme a cor base"
                >
                  Automática
                </button>
              </div>
            </div>
            <div className={styles.tabs} role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'preset'}
                className={`${styles.tab} ${mode === 'preset' ? styles.tabOn : ''}`}
                onClick={() => setMode('preset')}
              >
                Modelos prontos
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'custom'}
                className={`${styles.tab} ${mode === 'custom' ? styles.tabOn : ''}`}
                onClick={() => setMode('custom')}
              >
                Personalizado
              </button>
            </div>

            {mode === 'preset' ? (
              <>
                <div className={styles.grid}>
                  <button
                    type="button"
                    className={`${styles.tile} ${pattern === 'solid' ? styles.tileOn : ''}`}
                    onClick={() => setPattern('solid')}
                    title="Liso"
                  >
                    <KitPreview kit={{ id: 't', base: draft.base, design: { type: 'solid' } }} size={56} />
                    <span>Liso</span>
                  </button>
                  {KIT_PATTERNS.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      className={`${styles.tile} ${pattern === p.id ? styles.tileOn : ''}`}
                      onClick={() => setPattern(p.id)}
                      title={p.label}
                    >
                      <KitPreview
                        kit={{ id: 't', base: draft.base, design: { type: 'preset', pattern: p.id, color2 } }}
                        size={56}
                      />
                      <span>{p.label}</span>
                    </button>
                  ))}
                </div>
                <label className={styles.field}>
                  <span>Cor secundária do desenho</span>
                  <div className={styles.colorRow}>
                    <input type="color" value={color2} onChange={e => setColor2(e.target.value)} />
                    <input
                      className={styles.hex}
                      value={color2}
                      maxLength={7}
                      onChange={e => setColor2(e.target.value)}
                      aria-label="Cor secundária em hexadecimal"
                    />
                  </div>
                </label>
              </>
            ) : (
              <KitPainter base={draft.base} initialImage={customImage} onChange={setCustomImage} />
            )}
          </div>
        </div>

        <div className={styles.actions}>
          {onDelete && (
            <button type="button" className={styles.dangerBtn} onClick={onDelete}>
              Remover uniforme
            </button>
          )}
          <span className={styles.spacer} />
          <button type="button" className={styles.ghostBtn} onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className={styles.primaryBtn} onClick={() => onSave(draft)}>
            Salvar uniforme
          </button>
        </div>
      </div>
    </div>
  );
}
