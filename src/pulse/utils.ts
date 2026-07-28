export function uid(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function pickWeighted<T>(items: T[], weightFn: (item: T) => number): T | null {
  if (!items || items.length === 0) return null;
  let total = 0;
  const weights = items.map(item => {
    const w = Math.max(0, weightFn(item));
    total += w;
    return w;
  });
  if (total <= 0) return items[Math.floor(Math.random() * items.length)];
  let roll = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return items[i];
  }
  return items[items.length - 1];
}

export function pickRandom<T>(items: T[]): T | null {
  if (!items || items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)];
}

export function template(str: string, vars: Record<string, string | number | null | undefined>): string {
  if (!str) return '';
  return String(str).replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    return vars[key] != null ? String(vars[key]) : '';
  });
}

export function ageBand(idade: number | null | undefined): 'jovem' | 'pico' | 'veterano' | 'qualquer' {
  if (idade == null || idade === ('' as unknown)) return 'qualquer';
  const n = Number(idade);
  if (Number.isNaN(n)) return 'qualquer';
  if (n <= 21) return 'jovem';
  if (n <= 29) return 'pico';
  return 'veterano';
}

export function formatPulseDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export const PERSONALIDADES = [
  'Líder',
  'Veterano',
  'Promessa',
  'Temperamental',
  'Vaidoso',
  'Ambicioso',
  'Reservado',
  'Disciplinado',
] as const;

export const CATEGORIA_LABELS: Record<string, string> = {
  atleta: 'Atleta',
  diretoria: 'Diretoria',
  torcida: 'Torcida',
  imprensa: 'Imprensa',
  lesao: 'Lesão',
  familia: 'Família',
  financeiro: 'Financeiro',
  transferencia: 'Transferência',
  patrocinio: 'Patrocínio',
  escandalo: 'Escândalo',
  nenhum: 'Nada',
};

export const RARIDADE_LABELS: Record<string, string> = {
  comum: 'Comum',
  incomum: 'Incomum',
  raro: 'Raro',
  'muito-raro': 'Muito raro',
};
