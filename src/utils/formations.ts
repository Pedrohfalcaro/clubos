import type { MatchLineup } from '../types/Match';
import type { Player, PlayerPosition } from '../types/Player';
import { isPlayerBlockedFromLineup, availabilityStatusLabel } from '../types/Player';
import type {
  FormationKey,
  FormationSlot,
  SavedTactics,
  SlotRole,
  TacticsDraft,
  TacticsPreset,
} from '../types/Tactics';
import { MAX_TACTICS_PRESETS } from '../types/Tactics';
import { DEFAULT_STYLE_KEY, isTacticalStyleKey } from './tacticalStyles';

export type { FormationKey } from '../types/Tactics';

export type FormationNature = 'defensiva' | 'equilibrada' | 'ofensiva' | 'muito-ofensiva';

export interface FormationPreset {
  key: FormationKey;
  label: string;
  /** Rótulo curto da variante (ex.: Losango, Aberto). */
  variantLabel: string;
  /** Família tática (ex.: 4-4-2) — agrupa variantes no picker. */
  family: string;
  familyLabel: string;
  defenders: 3 | 4 | 5;
  nature: FormationNature;
  description: string;
  slots: { x: number; y: number; role: SlotRole }[];
}

export interface FormationFamily {
  id: string;
  label: string;
  defenders: 3 | 4 | 5;
  variants: FormationPreset[];
}

export const DEFAULT_FORMATION_KEY: FormationKey = '433';

export const NATURE_LABELS: Record<FormationNature, string> = {
  defensiva: 'Defensiva',
  equilibrada: 'Equilibrada',
  ofensiva: 'Ofensiva',
  'muito-ofensiva': 'Muito ofensiva',
};

export const ROLE_NAMES: Record<SlotRole, string> = {
  GOL: 'Goleiro',
  ZAG: 'Zagueiro',
  LE: 'Lateral esquerdo',
  LD: 'Lateral direito',
  ALE: 'Ala esquerdo',
  ALD: 'Ala direito',
  VOL: 'Volante',
  MC: 'Meio-campista',
  MEI: 'Meia atacante',
  ME: 'Meia esquerda',
  MD: 'Meia direita',
  PE: 'Ponta esquerda',
  PD: 'Ponta direita',
  SA: 'Segundo atacante',
  ATA: 'Atacante',
};

/** Posições do elenco que atendem cada função, da mais natural para a menos. */
const ROLE_POSITIONS: Record<SlotRole, PlayerPosition[]> = {
  GOL: ['GK'],
  ZAG: ['CB'],
  LE: ['LB', 'CB'],
  LD: ['RB', 'CB'],
  ALE: ['LB', 'LW', 'CM'],
  ALD: ['RB', 'RW', 'CM'],
  VOL: ['CDM', 'CM'],
  MC: ['CM', 'CDM', 'CAM'],
  MEI: ['CAM', 'CM', 'CF'],
  ME: ['LW', 'CM', 'LB'],
  MD: ['RW', 'CM', 'RB'],
  PE: ['LW', 'CF', 'ST'],
  PD: ['RW', 'CF', 'ST'],
  SA: ['CF', 'CAM', 'ST'],
  ATA: ['ST', 'CF'],
};

const FIT_BY_RANK = [1, 0.72, 0.5];

/**
 * Coordinates of the five original formations are kept byte-for-byte so saves
 * created before formations carried an explicit key still resolve correctly.
 */
export const FORMATION_PRESETS: FormationPreset[] = [
  {
    key: '442',
    label: '4-4-2 Plano',
    variantLabel: 'Plano',
    family: '442',
    familyLabel: '4-4-2',
    defenders: 4,
    nature: 'equilibrada',
    description: 'Duas linhas de quatro. Simples de organizar e sólido em qualquer cenário.',
    slots: [
      { x: 50, y: 88, role: 'GOL' },
      { x: 15, y: 72, role: 'LE' },
      { x: 38, y: 72, role: 'ZAG' },
      { x: 62, y: 72, role: 'ZAG' },
      { x: 85, y: 72, role: 'LD' },
      { x: 15, y: 48, role: 'ME' },
      { x: 38, y: 48, role: 'MC' },
      { x: 62, y: 48, role: 'MC' },
      { x: 85, y: 48, role: 'MD' },
      { x: 35, y: 22, role: 'ATA' },
      { x: 65, y: 22, role: 'ATA' },
    ],
  },
  {
    key: '442-losango',
    label: '4-4-2 Losango',
    variantLabel: 'Losango',
    family: '442',
    familyLabel: '4-4-2',
    defenders: 4,
    nature: 'equilibrada',
    description: 'Meio-campo em diamante: volante fixo, dois meias por dentro e um armador.',
    slots: [
      { x: 50, y: 88, role: 'GOL' },
      { x: 15, y: 72, role: 'LE' },
      { x: 38, y: 72, role: 'ZAG' },
      { x: 62, y: 72, role: 'ZAG' },
      { x: 85, y: 72, role: 'LD' },
      { x: 50, y: 58, role: 'VOL' },
      { x: 18, y: 46, role: 'ME' },
      { x: 82, y: 46, role: 'MD' },
      { x: 50, y: 34, role: 'MEI' },
      { x: 38, y: 18, role: 'ATA' },
      { x: 62, y: 18, role: 'ATA' },
    ],
  },
  {
    key: '442-aberto',
    label: '4-4-2 Aberto',
    variantLabel: 'Aberto',
    family: '442',
    familyLabel: '4-4-2',
    defenders: 4,
    nature: 'ofensiva',
    description: 'Meias abertos colados na linha, prontos para cruzar e esticar a defesa rival.',
    slots: [
      { x: 50, y: 88, role: 'GOL' },
      { x: 12, y: 72, role: 'LE' },
      { x: 38, y: 72, role: 'ZAG' },
      { x: 62, y: 72, role: 'ZAG' },
      { x: 88, y: 72, role: 'LD' },
      { x: 8, y: 42, role: 'ME' },
      { x: 38, y: 50, role: 'MC' },
      { x: 62, y: 50, role: 'MC' },
      { x: 92, y: 42, role: 'MD' },
      { x: 35, y: 20, role: 'ATA' },
      { x: 65, y: 20, role: 'ATA' },
    ],
  },
  {
    key: '4412',
    label: '4-4-1-1',
    variantLabel: '4-4-1-1',
    family: '442',
    familyLabel: '4-4-2',
    defenders: 4,
    nature: 'defensiva',
    description: 'Bloco de oito atrás com um segundo atacante ligando o meio ao homem de área.',
    slots: [
      { x: 50, y: 88, role: 'GOL' },
      { x: 15, y: 72, role: 'LE' },
      { x: 38, y: 72, role: 'ZAG' },
      { x: 62, y: 72, role: 'ZAG' },
      { x: 85, y: 72, role: 'LD' },
      { x: 14, y: 50, role: 'ME' },
      { x: 38, y: 50, role: 'MC' },
      { x: 62, y: 50, role: 'MC' },
      { x: 86, y: 50, role: 'MD' },
      { x: 50, y: 32, role: 'SA' },
      { x: 50, y: 16, role: 'ATA' },
    ],
  },
  {
    key: '433',
    label: '4-3-3 Clássico',
    variantLabel: 'Clássico',
    family: '433',
    familyLabel: '4-3-3',
    defenders: 4,
    nature: 'ofensiva',
    description: 'Trio de ataque aberto e três no meio. Boa amplitude com pressão alta.',
    slots: [
      { x: 50, y: 88, role: 'GOL' },
      { x: 15, y: 68, role: 'LE' },
      { x: 38, y: 72, role: 'ZAG' },
      { x: 62, y: 72, role: 'ZAG' },
      { x: 85, y: 68, role: 'LD' },
      { x: 25, y: 48, role: 'VOL' },
      { x: 50, y: 52, role: 'MC' },
      { x: 75, y: 48, role: 'MC' },
      { x: 20, y: 22, role: 'PE' },
      { x: 50, y: 18, role: 'ATA' },
      { x: 80, y: 22, role: 'PD' },
    ],
  },
  {
    key: '433-holding',
    label: '4-3-3 Holding',
    variantLabel: 'Holding',
    family: '433',
    familyLabel: '4-3-3',
    defenders: 4,
    nature: 'equilibrada',
    description: 'Um volante fixo na frente da zaga e dois meias mais adiantados.',
    slots: [
      { x: 50, y: 88, role: 'GOL' },
      { x: 15, y: 68, role: 'LE' },
      { x: 38, y: 72, role: 'ZAG' },
      { x: 62, y: 72, role: 'ZAG' },
      { x: 85, y: 68, role: 'LD' },
      { x: 50, y: 58, role: 'VOL' },
      { x: 28, y: 44, role: 'MC' },
      { x: 72, y: 44, role: 'MC' },
      { x: 18, y: 22, role: 'PE' },
      { x: 50, y: 18, role: 'ATA' },
      { x: 82, y: 22, role: 'PD' },
    ],
  },
  {
    key: '433-falso9',
    label: '4-3-3 Falso 9',
    variantLabel: 'Falso 9',
    family: '433',
    familyLabel: '4-3-3',
    defenders: 4,
    nature: 'ofensiva',
    description: 'Centroavante recua para armar; as pontas atacam o espaço nas costas.',
    slots: [
      { x: 50, y: 88, role: 'GOL' },
      { x: 15, y: 68, role: 'LE' },
      { x: 38, y: 72, role: 'ZAG' },
      { x: 62, y: 72, role: 'ZAG' },
      { x: 85, y: 68, role: 'LD' },
      { x: 28, y: 50, role: 'MC' },
      { x: 50, y: 52, role: 'MC' },
      { x: 72, y: 50, role: 'MC' },
      { x: 16, y: 20, role: 'PE' },
      { x: 50, y: 28, role: 'SA' },
      { x: 84, y: 20, role: 'PD' },
    ],
  },
  {
    key: '4231',
    label: '4-2-3-1 Clássico',
    variantLabel: 'Clássico',
    family: '4231',
    familyLabel: '4-2-3-1',
    defenders: 4,
    nature: 'ofensiva',
    description: 'Dois volantes protegem a defesa e três meias municiam o atacante.',
    slots: [
      { x: 50, y: 88, role: 'GOL' },
      { x: 15, y: 72, role: 'LE' },
      { x: 38, y: 72, role: 'ZAG' },
      { x: 62, y: 72, role: 'ZAG' },
      { x: 85, y: 72, role: 'LD' },
      { x: 35, y: 56, role: 'VOL' },
      { x: 65, y: 56, role: 'VOL' },
      { x: 18, y: 34, role: 'PE' },
      { x: 50, y: 34, role: 'MEI' },
      { x: 82, y: 34, role: 'PD' },
      { x: 50, y: 16, role: 'ATA' },
    ],
  },
  {
    key: '4231-estreito',
    label: '4-2-3-1 Estreito',
    variantLabel: 'Estreito',
    family: '4231',
    familyLabel: '4-2-3-1',
    defenders: 4,
    nature: 'ofensiva',
    description: 'Três meias por dentro, sem pontas abertas — troca de posição e combinação.',
    slots: [
      { x: 50, y: 88, role: 'GOL' },
      { x: 15, y: 72, role: 'LE' },
      { x: 38, y: 72, role: 'ZAG' },
      { x: 62, y: 72, role: 'ZAG' },
      { x: 85, y: 72, role: 'LD' },
      { x: 35, y: 56, role: 'VOL' },
      { x: 65, y: 56, role: 'VOL' },
      { x: 28, y: 34, role: 'MEI' },
      { x: 50, y: 32, role: 'MEI' },
      { x: 72, y: 34, role: 'MEI' },
      { x: 50, y: 16, role: 'ATA' },
    ],
  },
  {
    key: '4141',
    label: '4-1-4-1',
    variantLabel: 'Padrão',
    family: '4141',
    familyLabel: '4-1-4-1',
    defenders: 4,
    nature: 'defensiva',
    description: 'Um volante isolado na frente da zaga e quatro meias em linha.',
    slots: [
      { x: 50, y: 88, role: 'GOL' },
      { x: 15, y: 72, role: 'LE' },
      { x: 38, y: 72, role: 'ZAG' },
      { x: 62, y: 72, role: 'ZAG' },
      { x: 85, y: 72, role: 'LD' },
      { x: 50, y: 60, role: 'VOL' },
      { x: 14, y: 44, role: 'ME' },
      { x: 38, y: 44, role: 'MC' },
      { x: 62, y: 44, role: 'MC' },
      { x: 86, y: 44, role: 'MD' },
      { x: 50, y: 17, role: 'ATA' },
    ],
  },
  {
    key: '4222',
    label: '4-2-2-2',
    variantLabel: 'Padrão',
    family: '4222',
    familyLabel: '4-2-2-2',
    defenders: 4,
    nature: 'ofensiva',
    description: 'O quadrado mágico: dois volantes, dois meias por dentro e dupla de ataque.',
    slots: [
      { x: 50, y: 88, role: 'GOL' },
      { x: 15, y: 72, role: 'LE' },
      { x: 38, y: 72, role: 'ZAG' },
      { x: 62, y: 72, role: 'ZAG' },
      { x: 85, y: 72, role: 'LD' },
      { x: 35, y: 56, role: 'VOL' },
      { x: 65, y: 56, role: 'VOL' },
      { x: 22, y: 34, role: 'MEI' },
      { x: 78, y: 34, role: 'MEI' },
      { x: 38, y: 17, role: 'ATA' },
      { x: 62, y: 17, role: 'ATA' },
    ],
  },
  {
    key: '4312',
    label: '4-3-1-2',
    variantLabel: 'Padrão',
    family: '4312',
    familyLabel: '4-3-1-2',
    defenders: 4,
    nature: 'ofensiva',
    description: 'Meio-campo fechado por dentro, sem pontas, com dupla de atacantes próxima.',
    slots: [
      { x: 50, y: 88, role: 'GOL' },
      { x: 15, y: 72, role: 'LE' },
      { x: 38, y: 72, role: 'ZAG' },
      { x: 62, y: 72, role: 'ZAG' },
      { x: 85, y: 72, role: 'LD' },
      { x: 50, y: 58, role: 'VOL' },
      { x: 26, y: 50, role: 'MC' },
      { x: 74, y: 50, role: 'MC' },
      { x: 50, y: 36, role: 'MEI' },
      { x: 38, y: 17, role: 'ATA' },
      { x: 62, y: 17, role: 'ATA' },
    ],
  },
  {
    key: '451',
    label: '4-5-1 Aberto',
    variantLabel: 'Aberto',
    family: '451',
    familyLabel: '4-5-1',
    defenders: 4,
    nature: 'defensiva',
    description: 'Cinco no meio com alas abertos para dominar a posse e esticar o campo.',
    slots: [
      { x: 50, y: 88, role: 'GOL' },
      { x: 15, y: 72, role: 'LE' },
      { x: 38, y: 72, role: 'ZAG' },
      { x: 62, y: 72, role: 'ZAG' },
      { x: 85, y: 72, role: 'LD' },
      { x: 12, y: 48, role: 'ALE' },
      { x: 30, y: 48, role: 'MC' },
      { x: 50, y: 48, role: 'MC' },
      { x: 70, y: 48, role: 'MC' },
      { x: 88, y: 48, role: 'ALD' },
      { x: 50, y: 18, role: 'ATA' },
    ],
  },
  {
    key: '451-fechado',
    label: '4-5-1 Fechado',
    variantLabel: 'Fechado',
    family: '451',
    familyLabel: '4-5-1',
    defenders: 4,
    nature: 'defensiva',
    description: 'Meio-campo compacto por dentro, sem alas — sufoca o adversário no miolo.',
    slots: [
      { x: 50, y: 88, role: 'GOL' },
      { x: 15, y: 72, role: 'LE' },
      { x: 38, y: 72, role: 'ZAG' },
      { x: 62, y: 72, role: 'ZAG' },
      { x: 85, y: 72, role: 'LD' },
      { x: 22, y: 50, role: 'MC' },
      { x: 36, y: 46, role: 'MC' },
      { x: 50, y: 52, role: 'VOL' },
      { x: 64, y: 46, role: 'MC' },
      { x: 78, y: 50, role: 'MC' },
      { x: 50, y: 18, role: 'ATA' },
    ],
  },
  {
    key: '424',
    label: '4-2-4',
    variantLabel: 'Padrão',
    family: '424',
    familyLabel: '4-2-4',
    defenders: 4,
    nature: 'muito-ofensiva',
    description: 'Quatro homens de frente. Devastador com a bola, frágil sem ela.',
    slots: [
      { x: 50, y: 88, role: 'GOL' },
      { x: 15, y: 72, role: 'LE' },
      { x: 38, y: 72, role: 'ZAG' },
      { x: 62, y: 72, role: 'ZAG' },
      { x: 85, y: 72, role: 'LD' },
      { x: 35, y: 50, role: 'MC' },
      { x: 65, y: 50, role: 'MC' },
      { x: 14, y: 26, role: 'PE' },
      { x: 38, y: 17, role: 'ATA' },
      { x: 62, y: 17, role: 'ATA' },
      { x: 86, y: 26, role: 'PD' },
    ],
  },
  {
    key: '352',
    label: '3-5-2 Clássico',
    variantLabel: 'Clássico',
    family: '352',
    familyLabel: '3-5-2',
    defenders: 3,
    nature: 'equilibrada',
    description: 'Três zagueiros com alas cobrindo toda a lateral e dupla de ataque.',
    slots: [
      { x: 50, y: 88, role: 'GOL' },
      { x: 25, y: 72, role: 'ZAG' },
      { x: 50, y: 72, role: 'ZAG' },
      { x: 75, y: 72, role: 'ZAG' },
      { x: 12, y: 48, role: 'ALE' },
      { x: 30, y: 48, role: 'VOL' },
      { x: 50, y: 48, role: 'MC' },
      { x: 70, y: 48, role: 'VOL' },
      { x: 88, y: 48, role: 'ALD' },
      { x: 35, y: 22, role: 'ATA' },
      { x: 65, y: 22, role: 'ATA' },
    ],
  },
  {
    key: '352-ofensivo',
    label: '3-5-2 Ofensivo',
    variantLabel: 'Ofensivo',
    family: '352',
    familyLabel: '3-5-2',
    defenders: 3,
    nature: 'ofensiva',
    description: 'Alas altos e um armador entre as linhas atrás da dupla de ataque.',
    slots: [
      { x: 50, y: 88, role: 'GOL' },
      { x: 25, y: 72, role: 'ZAG' },
      { x: 50, y: 72, role: 'ZAG' },
      { x: 75, y: 72, role: 'ZAG' },
      { x: 10, y: 42, role: 'ALE' },
      { x: 35, y: 52, role: 'VOL' },
      { x: 50, y: 36, role: 'MEI' },
      { x: 65, y: 52, role: 'MC' },
      { x: 90, y: 42, role: 'ALD' },
      { x: 35, y: 18, role: 'ATA' },
      { x: 65, y: 18, role: 'ATA' },
    ],
  },
  {
    key: '343',
    label: '3-4-3',
    variantLabel: 'Padrão',
    family: '343',
    familyLabel: '3-4-3',
    defenders: 3,
    nature: 'muito-ofensiva',
    description: 'Alas na linha lateral e três atacantes. Muito volume ofensivo pelos lados.',
    slots: [
      { x: 50, y: 88, role: 'GOL' },
      { x: 27, y: 72, role: 'ZAG' },
      { x: 50, y: 73, role: 'ZAG' },
      { x: 73, y: 72, role: 'ZAG' },
      { x: 12, y: 48, role: 'ALE' },
      { x: 38, y: 50, role: 'MC' },
      { x: 62, y: 50, role: 'MC' },
      { x: 88, y: 48, role: 'ALD' },
      { x: 20, y: 22, role: 'PE' },
      { x: 50, y: 17, role: 'ATA' },
      { x: 80, y: 22, role: 'PD' },
    ],
  },
  {
    key: '3421',
    label: '3-4-2-1',
    variantLabel: 'Padrão',
    family: '3421',
    familyLabel: '3-4-2-1',
    defenders: 3,
    nature: 'ofensiva',
    description: 'Dois meias entre as linhas atrás do atacante, com alas dando a largura.',
    slots: [
      { x: 50, y: 88, role: 'GOL' },
      { x: 27, y: 72, role: 'ZAG' },
      { x: 50, y: 73, role: 'ZAG' },
      { x: 73, y: 72, role: 'ZAG' },
      { x: 12, y: 50, role: 'ALE' },
      { x: 38, y: 52, role: 'MC' },
      { x: 62, y: 52, role: 'MC' },
      { x: 88, y: 50, role: 'ALD' },
      { x: 30, y: 32, role: 'MEI' },
      { x: 70, y: 32, role: 'MEI' },
      { x: 50, y: 16, role: 'ATA' },
    ],
  },
  {
    key: '532',
    label: '5-3-2',
    variantLabel: 'Padrão',
    family: '532',
    familyLabel: '5-3-2',
    defenders: 5,
    nature: 'defensiva',
    description: 'Cinco atrás com três zagueiros de ofício. Fecha o meio e sai em contra-ataque.',
    slots: [
      { x: 50, y: 88, role: 'GOL' },
      { x: 10, y: 68, role: 'LE' },
      { x: 28, y: 73, role: 'ZAG' },
      { x: 50, y: 74, role: 'ZAG' },
      { x: 72, y: 73, role: 'ZAG' },
      { x: 90, y: 68, role: 'LD' },
      { x: 28, y: 48, role: 'MC' },
      { x: 50, y: 50, role: 'MC' },
      { x: 72, y: 48, role: 'MC' },
      { x: 38, y: 20, role: 'ATA' },
      { x: 62, y: 20, role: 'ATA' },
    ],
  },
  {
    key: '541',
    label: '5-4-1',
    variantLabel: 'Padrão',
    family: '541',
    familyLabel: '5-4-1',
    defenders: 5,
    nature: 'defensiva',
    description: 'Nove jogadores atrás da linha da bola. Extremamente difícil de furar.',
    slots: [
      { x: 50, y: 88, role: 'GOL' },
      { x: 10, y: 72, role: 'LE' },
      { x: 27, y: 72, role: 'ZAG' },
      { x: 50, y: 72, role: 'ZAG' },
      { x: 73, y: 72, role: 'ZAG' },
      { x: 90, y: 72, role: 'LD' },
      { x: 15, y: 48, role: 'ME' },
      { x: 38, y: 48, role: 'MC' },
      { x: 62, y: 48, role: 'MC' },
      { x: 85, y: 48, role: 'MD' },
      { x: 50, y: 18, role: 'ATA' },
    ],
  },
];

const FAMILY_ORDER = [
  '442', '433', '4231', '4141', '4222', '4312', '451', '424', '352', '343', '3421', '532', '541',
];

export const FORMATION_FAMILIES: FormationFamily[] = FAMILY_ORDER.map(id => {
  const variants = FORMATION_PRESETS.filter(p => p.family === id);
  return {
    id,
    label: variants[0]?.familyLabel ?? id,
    defenders: variants[0]?.defenders ?? 4,
    variants,
  };
});

export const FORMATION_GROUPS: { label: string; presets: FormationPreset[] }[] = (
  [4, 3, 5] as const
).map(defenders => ({
  label: `${defenders} defensores`,
  presets: FORMATION_FAMILIES.filter(f => f.defenders === defenders).map(f => f.variants[0]),
}));

export function isFormationKey(value: unknown): value is FormationKey {
  return FORMATION_PRESETS.some(p => p.key === value);
}

export function getFormationPreset(key: FormationKey | string | null | undefined): FormationPreset {
  return (
    FORMATION_PRESETS.find(p => p.key === key) ??
    FORMATION_PRESETS.find(p => p.key === DEFAULT_FORMATION_KEY)!
  );
}

export function formationLabel(key: FormationKey | string | null | undefined): string {
  return getFormationPreset(key).label;
}

export function getFormationFamily(key: FormationKey | string | null | undefined): FormationFamily {
  const preset = getFormationPreset(key);
  return FORMATION_FAMILIES.find(f => f.id === preset.family) ?? FORMATION_FAMILIES[0];
}

/** Ordem de posições para listar o elenco disponível na tática. */
export const TACTICS_POSITION_ORDER: PlayerPosition[] = [
  'GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'CF', 'ST',
];

export const TACTICS_POSITION_LABELS: Record<PlayerPosition, string> = {
  GK: 'Goleiros',
  CB: 'Zagueiros',
  LB: 'Laterais E',
  RB: 'Laterais D',
  CDM: 'Volantes',
  CM: 'Meias',
  CAM: 'Armadores',
  LW: 'Pontas E',
  RW: 'Pontas D',
  CF: 'Segundos atacantes',
  ST: 'Atacantes',
};

export function sortPlayersForTactics(players: Player[]): Player[] {
  return [...players].sort((a, b) => {
    const pa = TACTICS_POSITION_ORDER.indexOf(a.position);
    const pb = TACTICS_POSITION_ORDER.indexOf(b.position);
    if (pa !== pb) return (pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb);
    return b.overall - a.overall || a.name.localeCompare(b.name, 'pt-BR');
  });
}

export function groupPlayersByPosition(players: Player[]): { position: PlayerPosition; label: string; players: Player[] }[] {
  const sorted = sortPlayersForTactics(players);
  const groups: { position: PlayerPosition; label: string; players: Player[] }[] = [];
  for (const pos of TACTICS_POSITION_ORDER) {
    const list = sorted.filter(p => p.position === pos);
    if (list.length) groups.push({ position: pos, label: TACTICS_POSITION_LABELS[pos], players: list });
  }
  return groups;
}

/** Quão bem uma posição do elenco atende a função do slot (0 a 1). */
export function roleFit(role: SlotRole, position: PlayerPosition | undefined): number {
  if (!position) return 0.2;
  if (role === 'GOL') return position === 'GK' ? 1 : 0;
  if (position === 'GK') return 0;
  const rank = ROLE_POSITIONS[role].indexOf(position);
  if (rank >= 0) return FIT_BY_RANK[rank] ?? 0.4;
  return 0.25;
}

interface PresetMatch {
  /** índice na lista de entradas -> índice do slot no preset */
  slotByEntry: Map<number, number>;
  distance: number;
}

/**
 * Casa entradas com slots do preset pelo par mais próximo primeiro, sem depender
 * da ordem do array — foi exatamente essa dependência de ordem que fazia a
 * formação salva ser identificada errado.
 */
function matchEntriesToPreset(
  entries: { x: number; y: number }[],
  preset: FormationPreset,
  tolerance: number,
  blockedSlots?: Set<number>,
): PresetMatch {
  const pairs: { entry: number; slot: number; d: number }[] = [];
  entries.forEach((entry, ei) => {
    preset.slots.forEach((slot, si) => {
      if (blockedSlots?.has(si)) return;
      const d = Math.hypot(entry.x - slot.x, entry.y - slot.y);
      if (d <= tolerance) pairs.push({ entry: ei, slot: si, d });
    });
  });
  pairs.sort((a, b) => a.d - b.d);

  const slotByEntry = new Map<number, number>();
  const usedSlots = new Set<number>();
  let distance = 0;
  for (const pair of pairs) {
    if (slotByEntry.has(pair.entry) || usedSlots.has(pair.slot)) continue;
    slotByEntry.set(pair.entry, pair.slot);
    usedSlots.add(pair.slot);
    distance += pair.d;
  }
  return { slotByEntry, distance };
}

/** Identifica a formação de uma escalação completa. Retorna null se não houver certeza. */
export function detectFormationKey(
  formation: { x: number; y: number }[] | null | undefined,
  tolerance = 3,
): FormationKey | null {
  if (!formation?.length) return null;
  let best: { key: FormationKey; distance: number } | null = null;
  for (const preset of FORMATION_PRESETS) {
    if (formation.length !== preset.slots.length) continue;
    const match = matchEntriesToPreset(formation, preset, tolerance);
    if (match.slotByEntry.size !== formation.length) continue;
    if (!best || match.distance < best.distance) best = { key: preset.key, distance: match.distance };
  }
  return best?.key ?? null;
}

/** Melhor palpite para escalações incompletas ou salvas por versões antigas. */
export function guessFormationKey(
  formation: { x: number; y: number }[] | null | undefined,
): FormationKey | null {
  if (!formation?.length) return null;
  const exact = detectFormationKey(formation);
  if (exact) return exact;

  let best: { key: FormationKey; matched: number; distance: number } | null = null;
  for (const preset of FORMATION_PRESETS) {
    const match = matchEntriesToPreset(formation, preset, 6);
    const matched = match.slotByEntry.size;
    if (matched === 0) continue;
    const better =
      !best ||
      matched > best.matched ||
      (matched === best.matched && match.distance < best.distance);
    if (better) best = { key: preset.key, matched, distance: match.distance };
  }
  return best?.key ?? null;
}

/**
 * Deixa a escalação consistente com a formação: cada jogador ocupa um slot real,
 * sem duplicatas e sem entradas órfãs de outra formação.
 */
export function normalizeFormation(
  formation: FormationSlot[] | null | undefined,
  key: FormationKey,
  players?: Player[],
): FormationSlot[] {
  const preset = getFormationPreset(key);
  const roster = players ? new Set(players.map(p => p.id)) : null;
  const entries = (formation ?? []).filter(
    (f): f is FormationSlot =>
      !!f &&
      typeof f.playerId === 'string' &&
      f.playerId.length > 0 &&
      Number.isFinite(f.x) &&
      Number.isFinite(f.y) &&
      (!roster || roster.has(f.playerId)),
  );

  const playerBySlot = new Map<number, string>();
  const placed = new Set<string>();

  // Entradas que já sabem o próprio slot têm prioridade
  for (const entry of entries) {
    const slot = entry.slot;
    if (typeof slot !== 'number' || !Number.isInteger(slot)) continue;
    if (slot < 0 || slot >= preset.slots.length) continue;
    if (playerBySlot.has(slot) || placed.has(entry.playerId)) continue;
    playerBySlot.set(slot, entry.playerId);
    placed.add(entry.playerId);
  }

  // O resto é reencaixado pelas coordenadas
  const pending = entries.filter(e => !placed.has(e.playerId));
  if (pending.length) {
    const match = matchEntriesToPreset(pending, preset, 6, new Set(playerBySlot.keys()));
    for (const [entryIndex, slot] of match.slotByEntry) {
      const entry = pending[entryIndex];
      if (playerBySlot.has(slot) || placed.has(entry.playerId)) continue;
      playerBySlot.set(slot, entry.playerId);
      placed.add(entry.playerId);
    }
  }

  return [...playerBySlot.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([slot, playerId]) => ({
      playerId,
      slot,
      x: preset.slots[slot].x,
      y: preset.slots[slot].y,
    }));
}

/** Lê uma tática salva (de qualquer versão) e devolve algo sempre coerente. */
export function resolveTactics(
  saved: SavedTactics | null | undefined,
  players?: Player[],
): TacticsDraft {
  const formationKey = isFormationKey(saved?.formationKey)
    ? saved.formationKey
    : guessFormationKey(saved?.formation) ?? DEFAULT_FORMATION_KEY;

  const formation = normalizeFormation(saved?.formation, formationKey, players);
  const onField = new Set(formation.map(f => f.playerId));
  const roster = players ? new Set(players.map(p => p.id)) : null;

  const bench: string[] = [];
  for (const id of saved?.bench ?? []) {
    if (typeof id !== 'string' || !id) continue;
    if (onField.has(id) || bench.includes(id)) continue;
    if (roster && !roster.has(id)) continue;
    bench.push(id);
  }

  return {
    formationKey,
    style: isTacticalStyleKey(saved?.style) ? saved.style : DEFAULT_STYLE_KEY,
    formation,
    bench,
  };
}

/** Versão para persistência: normaliza e mantém o carimbo de tempo. */
export function normalizeSavedTactics(
  saved: SavedTactics | null | undefined,
): SavedTactics | null {
  if (!saved) return null;
  const draft = resolveTactics(saved);
  if (!draft.formation.length && !draft.bench.length) return null;
  return { ...draft, updatedAt: saved.updatedAt };
}

export function createTacticsPresetId(): string {
  return `tac-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function normalizeTacticsPreset(
  preset: TacticsPreset | null | undefined,
): TacticsPreset | null {
  if (!preset?.id) return null;
  const body = normalizeSavedTactics(preset);
  if (!body) return null;
  const name = (preset.name ?? '').trim() || 'Tática';
  return { ...body, id: preset.id, name };
}

/** Migra tática única legada → lista de presets (máx. 5). */
export function migrateTacticsPresets(
  tactics: SavedTactics | null | undefined,
  presets?: TacticsPreset[] | null,
  activeId?: string | null,
): {
  tacticsPresets: TacticsPreset[];
  activeTacticsId: string | null;
  tactics: SavedTactics | null;
} {
  const fromList = (presets ?? [])
    .map(p => normalizeTacticsPreset(p))
    .filter((p): p is TacticsPreset => !!p)
    .slice(0, MAX_TACTICS_PRESETS);

  if (fromList.length > 0) {
    const activeTacticsId =
      activeId && fromList.some(p => p.id === activeId) ? activeId : fromList[0].id;
    const active = fromList.find(p => p.id === activeTacticsId)!;
    const { id: _i, name: _n, ...rest } = active;
    return {
      tacticsPresets: fromList,
      activeTacticsId,
      tactics: rest,
    };
  }

  const one = normalizeSavedTactics(tactics);
  if (!one) {
    return { tacticsPresets: [], activeTacticsId: null, tactics: null };
  }

  const preset: TacticsPreset = {
    ...one,
    id: 'preset-principal',
    name: 'Principal',
  };
  const { id: _i, name: _n, ...rest } = preset;
  return {
    tacticsPresets: [preset],
    activeTacticsId: preset.id,
    tactics: rest,
  };
}

export function tacticsBodyFromPreset(preset: TacticsPreset): SavedTactics {
  const { id: _i, name: _n, ...rest } = preset;
  return rest;
}

/**
 * Mesma normalização para escalações de partidas já registradas, mas conservadora:
 * se o reparo perderia algum jogador, o registro original é mantido intacto.
 */
export function normalizeMatchLineup(lineup: MatchLineup): MatchLineup {
  const draft = resolveTactics(lineup);
  const original = new Set((lineup.formation ?? []).filter(f => f?.playerId).map(f => f.playerId));
  if (draft.formation.length !== original.size) return lineup;
  return { ...lineup, ...draft };
}

export function countFilledSlots(
  formation: FormationSlot[] | null | undefined,
  key: FormationKey,
  players?: Player[],
): number {
  return normalizeFormation(formation, key, players).length;
}

export function isLineupComplete(
  formation: FormationSlot[] | null | undefined,
  key: FormationKey,
  players?: Player[],
  competition?: string | null,
  gameDate?: string | null,
): boolean {
  if (countFilledSlots(formation, key, players) !== getFormationPreset(key).slots.length) {
    return false;
  }
  if (!players) return true;
  const byId = new Map(players.map(p => [p.id, p]));
  for (const entry of formation ?? []) {
    const player = byId.get(entry.playerId);
    if (!player || isPlayerBlockedFromLineup(player, competition, gameDate)) return false;
  }
  return true;
}

/** Mantém os mesmos jogadores ao trocar de formação, reposicionando por função. */
export function remapFormation(
  formation: FormationSlot[] | null | undefined,
  fromKey: FormationKey,
  toKey: FormationKey,
  players: Player[],
): FormationSlot[] {
  if (fromKey === toKey) return normalizeFormation(formation, toKey, players);

  const from = getFormationPreset(fromKey);
  const to = getFormationPreset(toKey);
  const current = normalizeFormation(formation, fromKey, players);
  if (!current.length) return [];

  const byId = new Map(players.map(p => [p.id, p]));
  const pairs: { entry: number; slot: number; score: number }[] = [];

  current.forEach((entry, ei) => {
    const player = byId.get(entry.playerId);
    const previousRole = from.slots[entry.slot ?? -1]?.role;
    to.slots.forEach((slot, si) => {
      const fit = roleFit(slot.role, player?.position);
      const sameRole = previousRole === slot.role ? 40 : 0;
      const drift = Math.hypot(entry.x - slot.x, entry.y - slot.y);
      pairs.push({ entry: ei, slot: si, score: fit * 100 + sameRole - drift });
    });
  });
  pairs.sort((a, b) => b.score - a.score);

  const playerBySlot = new Map<number, string>();
  const placed = new Set<number>();
  for (const pair of pairs) {
    if (placed.has(pair.entry) || playerBySlot.has(pair.slot)) continue;
    playerBySlot.set(pair.slot, current[pair.entry].playerId);
    placed.add(pair.entry);
  }

  return [...playerBySlot.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([slot, playerId]) => ({
      playerId,
      slot,
      x: to.slots[slot].x,
      y: to.slots[slot].y,
    }));
}

function isAvailable(
  player: Player,
  competition?: string | null,
  gameDate?: string | null,
): boolean {
  return !isPlayerBlockedFromLineup(player, competition, gameDate);
}

/** Monta a melhor escalação possível para a formação, por posição e overall. */
export function buildBestLineup(
  key: FormationKey,
  players: Player[],
  benchSize = 7,
  competition?: string | null,
  gameDate?: string | null,
): { formation: FormationSlot[]; bench: string[] } {
  const preset = getFormationPreset(key);
  const pool = players.filter(p => isAvailable(p, competition, gameDate));

  const pairs: { player: Player; slot: number; score: number }[] = [];
  pool.forEach(player => {
    preset.slots.forEach((slot, si) => {
      const fit = roleFit(slot.role, player.position);
      if (fit <= 0) return;
      pairs.push({ player, slot: si, score: fit * 1000 + player.overall });
    });
  });
  pairs.sort((a, b) => b.score - a.score);

  const playerBySlot = new Map<number, string>();
  const used = new Set<string>();
  for (const pair of pairs) {
    if (playerBySlot.has(pair.slot) || used.has(pair.player.id)) continue;
    playerBySlot.set(pair.slot, pair.player.id);
    used.add(pair.player.id);
  }

  const formation = [...playerBySlot.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([slot, playerId]) => ({
      playerId,
      slot,
      x: preset.slots[slot].x,
      y: preset.slots[slot].y,
    }));

  const rest = pool
    .filter(p => !used.has(p.id))
    .sort((a, b) => b.overall - a.overall);
  const backupKeeper = rest.find(p => p.position === 'GK');
  const bench: string[] = [];
  if (backupKeeper && benchSize > 0) bench.push(backupKeeper.id);
  for (const player of rest) {
    if (bench.length >= benchSize) break;
    if (bench.includes(player.id)) continue;
    bench.push(player.id);
  }

  return { formation, bench };
}

export interface LineupWarning {
  kind: 'availability' | 'position' | 'bench';
  message: string;
}

export function lineupWarnings(
  formation: FormationSlot[] | null | undefined,
  key: FormationKey,
  players: Player[],
  bench: string[] = [],
  competition?: string | null,
  gameDate?: string | null,
): LineupWarning[] {
  const preset = getFormationPreset(key);
  const byId = new Map(players.map(p => [p.id, p]));
  const normalized = normalizeFormation(formation, key, players);
  const warnings: LineupWarning[] = [];

  for (const entry of normalized) {
    const player = byId.get(entry.playerId);
    const slot = preset.slots[entry.slot ?? -1];
    if (!player || !slot) continue;

    if (isPlayerBlockedFromLineup(player, competition, gameDate)) {
      const label = availabilityStatusLabel(player, gameDate) ?? player.availability;
      warnings.push({
        kind: 'availability',
        message: `${player.name} — ${label}. Não pode ser escalado.`,
      });
    }

    if (roleFit(slot.role, player.position) <= 0.25) {
      warnings.push({
        kind: 'position',
        message: `${player.name} (${player.position}) escalado como ${ROLE_NAMES[slot.role]}.`,
      });
    }
  }

  if (bench.length > 0 && !bench.some(id => byId.get(id)?.position === 'GK')) {
    warnings.push({ kind: 'bench', message: 'Nenhum goleiro reserva no banco.' });
  }

  for (const id of bench) {
    const player = byId.get(id);
    if (!player) continue;
    if (isPlayerBlockedFromLineup(player, competition, gameDate)) {
      const label = availabilityStatusLabel(player, gameDate) ?? player.availability;
      warnings.push({
        kind: 'availability',
        message: `${player.name} — ${label}. Remova do banco.`,
      });
    }
  }

  return warnings;
}

export function lineupAverageOverall(
  formation: FormationSlot[] | null | undefined,
  players: Player[],
): number {
  const byId = new Map(players.map(p => [p.id, p]));
  const values = (formation ?? [])
    .map(f => byId.get(f.playerId)?.overall)
    .filter((v): v is number => typeof v === 'number');
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}
