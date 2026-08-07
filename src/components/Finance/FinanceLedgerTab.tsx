import { useMemo, useState } from 'react';
import type { LedgerEntryType } from '../../types/Finance';
import type { useGame } from '../../context/GameContext';
import { formatMoney, ledgerEntryTypeLabel } from '../../utils/finance';
import { LEDGER_ICON } from './ledgerIcons';
import styles from '../../pages/Finance/Finance.module.css';

type GameFinance = ReturnType<typeof useGame>['state']['finance'];

type LedgerFilter = 'all' | 'income' | 'expense' | 'transfer' | 'wage';

const INCOME_TYPES: LedgerEntryType[] = ['prize', 'transfer_fee', 'loan_fee', 'loan_credit', 'sponsor', 'other_in', 'ticket'];
const EXPENSE_TYPES: LedgerEntryType[] = ['wage', 'other_out', 'adjustment', 'travel', 'stadium_ops', 'loan_repay', 'debt_repay'];
const TRANSFER_TYPES: LedgerEntryType[] = ['transfer_fee', 'loan_fee'];

interface FinanceLedgerTabProps {
  finance: GameFinance;
}

export default function FinanceLedgerTab({ finance }: FinanceLedgerTabProps) {
  const [ledgerFilter, setLedgerFilter] = useState<LedgerFilter>('all');
  const [search, setSearch] = useState('');

  const filteredLedger = useMemo(() => {
    const query = search.trim().toLowerCase();
    return finance.ledger.filter(e => {
      if (ledgerFilter === 'income' && !INCOME_TYPES.includes(e.type)) return false;
      if (ledgerFilter === 'expense' && !EXPENSE_TYPES.includes(e.type)) return false;
      if (ledgerFilter === 'transfer' && !TRANSFER_TYPES.includes(e.type)) return false;
      if (ledgerFilter === 'wage' && e.type !== 'wage') return false;
      if (query && !e.label.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [finance.ledger, ledgerFilter, search]);

  const isFiltered = ledgerFilter !== 'all' || search.trim().length > 0;

  return (
    <>
      <div className={styles.ledgerFilters}>
        {([
          ['all', 'Todos'],
          ['income', 'Receitas'],
          ['expense', 'Despesas'],
          ['transfer', 'Transferências'],
          ['wage', 'Folha'],
        ] as [LedgerFilter, string][]).map(([f, l]) => (
          <button
            key={f}
            className={`${styles.filterChip} ${ledgerFilter === f ? styles.filterChipActive : ''}`}
            onClick={() => setLedgerFilter(f)}
          >
            {l}
          </button>
        ))}
      </div>

      <input
        className={styles.formInput}
        style={{ marginBottom: 12 }}
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Buscar por descrição..."
        aria-label="Buscar lançamento"
      />

      {filteredLedger.length === 0 ? (
        <div className={styles.emptyState}>Nenhum lançamento {isFiltered ? 'encontrado' : 'ainda'}.</div>
      ) : (
        <ul className={styles.ledgerList} style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: 'var(--card-bg)' }}>
          {filteredLedger.map(entry => (
            <li key={entry.id} className={styles.ledgerRow}>
              <div className={styles.ledgerMeta}>
                <span className={styles.ledgerLabel}>
                  <span aria-hidden="true">{LEDGER_ICON[entry.type]}</span> {entry.label}
                </span>
                <span className={styles.ledgerSub}>
                  {ledgerEntryTypeLabel(entry.type)} · {entry.date}
                </span>
              </div>
              <span className={`${styles.ledgerAmount} ${entry.amount >= 0 ? styles.income : styles.expense}`}>
                {entry.amount >= 0 ? '+' : ''}{formatMoney(entry.amount, finance.currency)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
