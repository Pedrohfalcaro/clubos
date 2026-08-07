import type { Currency, FinanceLedgerEntry } from '../../types/Finance';
import { formatMoney } from '../../utils/finance';
import { LEDGER_ICON } from './ledgerIcons';
import styles from '../../pages/Finance/Finance.module.css';
import listStyles from './TopEntriesList.module.css';

interface TopEntriesListProps {
  entries: FinanceLedgerEntry[];
  currency: Currency;
  limit?: number;
}

function TopList({
  title,
  items,
  currency,
  emptyLabel,
  amountClass,
}: {
  title: string;
  items: FinanceLedgerEntry[];
  currency: Currency;
  emptyLabel: string;
  amountClass: string;
}) {
  return (
    <div className={listStyles.column}>
      <p className={listStyles.columnTitle}>{title}</p>
      {items.length === 0 ? (
        <div className={styles.emptyState}>{emptyLabel}</div>
      ) : (
        <ul className={listStyles.list}>
          {items.map(entry => (
            <li key={entry.id} className={listStyles.row}>
              <span className={listStyles.icon} aria-hidden="true">{LEDGER_ICON[entry.type]}</span>
              <span className={listStyles.label} title={entry.label}>{entry.label}</span>
              <span className={`${listStyles.amount} ${amountClass}`}>
                {formatMoney(Math.abs(entry.amount), currency)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function TopEntriesList({ entries, currency, limit = 5 }: TopEntriesListProps) {
  const topIncome = entries
    .filter(e => e.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
  const topExpense = entries
    .filter(e => e.amount < 0)
    .sort((a, b) => a.amount - b.amount)
    .slice(0, limit);

  return (
    <div className={listStyles.grid}>
      <TopList
        title="Maiores entradas"
        items={topIncome}
        currency={currency}
        emptyLabel="Nenhuma receita no período."
        amountClass={styles.income}
      />
      <TopList
        title="Maiores saídas"
        items={topExpense}
        currency={currency}
        emptyLabel="Nenhuma despesa no período."
        amountClass={styles.expense}
      />
    </div>
  );
}
