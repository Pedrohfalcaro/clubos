import { kitNumberColor, numberOutline, type Kit } from '../types/Kit';

/** Lado (px) do desenho do uniforme. Todos os desenhos (modelos e livre) são quadrados. */
export const KIT_TEXTURE_SIZE = 128;

const imageCache = new Map<string, HTMLImageElement>();
const spriteCache = new Map<string, HTMLCanvasElement>();
const spriteUrlCache = new Map<string, string>();
const listeners = new Set<() => void>();

/** Avisa quando uma imagem de uniforme personalizado terminou de carregar (para redesenhar). */
export function onKitImagesLoaded(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function loadImage(src: string): HTMLImageElement | null {
  const cached = imageCache.get(src);
  if (cached) return cached.complete && cached.naturalWidth > 0 ? cached : null;
  const img = new Image();
  imageCache.set(src, img);
  img.onload = () => {
    spriteCache.clear();
    spriteUrlCache.clear();
    for (const cb of listeners) cb();
  };
  img.src = src;
  return img.complete && img.naturalWidth > 0 ? img : null;
}

/** Silhueta de camisa em coordenadas normalizadas (0–1). */
export function shirtPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const p = (nx: number, ny: number) => [x + nx * w, y + ny * h] as const;
  ctx.beginPath();
  ctx.moveTo(...p(0.3, 0.05));
  ctx.quadraticCurveTo(...p(0.5, 0.2), ...p(0.7, 0.05));
  ctx.lineTo(...p(0.97, 0.18));
  ctx.lineTo(...p(1.0, 0.4));
  ctx.lineTo(...p(0.82, 0.46));
  ctx.lineTo(...p(0.8, 0.97));
  ctx.lineTo(...p(0.2, 0.97));
  ctx.lineTo(...p(0.18, 0.46));
  ctx.lineTo(...p(0.0, 0.4));
  ctx.lineTo(...p(0.03, 0.18));
  ctx.closePath();
}

/** Desenha o uniforme (cor base + desenho) num quadrado s × s a partir de (0, 0). */
export function drawKitTexture(ctx: CanvasRenderingContext2D, kit: Kit, s: number): void {
  ctx.fillStyle = kit.base;
  ctx.fillRect(0, 0, s, s);
  const d = kit.design;

  if (d.type === 'custom') {
    const img = loadImage(d.image);
    if (img) ctx.drawImage(img, 0, 0, s, s);
    return;
  }
  if (d.type !== 'preset') return;

  ctx.fillStyle = d.color2;
  ctx.strokeStyle = d.color2;
  switch (d.pattern) {
    case 'vstripes': {
      const n = 7;
      for (let i = 1; i < n; i += 2) ctx.fillRect((i * s) / n, 0, s / n, s);
      break;
    }
    case 'hoops': {
      const n = 8;
      for (let i = 1; i < n; i += 2) ctx.fillRect(0, (i * s) / n, s, s / n);
      break;
    }
    case 'pinstripes': {
      const n = 14;
      for (let i = 0; i < n; i++) ctx.fillRect((i * s) / n + s / (2 * n) - s / 80, 0, s / 40, s);
      break;
    }
    case 'sash': {
      ctx.lineWidth = s * 0.3;
      ctx.beginPath();
      ctx.moveTo(-0.1 * s, -0.1 * s);
      ctx.lineTo(1.1 * s, 1.1 * s);
      ctx.stroke();
      break;
    }
    case 'diagstripes': {
      ctx.lineWidth = s * 0.1;
      for (let k = -4; k <= 4; k++) {
        ctx.beginPath();
        ctx.moveTo(k * s * 0.25 - s * 0.2, -s * 0.1);
        ctx.lineTo(k * s * 0.25 + s * 1.1, s * 1.1);
        ctx.stroke();
      }
      break;
    }
    case 'halves':
      ctx.fillRect(s / 2, 0, s / 2, s);
      break;
    case 'quarters':
      ctx.fillRect(0, 0, s / 2, s / 2);
      ctx.fillRect(s / 2, s / 2, s / 2, s / 2);
      break;
    case 'checkers': {
      const n = 6;
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) if ((r + c) % 2 === 1) ctx.fillRect((c * s) / n, (r * s) / n, s / n, s / n);
      }
      break;
    }
    case 'chevron':
      ctx.beginPath();
      ctx.moveTo(0, 0.25 * s);
      ctx.lineTo(0.5 * s, 0.6 * s);
      ctx.lineTo(s, 0.25 * s);
      ctx.lineTo(s, 0.45 * s);
      ctx.lineTo(0.5 * s, 0.8 * s);
      ctx.lineTo(0, 0.45 * s);
      ctx.closePath();
      ctx.fill();
      break;
    case 'sleeves':
      ctx.fillRect(0, 0, 0.22 * s, s);
      ctx.fillRect(0.78 * s, 0, 0.22 * s, s);
      break;
    case 'band':
      ctx.fillRect(0, 0.4 * s, s, 0.2 * s);
      break;
    case 'gradient': {
      const g = ctx.createLinearGradient(0, 0, 0, s);
      g.addColorStop(0, kit.base);
      g.addColorStop(1, d.color2);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
      break;
    }
  }
}

/** Desenha a camisa completa (silhueta + desenho + contorno) num retângulo. */
export function drawShirt(
  ctx: CanvasRenderingContext2D,
  kit: Kit,
  x: number,
  y: number,
  w: number,
  h: number,
  /** Número da camisa para pré-visualizar (ex.: "10"). */
  number?: string,
): void {
  const tex = document.createElement('canvas');
  tex.width = KIT_TEXTURE_SIZE;
  tex.height = KIT_TEXTURE_SIZE;
  const tctx = tex.getContext('2d');
  if (!tctx) return;
  drawKitTexture(tctx, kit, KIT_TEXTURE_SIZE);
  ctx.save();
  shirtPath(ctx, x, y, w, h);
  ctx.clip();
  ctx.drawImage(tex, x, y, w, h);
  ctx.restore();
  shirtPath(ctx, x, y, w, h);
  ctx.lineWidth = Math.max(1, w * 0.025);
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineJoin = 'round';
  ctx.stroke();

  if (number) {
    const color = kitNumberColor(kit);
    ctx.font = `900 ${Math.round(h * 0.34)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, h * 0.07);
    ctx.strokeStyle = numberOutline(color);
    ctx.strokeText(number, x + w / 2, y + h * 0.6);
    ctx.fillStyle = color;
    ctx.fillText(number, x + w / 2, y + h * 0.6);
  }
}

/** Ficha redonda do jogador no campo (como no jogo), para pré-visualizar o uniforme com número. */
export function drawToken(ctx: CanvasRenderingContext2D, kit: Kit, cx: number, cy: number, r: number, number: string): void {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = kit.base;
  ctx.fill();
  if (kit.design.type !== 'solid') {
    ctx.save();
    ctx.clip();
    ctx.drawImage(getKitSprite(kit), cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.stroke();
  const color = kitNumberColor(kit);
  ctx.font = `800 ${Math.round(r)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (kit.design.type !== 'solid') {
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, r * 0.28);
    ctx.strokeStyle = numberOutline(color);
    ctx.strokeText(number, cx, cy + 0.5);
  }
  ctx.fillStyle = color;
  ctx.fillText(number, cx, cy + 0.5);
}

function kitKey(kit: Kit): string {
  const d = kit.design;
  if (d.type === 'custom') return `${kit.base}|c|${d.image.length}|${d.image.slice(-24)}`;
  if (d.type === 'preset') return `${kit.base}|p|${d.pattern}|${d.color2}`;
  return `${kit.base}|s`;
}

/** Textura pronta (em cache) do uniforme, para desenhar nos jogadores do campo. */
export function getKitSprite(kit: Kit, size = 64): HTMLCanvasElement {
  const key = `${kitKey(kit)}|${size}`;
  const hit = spriteCache.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) drawKitTexture(ctx, kit, size);
  spriteCache.set(key, canvas);
  return canvas;
}

/** O desenho do uniforme como imagem (data URL) — para usar em CSS (quadradinhos de escalação). */
export function getKitSpriteUrl(kit: Kit, size = 64): string {
  const key = `${kitKey(kit)}|${size}`;
  const hit = spriteUrlCache.get(key);
  if (hit) return hit;
  const url = getKitSprite(kit, size).toDataURL('image/png');
  spriteUrlCache.set(key, url);
  return url;
}
