import { useCallback, useEffect, useRef, useState } from 'react';
import { KIT_TEXTURE_SIZE, shirtPath } from '../../utils/kitRender';
import styles from './KitEditor.module.css';

type Tool = 'brush' | 'eraser' | 'line' | 'rect' | 'ellipse' | 'fill';

const TOOLS: { id: Tool; label: string }[] = [
  { id: 'brush', label: 'Pincel' },
  { id: 'eraser', label: 'Borracha' },
  { id: 'line', label: 'Linha' },
  { id: 'rect', label: 'Retângulo' },
  { id: 'ellipse', label: 'Círculo' },
  { id: 'fill', label: 'Balde' },
];

const SIZE = KIT_TEXTURE_SIZE * 2; // superfície de desenho 256 × 256 (salva em 128 × 128)
const MAX_UNDO = 25;

interface KitPainterProps {
  /** Cor de fundo (cor base do uniforme) — também é a "borracha". */
  base: string;
  /** Desenho anterior para continuar editando (data URL). */
  initialImage?: string | null;
  /** Chamado ao fim de cada traço com o desenho atual (data URL, 128 × 128). */
  onChange: (dataUrl: string) => void;
}

/** Converte "#rrggbb" em [r, g, b]. */
function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [0, 0, 0];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Balde de tinta com tolerância (varredura por pilha). */
function floodFill(ctx: CanvasRenderingContext2D, sx: number, sy: number, color: string, tolerance = 28): void {
  const img = ctx.getImageData(0, 0, SIZE, SIZE);
  const data = img.data;
  const [fr, fg, fb] = hexToRgb(color);
  const idx = (x: number, y: number) => (y * SIZE + x) * 4;
  const start = idx(sx, sy);
  const tr = data[start];
  const tg = data[start + 1];
  const tb = data[start + 2];
  if (Math.abs(tr - fr) + Math.abs(tg - fg) + Math.abs(tb - fb) < 6) return;
  const match = (i: number) =>
    Math.abs(data[i] - tr) + Math.abs(data[i + 1] - tg) + Math.abs(data[i + 2] - tb) <= tolerance * 3;

  const stack: number[] = [sx, sy];
  const seen = new Uint8Array(SIZE * SIZE);
  while (stack.length) {
    const y = stack.pop()!;
    const x = stack.pop()!;
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) continue;
    const p = y * SIZE + x;
    if (seen[p]) continue;
    const i = p * 4;
    if (!match(i)) continue;
    seen[p] = 1;
    data[i] = fr;
    data[i + 1] = fg;
    data[i + 2] = fb;
    data[i + 3] = 255;
    stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
  }
  ctx.putImageData(img, 0, 0);
}

/**
 * Editor de desenho livre do uniforme: pincel, borracha, linha, retângulo, círculo e balde, com
 * desfazer. A camisa aparece como guia por cima (a parte de fora da silhueta fica escurecida).
 */
export default function KitPainter({ base, initialImage, onChange }: KitPainterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const guideRef = useRef<HTMLCanvasElement>(null);
  const undoRef = useRef<ImageData[]>([]);
  const dragRef = useRef<{ x: number; y: number; snap: ImageData } | null>(null);
  const [tool, setTool] = useState<Tool>('brush');
  const [color, setColor] = useState('#ffffff');
  const [width, setWidth] = useState(10);
  const [filled, setFilled] = useState(true);
  const [undoCount, setUndoCount] = useState(0);

  const emit = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const out = document.createElement('canvas');
    out.width = KIT_TEXTURE_SIZE;
    out.height = KIT_TEXTURE_SIZE;
    out.getContext('2d')?.drawImage(canvas, 0, 0, KIT_TEXTURE_SIZE, KIT_TEXTURE_SIZE);
    onChange(out.toDataURL('image/png'));
  }, [onChange]);

  // Inicializa a tela (fundo na cor base ou desenho anterior) e a guia da camisa
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, SIZE, SIZE);
    if (initialImage) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, SIZE, SIZE);
        emit();
      };
      img.src = initialImage;
    }
    const guide = guideRef.current?.getContext('2d');
    if (guide) {
      guide.clearRect(0, 0, SIZE, SIZE);
      guide.fillStyle = 'rgba(0,0,0,0.55)';
      guide.beginPath();
      guide.rect(0, 0, SIZE, SIZE);
      shirtPath(guide, SIZE * 0.04, SIZE * 0.04, SIZE * 0.92, SIZE * 0.92);
      guide.fill('evenodd');
      shirtPath(guide, SIZE * 0.04, SIZE * 0.04, SIZE * 0.92, SIZE * 0.92);
      guide.lineWidth = 2;
      guide.strokeStyle = 'rgba(255,255,255,0.7)';
      guide.stroke();
    }
    // só na abertura: `base` e `initialImage` não mudam enquanto o editor está aberto
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pos(e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(SIZE - 1, ((e.clientX - rect.left) / rect.width) * SIZE)),
      y: Math.max(0, Math.min(SIZE - 1, ((e.clientY - rect.top) / rect.height) * SIZE)),
    };
  }

  function pushUndo(ctx: CanvasRenderingContext2D) {
    undoRef.current.push(ctx.getImageData(0, 0, SIZE, SIZE));
    if (undoRef.current.length > MAX_UNDO) undoRef.current.shift();
    setUndoCount(undoRef.current.length);
  }

  function drawShape(ctx: CanvasRenderingContext2D, a: { x: number; y: number }, b: { x: number; y: number }) {
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    if (tool === 'line') {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    } else if (tool === 'rect') {
      const x = Math.min(a.x, b.x);
      const y = Math.min(a.y, b.y);
      const w = Math.abs(b.x - a.x);
      const h = Math.abs(b.y - a.y);
      if (filled) ctx.fillRect(x, y, w, h);
      else ctx.strokeRect(x, y, w, h);
    } else if (tool === 'ellipse') {
      ctx.beginPath();
      ctx.ellipse((a.x + b.x) / 2, (a.y + b.y) / 2, Math.abs(b.x - a.x) / 2, Math.abs(b.y - a.y) / 2, 0, 0, Math.PI * 2);
      if (filled) ctx.fill();
      else ctx.stroke();
    }
  }

  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = pos(e);
    pushUndo(ctx);
    if (tool === 'fill') {
      floodFill(ctx, Math.floor(p.x), Math.floor(p.y), color);
      emit();
      return;
    }
    dragRef.current = { x: p.x, y: p.y, snap: ctx.getImageData(0, 0, SIZE, SIZE) };
    if (tool === 'brush' || tool === 'eraser') {
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = tool === 'eraser' ? base : color;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + 0.01, p.y + 0.01);
      ctx.stroke();
    }
  }

  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    const ctx = canvasRef.current?.getContext('2d');
    if (!drag || !ctx) return;
    const p = pos(e);
    if (tool === 'brush' || tool === 'eraser') {
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    } else {
      ctx.putImageData(drag.snap, 0, 0);
      drawShape(ctx, { x: drag.x, y: drag.y }, p);
    }
  }

  function onUp() {
    if (!dragRef.current) return;
    dragRef.current = null;
    emit();
  }

  function undo() {
    const ctx = canvasRef.current?.getContext('2d');
    const last = undoRef.current.pop();
    if (!ctx || !last) return;
    ctx.putImageData(last, 0, 0);
    setUndoCount(undoRef.current.length);
    emit();
  }

  function clear() {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    pushUndo(ctx);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, SIZE, SIZE);
    emit();
  }

  const shapeTool = tool === 'rect' || tool === 'ellipse';

  return (
    <div className={styles.painter}>
      <div className={styles.toolbar} role="toolbar" aria-label="Ferramentas de desenho">
        {TOOLS.map(t => (
          <button
            key={t.id}
            type="button"
            className={`${styles.toolBtn} ${tool === t.id ? styles.toolBtnOn : ''}`}
            onClick={() => setTool(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className={styles.paintOptions}>
        <label className={styles.optLabel}>
          Cor
          <input type="color" value={color} onChange={e => setColor(e.target.value)} />
        </label>
        {tool !== 'fill' && (
          <label className={styles.optLabel}>
            Espessura {width}
            <input type="range" min={2} max={48} value={width} onChange={e => setWidth(Number(e.target.value))} />
          </label>
        )}
        {shapeTool && (
          <label className={styles.optLabel}>
            <input type="checkbox" checked={filled} onChange={e => setFilled(e.target.checked)} /> Preenchido
          </label>
        )}
        <button type="button" className={styles.smallBtn} onClick={undo} disabled={undoCount === 0}>
          Desfazer
        </button>
        <button type="button" className={styles.smallBtn} onClick={clear}>
          Limpar
        </button>
      </div>

      <div className={styles.canvasWrap}>
        <canvas
          ref={canvasRef}
          width={SIZE}
          height={SIZE}
          className={styles.drawCanvas}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        />
        <canvas ref={guideRef} width={SIZE} height={SIZE} className={styles.guideCanvas} aria-hidden="true" />
      </div>
      <p className={styles.hint}>Desenhe dentro da camisa — a parte escurecida não aparece no uniforme.</p>
    </div>
  );
}
