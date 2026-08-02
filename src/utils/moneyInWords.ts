import type { Currency } from '../types/Finance';
import { formatMoneyFull } from './finance';

const UNITS = [
  '',
  'um',
  'dois',
  'três',
  'quatro',
  'cinco',
  'seis',
  'sete',
  'oito',
  'nove',
  'dez',
  'onze',
  'doze',
  'treze',
  'quatorze',
  'quinze',
  'dezesseis',
  'dezessete',
  'dezoito',
  'dezenove',
];

const TENS = [
  '',
  '',
  'vinte',
  'trinta',
  'quarenta',
  'cinquenta',
  'sessenta',
  'setenta',
  'oitenta',
  'noventa',
];

const HUNDREDS = [
  '',
  'cento',
  'duzentos',
  'trezentos',
  'quatrocentos',
  'quinhentos',
  'seiscentos',
  'setecentos',
  'oitocentos',
  'novecentos',
];

function under100(n: number): string {
  if (n < 20) return UNITS[n] ?? '';
  const ten = Math.floor(n / 10);
  const unit = n % 10;
  return unit === 0 ? TENS[ten]! : `${TENS[ten]} e ${UNITS[unit]}`;
}

function under1000(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'cem';
  if (n < 100) return under100(n);
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  return rest === 0 ? HUNDREDS[hundred]! : `${HUNDREDS[hundred]} e ${under100(rest)}`;
}

function joinParts(parts: string[]): string {
  if (parts.length === 0) return 'zero';
  if (parts.length === 1) return parts[0]!;
  if (parts.length === 2) return `${parts[0]} e ${parts[1]}`;
  const last = parts[parts.length - 1]!;
  return `${parts.slice(0, -1).join(', ')} e ${last}`;
}

/** Inteiro em português (até trilhões). */
export function numberInWords(value: number): string {
  const n = Math.round(Math.abs(value));
  if (n === 0) return 'zero';
  if (n >= 1_000_000_000_000_000) {
    return n.toLocaleString('pt-BR');
  }

  const scales: { div: number; singular: string; plural: string }[] = [
    { div: 1_000_000_000_000, singular: 'trilhão', plural: 'trilhões' },
    { div: 1_000_000_000, singular: 'bilhão', plural: 'bilhões' },
    { div: 1_000_000, singular: 'milhão', plural: 'milhões' },
    { div: 1_000, singular: 'mil', plural: 'mil' },
  ];

  const parts: string[] = [];
  let rest = n;

  for (const scale of scales) {
    const qty = Math.floor(rest / scale.div);
    if (qty === 0) continue;
    rest %= scale.div;
    if (scale.div === 1_000) {
      parts.push(qty === 1 ? 'mil' : `${under1000(qty)} mil`);
    } else {
      const label = qty === 1 ? scale.singular : scale.plural;
      parts.push(`${under1000(qty)} ${label}`);
    }
  }

  if (rest > 0) parts.push(under1000(rest));
  return joinParts(parts);
}

function currencyUnit(value: number, currency: Currency): string {
  const singular = value === 1;
  switch (currency) {
    case 'EUR':
      return singular ? 'euro' : 'euros';
    case 'GBP':
      return singular ? 'libra' : 'libras';
    case 'USD':
      return singular ? 'dólar' : 'dólares';
    case 'BRL':
    default:
      return singular ? 'real' : 'reais';
  }
}

/** Valor monetário por extenso, ex.: "um milhão e quinhentos mil reais". */
export function moneyInWords(value: number, currency: Currency = 'BRL'): string {
  const n = Math.round(Math.abs(value));
  const words = numberInWords(n);
  const unit = currencyUnit(n, currency);
  // "dois milhões de reais", mas "um milhão e quinhentos mil reais" (sem "de").
  const needsDe = n >= 1_000_000 && n % 1_000_000 === 0;
  return needsDe ? `${words} de ${unit}` : `${words} ${unit}`;
}

/** Texto de apoio sob o campo: "R$ 1.500.000 · um milhão e quinhentos mil reais". */
export function moneyAmountHint(
  value: string | number | null | undefined,
  currency: Currency = 'BRL',
): string | null {
  if (value === '' || value == null) return null;
  const n =
    typeof value === 'number'
      ? value
      : parseFloat(String(value).replace(/\s/g, '').replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  return `${formatMoneyFull(n, currency)} · ${moneyInWords(n, currency)}`;
}
