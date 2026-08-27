/**
 * Importação JSON de pré-lista da Seleção Nacional (v1.4).
 * Mesma disciplina de `clubImport.ts`: falha tudo ou nada, mensagens por índice/nome.
 */

import { uid } from './matchEvents';
import { PLAYER_POSITIONS, type PlayerPosition, type Player } from '../types/Player';
import type { NationalPlayer } from '../types/NationalTeam';
import { emptyNationalPlayerStats } from '../types/NationalTeam';

const MAX_IMPORT_PLAYERS = 30;

export interface NationalImportPlayerJson {
  nome: string;
  posicao: string;
  clube: string;
  idade: number;
  overall?: number;
}

export interface NationalImportJson {
  /** Guia de preenchimento — ignorado na importação. */
  _docs?: Record<string, unknown>;
  jogadores: NationalImportPlayerJson[];
}

export const NATIONAL_IMPORT_TEMPLATE: NationalImportJson = {
  _docs: {
    comoUsar:
      'Edite "jogadores", salve como .json e use Importar JSON na Convocação. Até 30 atletas por arquivo. Campo inválido faz a importação inteira falhar (nada é aceito pela metade).',
    jogadores: {
      nome: 'Obrigatório. Nome do atleta (texto não vazio).',
      posicao: `Obrigatório. Uma de: ${PLAYER_POSITIONS.join(', ')}.`,
      clube: 'Obrigatório. Clube de origem do atleta (texto livre).',
      idade: 'Obrigatório. Número inteiro entre 15 e 45.',
      overall: 'Opcional. Número inteiro entre 1 e 99.',
    },
  },
  jogadores: [
    { nome: 'Gabriel Martinelli', posicao: 'LW', clube: 'Arsenal', idade: 25, overall: 84 },
    { nome: 'Bruno Guimarães', posicao: 'CDM', clube: 'Newcastle', idade: 28, overall: 85 },
  ],
};

function isIntInRange(n: unknown, min: number, max: number): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max;
}

export function downloadNationalImportTemplate() {
  const blob = new Blob([JSON.stringify(NATIONAL_IMPORT_TEMPLATE, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'clubos-selecao-pre-lista-modelo.json';
  a.click();
  URL.revokeObjectURL(url);
}

export function parseNationalImport(raw: unknown, clubPlayers: Player[] = []): NationalPlayer[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('JSON inválido: esperado um objeto com "jogadores".');
  }
  const data = raw as Partial<NationalImportJson>;

  if (!Array.isArray(data.jogadores)) {
    throw new Error('Campo "jogadores" é obrigatório (array).');
  }
  if (data.jogadores.length === 0) {
    throw new Error('A lista de "jogadores" está vazia.');
  }
  if (data.jogadores.length > MAX_IMPORT_PLAYERS) {
    throw new Error(
      `No máximo ${MAX_IMPORT_PLAYERS} atletas por importação (recebido: ${data.jogadores.length}).`,
    );
  }

  return data.jogadores.map((p, i) => {
    const label =
      p && typeof p === 'object' && typeof (p as NationalImportPlayerJson).nome === 'string'
        ? `"${(p as NationalImportPlayerJson).nome.trim() || `#${i + 1}`}"`
        : `#${i + 1}`;

    if (!p || typeof p !== 'object' || Array.isArray(p)) {
      throw new Error(`Atleta ${label}: objeto inválido.`);
    }
    if (typeof p.nome !== 'string' || !p.nome.trim()) {
      throw new Error(`Atleta ${label}: "nome" obrigatório (texto não vazio).`);
    }
    const pos = String(p.posicao ?? '').toUpperCase() as PlayerPosition;
    if (!PLAYER_POSITIONS.includes(pos)) {
      throw new Error(
        `Atleta ${label}: posição inválida "${p.posicao}". Use: ${PLAYER_POSITIONS.join(', ')}.`,
      );
    }
    if (typeof p.clube !== 'string' || !p.clube.trim()) {
      throw new Error(`Atleta ${label}: "clube" obrigatório (texto não vazio).`);
    }
    if (!isIntInRange(p.idade, 15, 45)) {
      throw new Error(`Atleta ${label}: "idade" deve ser inteiro entre 15 e 45.`);
    }
    if (p.overall !== undefined && !isIntInRange(p.overall, 1, 99)) {
      throw new Error(`Atleta ${label}: "overall" deve ser inteiro entre 1 e 99.`);
    }

    const player: NationalPlayer = {
      id: uid(),
      name: p.nome.trim(),
      position: pos,
      age: p.idade,
      club: p.clube.trim(),
      caps: 0,
      stats: emptyNationalPlayerStats(),
    };
    if (p.overall !== undefined) player.overall = p.overall;
    const linked = clubPlayers.find(
      cp => cp.name.trim().toLowerCase() === player.name.toLowerCase(),
    );
    if (linked) player.clubPlayerId = linked.id;
    return player;
  });
}
