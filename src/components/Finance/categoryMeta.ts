import type { ExpenseCategoryGroup } from '../../utils/financeAnalytics';

/** Label PT-BR + cor de UI por grupo de despesa (spec v1.3 §2.4). */
export const CATEGORY_META: Record<ExpenseCategoryGroup, { label: string; color: string }> = {
  payroll: { label: 'Folha salarial', color: '#3b82f6' },
  stadium_travel: { label: 'Estádio / Viagens', color: '#ef4444' },
  loans_debts: { label: 'Empréstimos & Dívidas', color: '#f59e0b' },
  transfers: { label: 'Transferências & Mercado', color: '#a855f7' },
  other: { label: 'Outras despesas', color: '#8b8a93' },
};

export const CATEGORY_ORDER: ExpenseCategoryGroup[] = [
  'payroll',
  'stadium_travel',
  'loans_debts',
  'transfers',
  'other',
];
