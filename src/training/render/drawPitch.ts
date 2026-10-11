import { MARKINGS } from '../engine';
import type { Format, Pitch } from '../engine';

/** Posição do campo na tela: origem em px e pixels por metro. */
export interface View {
  ox: number;
  oy: number;
  ppm: number;
}

/** Margem (em metros) ao redor do campo, para as redes e o respiro visual. */
export const PITCH_MARGIN = 3.5;

/** Faixas da tela ocupadas por HUD (placar em cima, notas embaixo). */
export interface Insets {
  top: number;
  bottom: number;
}

export function computeView(
  width: number,
  height: number,
  pitch: Pitch,
  insets: Insets = { top: 0, bottom: 0 },
): View {
  const availH = Math.max(80, height - insets.top - insets.bottom);
  const ppm = Math.min(
    width / (pitch.L + PITCH_MARGIN * 2),
    availH / (pitch.H + PITCH_MARGIN * 2),
  );
  return {
    ppm,
    ox: (width - pitch.L * ppm) / 2,
    oy: insets.top + (availH - pitch.H * ppm) / 2,
  };
}

export function drawPitch(
  ctx: CanvasRenderingContext2D,
  view: View,
  format: Format,
  pitch: Pitch,
): void {
  const m = MARKINGS[format];
  const { ox, oy, ppm } = view;
  const px = (x: number) => ox + x * ppm;
  const py = (y: number) => oy + y * ppm;
  const W = pitch.L * ppm;
  const H = pitch.H * ppm;

  // Grama listrada
  const stripes = 14;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#1d6a36' : '#1a5f31';
    ctx.fillRect(ox + (W / stripes) * i, oy, W / stripes + 1, H);
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.88)';
  ctx.lineWidth = Math.max(1.5, ppm * 0.14);
  ctx.lineJoin = 'round';

  // Linhas externas e meio-campo
  ctx.strokeRect(ox, oy, W, H);
  ctx.beginPath();
  ctx.moveTo(px(pitch.L / 2), oy);
  ctx.lineTo(px(pitch.L / 2), oy + H);
  ctx.stroke();

  // Círculo e ponto central
  ctx.beginPath();
  ctx.arc(px(pitch.L / 2), py(pitch.H / 2), m.circle * ppm, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.arc(px(pitch.L / 2), py(pitch.H / 2), Math.max(2, ppm * 0.22), 0, Math.PI * 2);
  ctx.fill();

  for (const side of [0, 1] as const) {
    const dir = side === 0 ? 1 : -1;
    const lineX = side === 0 ? 0 : pitch.L;
    const rect = (depth: number, width: number) => {
      const x0 = px(lineX);
      const x1 = px(lineX + dir * depth);
      ctx.strokeRect(Math.min(x0, x1), py(pitch.H / 2 - width / 2), Math.abs(x1 - x0), width * ppm);
    };
    rect(m.boxD, m.boxW);
    if (m.sixD > 0) rect(m.sixD, m.sixW);

    // Marca do pênalti e meia-lua da grande área
    const spotX = lineX + dir * m.spot;
    ctx.beginPath();
    ctx.arc(px(spotX), py(pitch.H / 2), Math.max(2, ppm * 0.2), 0, Math.PI * 2);
    ctx.fill();
    const boxEdge = lineX + dir * m.boxD;
    const arcR = m.circle * ppm;
    const dx = (boxEdge - spotX) * ppm;
    if (Math.abs(dx) < arcR) {
      const ang = Math.acos(Math.abs(dx) / arcR);
      ctx.beginPath();
      if (dir === 1) ctx.arc(px(spotX), py(pitch.H / 2), arcR, -ang, ang);
      else ctx.arc(px(spotX), py(pitch.H / 2), arcR, Math.PI - ang, Math.PI + ang);
      ctx.stroke();
    }

    // Gol com rede
    const gx0 = px(lineX);
    const gx1 = px(lineX - dir * m.goalDepth);
    const gy = py(pitch.H / 2 - pitch.goalW / 2);
    const gh = pitch.goalW * ppm;
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(Math.min(gx0, gx1), gy, Math.abs(gx1 - gx0), gh);
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    const steps = 6;
    for (let i = 1; i < steps; i++) {
      const yy = gy + (gh / steps) * i;
      ctx.moveTo(Math.min(gx0, gx1), yy);
      ctx.lineTo(Math.max(gx0, gx1), yy);
    }
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(2, ppm * 0.2);
    ctx.strokeRect(Math.min(gx0, gx1), gy, Math.abs(gx1 - gx0), gh);
    ctx.strokeStyle = 'rgba(255,255,255,0.88)';
    ctx.lineWidth = Math.max(1.5, ppm * 0.14);
  }

  // Escanteios
  const corner = Math.max(6, ppm * 1);
  for (const cx of [0, pitch.L]) {
    for (const cy of [0, pitch.H]) {
      ctx.beginPath();
      const a0 = cx === 0 ? (cy === 0 ? 0 : -Math.PI / 2) : cy === 0 ? Math.PI / 2 : Math.PI;
      ctx.arc(px(cx), py(cy), corner, a0, a0 + Math.PI / 2);
      ctx.stroke();
    }
  }
}
