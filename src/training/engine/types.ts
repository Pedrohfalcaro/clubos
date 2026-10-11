import type { PlayerPosition } from '../../types/Player.ts';
import type { SlotRole } from '../../types/Tactics.ts';
import type { Rng } from './rng.ts';
import type { Biases } from './traits.ts';

export type Team = 'a' | 'b';
export type RoleGroup = 'GK' | 'DEF' | 'MID' | 'ATT';
export type Format = 5 | 7 | 11;

/** Jogador que entra no motor — independente do tipo `Player` do app. */
export interface EnginePlayerInput {
  id: string;
  position: PlayerPosition;
  overall: number;
  fatigue?: number;
  role: SlotRole;
  /** Slot da formação (campo 0–100, gol em y=88). */
  slotX: number;
  slotY: number;
  /** Moral 0–100 — sobe ou desce todos os atributos (padrão: neutro). */
  morale?: number;
  /** Personalidade do jogador; sem ela, perfil neutro. */
  personality?: string;
  /** Característica (perfil dentro da posição); sem ela, "Padrão". */
  trait?: string;
  /** Adequação à função do slot (0–1): jogar improvisado piora os atributos. */
  fit?: number;
}

/** Traços do estilo tático, de 1 a 5 — mesma escala de `StyleTraits` do app. */
export interface StyleTraits {
  mentalidade: number;
  ritmo: number;
  amplitude: number;
  pressao: number;
  linha: number;
}

/** Traços convertidos em parâmetros de jogo. */
export interface TeamTactics {
  /** deslocamento do bloco inteiro (fração do campo) */
  lineShift: number;
  /** quanto os homens de frente/meio sobem junto com a posse */
  mentShift: number;
  /** multiplicador da largura do time */
  widthMul: number;
  pressN: number;
  /** distância (m) até a bola em que a marcação sai para pressionar */
  pressRadius: number;
  /** 0–1: força do gatilho de pressão (saída de bola e laterais) */
  pressTrap: number;
  /** multiplicador do tempo de decisão (menor = jogo mais rápido) */
  thinkMul: number;
  /** peso do passe vertical/longo */
  directness: number;
  shootMul: number;
}

export interface MatchSetup {
  format: Format;
  halfDurationSec: number;
  seed: number;
  teams: Record<Team, EnginePlayerInput[]>;
  /** Estilo tático por time; ausente = Padrão. */
  styles?: Partial<Record<Team, StyleTraits>>;
}

export interface Attrs {
  /** m/s máximos já na escala do campo. */
  speed: number;
  pass: number;
  shoot: number;
  defend: number;
  dribble: number;
  gk: number;
  stamina: number;
  /** jogo aéreo (cruzamentos, escanteios, saídas do goleiro) */
  aerial: number;
  /** força: segurar a bola, duelos no corpo */
  strength: number;
  /** qualidade da escolha do passe */
  vision: number;
  /** precisão do cruzamento */
  crossing: number;
  /** movimentação sem a bola */
  workRate: number;
  /** goleiro: encaixe, saída da área, jogo com os pés, pênaltis */
  handling: number;
  sweeping: number;
  distribution: number;
  penaltySave: number;
  /** 0–1: agressividade nos desarmes. */
  aggression: number;
  /** multiplicador do erro de passe/chute (1 = normal). */
  volatility: number;
  /** 0–1: tendência a finalizar em vez de passar. */
  selfish: number;
}

export interface PlayerMatchStats {
  goals: number;
  assists: number;
  shotsOn: number;
  shotsOff: number;
  passesOk: number;
  passesBad: number;
  keyPasses: number;
  tackles: number;
  interceptions: number;
  clearances: number;
  crosses: number;
  fouls: number;
  foulsWon: number;
  yellows: number;
  reds: number;
  offsides: number;
  dribbles: number;
  dribblesWon: number;
  losses: number;
  saves: number;
  distance: number;
  conceded: number;
  cleanSheet: boolean;
}

export interface Agent {
  id: string;
  team: Team;
  role: SlotRole;
  group: RoleGroup;
  attrs: Attrs;
  /** tendências de jogo vindas da característica e da personalidade */
  bias: Biases;
  /** 0 = junto ao próprio gol, 1 = linha mais avançada da formação. */
  homeDepth: number;
  /** 0–1 ao longo da largura, já espelhado por time. */
  homeLat: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  stamina: number;
  /** Tempo até o dono da bola decidir de novo. */
  think: number;
  /** Não pode recuperar a bola (acabou de chutar / perdeu o domínio). */
  lock: number;
  tackleCd: number;
  /** Proteção breve contra desarme logo após dominar a bola. */
  protect: number;
  /** Ponto de apoio escolhido (jogador de suporte) e quanto tempo ele vale. */
  supportTimer: number;
  sx: number;
  sy: number;
  /** Dados de entrada — usados para repetir a função/slot numa substituição. */
  input: EnginePlayerInput;
  /** Segundos de partida em que entrou (0 = titular) e em que saiu (null = ainda em campo). */
  enteredAt: number;
  leftAt: number | null;
  /** Expulso: deixa o time com um a menos. */
  sentOff: boolean;
  /** Fôlego de arrancada depois de vencer um drible, e atordoamento de quem foi driblado. */
  boostT: number;
  slowT: number;
  takeOnCd: number;
  stats: PlayerMatchStats;
}

export type BallKind = 'loose' | 'pass' | 'shot' | 'clear' | 'cross';

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  owner: Agent | null;
  lastTouch: Agent | null;
  kind: BallKind;
  /** Passe em voo, ainda sem resolução (certo/errado). */
  passFrom: Agent | null;
  passTo: Agent | null;
  /** Chute em voo: time que chutou e quem deu o passe-chave. */
  shotTeam: Team | null;
  shotAssist: Agent | null;
  saveResolved: boolean;
  /** Pênalti em voo: o goleiro defende bem menos. */
  penalty: boolean;
  /** Distância do chute em voo até o gol (m) — chute de longe é mais fácil de defender. */
  shotDist: number;
  /** Cruzamento em voo: quem cruzou e quanto falta para a bola cair. */
  crossFrom: Agent | null;
  crossT: number;
  /** Lançamento (bola longa por cima) em voo: o companheiro a quem se destina. */
  lobTo: Agent | null;
  /** Passe em voo para um jogador que estava em impedimento no momento do passe. */
  offsideBy: Agent | null;
  /** Pênalti em "cavadinha" (bola mansa no meio). */
  panenka: boolean;
  /** Chute de cabeça em voo (cabeceio dentro da área: difícil para o goleiro). */
  header: boolean;
}

export type MatchEventType =
  | 'goal'
  | 'save'
  | 'foul'
  | 'penalty'
  | 'corner'
  | 'card'
  | 'offside'
  | 'sub'
  | 'half-time'
  | 'full-time';

export interface MatchEvent {
  type: MatchEventType;
  /** Segundos de jogo desde o início (somando os dois tempos). */
  t: number;
  team?: Team;
  playerId?: string;
  assistId?: string;
  ownGoal?: boolean;
  /** Substituição: quem saiu (`playerId` é quem entrou). */
  outId?: string;
  /** Cartão mostrado (`playerId` é quem recebeu). */
  card?: 'yellow' | 'second-yellow' | 'red';
}

export interface SubRecord {
  t: number;
  team: Team;
  outId: string;
  inId: string;
  role: SlotRole;
}

export type RestartKind = 'kickoff' | 'throw-in' | 'corner' | 'goal-kick' | 'free-kick' | 'penalty';

/** O que o cobrador vai fazer na bola parada. */
export type SetPiecePlan = 'throw' | 'goal-kick' | 'cross' | 'shot' | 'short' | 'penalty';

export interface SetPiece {
  kind: RestartKind;
  /** time que cobra */
  team: Team;
  taker: Agent;
  plan: SetPiecePlan;
  /** posições fixas durante a cobrança (área cheia no escanteio, afastados no pênalti) */
  targets: Map<Agent, { x: number; y: number }>;
  /** a bola parada vale até este instante (s de jogo) */
  until: number;
}

export interface Restart {
  kind: RestartKind;
  team: Team;
  x: number;
  y: number;
  timer: number;
  /** Cobrador escolhido: corre até a bola durante a pausa. */
  taker?: Agent;
  plan?: SetPiecePlan;
  /** Posições que cada jogador já assume durante a pausa (área cheia, barreira). */
  targets?: Map<Agent, { x: number; y: number }>;
}

export interface Pitch {
  /** comprimento (eixo x) e largura (eixo y), em metros */
  L: number;
  H: number;
  goalW: number;
  /** escala de velocidade/distância em relação ao campo de 11 */
  scale: number;
}

export interface World {
  setup: MatchSetup;
  pitch: Pitch;
  rng: Rng;
  agents: Agent[];
  byTeam: Record<Team, Agent[]>;
  ball: Ball;
  score: Record<Team, number>;
  /** segundos do tempo atual */
  clock: number;
  /** segundos totais de partida */
  time: number;
  phase: 'h1' | 'h2' | 'ft';
  restart: Restart | null;
  events: MatchEvent[];
  /** Último passe recebido por um companheiro — base de assistência/passe-chave. */
  assistCandidate: { from: Agent; to: Agent; t: number } | null;
  /** Time que tem (ou teve por último) a bola. */
  possession: Team;
  tactics: Record<Team, TeamTactics>;
  setPiece: SetPiece | null;
  /** Jogadores que já saíram (as estatísticas deles continuam valendo). */
  subbedOut: Agent[];
  subs: SubRecord[];
  /** Segundos de posse de bola por time. */
  possTime: Record<Team, number>;
  /** Virada de posse recente: quem ganhou a bola ataca rápido, quem perdeu recompõe. */
  transition: { team: Team; until: number } | null;
  /** Gol recém-marcado: o autor corre para comemorar e os companheiros o seguem. */
  celebration: { scorer: Agent; team: Team; x: number; y: number } | null;
}

export interface MatchResult {
  score: Record<Team, number>;
  stats: Record<string, PlayerMatchStats>;
  ratings: Record<string, number>;
  /** Fração da partida que cada jogador atuou (0–1). */
  shares: Record<string, number>;
  mvpId: string | null;
  events: MatchEvent[];
  seed: number;
}
