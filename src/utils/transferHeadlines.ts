import type { TransferRecord, TransferType } from '../types/Transfer';
import { newSocialPost, type HeadlineStyle, type SocialPost } from '../types/Social';
import { HEADLINE_STYLE_META } from './socialHeadlines';

interface Ctx {
  player: string;
  team: string;
  from: string;
  to: string;
  feeLabel: string;
  feeRaw: number;
  wageLabel: string;
  pos: string;
  age: string;
  ovr: string;
  loanMonths: string;
  contract: string;
}

type Template = {
  id: string;
  type: TransferType;
  style: HeadlineStyle;
  title: (c: Ctx) => string;
  body: (c: Ctx) => string;
};

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)] ?? arr[0];
}

function formatFee(fee: number, currencySymbol: string): string {
  if (fee <= 0) return 'sem taxa';
  if (fee >= 1_000_000) {
    const m = fee / 1_000_000;
    return `${currencySymbol} ${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)} mi`;
  }
  if (fee >= 1_000) {
    return `${currencySymbol} ${(fee / 1_000).toFixed(0)} mil`;
  }
  return `${currencySymbol} ${fee.toLocaleString('pt-BR')}`;
}

const TEMPLATES: Template[] = [
  // ── Compras ──────────────────────────────────────────────────────────────
  {
    id: 'buy_flash_1',
    type: 'buy',
    style: 'flash',
    title: c => `OFICIAL: ${c.player} é do ${c.team}`,
    body: c =>
      `Contratação confirmada. O ${c.pos} chega vindo do ${c.from}${c.feeRaw > 0 ? ` por ${c.feeLabel}` : ''}.`,
  },
  {
    id: 'buy_flash_2',
    type: 'buy',
    style: 'flash',
    title: c => `${c.team} anuncia ${c.player}`,
    body: c => `Mercado fechado. ${c.player} (${c.age} anos, OVR ${c.ovr}) reforça o elenco.`,
  },
  {
    id: 'buy_jour_1',
    type: 'buy',
    style: 'journalistic',
    title: c => `${c.team} contrata ${c.player} junto ao ${c.from}`,
    body: c =>
      `O clube acertou a compra do ${c.pos}. ${c.feeRaw > 0 ? `Taxa: ${c.feeLabel}. ` : ''}Contrato: ${c.contract}.`,
  },
  {
    id: 'buy_jour_2',
    type: 'buy',
    style: 'journalistic',
    title: c => `Reforço: ${c.player} assina com o ${c.team}`,
    body: c =>
      `Negociação com o ${c.from} concluída. O atleta chega para disputar posição no setor (${c.pos}).`,
  },
  {
    id: 'buy_sens_1',
    type: 'buy',
    style: 'sensational',
    title: c => `BOMBA: ${c.player} veste a camisa do ${c.team}!`,
    body: c =>
      `A torcida vibra. ${c.feeRaw > 0 ? `Bolada de ${c.feeLabel} na mesa. ` : 'Livre de taxa. '}Era isso que a arquibancada pedia?`,
  },
  {
    id: 'buy_sens_2',
    type: 'buy',
    style: 'sensational',
    title: c => `${c.player} no ${c.team}: o mercado não para!`,
    body: c => `Mais um nome na lista. Vindo do ${c.from}, o ${c.pos} já treina com o grupo.`,
  },
  {
    id: 'buy_ana_1',
    type: 'buy',
    style: 'analytical',
    title: c => `Análise: o que ${c.player} muda no ${c.team}`,
    body: c =>
      `Perfil: ${c.pos}, ${c.age} anos, overall ${c.ovr}. Investimento ${c.feeLabel}; salário mensal ${c.wageLabel}.`,
  },
  {
    id: 'buy_ana_2',
    type: 'buy',
    style: 'analytical',
    title: c => `${c.team} reforça o elenco com ${c.player}`,
    body: c =>
      `Operação com o ${c.from}. Custo de aquisição ${c.feeLabel}. Expectativa: impacto imediato na rotação.`,
  },
  {
    id: 'buy_chron_1',
    type: 'buy',
    style: 'chronicle',
    title: c => `Novo capítulo: ${c.player} chega ao ${c.team}`,
    body: c =>
      `Da saída do ${c.from} ao CT. A torcida já cantarola o nome. Que a temporada escreva bem essa página.`,
  },
  {
    id: 'buy_chron_2',
    type: 'buy',
    style: 'chronicle',
    title: c => `A casa ganha cor com ${c.player}`,
    body: c => `Há contratações que aquecem o inverno. ${c.player} é a aposta do momento no ${c.team}.`,
  },

  // ── Vendas ───────────────────────────────────────────────────────────────
  {
    id: 'sell_flash_1',
    type: 'sell',
    style: 'flash',
    title: c => `OFICIAL: ${c.player} deixa o ${c.team}`,
    body: c =>
      `Venda confirmada para o ${c.to}${c.feeRaw > 0 ? `. Entrada de ${c.feeLabel}` : ''}.`,
  },
  {
    id: 'sell_flash_2',
    type: 'sell',
    style: 'flash',
    title: c => `${c.player} transferido ao ${c.to}`,
    body: c => `Saída concluída. O ${c.pos} não faz mais parte do elenco.`,
  },
  {
    id: 'sell_jour_1',
    type: 'sell',
    style: 'journalistic',
    title: c => `${c.team} vende ${c.player} ao ${c.to}`,
    body: c =>
      `Acordo fechado. ${c.feeRaw > 0 ? `Valor da operação: ${c.feeLabel}.` : 'Negócio sem taxa divulgada.'}`,
  },
  {
    id: 'sell_jour_2',
    type: 'sell',
    style: 'journalistic',
    title: c => `Mercado: ${c.player} acerta com o ${c.to}`,
    body: c => `O ${c.team} libera o atleta. Posição afetada: ${c.pos}.`,
  },
  {
    id: 'sell_sens_1',
    type: 'sell',
    style: 'sensational',
    title: c => `Adeus! ${c.player} vira as costas ao ${c.team}`,
    body: c =>
      `Choque na torcida. Destino: ${c.to}. ${c.feeRaw > 0 ? `Caixa engorda ${c.feeLabel}.` : ''}`,
  },
  {
    id: 'sell_sens_2',
    type: 'sell',
    style: 'sensational',
    title: c => `${c.player} no ${c.to}: fim de era?`,
    body: c =>
      `A saída de ${c.player} que ninguém queria — ou que o caixa pediu. Debate aberto nos corredores.`,
  },
  {
    id: 'sell_ana_1',
    type: 'sell',
    style: 'analytical',
    title: c => `Venda de ${c.player}: impacto no elenco do ${c.team}`,
    body: c =>
      `Receita ${c.feeLabel}. O clube perde overall ${c.ovr} no setor ${c.pos}; entra folga orçamentária.`,
  },
  {
    id: 'sell_ana_2',
    type: 'sell',
    style: 'analytical',
    title: c => `${c.team} monetiza ${c.player}`,
    body: c => `Operação de saída para o ${c.to}. Valor de mercado realizado: ${c.feeLabel}.`,
  },
  {
    id: 'sell_chron_1',
    type: 'sell',
    style: 'chronicle',
    title: c => `A porta se fecha: ${c.player} se despede`,
    body: c => `Camisas, abraços e uma mala. O ${c.team} segue; ${c.player} escreve em outra cidade.`,
  },
  {
    id: 'sell_chron_2',
    type: 'sell',
    style: 'chronicle',
    title: c => `${c.player}: obrigado e até logo`,
    body: c => `Histórias terminam assim — com um anúncio e silêncio no vestiário. Boa sorte no ${c.to}.`,
  },

  // ── Empréstimo in ────────────────────────────────────────────────────────
  {
    id: 'loan_in_flash_1',
    type: 'loan_in',
    style: 'flash',
    title: c => `${c.player} chega por empréstimo ao ${c.team}`,
    body: c => `Cedido pelo ${c.from}. Duração: ${c.loanMonths}.`,
  },
  {
    id: 'loan_in_flash_2',
    type: 'loan_in',
    style: 'flash',
    title: c => `EMPRÉSTIMO: ${c.player} no ${c.team}`,
    body: c => `Reforço temporário. ${c.pos}, ${c.age} anos.`,
  },
  {
    id: 'loan_in_jour_1',
    type: 'loan_in',
    style: 'journalistic',
    title: c => `${c.team} anuncia empréstimo de ${c.player}`,
    body: c =>
      `Acordo com o ${c.from} por ${c.loanMonths}.${c.feeRaw > 0 ? ` Taxa: ${c.feeLabel}.` : ''}`,
  },
  {
    id: 'loan_in_jour_2',
    type: 'loan_in',
    style: 'journalistic',
    title: c => `${c.player} reforça o ${c.team} até o fim do empréstimo`,
    body: c => `O ${c.pos} treina com o elenco enquanto o vínculo com o ${c.from} permanece.`,
  },
  {
    id: 'loan_in_sens_1',
    type: 'loan_in',
    style: 'sensational',
    title: c => `Empréstimo bomba: ${c.player} no ${c.team}!`,
    body: c => `Não é compra — mas a torcida já sonha alto. ${c.loanMonths} para mostrar serviço.`,
  },
  {
    id: 'loan_in_ana_1',
    type: 'loan_in',
    style: 'analytical',
    title: c => `Empréstimo de ${c.player}: custo-benefício`,
    body: c =>
      `Sem compra definitiva. Custo ${c.feeLabel}, salário ${c.wageLabel}, janela de ${c.loanMonths}.`,
  },
  {
    id: 'loan_in_chron_1',
    type: 'loan_in',
    style: 'chronicle',
    title: c => `Por um tempo, ${c.player} é nosso`,
    body: c => `Empréstimos são promessas curtas. Que ${c.player} faça a casa sorrir enquanto estiver aqui.`,
  },
  {
    id: 'loan_in_sens_2',
    type: 'loan_in',
    style: 'sensational',
    title: c => `${c.from} cede ${c.player} — e a torcida comemora`,
    body: c =>
      `Chegada de ${c.player} por empréstimo. Se render, a cobrança por compra vem depois.`,
  },

  // ── Empréstimo out ───────────────────────────────────────────────────────
  {
    id: 'loan_out_flash_1',
    type: 'loan_out',
    style: 'flash',
    title: c => `${c.player} sai por empréstimo ao ${c.to}`,
    body: c => `Cedido pelo ${c.team}. Prazo: ${c.loanMonths}.`,
  },
  {
    id: 'loan_out_flash_2',
    type: 'loan_out',
    style: 'flash',
    title: c => `EMPRÉSTIMO: ${c.player} no ${c.to}`,
    body: c => `Atleta do ${c.team} muda de ares temporariamente.`,
  },
  {
    id: 'loan_out_jour_1',
    type: 'loan_out',
    style: 'journalistic',
    title: c => `${c.team} empresta ${c.player} ao ${c.to}`,
    body: c =>
      `Acordo de ${c.loanMonths}.${c.feeRaw > 0 ? ` Taxa recebida: ${c.feeLabel}.` : ''} Continua vinculado ao clube.`,
  },
  {
    id: 'loan_out_jour_2',
    type: 'loan_out',
    style: 'journalistic',
    title: c => `${c.player} busca minutos no ${c.to}`,
    body: c => `Saída por empréstimo para ganhar ritmo. Posição: ${c.pos}.`,
  },
  {
    id: 'loan_out_ana_1',
    type: 'loan_out',
    style: 'analytical',
    title: c => `Empréstimo de ${c.player}: gestão de elenco`,
    body: c =>
      `Libera espaço e salário relativo. Retorno previsto após ${c.loanMonths}. Receita ${c.feeLabel}.`,
  },
  {
    id: 'loan_out_sens_1',
    type: 'loan_out',
    style: 'sensational',
    title: c => `${c.player} fora! Empréstimo ao ${c.to}`,
    body: c =>
      `A torcida discute a saída de ${c.player}: castigo, estratégia ou primeiro passo para venda?`,
  },
  {
    id: 'loan_out_chron_1',
    type: 'loan_out',
    style: 'chronicle',
    title: c => `${c.player} parte — e a porta fica entreaberta`,
    body: c =>
      `Não é adeus definitivo para ${c.player}. É um desvio. Que volte melhor — ou que o destino decida.`,
  },
  {
    id: 'loan_out_ana_2',
    type: 'loan_out',
    style: 'analytical',
    title: c => `${c.team} cede ${c.player}: leitura do mercado`,
    body: c => `Movimento típico de janela cheia. O ${c.to} assume o dia a dia do atleta.`,
  },

  // ── Livre ────────────────────────────────────────────────────────────────
  {
    id: 'free_flash_1',
    type: 'free',
    style: 'flash',
    title: c => `${c.player} assina com o ${c.team} (livre)`,
    body: c => `Sem taxa de transferência. Salário ${c.wageLabel}.`,
  },
  {
    id: 'free_flash_2',
    type: 'free',
    style: 'flash',
    title: c => `LIVRE: ${c.player} é do ${c.team}`,
    body: c => `Mercado sem custo de compra. ${c.pos}, ${c.age} anos.`,
  },
  {
    id: 'free_jour_1',
    type: 'free',
    style: 'journalistic',
    title: c => `${c.team} anuncia ${c.player} a custo zero`,
    body: c => `Contrato de ${c.contract}. Chegada sem taxa; investimento focado em salário.`,
  },
  {
    id: 'free_jour_2',
    type: 'free',
    style: 'journalistic',
    title: c => `${c.player} reforça o ${c.team} sem taxa`,
    body: c => `Operação limpa no balanço. Overall ${c.ovr} entra no elenco.`,
  },
  {
    id: 'free_sens_1',
    type: 'free',
    style: 'sensational',
    title: c => `PECHINCHA: ${c.player} de graça no ${c.team}!`,
    body: c =>
      `Zero na taxa por ${c.player} — e a torcida já imagina o melhor cenário.`,
  },
  {
    id: 'free_ana_1',
    type: 'free',
    style: 'analytical',
    title: c => `Custo zero: ${c.player} no ${c.team}`,
    body: c => `Sem amortização de taxa. Risco concentrado no contrato (${c.wageLabel}/mês).`,
  },
  {
    id: 'free_chron_1',
    type: 'free',
    style: 'chronicle',
    title: c => `${c.player} escolhe o ${c.team}`,
    body: c =>
      `Às vezes o destino não cobra pedágio. ${c.player} no ${c.team}: só falta o campo dizer o resto.`,
  },
  {
    id: 'free_sens_2',
    type: 'free',
    style: 'sensational',
    title: c => `Mercado: ${c.player} cai no colo do ${c.team}`,
    body: c =>
      `${c.player} livre no papel, cobiçado na prática. Apresentação a caminho.`,
  },
];

export function buildTransferHeadline(input: {
  record: TransferRecord;
  teamName: string;
  currencySymbol?: string;
  gameDate?: string;
  rng?: () => number;
}): SocialPost {
  const rng = input.rng ?? Math.random;
  const r = input.record;
  const sym = input.currencySymbol ?? 'R$';
  const pool = TEMPLATES.filter(t => t.type === r.type);
  const tpl = pick(pool.length ? pool : TEMPLATES.filter(t => t.type === 'buy'), rng);
  const meta = HEADLINE_STYLE_META[tpl.style];

  const ctx: Ctx = {
    player: r.playerSnapshot.name,
    team: input.teamName,
    from: r.fromClub || '—',
    to: r.toClub || '—',
    feeLabel: formatFee(r.fee, sym),
    feeRaw: r.fee,
    wageLabel: r.wage > 0 ? formatFee(r.wage, sym) : 'a definir',
    pos: r.playerSnapshot.position || 'jogador',
    age: r.playerSnapshot.age != null ? String(r.playerSnapshot.age) : '?',
    ovr: r.playerSnapshot.overall != null ? String(r.playerSnapshot.overall) : '?',
    loanMonths: r.loanDurationMonths
      ? `${r.loanDurationMonths} mês${r.loanDurationMonths === 1 ? '' : 'es'}`
      : 'prazo a definir',
    contract: r.contractYears
      ? `${r.contractYears} ano${r.contractYears === 1 ? '' : 's'}`
      : 'prazo a definir',
  };

  return newSocialPost({
    date: (input.gameDate ?? r.date).slice(0, 10),
    type: 'headline',
    content: tpl.title(ctx),
    body: tpl.body(ctx),
    headlineStyle: tpl.style,
    author: meta.author,
    likes: 110 + Math.floor(rng() * 220),
  });
}
