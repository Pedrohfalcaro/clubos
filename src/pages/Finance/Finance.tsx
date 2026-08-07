import { useState, useMemo } from 'react';
import { useGame } from '../../context/GameContext';
import { formatMoney, wageBill, runwayMonths, newLedgerEntry, ledgerEntryTypeLabel, isStadiumConfigured, normalizeStadiumConfig } from '../../utils/finance';
import { competitionNames } from '../../utils/competitions';
import type {
  Currency,
  LedgerEntryType,
  SponsorBonusKind,
  SponsorTier,
  StadiumConfig,
} from '../../types/Finance';
import { currencyLabel, createDefaultStadiumConfig } from '../../types/Finance';
import { POSITION_LABELS } from '../../utils/matchEvents';
import { calcLoanTotal } from '../../utils/clubLoans';
import { totalDebtRemaining } from '../../utils/clubDebts';
import { hasActiveTier, sponsorTierLabel } from '../../utils/sponsors';
import { buildInstallmentDates, splitInstallmentAmounts } from '../../utils/transferPayments';
import MoneyAmountHint from '../../components/MoneyAmountHint/MoneyAmountHint';
import FinanceHeader, { type Period } from '../../components/Finance/FinanceHeader';
import FinanceOverviewTab from '../../components/Finance/FinanceOverviewTab';
import FinanceLedgerTab from '../../components/Finance/FinanceLedgerTab';
import styles from './Finance.module.css';

type Tab =
  | 'overview'
  | 'ledger'
  | 'wages'
  | 'loans'
  | 'debts'
  | 'sponsors'
  | 'prizes'
  | 'stadium';

const INCOME_TYPES: LedgerEntryType[] = ['prize', 'transfer_fee', 'loan_fee', 'loan_credit', 'sponsor', 'other_in', 'ticket'];
const EXPENSE_TYPES: LedgerEntryType[] = ['wage', 'other_out', 'adjustment', 'travel', 'stadium_ops', 'loan_repay', 'debt_repay'];

export default function Finance() {
  const {
    state,
    applyLedger,
    payWages,
    setPrizeTable,
    updatePlayer,
    updateFinance,
    setMonthlyBudget,
    takeClubLoan,
    addClubDebt,
    payClubDebt,
    addClubSponsor,
    renewClubSponsor,
    terminateClubSponsor,
  } = useGame();
  const { finance, players, season, seasonCompetitions, currentDate, manager, team } = state;

  const [tab, setTab] = useState<Tab>('overview');
  const [period, setPeriod] = useState<Period>('month');
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
  const debtTotal = useMemo(() => totalDebtRemaining(finance.debts), [finance.debts]);

  const sortedPlayers = useMemo(() =>
    [...players].sort((a, b) => (b.salary ?? 0) - (a.salary ?? 0)),
    [players],
  );

  const greeting = manager?.name
    ? `Olá, ${manager.name}. Seu dinheiro em um só lugar.`
    : team?.name
      ? `Saúde financeira do ${team.name} sob controle.`
      : 'Seu dinheiro em um só lugar.';

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
      <FinanceHeader
        greeting={greeting}
        season={season}
        period={period}
        onPeriodChange={setPeriod}
        onAddEntry={() => setShowAdjust(true)}
        onRequestLoan={() => setTab('loans')}
        currentBudget={finance.monthlyBudget?.targetExpenseLimit}
        currency={finance.currency}
        onSetBudget={setMonthlyBudget}
        showPayWages={tab === 'wages'}
        onPayWages={payWages}
      />

      <div className={styles.tabs}>
        {([
          ['overview', 'Visão geral'],
          ['ledger', 'Extrato'],
          ['wages', 'Folha salarial'],
          ['loans', 'Empréstimos'],
          ['debts', 'Dívidas'],
          ['sponsors', 'Patrocínios'],
          ['prizes', 'Premiações'],
          ['stadium', 'Estádio'],
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
        <FinanceOverviewTab
          finance={finance}
          players={players}
          bill={bill}
          runway={runway}
          debtTotal={debtTotal}
          season={season}
          currentDate={currentDate}
          period={period}
          onAddEntry={() => setShowAdjust(true)}
          onCurrencyChange={(currency: Currency) => updateFinance({ currency })}
        />
      )}

      {tab === 'ledger' && <FinanceLedgerTab finance={finance} />}

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

      {tab === 'loans' && (
        <LoansTab
          finance={finance}
          currentDate={currentDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10)}
          onTakeLoan={takeClubLoan}
        />
      )}

      {tab === 'debts' && (
        <DebtsTab
          finance={finance}
          onAddDebt={addClubDebt}
          onPayDebt={payClubDebt}
        />
      )}

      {tab === 'sponsors' && (
        <SponsorsTab
          finance={finance}
          competitions={competitionNames(seasonCompetitions)}
          onAdd={addClubSponsor}
          onRenew={renewClubSponsor}
          onTerminate={terminateClubSponsor}
        />
      )}

      {tab === 'stadium' && (
        <StadiumTab
          config={finance.stadiumConfig}
          currency={finance.currency}
          onSave={cfg => updateFinance({ stadiumConfig: cfg })}
          onClear={() => updateFinance({ stadiumConfig: undefined })}
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
              <MoneyAmountHint value={adjAmount} currency={finance.currency} />
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

function StadiumTab({
  config,
  currency,
  onSave,
  onClear,
}: {
  config: StadiumConfig | undefined;
  currency: Currency;
  onSave: (cfg: StadiumConfig) => void;
  onClear: () => void;
}) {
  const defaults = createDefaultStadiumConfig(currency);
  const [draft, setDraft] = useState<StadiumConfig>(() =>
    normalizeStadiumConfig(config ?? defaults, currency),
  );
  const configured = isStadiumConfigured(config);

  function setField(key: keyof StadiumConfig, raw: string) {
    const v = parseInt(raw.replace(/\D/g, ''), 10);
    setDraft(prev => ({ ...prev, [key]: isNaN(v) ? 0 : v }));
  }

  function handleSave() {
    onSave(normalizeStadiumConfig(draft, currency));
  }

  function handleEnableDefaults() {
    setDraft(defaults);
    onSave(defaults);
  }

  return (
    <div className={styles.stadiumCard}>
      <p className={styles.stadiumIntro}>
        Parâmetros usados na bilheteria automática após cada partida.
        Sem estádio configurado, nenhum lançamento de ticket é gerado.
      </p>
      {!configured && (
        <button type="button" className={styles.btnPrimary} onClick={handleEnableDefaults}>
          Usar valores padrão
        </button>
      )}
      <div className={styles.stadiumGrid}>
        {([
          ['capacity', 'Capacidade', 'lugares'],
          ['ticketPriceHome', 'Ingresso casa / neutro', currencyLabel(currency)],
          ['ticketPriceAway', 'Ingresso cota visitante', currencyLabel(currency)],
          ['maintenanceCostPerMatch', 'Custo operação (casa)', currencyLabel(currency)],
          ['travelCostAverage', 'Custo viagem (fora/neutro)', currencyLabel(currency)],
        ] as [keyof StadiumConfig, string, string][]).map(([key, label, unit]) => (
          <div key={key} className={styles.formGroup}>
            <label className={styles.formLabel}>{label}</label>
            <input
              className={styles.formInput}
              type="number"
              min={0}
              value={draft[key] || ''}
              onChange={e => setField(key, e.target.value)}
              placeholder={String(defaults[key])}
            />
            <span className={styles.stadiumUnit}>{unit}</span>
          </div>
        ))}
      </div>
      <div className={styles.modalActions} style={{ justifyContent: 'space-between' }}>
        <button
          type="button"
          className={styles.btnSecondary}
          onClick={onClear}
          disabled={!config}
        >
          Desativar bilheteria
        </button>
        <button type="button" className={styles.btnPrimary} onClick={handleSave}>
          Salvar estádio
        </button>
      </div>
    </div>
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

function LoansTab({
  finance,
  currentDate,
  onTakeLoan,
}: {
  finance: ReturnType<typeof useGame>['state']['finance'];
  currentDate: string;
  onTakeLoan: (input: {
    principal: number;
    interestRatePercent: number;
    installmentCount: number;
    firstPaymentDate: string;
    notes?: string;
  }) => void;
}) {
  const [principal, setPrincipal] = useState('1000000');
  const [interest, setInterest] = useState('12');
  const [installments, setInstallments] = useState('6');
  const [firstDate, setFirstDate] = useState(currentDate);
  const [notes, setNotes] = useState('');

  const principalN = Math.max(0, Math.round(parseFloat(principal.replace(',', '.')) || 0));
  const interestN = Math.max(0.5, parseFloat(interest.replace(',', '.')) || 0.5);
  const countN = Math.max(1, parseInt(installments, 10) || 1);
  const total = principalN > 0 ? calcLoanTotal(principalN, interestN) : 0;
  const preview = useMemo(() => {
    if (principalN <= 0) return [];
    const dates = buildInstallmentDates(firstDate, countN);
    const amounts = splitInstallmentAmounts(total, countN);
    return dates.map((d, i) => ({ date: d, amount: amounts[i] ?? 0 }));
  }, [principalN, firstDate, countN, total]);

  const activeLoans = (finance.loans ?? []).filter(l => l.status === 'active');
  const pendingPays = (finance.loanPayments ?? []).filter(p => p.status === 'pending');

  function submit() {
    if (principalN < 1) return;
    onTakeLoan({
      principal: principalN,
      interestRatePercent: interestN,
      installmentCount: countN,
      firstPaymentDate: firstDate,
      notes: notes.trim() || undefined,
    });
    setNotes('');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className={styles.heroCard}>
        <p className={styles.heroLabel}>Novo empréstimo</p>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text)' }}>
          Crédito entra no caixa agora. Sempre há juros. As parcelas vão para o calendário e
          só saem do caixa no dia (popup ao avançar). No dia 5, se o caixa não cobrir a folha,
          o Dashboard oferece um empréstimo-ponte automático (120% da folha).
        </p>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Valor do crédito</label>
          <input
            className={styles.formInput}
            type="number"
            min={1}
            value={principal}
            onChange={e => setPrincipal(e.target.value)}
          />
          <MoneyAmountHint value={principal} currency={finance.currency} />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Juros totais (%)</label>
          <input
            className={styles.formInput}
            type="number"
            min={0.5}
            step={0.5}
            value={interest}
            onChange={e => setInterest(e.target.value)}
          />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Nº de parcelas</label>
          <input
            className={styles.formInput}
            type="number"
            min={1}
            max={36}
            value={installments}
            onChange={e => setInstallments(e.target.value)}
          />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>1ª parcela / vencimento</label>
          <input
            className={styles.formInput}
            type="date"
            value={firstDate}
            onChange={e => setFirstDate(e.target.value)}
          />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Notas (opcional)</label>
          <input
            className={styles.formInput}
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>
        {principalN > 0 && (
          <div style={{ marginBottom: 12, fontSize: 13 }}>
            <strong>Total a devolver:</strong>{' '}
            {formatMoney(total, finance.currency)}{' '}
            <span style={{ color: 'var(--text)' }}>
              (juros {formatMoney(total - principalN, finance.currency)})
            </span>
            <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
              {preview.map((p, i) => (
                <li key={p.date + i}>
                  {p.date} · {i + 1}/{preview.length} · {formatMoney(-p.amount, finance.currency)}
                </li>
              ))}
            </ul>
          </div>
        )}
        <button
          type="button"
          className={styles.btnPrimary}
          onClick={submit}
          disabled={principalN < 1}
        >
          Contratar empréstimo
        </button>
      </div>

      <div className={styles.heroCard}>
        <p className={styles.heroLabel}>Empréstimos ativos</p>
        {activeLoans.length === 0 ? (
          <div className={styles.emptyState}>Nenhum empréstimo ativo.</div>
        ) : (
          <ul className={styles.ledgerList} style={{ margin: 0 }}>
            {activeLoans.map(l => {
              const left = pendingPays
                .filter(p => p.loanId === l.id)
                .reduce((s, p) => s + p.amount, 0);
              return (
                <li key={l.id} className={styles.ledgerRow}>
                  <div className={styles.ledgerMeta}>
                    <span className={styles.ledgerLabel}>
                      {formatMoney(l.principal, finance.currency)} · {l.interestRate}% juros
                    </span>
                    <span className={styles.ledgerSub}>
                      {l.installmentCount} parcela(s) · desde {l.createdAt}
                      {l.notes ? ` · ${l.notes}` : ''}
                    </span>
                  </div>
                  <span className={`${styles.ledgerAmount} ${styles.expense}`}>
                    resta {formatMoney(left, finance.currency)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className={styles.heroCard}>
        <p className={styles.heroLabel}>Parcelas pendentes</p>
        {pendingPays.length === 0 ? (
          <div className={styles.emptyState}>Nenhuma parcela no calendário.</div>
        ) : (
          <ul className={styles.ledgerList} style={{ margin: 0 }}>
            {[...pendingPays]
              .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
              .map(p => (
                <li key={p.id} className={styles.ledgerRow}>
                  <div className={styles.ledgerMeta}>
                    <span className={styles.ledgerLabel}>{p.label}</span>
                    <span className={styles.ledgerSub}>vence {p.dueDate}</span>
                  </div>
                  <span className={`${styles.ledgerAmount} ${styles.expense}`}>
                    {formatMoney(-p.amount, finance.currency)}
                  </span>
                </li>
              ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function DebtsTab({
  finance,
  onAddDebt,
  onPayDebt,
}: {
  finance: ReturnType<typeof useGame>['state']['finance'];
  onAddDebt: (input: {
    amount: number;
    monthlyInstallment: number;
    paymentDay: number;
    label?: string;
  }) => void;
  onPayDebt: (debtId: string, amount: number, asMonthlyInstallment?: boolean) => void;
}) {
  const [label, setLabel] = useState('Dívida do clube');
  const [amount, setAmount] = useState('');
  const [installments, setInstallments] = useState('12');
  const [paymentDay, setPaymentDay] = useState('5');
  const [payInputs, setPayInputs] = useState<Record<string, string>>({});

  const active = (finance.debts ?? []).filter(d => d.status === 'active' && d.remaining > 0);
  const paid = (finance.debts ?? []).filter(d => d.status === 'paid');

  const amountN = Math.round(parseFloat(amount.replace(',', '.')) || 0);
  const installmentsN = Math.max(1, Math.min(120, parseInt(installments, 10) || 0));
  const monthlyPreview =
    amountN >= 1 && installmentsN >= 1
      ? Math.max(1, Math.round(amountN / installmentsN))
      : 0;

  function submitNew() {
    if (amountN < 1 || installmentsN < 1 || monthlyPreview < 1) return;
    const day = Math.round(parseFloat(paymentDay) || 5);
    onAddDebt({
      amount: amountN,
      monthlyInstallment: monthlyPreview,
      paymentDay: day,
      label: label.trim() || 'Dívida do clube',
    });
    setAmount('');
    setInstallments('12');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className={styles.heroCard}>
        <p className={styles.heroLabel}>Nova dívida</p>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text)' }}>
          Parcela mensal obrigatória no dia escolhido (aparece no calendário). Ignorar no
          Dashboard aplica juros; aqui você também pode amortizar qualquer valor.
        </p>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Descrição</label>
          <input
            className={styles.formInput}
            value={label}
            onChange={e => setLabel(e.target.value)}
          />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Valor</label>
          <input
            className={styles.formInput}
            type="number"
            min={1}
            value={amount}
            onChange={e => setAmount(e.target.value)}
          />
          <MoneyAmountHint value={amount} currency={finance.currency} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Nº de parcelas *</label>
            <input
              className={styles.formInput}
              type="number"
              min={1}
              max={120}
              value={installments}
              onChange={e => setInstallments(e.target.value)}
              required
            />
            {monthlyPreview > 0 && (
              <MoneyAmountHint value={monthlyPreview} currency={finance.currency} suffix="/mês" />
            )}
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Dia da parcela (1–28)</label>
            <input
              className={styles.formInput}
              type="number"
              min={1}
              max={28}
              value={paymentDay}
              onChange={e => setPaymentDay(e.target.value)}
            />
          </div>
        </div>
        <button
          type="button"
          className={styles.btnPrimary}
          onClick={submitNew}
          disabled={amountN < 1 || installmentsN < 1}
        >
          Registrar dívida
        </button>
      </div>

      <div className={styles.heroCard}>
        <p className={styles.heroLabel}>Dívidas ativas</p>
        {active.length === 0 ? (
          <div className={styles.emptyState}>Nenhuma dívida ativa.</div>
        ) : (
          <ul className={styles.ledgerList} style={{ margin: 0 }}>
            {active.map(d => {
              const payRaw = payInputs[d.id] ?? '';
              const payN = Math.round(parseFloat(payRaw.replace(',', '.')) || 0);
              return (
                <li
                  key={d.id}
                  className={styles.ledgerRow}
                  style={{ flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}
                >
                  <div className={styles.ledgerMeta} style={{ flex: 1, minWidth: 160 }}>
                    <span className={styles.ledgerLabel}>{d.label}</span>
                    <span className={styles.ledgerSub}>
                      original {formatMoney(d.principal, finance.currency)}
                      {` · parcela ${formatMoney(d.monthlyInstallment, finance.currency)} dia ${d.paymentDay}`}
                      {(d.accruedInterest ?? 0) > 0
                        ? ` · juros acum. ${formatMoney(d.accruedInterest ?? 0, finance.currency)}`
                        : ''}
                      {d.source === 'wage_overdraft' ? ' · folha' : ''}
                    </span>
                  </div>
                  <span className={`${styles.ledgerAmount} ${styles.expense}`}>
                    resta {formatMoney(d.remaining, finance.currency)}
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%' }}>
                      <input
                        className={styles.formInput}
                        type="number"
                        min={1}
                        max={d.remaining}
                        placeholder="Valor a pagar"
                        value={payRaw}
                        onChange={e =>
                          setPayInputs(prev => ({ ...prev, [d.id]: e.target.value }))
                        }
                        style={{ flex: 1 }}
                      />
                      <button
                        type="button"
                        className={styles.btnDanger}
                        disabled={payN < 1}
                        onClick={() => {
                          onPayDebt(d.id, payN);
                          setPayInputs(prev => ({ ...prev, [d.id]: '' }));
                        }}
                      >
                        Amortizar
                      </button>
                      <button
                        type="button"
                        className={styles.btnSecondary}
                        onClick={() => onPayDebt(d.id, d.remaining)}
                      >
                        Quitar
                      </button>
                    </div>
                    <MoneyAmountHint value={payRaw} currency={finance.currency} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {paid.length > 0 && (
        <div className={styles.heroCard}>
          <p className={styles.heroLabel}>Quitadas</p>
          <ul className={styles.ledgerList} style={{ margin: 0 }}>
            {paid.slice(0, 8).map(d => (
              <li key={d.id} className={styles.ledgerRow}>
                <div className={styles.ledgerMeta}>
                  <span className={styles.ledgerLabel}>{d.label}</span>
                  <span className={styles.ledgerSub}>
                    {formatMoney(d.principal, finance.currency)} · {d.createdAt}
                  </span>
                </div>
                <span className={`${styles.ledgerAmount} ${styles.income}`}>Quitada</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const BONUS_KIND_LABEL: Record<SponsorBonusKind, string> = {
  league_position: 'Classificação',
  title: 'Título',
  club_top_scorer: 'Artilheiro do clube',
};

function SponsorsTab({
  finance,
  competitions,
  onAdd,
  onRenew,
  onTerminate,
}: {
  finance: ReturnType<typeof useGame>['state']['finance'];
  competitions: string[];
  onAdd: (input: {
    brand: string;
    tier: SponsorTier;
    monthlyFee: number;
    seasons: number;
    paymentDay: number;
    minLeaguePosition?: number;
    terminationFee?: number;
    bonuses?: { kind: SponsorBonusKind; amount: number; threshold?: number; competition?: string }[];
  }) => boolean;
  onRenew: (id: string, extra?: number) => void;
  onTerminate: (id: string) => void;
}) {
  const [brand, setBrand] = useState('');
  const [tier, setTier] = useState<SponsorTier>('master');
  const [monthly, setMonthly] = useState('500000');
  const [seasons, setSeasons] = useState('2');
  const [paymentDay, setPaymentDay] = useState('5');
  const [minPos, setMinPos] = useState('14');
  const [termFee, setTermFee] = useState('2000000');
  const [bonusKind, setBonusKind] = useState<SponsorBonusKind>('league_position');
  const [bonusAmount, setBonusAmount] = useState('1000000');
  const [bonusThreshold, setBonusThreshold] = useState('4');
  const [bonusComp, setBonusComp] = useState('');
  const [bonuses, setBonuses] = useState<
    { kind: SponsorBonusKind; amount: number; threshold?: number; competition?: string }[]
  >([]);
  const [error, setError] = useState('');

  const list = finance.sponsors ?? [];
  const active = list.filter(s => s.status === 'active');
  const others = list.filter(s => s.status !== 'active');

  function addBonus() {
    const amt = Math.round(parseFloat(bonusAmount.replace(',', '.')) || 0);
    if (amt < 1) return;
    const th = Math.round(parseFloat(bonusThreshold.replace(',', '.')) || 0);
    setBonuses(prev => [
      ...prev,
      {
        kind: bonusKind,
        amount: amt,
        threshold:
          bonusKind === 'title' ? undefined : th > 0 ? th : undefined,
        competition:
          bonusKind === 'title' && bonusComp.trim() ? bonusComp.trim() : undefined,
      },
    ]);
  }

  function submit() {
    setError('');
    if (hasActiveTier(finance.sponsors, tier)) {
      setError(`Já existe um patrocínio ${sponsorTierLabel(tier)} ativo.`);
      return;
    }
    const ok = onAdd({
      brand: brand.trim() || `Patrocínio ${sponsorTierLabel(tier)}`,
      tier,
      monthlyFee: Math.round(parseFloat(monthly.replace(',', '.')) || 0),
      seasons: Math.max(1, parseInt(seasons, 10) || 1),
      paymentDay: Math.round(parseFloat(paymentDay) || 5),
      minLeaguePosition: Math.round(parseFloat(minPos.replace(',', '.')) || 0) || undefined,
      terminationFee: Math.round(parseFloat(termFee.replace(',', '.')) || 0),
      bonuses,
    });
    if (!ok) {
      setError(`Já existe um patrocínio ${sponsorTierLabel(tier)} ativo.`);
      return;
    }
    setBrand('');
    setBonuses([]);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className={styles.heroCard}>
        <p className={styles.heroLabel}>Novo contrato</p>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text)' }}>
          Master e Manga: um de cada ativo. Cota no dia escolhido (aparece no calendário). Bônus e
          rescisão ao avançar a temporada.
        </p>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Marca</label>
          <input
            className={styles.formInput}
            value={brand}
            onChange={e => setBrand(e.target.value)}
            placeholder="Ex.: AeroBank"
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Tipo</label>
            <select
              className={styles.formSelect}
              value={tier}
              onChange={e => setTier(e.target.value as SponsorTier)}
            >
              <option value="master">Master</option>
              <option value="sleeve">Manga</option>
            </select>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Temporadas</label>
            <input
              className={styles.formInput}
              type="number"
              min={1}
              max={10}
              value={seasons}
              onChange={e => setSeasons(e.target.value)}
            />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Cota mensal</label>
            <input
              className={styles.formInput}
              type="number"
              min={0}
              value={monthly}
              onChange={e => setMonthly(e.target.value)}
            />
            <MoneyAmountHint value={monthly} currency={finance.currency} suffix="/mês" />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Dia (1–28)</label>
            <input
              className={styles.formInput}
              type="number"
              min={1}
              max={28}
              value={paymentDay}
              onChange={e => setPaymentDay(e.target.value)}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Multa de rescisão</label>
            <input
              className={styles.formInput}
              type="number"
              min={0}
              value={termFee}
              onChange={e => setTermFee(e.target.value)}
            />
            <MoneyAmountHint value={termFee} currency={finance.currency} />
          </div>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>
            Cláusula: terminar no máximo em (posição na liga)
          </label>
          <input
            className={styles.formInput}
            type="number"
            min={0}
            value={minPos}
            onChange={e => setMinPos(e.target.value)}
            placeholder="Ex.: 14 — vazio = sem cláusula"
          />
        </div>

        <p className={styles.formLabel} style={{ marginTop: 8 }}>Bônus por meta</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Tipo</label>
            <select
              className={styles.formSelect}
              value={bonusKind}
              onChange={e => setBonusKind(e.target.value as SponsorBonusKind)}
            >
              <option value="league_position">Classificação (≤ posição)</option>
              <option value="title">Título</option>
              <option value="club_top_scorer">Artilheiro (gols mín.)</option>
            </select>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Valor do bônus</label>
            <input
              className={styles.formInput}
              type="number"
              min={1}
              value={bonusAmount}
              onChange={e => setBonusAmount(e.target.value)}
            />
            <MoneyAmountHint value={bonusAmount} currency={finance.currency} />
          </div>
        </div>
        {bonusKind !== 'title' && (
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>
              {bonusKind === 'league_position' ? 'Posição máxima' : 'Gols mínimos'}
            </label>
            <input
              className={styles.formInput}
              type="number"
              min={1}
              value={bonusThreshold}
              onChange={e => setBonusThreshold(e.target.value)}
            />
          </div>
        )}
        {bonusKind === 'title' && (
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Competição (opcional)</label>
            <select
              className={styles.formSelect}
              value={bonusComp}
              onChange={e => setBonusComp(e.target.value)}
            >
              <option value="">Qualquer título</option>
              {competitions.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        )}
        <button type="button" className={styles.btnSecondary} onClick={addBonus}>
          + Adicionar bônus à lista
        </button>
        {bonuses.length > 0 && (
          <ul style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: 13 }}>
            {bonuses.map((b, i) => (
              <li key={i}>
                {BONUS_KIND_LABEL[b.kind]} · {formatMoney(b.amount, finance.currency)}
                {b.threshold != null ? ` · meta ${b.threshold}` : ''}
                {b.competition ? ` · ${b.competition}` : ''}
                {' '}
                <button
                  type="button"
                  style={{ border: 'none', background: 'none', color: '#f87171', cursor: 'pointer' }}
                  onClick={() => setBonuses(prev => prev.filter((_, j) => j !== i))}
                >
                  remover
                </button>
              </li>
            ))}
          </ul>
        )}

        {error && <p style={{ color: '#f87171', fontSize: 13 }}>{error}</p>}
        <button type="button" className={styles.btnPrimary} onClick={submit} style={{ marginTop: 12 }}>
          Assinar contrato
        </button>
      </div>

      <div className={styles.heroCard}>
        <p className={styles.heroLabel}>Contratos ativos</p>
        {active.length === 0 ? (
          <div className={styles.emptyState}>Nenhum patrocínio ativo.</div>
        ) : (
          <ul className={styles.ledgerList} style={{ margin: 0 }}>
            {active.map(s => (
              <li
                key={s.id}
                className={styles.ledgerRow}
                style={{ flexWrap: 'wrap', gap: 10, alignItems: 'flex-start' }}
              >
                <div className={styles.ledgerMeta} style={{ flex: 1 }}>
                  <span className={styles.ledgerLabel}>
                    {sponsorTierLabel(s.tier)} · {s.brand}
                  </span>
                  <span className={styles.ledgerSub}>
                    {formatMoney(s.monthlyFee, finance.currency)}/mês · dia {s.paymentDay} ·{' '}
                    {s.seasonsRemaining}/{s.seasonsTotal} temp.
                    {s.minLeaguePosition
                      ? ` · cláusula ≤ ${s.minLeaguePosition}º`
                      : ''}
                    {s.bonuses.length
                      ? ` · ${s.bonuses.length} bônus`
                      : ''}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={() => onRenew(s.id, 1)}
                  >
                    +1 temporada
                  </button>
                  <button
                    type="button"
                    className={styles.btnDanger}
                    onClick={() => {
                      if (
                        window.confirm(
                          s.terminationFee > 0
                            ? `Rescindir ${s.brand}? Multa: ${formatMoney(s.terminationFee, finance.currency)}`
                            : `Rescindir ${s.brand}?`,
                        )
                      ) {
                        onTerminate(s.id);
                      }
                    }}
                  >
                    Rescindir
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {others.length > 0 && (
        <div className={styles.heroCard}>
          <p className={styles.heroLabel}>Encerrados</p>
          <ul className={styles.ledgerList} style={{ margin: 0 }}>
            {others.map(s => (
              <li key={s.id} className={styles.ledgerRow}>
                <div className={styles.ledgerMeta}>
                  <span className={styles.ledgerLabel}>
                    {sponsorTierLabel(s.tier)} · {s.brand}
                  </span>
                  <span className={styles.ledgerSub}>
                    {s.status === 'expired' ? 'Expirado' : 'Rescindido'} · desde temp.{' '}
                    {s.startSeason}
                  </span>
                </div>
                {s.status === 'expired' && (
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={() => onRenew(s.id, 1)}
                    disabled={hasActiveTier(
                      finance.sponsors?.filter(x => x.id !== s.id),
                      s.tier,
                    )}
                  >
                    Renovar
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
