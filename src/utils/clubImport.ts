/**
 * Club import JSON — template and parser for ClubCreate.
 */

import type { Player, PlayerPosition, PlayerStatus } from '../types/Player';
import { PLAYER_POSITIONS } from '../types/Player';
import type { Team } from '../types/Team';
import { createBlankTeam, createPlayerDraft } from './customSquad';
import { DEFAULT_PRIMARY, DEFAULT_SECONDARY } from './clubColors';

export interface ClubImportJson {
  club: {
    name: string;
    nickname?: string;
    primaryColor?: string;
    secondaryColor?: string;
    budget?: number;
    fans?: number;
    description?: string;
  };
  players: Array<{
    name: string;
    position: string;
    age: number;
    overall?: number;
    potential?: number;
    number?: number | null;
    status?: string;
    salary?: number;
    marketValue?: number;
    personality?: string;
  }>;
}

export const CLUB_IMPORT_TEMPLATE: ClubImportJson = {
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
    { name: 'Thiago Rocha', position: 'CAM', age: 20, overall: 69, potential: 84, number: 10, status: 'Titular', salary: 552000, marketValue: 10_350_000, personality: 'Criativo' },
    { name: 'Gabriel Lima', position: 'LW', age: 19, overall: 68, potential: 85, number: 11, status: 'Titular', salary: 544000, marketValue: 10_200_000, personality: 'Ambicioso' },
    { name: 'Matheus Oliveira', position: 'RW', age: 23, overall: 73, potential: 78, number: 7, status: 'Titular', salary: 584000, marketValue: 10_950_000, personality: 'Criativo' },
    { name: 'João Pedro', position: 'ST', age: 27, overall: 77, potential: 80, number: 9, status: 'Titular', salary: 616000, marketValue: 11_550_000, personality: 'Líder' },
    { name: 'Igor Martins', position: 'ST', age: 18, overall: 65, potential: 86, number: 19, status: 'Promessa', salary: 520000, marketValue: 9_750_000, personality: 'Ambicioso' },
    { name: 'Henrique Dias', position: 'CDM', age: 33, overall: 74, potential: 74, number: 15, status: 'Reserva', salary: 592000, marketValue: 11_100_000, personality: 'Disciplinado' },
  ],
};

const VALID_STATUSES = new Set([
  'Titular',
  'Reserva',
  'Promessa',
  'Transferível',
  'Emprestado',
  'Aposentado',
]);

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
  if (!raw || typeof raw !== 'object') {
    throw new Error('JSON inválido.');
  }
  const data = raw as Partial<ClubImportJson>;
  if (!data.club || typeof data.club.name !== 'string' || !data.club.name.trim()) {
    throw new Error('Campo "club.name" é obrigatório.');
  }
  if (!Array.isArray(data.players) || data.players.length < 11) {
    throw new Error('É preciso ter pelo menos 11 jogadores em "players".');
  }

  const team = createBlankTeam(data.club.name, country, {
    primaryColor: data.club.primaryColor ?? DEFAULT_PRIMARY,
    secondaryColor: data.club.secondaryColor ?? DEFAULT_SECONDARY,
  });
  if (data.club.nickname) team.nickname = data.club.nickname;
  if (typeof data.club.budget === 'number') team.budget = data.club.budget;
  if (typeof data.club.fans === 'number') team.fans = data.club.fans;
  if (data.club.description) team.description = data.club.description;

  const players: Player[] = data.players.map((p, i) => {
    if (!p.name?.trim()) throw new Error(`Jogador #${i + 1}: nome obrigatório.`);
    const pos = String(p.position ?? '').toUpperCase() as PlayerPosition;
    if (!PLAYER_POSITIONS.includes(pos)) {
      throw new Error(`Jogador "${p.name}": posição inválida "${p.position}". Use: ${PLAYER_POSITIONS.join(', ')}`);
    }
    if (typeof p.age !== 'number' || p.age < 15 || p.age > 50) {
      throw new Error(`Jogador "${p.name}": idade inválida.`);
    }
    const status = (p.status && VALID_STATUSES.has(p.status) ? p.status : 'Titular') as PlayerStatus;
    return createPlayerDraft(team.id, {
      name: p.name,
      position: pos,
      age: p.age,
      overall: p.overall,
      potential: p.potential,
      number: p.number ?? null,
      status,
      salary: p.salary,
      marketValue: p.marketValue,
      personality: p.personality,
    });
  });

  return { team, players };
}
