import type { PlayerPosition } from '../../types/Player.ts';

/** Modificadores de atributo (pontos, somados ao valor base do jogador). */
export interface AttrMods {
  speed?: number;
  pass?: number;
  shoot?: number;
  defend?: number;
  dribble?: number;
  stamina?: number;
  aerial?: number;
  strength?: number;
  vision?: number;
  crossing?: number;
  workRate?: number;
  /** Goleiro */
  reflex?: number;
  handling?: number;
  sweeping?: number;
  distribution?: number;
  penaltySave?: number;
  /** Comportamento: somados a 0,5 / 1 / 0,4 */
  aggression?: number;
  volatility?: number;
  selfish?: number;
}

/**
 * Tendências de jogo (−1 a +1). 0 = neutro. Mudam o QUE o jogador tenta fazer,
 * enquanto os atributos mudam o quanto ele acerta.
 */
export interface Biases {
  /** vontade de finalizar */
  shoot: number;
  /** chute de longe */
  longShot: number;
  /** cruzar em vez de entrar na área */
  cross: number;
  /** conduzir / driblar em vez de passar */
  carry: number;
  /** + toque curto e seguro, − passe vertical/longo arriscado */
  safe: number;
  /** corridas em profundidade sem a bola */
  run: number;
  /** recua para buscar o jogo (falso 9, pivô) */
  drop: number;
  /** abre pelo corredor (+) ou fecha por dentro (−) */
  width: number;
  /** disposição para pressionar a bola */
  press: number;
}

export const NEUTRAL_BIASES: Biases = {
  shoot: 0,
  longShot: 0,
  cross: 0,
  carry: 0,
  safe: 0,
  run: 0,
  drop: 0,
  width: 0,
  press: 0,
};

export interface Trait {
  key: string;
  label: string;
  positions: PlayerPosition[];
  description: string;
  attr: AttrMods;
  bias: Partial<Biases>;
}

const WING: PlayerPosition[] = ['LW', 'RW'];
const FULLBACK: PlayerPosition[] = ['LB', 'RB'];

/**
 * Características: cada posição tem perfis diferentes, para que dois atletas da mesma posição
 * e do mesmo overall joguem de forma distinta. Sem característica = "Padrão" (perfil neutro).
 */
export const TRAITS: Trait[] = [
  // ---- Goleiro
  {
    key: 'gk-paredao',
    label: 'Paredão',
    positions: ['GK'],
    description: 'Reflexos e defesas difíceis; fica na linha e joga simples com os pés.',
    attr: { reflex: 8, handling: 3, sweeping: -4, distribution: -3 },
    bias: {},
  },
  {
    key: 'gk-libero',
    label: 'Goleiro-líbero',
    positions: ['GK'],
    description: 'Joga adiantado, sai para cortar bolas nas costas da defesa e distribui bem.',
    attr: { sweeping: 10, distribution: 8, reflex: -3, aerial: -2 },
    bias: { safe: 0.3 },
  },
  {
    key: 'gk-dominador',
    label: 'Dominador de área',
    positions: ['GK'],
    description: 'Forte pelo alto: sai bem nos cruzamentos e segura a bola.',
    attr: { aerial: 10, handling: 6, reflex: -2, sweeping: -2 },
    bias: {},
  },
  {
    key: 'gk-penaltis',
    label: 'Pegador de pênaltis',
    positions: ['GK'],
    description: 'Lê o cobrador e defende muito mais pênaltis.',
    attr: { penaltySave: 14, reflex: 3 },
    bias: {},
  },
  // ---- Zagueiro
  {
    key: 'cb-xerife',
    label: 'Xerife',
    positions: ['CB'],
    description: 'Marcador duro: desarma, vence no corpo e vai firme em qualquer bola.',
    attr: { defend: 6, strength: 6, aggression: 0.2, pass: -3, speed: -2 },
    bias: { press: 0.5 },
  },
  {
    key: 'cb-construtor',
    label: 'Zagueiro construtor',
    positions: ['CB'],
    description: 'Sai jogando com qualidade; prefere o passe a afastar a bola.',
    attr: { pass: 8, vision: 6, defend: -2, strength: -2 },
    bias: { safe: 0.4, carry: 0.3 },
  },
  {
    key: 'cb-rapido',
    label: 'Zagueiro rápido',
    positions: ['CB'],
    description: 'Cobre as costas da defesa e acompanha atacantes velozes.',
    attr: { speed: 8, defend: 3, strength: -4, aerial: -2 },
    bias: {},
  },
  {
    key: 'cb-aereo',
    label: 'Zagueiro aéreo',
    positions: ['CB'],
    description: 'Dominante pelo alto, na defesa e nas bolas paradas ofensivas.',
    attr: { aerial: 10, strength: 4, speed: -4, shoot: 4 },
    bias: {},
  },
  // ---- Lateral
  {
    key: 'fb-ofensivo',
    label: 'Lateral ofensivo',
    positions: FULLBACK,
    description: 'Apoia o tempo todo, chega ao fundo e cruza.',
    attr: { speed: 4, crossing: 8, stamina: 4, workRate: 4, defend: -5 },
    bias: { run: 0.6, cross: 0.4, width: 0.4 },
  },
  {
    key: 'fb-defensivo',
    label: 'Lateral defensivo',
    positions: FULLBACK,
    description: 'Fica atrás, marca o ponta e protege a zaga.',
    attr: { defend: 7, strength: 3, crossing: -5 },
    bias: { run: -0.6 },
  },
  {
    key: 'fb-construtor',
    label: 'Lateral construtor',
    positions: FULLBACK,
    description: 'Entra por dentro e ajuda a circular a bola.',
    attr: { pass: 6, vision: 5, dribble: 2, crossing: -2 },
    bias: { safe: 0.4, width: -0.4 },
  },
  // ---- Volante
  {
    key: 'cdm-destruidor',
    label: 'Cão de guarda',
    positions: ['CDM'],
    description: 'Destruidor de jogadas: pressiona, desarma e rouba a bola.',
    attr: { defend: 8, strength: 4, aggression: 0.25, pass: -4 },
    bias: { press: 0.7 },
  },
  {
    key: 'cdm-regista',
    label: 'Regista',
    positions: ['CDM'],
    description: 'Organiza de trás, com passe longo e visão de jogo.',
    attr: { pass: 9, vision: 8, defend: -3, speed: -2 },
    bias: { safe: -0.3 },
  },
  {
    key: 'cdm-ancora',
    label: 'Âncora',
    positions: ['CDM'],
    description: 'Protege a zaga, não sai da posição e recompõe a linha.',
    attr: { defend: 5, pass: 2, workRate: -3, strength: 2 },
    bias: { run: -0.5, drop: 0.3 },
  },
  // ---- Meia
  {
    key: 'cm-box',
    label: 'Box-to-box',
    positions: ['CM'],
    description: 'Vai de área a área: marca, apoia e chega para finalizar.',
    attr: { stamina: 8, workRate: 8, shoot: 2 },
    bias: { run: 0.5, press: 0.3 },
  },
  {
    key: 'cm-armador',
    label: 'Armador',
    positions: ['CM'],
    description: 'Cérebro do meio: toca para quem está livre e acelera ou segura o jogo.',
    attr: { pass: 7, vision: 8, dribble: 2, defend: -3 },
    bias: { safe: -0.2 },
  },
  {
    key: 'cm-marcador',
    label: 'Meia marcador',
    positions: ['CM'],
    description: 'Combativo: pressiona, desarma e dá equilíbrio ao time.',
    attr: { defend: 6, strength: 3, workRate: 4, pass: -2 },
    bias: { press: 0.6 },
  },
  {
    key: 'cm-chegada',
    label: 'Meia de chegada',
    positions: ['CM'],
    description: 'Infiltra na área e arrisca de fora.',
    attr: { shoot: 7, workRate: 3, pass: -2 },
    bias: { run: 0.7, shoot: 0.4, longShot: 0.5 },
  },
  // ---- Meia-atacante
  {
    key: 'cam-armador',
    label: 'Armador clássico',
    positions: ['CAM'],
    description: 'Camisa 10: enxerga o passe que ninguém vê.',
    attr: { vision: 10, pass: 7, shoot: -2 },
    bias: { safe: -0.4 },
  },
  {
    key: 'cam-finalizador',
    label: 'Meia finalizador',
    positions: ['CAM'],
    description: 'Aparece na área e finaliza muito, de perto e de longe.',
    attr: { shoot: 8, pass: -2 },
    bias: { shoot: 0.5, run: 0.5, longShot: 0.4 },
  },
  {
    key: 'cam-driblador',
    label: 'Meia driblador',
    positions: ['CAM'],
    description: 'Desequilibra no um contra um e conduz a bola.',
    attr: { dribble: 9, speed: 2, pass: -2 },
    bias: { carry: 0.7 },
  },
  // ---- Ponta
  {
    key: 'w-driblador',
    label: 'Ponta driblador',
    positions: WING,
    description: 'Parte para cima do marcador e conduz até o fim.',
    attr: { dribble: 9, speed: 3, vision: -2 },
    bias: { carry: 0.7, width: 0.3 },
  },
  {
    key: 'w-cruzador',
    label: 'Ponta cruzador',
    positions: WING,
    description: 'Cola na linha e bota a bola na área.',
    attr: { crossing: 10, speed: 2, shoot: -2 },
    bias: { cross: 0.6, width: 0.7 },
  },
  {
    key: 'w-finalizador',
    label: 'Ponta que corta pra dentro',
    positions: WING,
    description: 'Fecha por dentro e chuta com a perna forte.',
    attr: { shoot: 8, dribble: 3, crossing: -4 },
    bias: { shoot: 0.5, longShot: 0.4, width: -0.7, cross: -0.4 },
  },
  {
    key: 'w-velocista',
    label: 'Ponta velocista',
    positions: WING,
    description: 'Explosão pura: ataca o espaço nas costas da defesa.',
    attr: { speed: 10, dribble: 2, shoot: -2 },
    bias: { run: 0.8 },
  },
  // ---- Segundo atacante
  {
    key: 'cf-falso9',
    label: 'Falso 9',
    positions: ['CF'],
    description: 'Recua para armar e abre espaço para os companheiros.',
    attr: { pass: 7, vision: 7, dribble: 3, shoot: -3 },
    bias: { drop: 0.8, safe: -0.2 },
  },
  {
    key: 'cf-articulador',
    label: 'Articulador',
    positions: ['CF'],
    description: 'Joga entre as linhas, liga o meio ao ataque.',
    attr: { vision: 8, pass: 5, dribble: 4 },
    bias: { drop: 0.4 },
  },
  {
    key: 'cf-finalizador',
    label: 'Segundo atacante finalizador',
    positions: ['CF'],
    description: 'Chega de trás para finalizar.',
    attr: { shoot: 8, speed: 1 },
    bias: { shoot: 0.5, run: 0.6 },
  },
  // ---- Atacante
  {
    key: 'st-artilheiro',
    label: 'Artilheiro',
    positions: ['ST'],
    description: 'Raposa da área: sempre no lugar certo, finaliza tudo.',
    attr: { shoot: 12, speed: -2, strength: -2, vision: 2 },
    bias: { shoot: 0.9, run: 0.6 },
  },
  {
    key: 'st-pivo',
    label: 'Pivô',
    positions: ['ST'],
    description: 'Segura a bola de costas e faz o time subir.',
    attr: { strength: 9, aerial: 6, pass: 3, shoot: 2, speed: -4 },
    bias: { drop: 0.6, safe: 0.3 },
  },
  {
    key: 'st-velocista',
    label: 'Velocista de profundidade',
    positions: ['ST'],
    description: 'Vive nas costas dos zagueiros, pede bola em profundidade.',
    attr: { speed: 10, dribble: 3, shoot: 2, strength: -4 },
    bias: { run: 0.9 },
  },
  {
    key: 'st-cabeceador',
    label: 'Cabeceador',
    positions: ['ST'],
    description: 'Dominante nas bolas aéreas e nos cruzamentos.',
    attr: { aerial: 11, strength: 5, speed: -3 },
    bias: { drop: -0.2 },
  },
  {
    key: 'st-completo',
    label: 'Atacante completo',
    positions: ['ST'],
    description: 'Faz de tudo um pouco: finaliza, driblando e participa da armação.',
    attr: { shoot: 3, pass: 3, dribble: 3, vision: 2 },
    bias: {},
  },
];

/** Características possíveis para uma posição (a primeira opção do app é sempre "Padrão"). */
export function traitsFor(position: PlayerPosition): Trait[] {
  return TRAITS.filter(t => t.positions.includes(position));
}

/** Característica válida para a posição, ou undefined (= Padrão). */
export function findTrait(key: string | undefined, position: PlayerPosition): Trait | undefined {
  if (!key) return undefined;
  const t = TRAITS.find(x => x.key === key);
  return t && t.positions.includes(position) ? t : undefined;
}

export function traitLabel(key: string | undefined, position: PlayerPosition): string {
  return findTrait(key, position)?.label ?? 'Padrão';
}
