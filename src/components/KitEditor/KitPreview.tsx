import { useEffect, useRef, useState } from 'react';
import type { Kit } from '../../types/Kit';
import { drawShirt, drawToken, onKitImagesLoaded } from '../../utils/kitRender';

interface KitPreviewProps {
  kit: Kit;
  /** Largura em px (a altura é a mesma: a camisa é desenhada num quadrado). */
  size?: number;
  className?: string;
  /** Mostra este número no peito (pré-visualização). */
  number?: string;
}

/** Camisa desenhada com a cor base e o desenho do uniforme. */
export default function KitPreview({ kit, size = 72, className, number }: KitPreviewProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => onKitImagesLoaded(() => setTick(t => t + 1)), []);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    drawShirt(ctx, kit, size * 0.04, size * 0.04, size * 0.92, size * 0.92, number);
  }, [kit, size, tick, number]);

  return <canvas ref={ref} className={className} style={{ width: size, height: size }} aria-hidden="true" />;
}

/** Ficha redonda de jogador (como aparece no campo do treino), com número. */
export function KitToken({ kit, size = 40, number = '10' }: { kit: Kit; size?: number; number?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => onKitImagesLoaded(() => setTick(t => t + 1)), []);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    drawToken(ctx, kit, size / 2, size / 2, size / 2 - 3, number);
  }, [kit, size, number, tick]);

  return <canvas ref={ref} style={{ width: size, height: size }} aria-hidden="true" />;
}
