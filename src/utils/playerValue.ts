/** Valor de mercado estimado do jogador, em reais. */
export function calcMarketValue(overall: number, potential: number, age: number): number {
  const base = overall * 100_000;
  const potentialBonus = Math.max(0, potential - overall) * 20_000;
  const ageFactor = age <= 23 ? 1.15 : age <= 29 ? 1 : age <= 33 ? 0.85 : 0.65;
  return Math.round(((base + potentialBonus) * ageFactor) / 10_000) * 10_000;
}

export function formatPlayerMoney(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}K`;
  return value > 0 ? `R$ ${value}` : 'Não informado';
}
