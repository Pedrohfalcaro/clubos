import type { Format, StyleTraits, TeamTactics } from './types.ts';
import { PITCHES } from './tuning.ts';

export const NEUTRAL_TRAITS: StyleTraits = {
  mentalidade: 3,
  ritmo: 3,
  amplitude: 3,
  pressao: 3,
  linha: 3,
};

/**
 * Converte os traços do estilo tático (1–5) em parâmetros do motor:
 * - mentalidade → quanto o time sobe com a bola e quanto chuta;
 * - ritmo → velocidade de decisão e preferência por passe vertical/longo
 *   (ritmo baixo = posse com passes curtos; alto = jogo direto);
 * - amplitude → largura; pressão → quantos e de que distância marcam a bola;
 * - linha → altura do bloco.
 */
export function deriveTactics(traits: StyleTraits | undefined, format: Format): TeamTactics {
  const t = traits ?? NEUTRAL_TRAITS;
  const scale = PITCHES[format].scale;
  const basePress = format === 11 ? 2 : 1;
  const pressN = Math.max(1, Math.min(3, basePress + (t.pressao >= 4 ? 1 : 0) - (t.pressao <= 1 ? 1 : 0)));
  return {
    lineShift: (t.linha - 3) * 0.035,
    mentShift: (t.mentalidade - 3) * 0.03,
    widthMul: 0.88 + (t.amplitude - 1) * 0.07,
    pressN,
    pressRadius: (6 + t.pressao * 3.5) * scale,
    pressTrap: Math.max(0, Math.min(1, (t.pressao - 2) / 3)),
    thinkMul: 1.3 - t.ritmo * 0.1,
    directness: 0.65 + (t.ritmo - 1) * 0.2,
    shootMul: 0.85 + (t.mentalidade - 1) * 0.07,
  };
}
