import { useState, useMemo } from 'react';
import { useGame } from '../../context/GameContext';
import { formatMoney, wageBill, runwayMonths, newLedgerEntry, ledgerEntryTypeLabel } from '../../utils/finance';
import { competitionNames } from '../../utils/competitions';
import type { Currency, LedgerEntryType } from '../../types/Finance';
import { CURRENCIES, currencyLabel } from '../../types/Finance';
import { POSITION_LABELS } from '../../utils/matchEvents';
import styles from './Finance.module.css';

type Tab = 'overview' | 'ledger' | 'wages' | 'prizes';

type LedgerFilter = 'all' | 'income' | 'expense' | 'transfer' | 'wage';

const INCOME_TYPES: LedgerEntryType[] = ['prize', 'transfer_fee', 'loan_fee', 'sponsor', 'other_in'];
const EXPENSE_TYPES: LedgerEntryType[] = ['wage', 'other_out', 'adjustment'];
const TRANSFER_TYPES: LedgerEntryType[] = ['transfer_fee', 'loan_fee'];

export default function Finance() {
  const { state, applyLedger, payWages, setPrizeTable, updatePlayer, updateFinance } = useGame();
  const { finance, players, season, seasonCompetitions } = state;

  const [tab, setTab] = useState<Tab>('overview');
  const [ledgerFilter, setLedgerFilter] = useState<LedgerFilter>('all');
  const [showAdjust, setShowAdjust] = useState(false);

  // Adjustment modal state
  const [adjLabel, setAdjLabel] = useState('');
  const [adjAmount, setAdjAmount] = useState('');
  const [adjType, setAdjType] = useState<'in' | 'out'>('in');
  const [adjCategory, setAdjCategory] = useState<LedgerEntryType>('other_in');

  // Wage inline edit
  const [editingWage, setEditingWage] = useState<string | null>(null);
  const [wageInput, setWageInput] = useState('');

  const bill = useMemo(() => wageBill(players), [players]);
  const runway = useMemo(() => runwayMonths(finance, players), [finance, players]);

  const seasonIncome = useMemo(() =>
    finance.ledger
      .filter(e => e.season === season && e.amount > 0)
      .reduce((s, e) => s + e.amount, 0),
    [finance.ledger, season],
  );

  const seasonExpense = useMemo(() =>
    finance.ledger
      .filter(e => e.season === season && e.amount < 0)
      .reduce((s, e) => s + e.amount, 0),
    [finance.ledger, season],
  );

  const filteredLedger = useMemo(() => {
    return finance.ledger.filter(e => {
      if (ledgerFilter === 'all') return true;
      if (ledgerFilter === 'income') return INCOME_TYPES.includes(e.type);
      if (ledgerFilter === 'expense') return EXPENSE_TYPES.includes(e.type);
      if (ledgerFilter === 'transfer') return TRANSFER_TYPES.includes(e.type);
      if (ledgerFilter === 'wage') return e.type === 'wage';
      return true;
    });
  }, [finance.ledger, ledgerFilter]);

  const sortedPlayers = useMemo(() =>
    [...players].sort((a, b) => (b.salary ?? 0) - (a.salary ?? 0)),
    [players],
  );

  function handleAdjust() {
    const amt = parseFloat(adjAmount.replace(',', '.'));
    if (!adjLabel.trim() || isNaN(amt) || amt <= 0) return;
    const signed = adjType === 'in' ? amt : -amt;
    const category: LedgerEntryType = adjType === 'in'
      ? (adjCategory as LedgerEntryType) ?? 'other_in'
      : (adjCategory as LedgerEntryType) ?? 'other_out';
    applyLedger(newLedgerEntry(category, signed, adjLabel.trim(), season));
    setAdjLabel('');
    setAdjAmount('');
    setAdjType('in');
    setShowAdjust(false);
  }

  function startWageEdit(playerId: string, currentSalary: number) {
    setEditingWage(playerId);
    setWageInput(String(currentSalary));
  }

  function saveWageEdit(playerId: string) {
    const v = parseInt(wageInput.replace(/\D/g, ''), 10);
    if (!isNaN(v) && v >= 0) {
      updatePlayer(playerId, { salary: v });
    }
    setEditingWage(null);
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1>Financeiro</h1>
          <p>Temporada {season}</p>
        </div>
        {tab === 'overview' && (
          <button className={styles.btnPrimary} onClick={() => setShowAdjust(true)}>
            + Lançamento
          </button>
        )}
        {tab === 'wages' && (
          <button className={styles.btnDanger} onClick={payWages}>
            Pagar folha
          </button>
        )}
      </div>

      <div className={styles.tabs}>
        {([
          ['overview', 'Visão geral'],
          ['ledger', 'Extrato'],
          ['wages', 'Folha salarial'],
          ['prizes', 'Premiações'],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            className={`${styles.tab} ${tab === key ? styles.tabActive : ''}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <OverviewTab
          finance={finance}
          bill={bill}
          runway={runway}
          seasonIncome={seasonIncome}
          seasonExpense={seasonExpense}
          onAddEntry={() => setShowAdjust(true)}
          onCurrencyChange={(currency: Currency) => updateFinance({ currency })}
        />
      )}

      {tab === 'ledger' && (
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
          {filteredLedger.length === 0 ? (
            <div className={styles.emptyState}>Nenhum lançamento {ledgerFilter !== 'all' ? 'nessa categoria' : 'ainda'}.</div>
          ) : (
            <ul className={styles.ledgerList} style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: 'var(--card-bg)' }}>
              {filteredLedger.map(entry => (
                <li key={entry.id} className={styles.ledgerRow}>
                  <div className={styles.ledgerMeta}>
                    <span className={styles.ledgerLabel}>{entry.label}</span>
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
      )}

      {tab === 'wages' && (
        <WagesTab
          players={sortedPlayers}
          bill={bill}
          currency={finance.currency}
          editingWage={editingWage}
          wageInput={wageInput}
          onEditStart={startWageEdit}
          onWageInputChange={setWageInput}
          onEditSave={saveWageEdit}
          onEditCancel={() => setEditingWage(null)}
        />
      )}

      {tab === 'prizes' && (
        <PrizesTab
          competitions={competitionNames(seasonCompetitions)}
          prizeTable={finance.prizeTable}
          currency={finance.currency}
          onSet={setPrizeTable}
        />
      )}

      {showAdjust && (
        <div className={styles.overlay} onClick={() => setShowAdjust(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <p className={styles.modalTitle}>Novo lançamento</p>

            <div className={styles.formGroup}>
              <span className={styles.formLabel}>Tipo</span>
              <div className={styles.formTypeRow}>
                <button
                  className={`${styles.typeBtn} ${styles.typeBtnIn} ${adjType === 'in' ? styles.active : ''}`}
                  onClick={() => { setAdjType('in'); setAdjCategory('other_in'); }}
                >
                  + Receita
                </button>
                <button
                  className={`${styles.typeBtn} ${styles.typeBtnOut} ${adjType === 'out' ? styles.active : ''}`}
                  onClick={() => { setAdjType('out'); setAdjCategory('other_out'); }}
                >
                  − Despesa
                </button>
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Categoria</label>
              <select
                className={styles.formSelect}
                value={adjCategory}
                onChange={e => setAdjCategory(e.target.value as LedgerEntryType)}
              >
                {adjType === 'in'
                  ? INCOME_TYPES.map(t => <option key={t} value={t}>{ledgerEntryTypeLabel(t)}</option>)
                  : EXPENSE_TYPES.filter(t => t !== 'wage').map(t => <option key={t} value={t}>{ledgerEntryTypeLabel(t)}</option>)
                }
              </select>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Descrição</label>
              <input
                className={styles.formInput}
                value={adjLabel}
                onChange={e => setAdjLabel(e.target.value)}
                placeholder="Ex: Patrocinador novo, Multa..."
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Valor</label>
              <input
                className={styles.formInput}
                value={adjAmount}
                onChange={e => setAdjAmount(e.target.value)}
                placeholder="Ex: 500000"
                type="number"
                min={0}
              />
            </div>

            <div className={styles.modalActions}>
              <button className={styles.btnSecondary} onClick={() => setShowAdjust(false)}>Cancelar</button>
              <button className={styles.btnPrimary} onClick={handleAdjust}>Registrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function OverviewTab({
  finance, bill, runway, seasonIncome, seasonExpense, onAddEntry, onCurrencyChange,
}: {
  finance: ReturnType<typeof useGame>['state']['finance'];
  bill: number;
  runway: number;
  seasonIncome: number;
  seasonExpense: number;
  onAddEntry: () => void;
  onCurrencyChange: (currency: Currency) => void;
}) {
  const recentLedger = finance.ledger.slice(0, 8);

  return (
    <>
      <div className={styles.heroCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <p className={styles.heroLabel}>Caixa atual</p>
            <p className={`${styles.heroAmount} ${finance.balance < 0 ? styles.negative : ''}`}>
              {formatMoney(finance.balance, finance.currency)}
            </p>
          </div>
          <div className={styles.formGroup} style={{ minWidth: 160 }}>
            <label className={styles.formLabel}>Moeda</label>
            <select
              className={styles.formSelect}
              value={finance.currency}
              onChange={e => onCurrencyChange(e.target.value as Currency)}
            >
              {CURRENCIES.map(c => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className={styles.heroMeta}>
          <div className={styles.heroMetaItem}>
            <span className={styles.heroMetaLabel}>Folha / mês</span>
            <span className={styles.heroMetaVal}>{formatMoney(bill, finance.currency)}</span>
          </div>
          <div className={styles.heroMetaItem}>
            <span className={styles.heroMetaLabel}>Runway</span>
            <span className={`${styles.heroMetaVal} ${runway <= 3 ? styles.danger : ''}`}>
              {runway === Infinity ? '∞' : `${runway} mês${runway !== 1 ? 'es' : ''}`}
            </span>
          </div>
          <div className={styles.heroMetaItem}>
            <span className={styles.heroMetaLabel}>Receita temporada</span>
            <span className={styles.heroMetaVal}>{formatMoney(seasonIncome, finance.currency)}</span>
          </div>
          <div className={styles.heroMetaItem}>
            <span className={styles.heroMetaLabel}>Despesas temporada</span>
            <span className={styles.heroMetaVal}>{formatMoney(Math.abs(seasonExpense), finance.currency)}</span>
          </div>
        </div>
      </div>

      <div>
        <div className={styles.sectionHead}>
          <h3 className={styles.sectionTitle}>Últimos lançamentos</h3>
          <button className={styles.btnSecondary} onClick={onAddEntry}>+ Lançamento</button>
        </div>
        {recentLedger.length === 0 ? (
          <div className={styles.emptyState}>Nenhum lançamento ainda. Registre premiações, patrocínios ou despesas.</div>
        ) : (
          <ul className={styles.ledgerList} style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: 'var(--card-bg)' }}>
            {recentLedger.map(entry => (
              <li key={entry.id} className={styles.ledgerRow}>
                <div className={styles.ledgerMeta}>
                  <span className={styles.ledgerLabel}>{entry.label}</span>
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
      </div>
    </>
  );
}

function WagesTab({
  players, bill, currency, editingWage, wageInput,
  onEditStart, onWageInputChange, onEditSave, onEditCancel,
}: {
  players: ReturnType<typeof useGame>['state']['players'];
  bill: number;
  currency: ReturnType<typeof useGame>['state']['finance']['currency'];
  editingWage: string | null;
  wageInput: string;
  onEditStart: (id: string, salary: number) => void;
  onWageInputChange: (v: string) => void;
  onEditSave: (id: string) => void;
  onEditCancel: () => void;
}) {
  return (
    <div className={styles.wageTable}>
      <div className={`${styles.wageRow} ${styles.wageHeader}`}>
        <span>#</span>
        <span>Jogador</span>
        <span>Pos.</span>
        <span style={{ textAlign: 'right' }}>Salário</span>
        <span />
      </div>
      {players.map(p => (
        <div key={p.id} className={styles.wageRow}>
          <span className={styles.wageNum}>{p.number ?? '—'}</span>
          <span className={styles.wageName}>{p.name}</span>
          <span className={styles.wagePos}>{POSITION_LABELS[p.position] ?? p.position}</span>
          {editingWage === p.id ? (
            <input
              className={styles.prizeInput}
              value={wageInput}
              onChange={e => onWageInputChange(e.target.value)}
              type="number"
              min={0}
              autoFocus
              onBlur={() => onEditSave(p.id)}
              onKeyDown={e => { if (e.key === 'Enter') onEditSave(p.id); if (e.key === 'Escape') onEditCancel(); }}
            />
          ) : (
            <span className={styles.wageVal}>{formatMoney(p.salary ?? 0, currency)}</span>
          )}
          <button
            className={styles.wageEdit}
            onClick={() => editingWage === p.id ? onEditSave(p.id) : onEditStart(p.id, p.salary ?? 0)}
          >
            {editingWage === p.id ? '✓' : 'Editar'}
          </button>
        </div>
      ))}
      <div className={styles.wageTotRow}>
        <span>Total mensal</span>
        <span>{formatMoney(bill, currency)}</span>
      </div>
    </div>
  );
}

function PrizesTab({
  competitions, prizeTable, currency, onSet,
}: {
  competitions: string[];
  prizeTable: ReturnType<typeof useGame>['state']['finance']['prizeTable'];
  currency: ReturnType<typeof useGame>['state']['finance']['currency'];
  onSet: (competition: string, prize: { win?: number; draw?: number; knockout?: number; champion?: number }) => void;
}) {
  function updateField(comp: string, field: 'win' | 'draw' | 'knockout' | 'champion', raw: string) {
    const v = parseInt(raw.replace(/\D/g, ''), 10);
    onSet(comp, { ...prizeTable[comp], [field]: isNaN(v) ? undefined : v });
  }

  const comps = competitions.length > 0 ? competitions : Object.keys(prizeTable);

  return (
    <div className={styles.prizeTable}>
      <div className={`${styles.prizeRow} ${styles.prizeHeader}`}>
        <span>Competição</span>
        <span style={{ textAlign: 'center' }}>Vitória</span>
        <span style={{ textAlign: 'center' }}>Empate</span>
        <span style={{ textAlign: 'center' }}>Eliminat.</span>
        <span style={{ textAlign: 'center' }}>Campeão</span>
        <span />
      </div>
      {comps.length === 0 ? (
        <div className={styles.emptyState}>Adicione competições na seção Competições para configurar premiações.</div>
      ) : (
        comps.map(comp => {
          const p = prizeTable[comp] ?? {};
          return (
            <div key={comp} className={styles.prizeRow}>
              <span className={styles.prizeComp} title={comp}>{comp}</span>
              {(['win', 'draw', 'knockout', 'champion'] as const).map(field => (
                <input
                  key={field}
                  className={styles.prizeInput}
                  value={p[field] ?? ''}
                  onChange={e => updateField(comp, field, e.target.value)}
                  placeholder="—"
                  type="number"
                  min={0}
                />
              ))}
              <button
                className={styles.prizeRemove}
                onClick={() => onSet(comp, {})}
                title="Limpar premiação"
              >
                ×
              </button>
            </div>
          );
        })
      )}
      {comps.length > 0 && (
        <div className={styles.wageTotRow} style={{ fontSize: 11, color: 'var(--text)' }}>
          Valores em {currencyLabel(currency)} por ocorrência
        </div>
      )}
    </div>
  );
}
