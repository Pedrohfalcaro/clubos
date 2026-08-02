/**
 * Club import JSON — template and parser for ClubCreate.
 */

import type { Player, PlayerPosition, PlayerStatus } from '../types/Player';
import { PLAYER_POSITIONS } from '../types/Player';
import type { Team } from '../types/Team';
import {
  PERSONALIDADES,
  PERSONALITY_DESCRIPTIONS,
  isPersonality,
  type Personality,
} from '../pulse/utils';
import { createBlankTeam, createPlayerDraft } from './customSquad';
import { DEFAULT_PRIMARY, DEFAULT_SECONDARY } from './clubColors';

const VALID_STATUSES: PlayerStatus[] = [
  'Titular',
  'Reserva',
  'Promessa',
  'Transferível',
  'Emprestado',
  'Aposentado',
];

const VALID_STATUS_SET = new Set<string>(VALID_STATUSES);

export interface ClubImportPlayerJson {
  name: string;
  position: string;
  age: number;
  overall: number;
  potential: number;
  number?: number | null;
  status: string;
  salary?: number;
  marketValue?: number;
  personality: Personality;
}

export interface ClubImportJson {
  /** Guia de preenchimento — ignorado na importação. */
  _docs?: Record<string, unknown>;
  club: {
    name: string;
    nickname?: string;
    primaryColor?: string;
    secondaryColor?: string;
    budget?: number;
    fans?: number;
    description?: string;
  };
  players: ClubImportPlayerJson[];
}

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export const CLUB_IMPORT_TEMPLATE: ClubImportJson = {
  _docs: {
    comoUsar:
      'Edite club + players, salve como .json e use Importar JSON na criação do clube. Remova _docs se quiser — ele é só documentação. Campos com valor inválido fazem a importação falhar (nada é aceito pela metade).',
    minimo: 'Pelo menos 11 jogadores em players.',
    club: {
      name: 'Obrigatório. Nome oficial do clube (texto não vazio).',
      nickname: 'Opcional. Apelido curto.',
      primaryColor: 'Opcional. Hex #RGB ou #RRGGBB (ex.: #7c3aed).',
      secondaryColor: 'Opcional. Hex #RGB ou #RRGGBB.',
      budget: 'Opcional. Número ≥ 0 (orçamento inicial).',
      fans: 'Opcional. Número inteiro ≥ 0 (torcida).',
      description: 'Opcional. Texto livre sobre o clube.',
    },
    players: {
      name: 'Obrigatório. Nome do atleta.',
      position: `Obrigatório. Uma de: ${PLAYER_POSITIONS.join(', ')}.`,
      age: 'Obrigatório. Número inteiro entre 15 e 50.',
      overall: 'Obrigatório. Número inteiro entre 1 e 99.',
      potential: 'Obrigatório. Número inteiro entre 1 e 99 (deve ser ≥ overall).',
      number: 'Opcional. Camisa 1–99, ou null.',
      status: `Obrigatório. Um de: ${VALID_STATUSES.join(', ')}.`,
      salary: 'Opcional. Número ≥ 0 (salário).',
      marketValue: 'Opcional. Número ≥ 0 (valor de mercado).',
      personality: {
        obrigatorio: true,
        valores: [...PERSONALIDADES],
        efeitoNoPulse:
          'Filtra eventos e altera chances de categorias (atleta, escândalo, etc.). Use exatamente a grafia da lista.',
        significados: { ...PERSONALITY_DESCRIPTIONS },
      },
    },
  },
  club: {
    name: 'Meu Clube',
    nickname: 'Meu',
    primaryColor: '#7c3aed',
    secondaryColor: '#e2e8f0',
    budget: 5_000_000,
    fans: 50_000,
    description: 'Clube criado via import JSON',
  },
  players: [
    { name: 'Carlos Mendes', position: 'GK', age: 31, overall: 74, potential: 76, number: 1, status: 'Titular', salary: 560000, marketValue: 10_500_000, personality: 'Disciplinado' },
    { name: 'Rafael Costa', position: 'CB', age: 28, overall: 76, potential: 78, number: 3, status: 'Titular', salary: 608000, marketValue: 11_400_000, personality: 'Líder' },
    { name: 'Bruno Silva', position: 'CB', age: 24, overall: 72, potential: 78, number: 4, status: 'Titular', salary: 576000, marketValue: 10_800_000, personality: 'Disciplinado' },
    { name: 'Diego Alves', position: 'LB', age: 22, overall: 70, potential: 80, number: 6, status: 'Titular', salary: 560000, marketValue: 10_500_000, personality: 'Ambicioso' },
    { name: 'Lucas Ferreira', position: 'RB', age: 26, overall: 73, potential: 75, number: 2, status: 'Titular', salary: 584000, marketValue: 10_950_000, personality: 'Disciplinado' },
    { name: 'André Souza', position: 'CDM', age: 29, overall: 75, potential: 76, number: 5, status: 'Titular', salary: 600000, marketValue: 11_250_000, personality: 'Líder' },
    { name: 'Pedro Nunes', position: 'CM', age: 21, overall: 71, potential: 82, number: 8, status: 'Titular', salary: 568000, marketValue: 10_650_000, personality: 'Ambicioso' },
    { name: 'Thiago Rocha', position: 'CAM', age: 20, overall: 69, potential: 84, number: 10, status: 'Titular', salary: 552000, marketValue: 10_350_000, personality: 'Promessa' },
    { name: 'Gabriel Lima', position: 'LW', age: 19, overall: 68, potential: 85, number: 11, status: 'Titular', salary: 544000, marketValue: 10_200_000, personality: 'Ambicioso' },
    { name: 'Matheus Oliveira', position: 'RW', age: 23, overall: 73, potential: 78, number: 7, status: 'Titular', salary: 584000, marketValue: 10_950_000, personality: 'Vaidoso' },
    { name: 'João Pedro', position: 'ST', age: 27, overall: 77, potential: 80, number: 9, status: 'Titular', salary: 616000, marketValue: 11_550_000, personality: 'Líder' },
    { name: 'Igor Martins', position: 'ST', age: 18, overall: 65, potential: 86, number: 19, status: 'Promessa', salary: 520000, marketValue: 9_750_000, personality: 'Promessa' },
    { name: 'Henrique Dias', position: 'CDM', age: 33, overall: 74, potential: 74, number: 15, status: 'Reserva', salary: 592000, marketValue: 11_100_000, personality: 'Veterano' },
  ],
};

function isIntInRange(n: unknown, min: number, max: number): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max;
}

function isNonNegNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0;
}

export function downloadClubTemplate() {
  const blob = new Blob([JSON.stringify(CLUB_IMPORT_TEMPLATE, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'clubos-elenco-modelo.json';
  a.click();
  URL.revokeObjectURL(url);
}

export function parseClubImport(
  raw: unknown,
  country: string,
): { team: Team; players: Player[] } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('JSON inválido: esperado um objeto com "club" e "players".');
  }
  const data = raw as Partial<ClubImportJson>;

  if (!data.club || typeof data.club !== 'object' || Array.isArray(data.club)) {
    throw new Error('Campo "club" é obrigatório (objeto).');
  }
  if (typeof data.club.name !== 'string' || !data.club.name.trim()) {
    throw new Error('Campo "club.name" é obrigatório (texto não vazio).');
  }
  if (data.club.nickname !== undefined && typeof data.club.nickname !== 'string') {
    throw new Error('Campo "club.nickname" deve ser texto.');
  }
  if (data.club.description !== undefined && typeof data.club.description !== 'string') {
    throw new Error('Campo "club.description" deve ser texto.');
  }
  if (data.club.primaryColor !== undefined) {
    if (typeof data.club.primaryColor !== 'string' || !HEX_COLOR.test(data.club.primaryColor)) {
      throw new Error('Campo "club.primaryColor" inválido. Use hex #RGB ou #RRGGBB.');
    }
  }
  if (data.club.secondaryColor !== undefined) {
    if (typeof data.club.secondaryColor !== 'string' || !HEX_COLOR.test(data.club.secondaryColor)) {
      throw new Error('Campo "club.secondaryColor" inválido. Use hex #RGB ou #RRGGBB.');
    }
  }
  if (data.club.budget !== undefined && !isNonNegNumber(data.club.budget)) {
    throw new Error('Campo "club.budget" deve ser um número ≥ 0.');
  }
  if (data.club.fans !== undefined) {
    if (!isNonNegNumber(data.club.fans) || !Number.isInteger(data.club.fans)) {
      throw new Error('Campo "club.fans" deve ser um inteiro ≥ 0.');
    }
  }

  if (!Array.isArray(data.players)) {
    throw new Error('Campo "players" é obrigatório (array).');
  }
  if (data.players.length < 11) {
    throw new Error(`É preciso ter pelo menos 11 jogadores em "players" (recebido: ${data.players.length}).`);
  }

  const team = createBlankTeam(data.club.name, country, {
    primaryColor: data.club.primaryColor ?? DEFAULT_PRIMARY,
    secondaryColor: data.club.secondaryColor ?? DEFAULT_SECONDARY,
  });
  if (data.club.nickname) team.nickname = data.club.nickname;
  if (typeof data.club.budget === 'number') team.budget = data.club.budget;
  if (typeof data.club.fans === 'number') team.fans = data.club.fans;
  if (data.club.description) team.description = data.club.description;

  const seenNumbers = new Set<number>();
  const players: Player[] = data.players.map((p, i) => {
    const label = p && typeof p === 'object' && typeof (p as ClubImportPlayerJson).name === 'string'
      ? `"${(p as ClubImportPlayerJson).name.trim() || `#${i + 1}`}"`
      : `#${i + 1}`;

    if (!p || typeof p !== 'object' || Array.isArray(p)) {
      throw new Error(`Jogador ${label}: objeto inválido.`);
    }
    if (typeof p.name !== 'string' || !p.name.trim()) {
      throw new Error(`Jogador ${label}: "name" obrigatório (texto não vazio).`);
    }
    const pos = String(p.position ?? '').toUpperCase() as PlayerPosition;
    if (!PLAYER_POSITIONS.includes(pos)) {
      throw new Error(
        `Jogador ${label}: posição inválida "${p.position}". Use: ${PLAYER_POSITIONS.join(', ')}.`,
      );
    }
    if (!isIntInRange(p.age, 15, 50)) {
      throw new Error(`Jogador ${label}: "age" deve ser inteiro entre 15 e 50.`);
    }
    if (!isIntInRange(p.overall, 1, 99)) {
      throw new Error(`Jogador ${label}: "overall" obrigatório (inteiro 1–99).`);
    }
    if (!isIntInRange(p.potential, 1, 99)) {
      throw new Error(`Jogador ${label}: "potential" obrigatório (inteiro 1–99).`);
    }
    if (p.potential < p.overall) {
      throw new Error(`Jogador ${label}: "potential" (${p.potential}) não pode ser menor que "overall" (${p.overall}).`);
    }
    if (p.number !== undefined && p.number !== null) {
      if (!isIntInRange(p.number, 1, 99)) {
        throw new Error(`Jogador ${label}: "number" deve ser inteiro 1–99 ou null.`);
      }
      if (seenNumbers.has(p.number)) {
        throw new Error(`Jogador ${label}: camisa ${p.number} duplicada no elenco.`);
      }
      seenNumbers.add(p.number);
    }
    if (typeof p.status !== 'string' || !VALID_STATUS_SET.has(p.status)) {
      throw new Error(
        `Jogador ${label}: "status" inválido "${p.status ?? ''}". Use: ${VALID_STATUSES.join(', ')}.`,
      );
    }
    if (!isPersonality(p.personality)) {
      throw new Error(
        `Jogador ${label}: "personality" inválida "${String(p.personality ?? '')}". Use exatamente: ${PERSONALIDADES.join(', ')}.`,
      );
    }
    if (p.salary !== undefined && !isNonNegNumber(p.salary)) {
      throw new Error(`Jogador ${label}: "salary" deve ser número ≥ 0.`);
    }
    if (p.marketValue !== undefined && !isNonNegNumber(p.marketValue)) {
      throw new Error(`Jogador ${label}: "marketValue" deve ser número ≥ 0.`);
    }

    return createPlayerDraft(team.id, {
      name: p.name,
      position: pos,
      age: p.age,
      overall: p.overall,
      potential: p.potential,
      number: p.number ?? null,
      status: p.status as PlayerStatus,
      salary: p.salary,
      marketValue: p.marketValue,
      personality: p.personality,
    });
  });

  return { team, players };
}
