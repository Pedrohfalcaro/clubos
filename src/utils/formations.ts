export const AVAILABLE_COMPETITIONS = [
  'Campeonato Brasileiro',
  'Copa do Brasil',
  'Libertadores',
  'Sul-Americana',
  'Campeonato Paulista',
  'Amistoso',
] as const;

export type FormationKey = '442' | '433' | '352' | '451' | '541';

export interface FormationPreset {
  key: FormationKey;
  label: string;
  slots: { x: number; y: number; role: string }[];
}

export const FORMATION_PRESETS: FormationPreset[] = [
  {
    key: '442',
    label: '4-4-2',
    slots: [
      { x: 50, y: 88, role: 'GOL' },
      { x: 15, y: 72, role: 'LE' },
      { x: 38, y: 72, role: 'ZAG' },
      { x: 62, y: 72, role: 'ZAG' },
      { x: 85, y: 72, role: 'LD' },
      { x: 15, y: 48, role: 'MEI' },
      { x: 38, y: 48, role: 'MEI' },
      { x: 62, y: 48, role: 'MEI' },
      { x: 85, y: 48, role: 'MEI' },
      { x: 35, y: 22, role: 'ATA' },
      { x: 65, y: 22, role: 'ATA' },
    ],
  },
  {
    key: '433',
    label: '4-3-3',
    slots: [
      { x: 50, y: 88, role: 'GOL' },
      { x: 15, y: 68, role: 'LE' },
      { x: 38, y: 72, role: 'ZAG' },
      { x: 62, y: 72, role: 'ZAG' },
      { x: 85, y: 68, role: 'LD' },
      { x: 25, y: 48, role: 'VOL' },
      { x: 50, y: 52, role: 'MEI' },
      { x: 75, y: 48, role: 'MEI' },
      { x: 20, y: 22, role: 'PE' },
      { x: 50, y: 18, role: 'ATA' },
      { x: 80, y: 22, role: 'PD' },
    ],
  },
  {
    key: '352',
    label: '3-5-2',
    slots: [
      { x: 50, y: 88, role: 'GOL' },
      { x: 25, y: 72, role: 'ZAG' },
      { x: 50, y: 72, role: 'ZAG' },
      { x: 75, y: 72, role: 'ZAG' },
      { x: 12, y: 48, role: 'ALA' },
      { x: 30, y: 48, role: 'VOL' },
      { x: 50, y: 48, role: 'MEI' },
      { x: 70, y: 48, role: 'VOL' },
      { x: 88, y: 48, role: 'ALA' },
      { x: 35, y: 22, role: 'ATA' },
      { x: 65, y: 22, role: 'ATA' },
    ],
  },
  {
    key: '451',
    label: '4-5-1',
    slots: [
      { x: 50, y: 88, role: 'GOL' },
      { x: 15, y: 72, role: 'LE' },
      { x: 38, y: 72, role: 'ZAG' },
      { x: 62, y: 72, role: 'ZAG' },
      { x: 85, y: 72, role: 'LD' },
      { x: 12, y: 48, role: 'ALA' },
      { x: 30, y: 48, role: 'MEI' },
      { x: 50, y: 48, role: 'MEI' },
      { x: 70, y: 48, role: 'MEI' },
      { x: 88, y: 48, role: 'ALA' },
      { x: 50, y: 18, role: 'ATA' },
    ],
  },
  {
    key: '541',
    label: '5-4-1',
    slots: [
      { x: 50, y: 88, role: 'GOL' },
      { x: 10, y: 72, role: 'LE' },
      { x: 27, y: 72, role: 'ZAG' },
      { x: 50, y: 72, role: 'ZAG' },
      { x: 73, y: 72, role: 'ZAG' },
      { x: 90, y: 72, role: 'LD' },
      { x: 15, y: 48, role: 'MEI' },
      { x: 38, y: 48, role: 'MEI' },
      { x: 62, y: 48, role: 'MEI' },
      { x: 85, y: 48, role: 'MEI' },
      { x: 50, y: 18, role: 'ATA' },
    ],
  },
];

export const DEFAULT_FORMATION_433 = FORMATION_PRESETS.find(p => p.key === '433')!.slots.map(
  ({ x, y }) => ({ x, y }),
);

export function getFormationPreset(key: FormationKey): FormationPreset {
  return FORMATION_PRESETS.find(p => p.key === key)!;
}

export function createDefaultFormation(playerIds: string[]): { playerId: string; x: number; y: number }[] {
  return DEFAULT_FORMATION_433.map((slot, i) => ({
    ...slot,
    playerId: playerIds[i] ?? '',
  })).filter(s => s.playerId);
}

export function detectFormationKey(
  formation: { x: number; y: number }[],
): FormationKey | null {
  if (formation.length === 0) return null;
  for (const preset of FORMATION_PRESETS) {
    const match = preset.slots.every((slot, i) => {
      const f = formation[i];
      return f && Math.abs(f.x - slot.x) < 3 && Math.abs(f.y - slot.y) < 3;
    });
    if (match && formation.length === preset.slots.length) return preset.key;
  }
  return null;
}
