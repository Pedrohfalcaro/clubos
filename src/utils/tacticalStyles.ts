import type { FormationKey, TacticalStyleKey } from '../types/Tactics';

/** Each trait goes from 1 (mínimo) to 5 (máximo). */
export interface StyleTraits {
  /** Postura geral: 1 recuado, 5 muito adiantado */
  mentalidade: number;
  /** Velocidade de circulação da bola */
  ritmo: number;
  /** Uso da largura do campo */
  amplitude: number;
  /** Intensidade da marcação */
  pressao: number;
  /** Altura da linha defensiva */
  linha: number;
}

export interface TacticalStyle {
  key: TacticalStyleKey;
  label: string;
  tagline: string;
  description: string;
  traits: StyleTraits;
  instructions: string[];
  /** Formações em que este estilo faz mais sentido */
  bestWith: FormationKey[];
}

export const DEFAULT_STYLE_KEY: TacticalStyleKey = 'padrao';

export const TRAIT_LABELS: { key: keyof StyleTraits; label: string }[] = [
  { key: 'mentalidade', label: 'Mentalidade' },
  { key: 'ritmo', label: 'Ritmo' },
  { key: 'amplitude', label: 'Amplitude' },
  { key: 'pressao', label: 'Pressão' },
  { key: 'linha', label: 'Linha defensiva' },
];

export const TACTICAL_STYLES: TacticalStyle[] = [
  {
    key: 'padrao',
    label: 'Padrão',
    tagline: 'Equilíbrio entre ataque e defesa',
    description:
      'Time compacto, sem se expor. Sai jogando com critério e recompõe as linhas assim que perde a bola.',
    traits: { mentalidade: 3, ritmo: 3, amplitude: 3, pressao: 3, linha: 3 },
    instructions: [
      'Construção pelo chão, sem forçar o passe vertical',
      'Marcação começa no meio-campo',
      'Laterais sobem um de cada vez',
    ],
    bestWith: ['442', '442-aberto', '433', '4231', '451', '352', '4412'],
  },
  {
    key: 'ofensivo',
    label: 'Ofensivo',
    tagline: 'Empurrar o jogo para o campo adversário',
    description:
      'Volume de ataque acima da média, com meias chegando na área e laterais apoiando as jogadas.',
    traits: { mentalidade: 4, ritmo: 4, amplitude: 4, pressao: 4, linha: 4 },
    instructions: [
      'Meias avançam junto com os atacantes',
      'Laterais apoiam pelos dois lados',
      'Recuperar a bola o mais alto possível',
    ],
    bestWith: ['433', '433-holding', '4231', '343', '4222', '3421', '442-losango'],
  },
  {
    key: 'ultra-ofensivo',
    label: 'Ultra-ofensivo',
    tagline: 'Tudo ou nada no ataque',
    description:
      'Time inteiro empilhado no campo do adversário. Cria muito, mas deixa espaço nas costas da defesa.',
    traits: { mentalidade: 5, ritmo: 5, amplitude: 4, pressao: 5, linha: 5 },
    instructions: [
      'Todos os setores avançam com a bola',
      'Cruzamentos e finalizações a qualquer momento',
      'Risco alto de contra-ataque sofrido',
    ],
    bestWith: ['424', '343', '4222', '433', '433-falso9', '3421'],
  },
  {
    key: 'defensivo',
    label: 'Defensivo',
    tagline: 'Solidez primeiro, ataque depois',
    description:
      'Bloco médio-baixo, linhas curtas e pouca gente à frente da bola. Prioriza não sofrer gol.',
    traits: { mentalidade: 2, ritmo: 2, amplitude: 2, pressao: 2, linha: 2 },
    instructions: [
      'Manter as duas linhas de quatro compactas',
      'Laterais não abandonam a defesa',
      'Só um homem de referência no ataque',
    ],
    bestWith: ['4141', '451', '451-fechado', '532', '4412', '442', '541'],
  },
  {
    key: 'retranca',
    label: 'Retranca',
    tagline: 'Fechar tudo e segurar o resultado',
    description:
      'Defesa dentro do próprio campo, sem linha de pressão. Serve para proteger vantagem ou jogo contra favorito.',
    traits: { mentalidade: 1, ritmo: 1, amplitude: 1, pressao: 1, linha: 1 },
    instructions: [
      'Bloco baixo, sem sair na pressão',
      'Bola longa para aliviar a marcação',
      'Perder tempo nas reposições',
    ],
    bestWith: ['541', '532', '4141', '451', '451-fechado', '4412'],
  },
  {
    key: 'contra-ataque',
    label: 'Contra-ataque',
    tagline: 'Ceder a bola e explodir na transição',
    description:
      'Espera o adversário subir e ataca no espaço com velocidade. Poucos toques entre roubar e finalizar.',
    traits: { mentalidade: 2, ritmo: 5, amplitude: 3, pressao: 2, linha: 2 },
    instructions: [
      'Recuar o bloco e aguardar o erro',
      'Sair em velocidade com dois ou três toques',
      'Atacantes rápidos nas costas dos zagueiros',
    ],
    bestWith: ['442', '4412', '532', '541', '433', '4141'],
  },
  {
    key: 'posse',
    label: 'Posse de bola',
    tagline: 'Controlar o jogo com a bola no pé',
    description:
      'Circulação paciente, muitos passes curtos e superioridade numérica no meio-campo.',
    traits: { mentalidade: 3, ritmo: 2, amplitude: 4, pressao: 4, linha: 4 },
    instructions: [
      'Sair jogando desde o goleiro',
      'Meio-campo sempre com opção de passe curto',
      'Reação imediata à perda da bola',
    ],
    bestWith: ['433', '433-holding', '4312', '442-losango', '3421', '4231', '451'],
  },
  {
    key: 'direto',
    label: 'Jogo direto',
    tagline: 'Bola para frente e disputa na área',
    description:
      'Dispensa a construção: bola longa para o atacante de referência e time avançando na segunda bola.',
    traits: { mentalidade: 4, ritmo: 5, amplitude: 3, pressao: 3, linha: 3 },
    instructions: [
      'Lançamentos diretos para o ataque',
      'Disputar toda segunda bola no meio',
      'Atacante de referência segura a jogada',
    ],
    bestWith: ['442', '4412', '532', '424', '451', '541'],
  },
  {
    key: 'pressao',
    label: 'Pressão alta',
    tagline: 'Marcar na saída do adversário',
    description:
      'Marcação alta e agressiva para roubar a bola perto da área rival. Exige elenco com fôlego.',
    traits: { mentalidade: 4, ritmo: 4, amplitude: 3, pressao: 5, linha: 5 },
    instructions: [
      'Pressionar a saída de bola em bloco',
      'Linha defensiva adiantada, apostando no impedimento',
      'Desgaste físico alto — rodar o elenco',
    ],
    bestWith: ['433', '4231', '343', '4222', '352', '352-ofensivo', '3421'],
  },
  {
    key: 'aberto',
    label: 'Jogo aberto',
    tagline: 'Atacar pelas pontas e cruzar',
    description:
      'Usa toda a largura do campo, com pontas e alas colados na linha para criar cruzamentos.',
    traits: { mentalidade: 4, ritmo: 4, amplitude: 5, pressao: 3, linha: 3 },
    instructions: [
      'Pontas sempre abertos na linha lateral',
      'Buscar o cruzamento na área',
      'Trocar de lado até achar o espaço',
    ],
    bestWith: ['442', '442-aberto', '343', '352', '424', '451', '433', '541'],
  },
];

export function isTacticalStyleKey(value: unknown): value is TacticalStyleKey {
  return TACTICAL_STYLES.some(s => s.key === value);
}

export function getTacticalStyle(key: TacticalStyleKey | string | null | undefined): TacticalStyle {
  return TACTICAL_STYLES.find(s => s.key === key) ?? TACTICAL_STYLES[0];
}

export function styleLabel(key: TacticalStyleKey | string | null | undefined): string {
  return getTacticalStyle(key).label;
}

export function styleFitsFormation(
  styleKey: TacticalStyleKey | string | null | undefined,
  formationKey: FormationKey,
): boolean {
  return getTacticalStyle(styleKey).bestWith.includes(formationKey);
}

export function recommendedStylesFor(formationKey: FormationKey): TacticalStyle[] {
  return TACTICAL_STYLES.filter(s => s.bestWith.includes(formationKey));
}
