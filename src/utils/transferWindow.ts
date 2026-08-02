/** Janelas oficiais de mercado (estilo FIFA / calendário europeu). */
export interface TransferWindowRange {
  id: string;
  label: string;
  /** Mês 1–12 */
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
}

export const DEFAULT_TRANSFER_WINDOWS: TransferWindowRange[] = [
  {
    id: 'winter',
    label: 'Janela de janeiro',
    startMonth: 1,
    startDay: 1,
    endMonth: 1,
    endDay: 31,
  },
  {
    id: 'summer',
    label: 'Janela de meio de ano',
    startMonth: 7,
    startDay: 1,
    endMonth: 8,
    endDay: 31,
  },
];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Compara MM-DD dentro do ano civil (ignora ano). */
function monthDayKey(month: number, day: number): number {
  return month * 100 + day;
}

export function parseIsoDateParts(iso: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.slice(0, 10));
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

export function isDateInTransferWindow(
  isoDate: string | null | undefined,
  windows: TransferWindowRange[] = DEFAULT_TRANSFER_WINDOWS,
): boolean {
  return getActiveTransferWindow(isoDate, windows) != null;
}

export function getActiveTransferWindow(
  isoDate: string | null | undefined,
  windows: TransferWindowRange[] = DEFAULT_TRANSFER_WINDOWS,
): TransferWindowRange | null {
  if (!isoDate) return null;
  const parts = parseIsoDateParts(isoDate);
  if (!parts) return null;
  const key = monthDayKey(parts.month, parts.day);
  for (const w of windows) {
    const start = monthDayKey(w.startMonth, w.startDay);
    const end = monthDayKey(w.endMonth, w.endDay);
    if (key >= start && key <= end) return w;
  }
  return null;
}

/** Próxima abertura da janela a partir de (e exclusive se já estiver aberta → fim desta + próxima). */
export function nextTransferWindowOpen(
  isoDate: string,
  windows: TransferWindowRange[] = DEFAULT_TRANSFER_WINDOWS,
): { date: string; window: TransferWindowRange } | null {
  const parts = parseIsoDateParts(isoDate);
  if (!parts || windows.length === 0) return null;

  // Procura nos próximos 400 dias
  const start = new Date(parts.year, parts.month - 1, parts.day);
  for (let i = 1; i <= 400; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const iso = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    const w = getActiveTransferWindow(iso, windows);
    if (w) {
      // só conta o primeiro dia da janela
      const prev = new Date(d);
      prev.setDate(prev.getDate() - 1);
      const prevIso = `${prev.getFullYear()}-${pad2(prev.getMonth() + 1)}-${pad2(prev.getDate())}`;
      if (!getActiveTransferWindow(prevIso, windows)) {
        return { date: iso, window: w };
      }
    }
  }
  return null;
}

export function transferWindowSummary(
  windows: TransferWindowRange[] = DEFAULT_TRANSFER_WINDOWS,
): string {
  return windows
    .map(w => {
      const a = `${pad2(w.startDay)}/${pad2(w.startMonth)}`;
      const b = `${pad2(w.endDay)}/${pad2(w.endMonth)}`;
      return `${w.label} (${a}–${b})`;
    })
    .join(' · ');
}

export function formatWindowRange(w: TransferWindowRange): string {
  return `${pad2(w.startDay)}/${pad2(w.startMonth)} – ${pad2(w.endDay)}/${pad2(w.endMonth)}`;
}
