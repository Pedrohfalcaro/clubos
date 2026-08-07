import { useState } from 'react';
import type { Currency } from '../../types/Finance';
import { formatMoney } from '../../utils/finance';
import MoneyAmountHint from '../MoneyAmountHint/MoneyAmountHint';
import styles from '../../pages/Finance/Finance.module.css';
import headerStyles from './FinanceHeader.module.css';

export type Period = 'month' | '6months' | 'season' | 'all';

const PERIOD_OPTIONS: [Period, string][] = [
  ['month', 'Mês atual'],
  ['6months', 'Últimos 6 meses'],
  ['season', 'Temporada atual'],
  ['all', 'Histórico acumulado'],
];

interface FinanceHeaderProps {
  greeting: string;
  season: number;
  period: Period;
  onPeriodChange: (period: Period) => void;
  onAddEntry: () => void;
  onRequestLoan: () => void;
  currentBudget: number | undefined;
  currency: Currency;
  onSetBudget: (targetExpenseLimit: number) => void;
  showPayWages?: boolean;
  onPayWages?: () => void;
}

export default function FinanceHeader({
  greeting,
  season,
  period,
  onPeriodChange,
  onAddEntry,
  onRequestLoan,
  currentBudget,
  currency,
  onSetBudget,
  showPayWages,
  onPayWages,
}: FinanceHeaderProps) {
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [budgetInput, setBudgetInput] = useState(currentBudget ? String(currentBudget) : '');

  function openBudgetModal() {
    setBudgetInput(currentBudget ? String(currentBudget) : '');
    setShowBudgetModal(true);
  }

  function submitBudget() {
    const v = Math.round(parseFloat(budgetInput.replace(',', '.')));
    if (!Number.isFinite(v) || v < 0) return;
    onSetBudget(v);
    setShowBudgetModal(false);
  }

  return (
    <div className={styles.header}>
      <div className={styles.headerLeft}>
        <h1>Financeiro</h1>
        <p className={headerStyles.greeting}>{greeting}</p>
        <p className={headerStyles.season}>Temporada {season}</p>
      </div>

      <div className={headerStyles.actions}>
        <select
          className={styles.formSelect}
          value={period}
          onChange={e => onPeriodChange(e.target.value as Period)}
          aria-label="Período de análise"
        >
          {PERIOD_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        {showPayWages && onPayWages && (
          <button className={styles.btnDanger} onClick={onPayWages}>
            Pagar folha
          </button>
        )}
        <button className={styles.btnSecondary} onClick={onRequestLoan}>
          Solicitar empréstimo
        </button>
        <button className={styles.btnSecondary} onClick={openBudgetModal}>
          Definir teto de gastos
        </button>
        <button className={styles.btnPrimary} onClick={onAddEntry}>
          + Novo lançamento
        </button>
      </div>

      {showBudgetModal && (
        <div className={styles.overlay} onClick={() => setShowBudgetModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <p className={styles.modalTitle}>Teto de gastos mensal</p>
            <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text)' }}>
              Se as despesas do mês passarem desse valor, a diretoria perde confiança.
              {currentBudget ? ` Teto atual: ${formatMoney(currentBudget, currency)}.` : ' Ainda não configurado.'}
            </p>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Teto mensal</label>
              <input
                className={styles.formInput}
                type="number"
                min={0}
                value={budgetInput}
                onChange={e => setBudgetInput(e.target.value)}
                placeholder="Ex: 2000000"
              />
              <MoneyAmountHint value={budgetInput} currency={currency} />
            </div>
            <div className={styles.modalActions}>
              <button className={styles.btnSecondary} onClick={() => setShowBudgetModal(false)}>Cancelar</button>
              <button className={styles.btnPrimary} onClick={submitBudget}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
