import type { Currency } from '../../types/Finance';
import { moneyAmountHint } from '../../utils/moneyInWords';
import styles from './MoneyAmountHint.module.css';

interface MoneyAmountHintProps {
  value: string | number | null | undefined;
  currency?: Currency;
  /** Sufixo curto após o valor formatado, ex.: "/mês". */
  suffix?: string;
  className?: string;
}

/** Label sob campos de valor: cifra completa + por extenso. */
export default function MoneyAmountHint({
  value,
  currency = 'BRL',
  suffix,
  className,
}: MoneyAmountHintProps) {
  const hint = moneyAmountHint(value, currency);
  if (!hint) return null;

  const text = suffix ? hint.replace(' · ', `${suffix} · `) : hint;

  return (
    <span className={[styles.hint, className].filter(Boolean).join(' ')} aria-live="polite">
      {text}
    </span>
  );
}
