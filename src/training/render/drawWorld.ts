import type { Agent, World } from '../engine';
import { numberOutline, type Kit } from '../../types/Kit';
import { getKitSprite } from '../../utils/kitRender';
import type { View } from './drawPitch';

export interface AgentLook {
  color: string;
  /** Uniforme com desenho (goleiros usam só a cor). */
  kit?: Kit;
  textColor: string;
  number: string;
  label: string;
}

/** Posições do passo anterior — o desenho interpola entre os dois estados do motor. */
export interface Snapshot {
  agents: { x: number; y: number }[];
  ball: { x: number; y: number };
}

export function takeSnapshot(w: World): Snapshot {
  return {
    agents: w.agents.map(a => ({ x: a.x, y: a.y })),
    ball: { x: w.ball.x, y: w.ball.y },
  };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function drawWorld(
  ctx: CanvasRenderingContext2D,
  view: View,
  w: World,
  prev: Snapshot,
  alpha: number,
  lookOf: (a: Agent) => AgentLook | undefined,
  showOwnerName: boolean,
  /** Segundo tempo: os times trocam de lado — o campo é girado 180°. */
  flip = false,
): void {
  const { ox, oy, ppm } = view;
  const mx = (x: number) => ox + (flip ? w.pitch.L - x : x) * ppm;
  const my = (y: number) => oy + (flip ? w.pitch.H - y : y) * ppm;
  const radiusM = 0.9 * Math.pow(w.pitch.scale, 0.8);
  // Raio mínimo para o número da camisa ficar legível mesmo com o campo encolhido pelos painéis
  const r = Math.max(10, radiusM * ppm);
  const owner = w.ball.owner;

  // Sombras primeiro, para ficarem sempre por baixo
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  w.agents.forEach((a, i) => {
    const before = prev.agents[i] ?? a;
    const x = mx(lerp(before.x, a.x, alpha));
    const y = my(lerp(before.y, a.y, alpha));
    ctx.beginPath();
    ctx.ellipse(x + r * 0.15, y + r * 0.7, r * 0.95, r * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  w.agents.forEach((a, i) => {
    const look = lookOf(a);
    const before = prev.agents[i] ?? a;
    const x = mx(lerp(before.x, a.x, alpha));
    const y = my(lerp(before.y, a.y, alpha));

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = look?.color ?? '#888';
    ctx.fill();
    if (look?.kit && look.kit.design.type !== 'solid') {
      // uniforme com desenho: o padrão recortado no círculo
      ctx.save();
      ctx.clip();
      ctx.drawImage(getKitSprite(look.kit), x - r, y - r, r * 2, r * 2);
      ctx.restore();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
    }
    ctx.lineWidth = owner === a ? 3 : 1.5;
    ctx.strokeStyle = owner === a ? '#ffffff' : 'rgba(0,0,0,0.55)';
    ctx.stroke();

    if (look) {
      const size = look.number.length > 2 ? r * 0.72 : r * 1.0;
      ctx.font = `800 ${Math.max(9, Math.round(size))}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (look.kit && look.kit.design.type !== 'solid') {
        // sobre um desenho o número precisa de contorno para continuar legível
        ctx.lineJoin = 'round';
        ctx.lineWidth = Math.max(2, r * 0.28);
        ctx.strokeStyle = numberOutline(look.textColor);
        ctx.strokeText(look.number, x, y + 0.5);
      }
      ctx.fillStyle = look.textColor;
      ctx.fillText(look.number, x, y + 0.5);
    }
  });

  // Bola
  const bx = mx(lerp(prev.ball.x, w.ball.x, alpha));
  const by = my(lerp(prev.ball.y, w.ball.y, alpha));
  const baseR = Math.max(4, 0.42 * ppm * Math.sqrt(w.pitch.scale));
  // Cruzamento no ar: bola maior e sombra afastada, para dar a ideia de altura
  const air = w.ball.kind === 'cross';
  const br = air ? baseR * 1.45 : baseR;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(bx + baseR * (air ? 1.4 : 0.3), by + baseR * (air ? 2.4 : 0.6), baseR, baseR * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(bx, air ? by - baseR * 1.2 : by, br, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = '#222';
  ctx.stroke();

  // Nome de quem está com a bola
  if (showOwnerName && owner) {
    const idx = w.agents.indexOf(owner);
    const look = lookOf(owner);
    if (look && idx >= 0) {
      const before = prev.agents[idx] ?? owner;
      const x = mx(lerp(before.x, owner.x, alpha));
      const y = my(lerp(before.y, owner.y, alpha));
      ctx.font = '700 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      const text = look.label;
      const tw = ctx.measureText(text).width + 10;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(x - tw / 2, y - r - 20, tw, 16);
      ctx.fillStyle = '#fff';
      ctx.fillText(text, x, y - r - 6);
    }
  }
}
