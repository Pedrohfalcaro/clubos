import { useMemo, useState } from 'react';
import styles from './SearchableSelect.module.css';

interface Option {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Buscar jogador...',
  disabled,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = options.find(o => o.value === value);
  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return options.filter(o => o.label.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.trigger}
        disabled={disabled}
        onClick={() => setOpen(v => !v)}
      >
        {selected?.label ?? placeholder}
        <span className={styles.chevron}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className={styles.dropdown}>
          <input
            className={styles.search}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Digite para buscar..."
            autoFocus
          />
          <ul className={styles.list}>
            {filtered.map(o => (
              <li key={o.value}>
                <button
                  type="button"
                  className={`${styles.option} ${value === o.value ? styles.optionActive : ''}`}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                    setQuery('');
                  }}
                >
                  {o.label}
                </button>
              </li>
            ))}
            {filtered.length === 0 && <li className={styles.empty}>Nenhum resultado</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
