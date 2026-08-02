import { useMemo, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { formatMoney, newLedgerEntry } from '../../utils/finance';
import type {
  TransferPaymentMethod,
  TransferRecord,
  TransferType,
  WatchlistPlayer,
} from '../../types/Transfer';
import { watchlistMissingForBuy } from '../../types/Transfer';
import type { Player } from '../../types/Player';
import { POSITION_LABELS } from '../../utils/matchEvents';
import {
  createPlayerDataProvider,
  externalToWatchlist,
  hasApiFootballKey,
  type ExternalPlayer,
} from '../../services/PlayerDataProvider';
import {
  buildInstallmentDates,
  createScheduledPayments,
  splitInstallmentAmounts,
} from '../../utils/transferPayments';
import {
  formatWindowRange,
  getActiveTransferWindow,
  isDateInTransferWindow,
  nextTransferWindowOpen,
  transferWindowSummary,
} from '../../utils/transferWindow';
import styles from './Transfers.module.css';

type Tab = 'lista' | 'negociar' | 'renovar' | 'busca' | 'historico';

const TRANSFER_TYPES: { type: TransferType; label: string }[] = [
  { type: 'buy', label: 'Contratação' },
  { type: 'sell', label: 'Venda' },
  { type: 'loan_in', label: 'Empréstimo (entra)' },
  { type: 'loan_out', label: 'Empréstimo (sai)' },
  { type: 'free', label: 'Livre' },
];

function uid() {
  return `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function badgeClass(type: TransferType): string {
  if (type === 'buy' || type === 'loan_in' || type === 'free') return styles.badgeBuy;
  if (type === 'sell' || type === 'loan_out') return styles.badgeSell;
  return styles.badgeLoan;
}

function badgeLabel(type: TransferType): string {
  return TRANSFER_TYPES.find(t => t.type === type)?.label ?? type;
}

export default function Transfers() {
  const {
    state,
    addWatchlist,
    removeWatchlist,
    updateWatchlist,
    executeTransfer,
    updateTransferRecord,
    renewPlayerContract,
  } = useGame();
  const { transfers, players, finance, season, team, currentDate } = state;

  const [tab, setTab] = useState<Tab>('lista');
  const [editingWatchId, setEditingWatchId] = useState<string | null>(null);
  const [renewPlayerId, setRenewPlayerId] = useState('');
  const [renewYears, setRenewYears] = useState('2');
  const [renewSalary, setRenewSalary] = useState('');
  const [renewBonus, setRenewBonus] = useState('');

  // Negociar
  const [transType, setTransType] = useState<TransferType>('buy');
  const [transPlayerSrc, setTransPlayerSrc] = useState<'new' | 'watchlist' | 'squad'>('watchlist');
  const [selectedWatchId, setSelectedWatchId] = useState('');
  const [selectedSquadId, setSelectedSquadId] = useState('');
  const [pName, setPName] = useState('');
  const [pPos, setPPos] = useState('ST');
  const [pAge, setPAge] = useState('');
  const [pOvr, setPOvr] = useState('');
  const [pNum, setPNum] = useState('');
  const [fromClub, setFromClub] = useState('');
  const [toClub, setToClub] = useState(team?.name ?? '');
  const [fee, setFee] = useState('');
  const [wage, setWage] = useState('');
  const [marketValue, setMarketValue] = useState('');
  const [loanMonths, setLoanMonths] = useState('');
  const [contractYears, setContractYears] = useState('3');
  const [notes, setNotes] = useState('');
  const [payMethod, setPayMethod] = useState<TransferPaymentMethod>('cash');
  const [installments, setInstallments] = useState('3');
  const [firstPayDate, setFirstPayDate] = useState(
    () => currentDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
  );
  const [presentationMode, setPresentationMode] = useState<'immediate' | 'date'>('immediate');
  const [presentationDate, setPresentationDate] = useState(
    () => currentDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
  );

  // Busca
  const [searchName, setSearchName] = useState('');
  const [searchNat, setSearchNat] = useState('');
  const [searchPos, setSearchPos] = useState('');
  const [searchMinAge, setSearchMinAge] = useState('');
  const [searchMaxAge, setSearchMaxAge] = useState('');
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchErr, setSearchErr] = useState('');
  const [searchHits, setSearchHits] = useState<ExternalPlayer[]>([]);

  // Histórico edit
  const [editHistId, setEditHistId] = useState<string | null>(null);
  const [histDraft, setHistDraft] = useState<Partial<TransferRecord>>({});

  const isSelling = transType === 'sell' || transType === 'loan_out';
  const transferivel = useMemo(
    () => players.filter(p => p.status === 'Transferível'),
    [players],
  );
  const pendingPays = transfers.pendingPayments?.filter(p => p.status === 'pending') ?? [];
  const windowOpen = isDateInTransferWindow(currentDate);
  const activeWindow = getActiveTransferWindow(currentDate);
  const nextWindow = useMemo(
    () => (currentDate && !windowOpen ? nextTransferWindowOpen(currentDate) : null),
    [currentDate, windowOpen],
  );

  const feeNum = parseFloat(fee.replace(',', '.')) || 0;
  const installmentN = payMethod === 'cash' ? 1 : Math.max(2, parseInt(installments) || 2);
  const payPreview = useMemo(() => {
    if (feeNum <= 0) return [];
    const dates = buildInstallmentDates(firstPayDate, installmentN);
    const amounts = splitInstallmentAmounts(feeNum, installmentN);
    return dates.map((d, i) => ({ date: d, amount: amounts[i] ?? 0 }));
  }, [feeNum, firstPayDate, installmentN]);

  function handleTypeChange(t: TransferType) {
    setTransType(t);
    if (t === 'sell' || t === 'loan_out') {
      setTransPlayerSrc('squad');
      setToClub('');
      setFromClub(team?.name ?? '');
    } else {
      setTransPlayerSrc('watchlist');
      setToClub(team?.name ?? '');
      setFromClub('');
    }
  }

  function buildNewPlayer(
    name: string,
    position: string,
    age: number | undefined,
    overall: number,
    number: number | null | undefined,
    salary: number,
    mv: number,
    opts?: { availableFrom?: string; contractYears?: number },
  ): Player {
    const awaiting = Boolean(opts?.availableFrom);
    return {
      id: uid(),
      teamId: team?.id ?? '',
      name,
      position: position as Player['position'],
      number: number ?? null,
      age: age ?? 25,
      overall,
      potential: overall,
      morale: 70,
      salary,
      marketValue: mv || overall * 150_000,
      contractYearsLeft: opts?.contractYears,
      status: 'Titular',
      stats: {
        matches: 0,
        minutes: 0,
        goals: 0,
        assists: 0,
        cleanSheets: 0,
        goalsConceded: 0,
        yellowCards: 0,
        redCards: 0,
      },
      personality: 'Disciplinado',
      fatigue: 0,
      availability: awaiting ? 'indisponivel' : 'disponivel',
      availableFrom: opts?.availableFrom,
    };
  }

  function executeTransferOp() {
    if (!isDateInTransferWindow(currentDate)) {
      alert(
        'Mercado fechado. Compras, vendas e empréstimos só na janela de transferências. Fora dela, use Renovar.',
      );
      setTab('renovar');
      return;
    }
    const wageNum = parseFloat(wage.replace(',', '.')) || 0;
    const mvNum = parseFloat(marketValue.replace(',', '.')) || 0;
    const loanNum = parseInt(loanMonths) || undefined;
    const yearsNum = parseInt(contractYears) || undefined;

    let snapshot: TransferRecord['playerSnapshot'];
    let playerId: string | undefined;
    let newPlayerData: Player | undefined;
    let removedId: string | undefined;

    const dealDate = (currentDate ?? new Date().toISOString()).slice(0, 10);
    const isIncoming =
      !isSelling &&
      (transType === 'buy' || transType === 'loan_in' || transType === 'free');
    let resolvedPresentation: string | undefined;
    if (isIncoming && presentationMode === 'date') {
      const picked = presentationDate.slice(0, 10);
      if (picked > dealDate) resolvedPresentation = picked;
    }

    if (isSelling) {
      const sq = players.find(p => p.id === selectedSquadId);
      if (!sq) return;
      snapshot = {
        name: sq.name,
        position: sq.position,
        age: sq.age,
        overall: sq.overall,
        number: sq.number,
      };
      playerId = sq.id;
      if (transType === 'sell') removedId = sq.id;
      else removedId = sq.id; // loan_out marca emprestado
    } else if (transPlayerSrc === 'watchlist') {
      const w = transfers.watchlist.find(p => p.id === selectedWatchId);
      if (!w) return;
      const missing = watchlistMissingForBuy(w);
      if (missing.length && (transType === 'buy' || transType === 'loan_in')) {
        alert(`Preencha na lista antes de contratar: ${missing.join(', ')}`);
        setTab('lista');
        setEditingWatchId(w.id);
        return;
      }
      snapshot = {
        name: w.name,
        position: w.position,
        age: w.age,
        overall: w.overall,
        nationality: w.nationality,
      };
      playerId = w.id;
      newPlayerData = buildNewPlayer(
        w.name,
        w.position,
        w.age,
        w.overall ?? 70,
        undefined,
        wageNum,
        mvNum || w.marketValue || 0,
        { availableFrom: resolvedPresentation, contractYears: yearsNum },
      );
    } else {
      if (!pName.trim()) return;
      snapshot = {
        name: pName.trim(),
        position: pPos,
        age: parseInt(pAge) || undefined,
        overall: parseInt(pOvr) || undefined,
        number: parseInt(pNum) || null,
      };
      newPlayerData = buildNewPlayer(
        pName.trim(),
        pPos,
        parseInt(pAge) || undefined,
        parseInt(pOvr) || 70,
        parseInt(pNum) || null,
        wageNum,
        mvNum,
        { availableFrom: resolvedPresentation, contractYears: yearsNum },
      );
    }

    const record: TransferRecord = {
      id: uid(),
      date: dealDate,
      season,
      type: transType,
      playerId,
      playerSnapshot: snapshot,
      fromClub: fromClub.trim() || (team?.name ?? ''),
      toClub: toClub.trim() || (team?.name ?? ''),
      fee: feeNum,
      wage: wageNum,
      loanDurationMonths: loanNum,
      ledgerEntryIds: [],
      paymentMethod: feeNum > 0 ? payMethod : undefined,
      installmentCount: feeNum > 0 ? installmentN : undefined,
      contractYears: yearsNum,
      notes: notes.trim() || undefined,
      presentationDate: resolvedPresentation ?? (isIncoming ? dealDate : undefined),
      squadPlayerId: newPlayerData?.id,
    };

    // À vista: desconta/credita na hora. Parcelado: calendário + popup.
    const isLoanDeal = transType === 'loan_in' || transType === 'loan_out';
    const feeType = isLoanDeal ? 'loan_fee' : 'transfer_fee';
    let ledgerEntries: ReturnType<typeof newLedgerEntry>[] = [];
    let pending: ReturnType<typeof createScheduledPayments> = [];

    if (feeNum > 0 && payMethod === 'cash') {
      const signed = isSelling ? feeNum : -feeNum;
      ledgerEntries = [
        newLedgerEntry(
          feeType,
          signed,
          `${isSelling ? 'Receita' : 'Pagamento'} transferência: ${snapshot.name}`,
          season,
          { relatedTransferId: record.id },
          dealDate,
        ),
      ];
      record.ledgerEntryIds = ledgerEntries.map(e => e.id);
    } else if (feeNum > 0) {
      pending = createScheduledPayments({
        transfer: record,
        method: payMethod,
        installmentCount: installmentN,
        firstPaymentDate: firstPayDate,
        isIncoming: isSelling,
      });
    }

    executeTransfer(record, newPlayerData, removedId, ledgerEntries, pending);

    setPName('');
    setPPos('ST');
    setPAge('');
    setPOvr('');
    setPNum('');
    setFee('');
    setWage('');
    setMarketValue('');
    setFromClub('');
    setToClub(team?.name ?? '');
    setLoanMonths('');
    setNotes('');
    setSelectedSquadId('');
    setSelectedWatchId('');
    setTab('historico');
  }

  async function runSearch() {
    setSearchErr('');
    setSearchBusy(true);
    try {
      if (!hasApiFootballKey()) {
        setSearchErr(
          'Configure VITE_API_FOOTBALL_KEY no arquivo .env e reinicie o servidor (npm run dev).',
        );
        setSearchHits([]);
        return;
      }
      const provider = createPlayerDataProvider();
      const hits = await provider.searchPlayers({
        name: searchName.trim(),
        nationality: searchNat.trim() || undefined,
        position: searchPos || undefined,
        minAge: searchMinAge ? parseInt(searchMinAge) : undefined,
        maxAge: searchMaxAge ? parseInt(searchMaxAge) : undefined,
        seasonYear: season,
      });
      // Enriquece com temporada (clube) — limitado aos primeiros 5 para economizar quota
      const enriched: ExternalPlayer[] = [];
      for (let i = 0; i < hits.length; i++) {
        if (i < 5 && hits[i]) {
          try {
            const full = await provider.getPlayer(hits[i].id, season);
            enriched.push(full ?? hits[i]);
          } catch {
            enriched.push(hits[i]);
          }
        } else {
          enriched.push(hits[i]);
        }
      }
      setSearchHits(enriched);
      if (!enriched.length) setSearchErr('Nenhum atleta encontrado.');
    } catch (e) {
      setSearchErr(e instanceof Error ? e.message : 'Falha na busca API-Football');
      setSearchHits([]);
    } finally {
      setSearchBusy(false);
    }
  }

  function addFromSearch(ext: ExternalPlayer) {
    if (transfers.watchlist.some(w => w.externalRef?.id === ext.id)) {
      alert('Já está na lista de observados.');
      return;
    }
    const draft = externalToWatchlist(ext);
    addWatchlist({ ...draft, id: uid() });
    setTab('lista');
  }

  function startHistEdit(r: TransferRecord) {
    setEditHistId(r.id);
    setHistDraft({
      fee: r.fee,
      wage: r.wage,
      fromClub: r.fromClub,
      toClub: r.toClub,
      date: r.date,
      notes: r.notes,
      contractYears: r.contractYears,
      loanDurationMonths: r.loanDurationMonths,
      playerSnapshot: { ...r.playerSnapshot },
    });
  }

  function saveHistEdit() {
    if (!editHistId) return;
    updateTransferRecord(editHistId, histDraft);
    setEditHistId(null);
    setHistDraft({});
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>LiveLife · Mercado</p>
          <h1 className={styles.brand}>Transferências</h1>
          <p className={styles.meta}>
            Temporada {season}
            {currentDate ? ` · Dia de jogo ${currentDate}` : ''}
            {pendingPays.length ? ` · ${pendingPays.length} pagamento(s) agendado(s)` : ''}
          </p>
        </div>
        <div className={styles.cashBox}>
          <span>Caixa</span>
          <strong>{formatMoney(finance.balance, finance.currency)}</strong>
        </div>
      </header>

      <div className={windowOpen ? styles.windowOpen : styles.windowClosed}>
        {windowOpen && activeWindow ? (
          <>
            <strong>Mercado aberto</strong> — {activeWindow.label} ({formatWindowRange(activeWindow)})
          </>
        ) : (
          <>
            <strong>Mercado fechado</strong> — só renovações.
            {nextWindow
              ? ` Próxima janela: ${nextWindow.window.label} a partir de ${nextWindow.date}.`
              : ''}{' '}
            <span style={{ opacity: 0.8 }}>{transferWindowSummary()}</span>
          </>
        )}
      </div>

      <nav className={styles.tabs}>
        {(
          [
            ['lista', 'Minha lista'],
            ['negociar', 'Negociar'],
            ['renovar', 'Renovar'],
            ['busca', 'Busca'],
            ['historico', 'Histórico'],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`${styles.tab} ${tab === key ? styles.tabActive : ''}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === 'lista' && (
        <>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Observados ({transfers.watchlist.length})</h2>
          </div>
          {transfers.watchlist.length === 0 ? (
            <p className={styles.empty}>
              Nenhum observado. Use a aba Busca (API-Football) ou adicione manualmente na negociação.
            </p>
          ) : (
            <div className={styles.list}>
              {transfers.watchlist.map(w => {
                const missing = watchlistMissingForBuy(w);
                const editing = editingWatchId === w.id;
                return (
                  <div key={w.id} className={styles.playerRow}>
                    {w.photoUrl ? (
                      <img src={w.photoUrl} alt="" className={styles.photo} />
                    ) : (
                      <div className={styles.photoPlaceholder}>◎</div>
                    )}
                    <div style={{ flex: 1 }}>
                      <p className={styles.playerName}>{w.name}</p>
                      <p className={styles.playerMeta}>
                        {POSITION_LABELS[w.position as keyof typeof POSITION_LABELS] ?? w.position}
                        {w.age != null ? ` · ${w.age} anos` : ''}
                        {w.overall != null ? ` · OVR ${w.overall}` : ''}
                        {` · ${w.clubName}`}
                        {w.nationality ? ` · ${w.nationality}` : ''}
                        {w.marketValue != null
                          ? ` · ${formatMoney(w.marketValue, finance.currency)}`
                          : ''}
                      </p>
                      {missing.length > 0 && (
                        <p className={styles.missing}>
                          Pendente para contratar: {missing.join(', ')}
                        </p>
                      )}
                      {editing && (
                        <WatchEditForm
                          player={w}
                          onSave={updates => {
                            updateWatchlist(w.id, updates);
                            setEditingWatchId(null);
                          }}
                          onCancel={() => setEditingWatchId(null)}
                        />
                      )}
                    </div>
                    <div className={styles.rowActions}>
                      <button
                        type="button"
                        className={styles.btnGhost}
                        onClick={() => setEditingWatchId(editing ? null : w.id)}
                      >
                        {editing ? 'Fechar' : 'Editar'}
                      </button>
                      <button
                        type="button"
                        className={styles.btnPrimary}
                        onClick={() => {
                          setTransType('buy');
                          setTransPlayerSrc('watchlist');
                          setSelectedWatchId(w.id);
                          setFromClub(w.clubName);
                          setToClub(team?.name ?? '');
                          setMarketValue(String(w.marketValue ?? ''));
                          setFee(String(w.marketValue ?? ''));
                          setTab('negociar');
                        }}
                      >
                        Negociar
                      </button>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        onClick={() => removeWatchlist(w.id)}
                        aria-label="Remover"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className={`${styles.sectionHead} ${styles.subSection}`}>
            <h2 className={styles.sectionTitle}>Transferíveis do elenco ({transferivel.length})</h2>
          </div>
          {transferivel.length === 0 ? (
            <p className={styles.empty}>
              Nenhum atleta com status Transferível. Marque no Elenco quem está à venda.
            </p>
          ) : (
            <div className={styles.list}>
              {transferivel.map(p => (
                <div key={p.id} className={styles.playerRow}>
                  <div className={styles.photoPlaceholder}>↗</div>
                  <div style={{ flex: 1 }}>
                    <p className={styles.playerName}>{p.name}</p>
                    <p className={styles.playerMeta}>
                      {POSITION_LABELS[p.position] ?? p.position} · {p.age} anos · OVR {p.overall}
                      {` · ${formatMoney(p.marketValue, finance.currency)}`}
                    </p>
                  </div>
                  <div className={styles.rowActions}>
                    <button
                      type="button"
                      className={styles.btnPrimary}
                      onClick={() => {
                        setTransType('sell');
                        setTransPlayerSrc('squad');
                        setSelectedSquadId(p.id);
                        setFromClub(team?.name ?? '');
                        setToClub('');
                        setFee(String(p.marketValue));
                        setMarketValue(String(p.marketValue));
                        setTab('negociar');
                      }}
                    >
                      Vender
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {pendingPays.length > 0 && (
            <>
              <div className={`${styles.sectionHead} ${styles.subSection}`}>
                <h2 className={styles.sectionTitle}>Pagamentos no calendário</h2>
              </div>
              <ul className={styles.paymentPreview}>
                {pendingPays
                  .slice()
                  .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
                  .map(p => (
                    <li key={p.id}>
                      {p.dueDate} · {p.label} ·{' '}
                      {formatMoney(p.direction === 'out' ? -p.amount : p.amount, finance.currency)}
                    </li>
                  ))}
              </ul>
            </>
          )}
        </>
      )}

      {tab === 'renovar' && (
        <div className={styles.card}>
          <h2 className={styles.sectionTitle}>Renovar contrato</h2>
          <p className={styles.info} style={{ marginTop: 8 }}>
            Renovações ficam disponíveis o ano inteiro, inclusive com o mercado fechado.
          </p>
          <div className={styles.formGrid} style={{ marginTop: 14 }}>
            <label className={`${styles.label} ${styles.formFull}`}>
              Jogador
              <select
                className={styles.select}
                value={renewPlayerId}
                onChange={e => {
                  setRenewPlayerId(e.target.value);
                  const p = players.find(x => x.id === e.target.value);
                  if (p) setRenewSalary(String(p.salary));
                }}
              >
                <option value="">Selecionar…</option>
                {players
                  .filter(p => p.status !== 'Emprestado' && p.status !== 'Aposentado')
                  .map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.contractYearsLeft != null
                        ? ` · ${p.contractYearsLeft}a restantes`
                        : ''}
                      {` · ${formatMoney(p.salary, finance.currency)}/mês`}
                    </option>
                  ))}
              </select>
            </label>
            <label className={styles.label}>
              Anos de contrato
              <input
                className={styles.input}
                type="number"
                min={1}
                max={7}
                value={renewYears}
                onChange={e => setRenewYears(e.target.value)}
              />
            </label>
            <label className={styles.label}>
              Novo salário / mês
              <input
                className={styles.input}
                type="number"
                min={0}
                value={renewSalary}
                onChange={e => setRenewSalary(e.target.value)}
              />
            </label>
            <label className={styles.label}>
              Bônus de assinatura (opcional)
              <input
                className={styles.input}
                type="number"
                min={0}
                value={renewBonus}
                onChange={e => setRenewBonus(e.target.value)}
              />
            </label>
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.btnPrimary}
              disabled={!renewPlayerId}
              onClick={() => {
                if (!renewPlayerId) return;
                renewPlayerContract({
                  playerId: renewPlayerId,
                  years: parseInt(renewYears) || 1,
                  newSalary: parseFloat(renewSalary.replace(',', '.')) || 0,
                  signingBonus: parseFloat(renewBonus.replace(',', '.')) || 0,
                });
                setRenewPlayerId('');
                setRenewBonus('');
                alert('Contrato renovado.');
              }}
            >
              Confirmar renovação
            </button>
          </div>
        </div>
      )}

      {tab === 'negociar' && (
        <div className={styles.card}>
          <h2 className={styles.sectionTitle}>Negociar</h2>
          {!windowOpen && (
            <p className={styles.warning} style={{ marginTop: 10 }}>
              Mercado fechado. Use a aba Renovar ou aguarde a janela
              {nextWindow ? ` (${nextWindow.date})` : ''}.
            </p>
          )}
          <div className={styles.typeRow} style={{ margin: '12px 0' }}>
            {TRANSFER_TYPES.map(t => (
              <button
                key={t.type}
                type="button"
                className={`${styles.typeBtn} ${transType === t.type ? styles.typeBtnActive : ''}`}
                onClick={() => handleTypeChange(t.type)}
                disabled={!windowOpen}
              >
                {t.label}
              </button>
            ))}
          </div>

          {!isSelling && (
            <div className={styles.typeRow} style={{ marginBottom: 12 }}>
              {(['watchlist', 'new'] as const).map(src => (
                <button
                  key={src}
                  type="button"
                  className={`${styles.typeBtn} ${transPlayerSrc === src ? styles.typeBtnActive : ''}`}
                  onClick={() => setTransPlayerSrc(src)}
                >
                  {src === 'watchlist' ? 'Da lista' : 'Novo atleta'}
                </button>
              ))}
            </div>
          )}

          {isSelling ? (
            <label className={styles.label}>
              Jogador do elenco
              <select
                className={styles.select}
                value={selectedSquadId}
                onChange={e => setSelectedSquadId(e.target.value)}
              >
                <option value="">Selecionar…</option>
                {players.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({POSITION_LABELS[p.position]})
                    {p.status === 'Transferível' ? ' · transferível' : ''}
                  </option>
                ))}
              </select>
            </label>
          ) : transPlayerSrc === 'watchlist' ? (
            <label className={styles.label}>
              Observado
              <select
                className={styles.select}
                value={selectedWatchId}
                onChange={e => {
                  setSelectedWatchId(e.target.value);
                  const w = transfers.watchlist.find(x => x.id === e.target.value);
                  if (w) {
                    setFromClub(w.clubName);
                    setMarketValue(String(w.marketValue ?? ''));
                    setFee(String(w.marketValue ?? ''));
                  }
                }}
              >
                <option value="">Selecionar…</option>
                {transfers.watchlist.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.clubName})
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className={styles.formGrid}>
              <label className={`${styles.label} ${styles.formFull}`}>
                Nome
                <input className={styles.input} value={pName} onChange={e => setPName(e.target.value)} />
              </label>
              <label className={styles.label}>
                Posição
                <select className={styles.select} value={pPos} onChange={e => setPPos(e.target.value)}>
                  {Object.entries(POSITION_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </label>
              <label className={styles.label}>
                Número
                <input className={styles.input} type="number" value={pNum} onChange={e => setPNum(e.target.value)} />
              </label>
              <label className={styles.label}>
                Idade
                <input className={styles.input} type="number" value={pAge} onChange={e => setPAge(e.target.value)} />
              </label>
              <label className={styles.label}>
                Overall
                <input className={styles.input} type="number" value={pOvr} onChange={e => setPOvr(e.target.value)} />
              </label>
            </div>
          )}

          <div className={styles.formGrid} style={{ marginTop: 14 }}>
            <label className={styles.label}>
              {isSelling ? 'Clube destino' : 'Clube de origem'}
              <input
                className={styles.input}
                value={isSelling ? toClub : fromClub}
                onChange={e => (isSelling ? setToClub(e.target.value) : setFromClub(e.target.value))}
              />
            </label>
            <label className={styles.label}>
              Taxa total
              <input className={styles.input} type="number" min={0} value={fee} onChange={e => setFee(e.target.value)} />
            </label>
            <label className={styles.label}>
              Salário / mês
              <input className={styles.input} type="number" min={0} value={wage} onChange={e => setWage(e.target.value)} />
            </label>
            <label className={styles.label}>
              Valor de mercado
              <input className={styles.input} type="number" min={0} value={marketValue} onChange={e => setMarketValue(e.target.value)} />
            </label>
            <label className={styles.label}>
              Contrato (anos)
              <input className={styles.input} type="number" min={1} max={10} value={contractYears} onChange={e => setContractYears(e.target.value)} />
            </label>
            {(transType === 'loan_in' || transType === 'loan_out') && (
              <label className={styles.label}>
                Empréstimo (meses)
                <input className={styles.input} type="number" min={1} max={24} value={loanMonths} onChange={e => setLoanMonths(e.target.value)} />
              </label>
            )}
            <label className={`${styles.label} ${styles.formFull}`}>
              Notas do negócio
              <textarea className={styles.textarea} value={notes} onChange={e => setNotes(e.target.value)} />
            </label>
          </div>

          {feeNum > 0 && (
            <div style={{ marginTop: 16 }}>
              <p className={styles.label}>Método de pagamento</p>
              <div className={styles.typeRow} style={{ marginTop: 8 }}>
                <button
                  type="button"
                  className={`${styles.typeBtn} ${payMethod === 'cash' ? styles.typeBtnActive : ''}`}
                  onClick={() => setPayMethod('cash')}
                >
                  À vista
                </button>
                <button
                  type="button"
                  className={`${styles.typeBtn} ${payMethod === 'installment' ? styles.typeBtnActive : ''}`}
                  onClick={() => setPayMethod('installment')}
                >
                  Parcelado
                </button>
              </div>
              {payMethod === 'installment' && (
                <div className={styles.formGrid} style={{ marginTop: 12 }}>
                  <label className={styles.label}>
                    1ª parcela
                    <input
                      className={styles.input}
                      type="date"
                      value={firstPayDate}
                      onChange={e => setFirstPayDate(e.target.value)}
                    />
                  </label>
                  <label className={styles.label}>
                    Nº de parcelas
                    <input
                      className={styles.input}
                      type="number"
                      min={2}
                      max={24}
                      value={installments}
                      onChange={e => setInstallments(e.target.value)}
                    />
                  </label>
                </div>
              )}
              <div className={styles.info} style={{ marginTop: 10 }}>
                {payMethod === 'cash'
                  ? 'À vista: o valor entra/sai do caixa na hora — sem popup.'
                  : 'Parcelado: o dinheiro só move no dia agendado (popup ao avançar). +1 mês entre parcelas.'}
              </div>
              {payMethod === 'installment' && (
                <ul className={styles.paymentPreview}>
                  {payPreview.map((p, i) => (
                    <li key={p.date + i}>
                      {p.date} · parcela {i + 1}/{payPreview.length} ·{' '}
                      {formatMoney(isSelling ? p.amount : -p.amount, finance.currency)}
                    </li>
                  ))}
                </ul>
              )}
              {payMethod === 'cash' && (
                <ul className={styles.paymentPreview}>
                  <li>
                    Agora ·{' '}
                    {formatMoney(isSelling ? feeNum : -feeNum, finance.currency)}
                  </li>
                </ul>
              )}
            </div>
          )}

          {!isSelling && (
            <div style={{ marginTop: 16 }}>
              <p className={styles.label}>Apresentação no clube</p>
              <div className={styles.typeRow} style={{ marginTop: 8 }}>
                <button
                  type="button"
                  className={`${styles.typeBtn} ${presentationMode === 'immediate' ? styles.typeBtnActive : ''}`}
                  onClick={() => setPresentationMode('immediate')}
                >
                  Imediata
                </button>
                <button
                  type="button"
                  className={`${styles.typeBtn} ${presentationMode === 'date' ? styles.typeBtnActive : ''}`}
                  onClick={() => setPresentationMode('date')}
                >
                  Escolher dia
                </button>
              </div>
              {presentationMode === 'date' && (
                <label className={styles.label} style={{ marginTop: 12, display: 'block' }}>
                  Data da apresentação
                  <input
                    className={styles.input}
                    type="date"
                    value={presentationDate}
                    min={currentDate?.slice(0, 10)}
                    onChange={e => setPresentationDate(e.target.value)}
                  />
                </label>
              )}
              <div className={styles.info} style={{ marginTop: 10 }}>
                {presentationMode === 'immediate'
                  ? 'O atleta fica disponível no elenco agora.'
                  : 'Fica indisponível até a data escolhida (aparece no calendário).'}
              </div>
            </div>
          )}

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={executeTransferOp}
              disabled={!windowOpen}
            >
              Confirmar negócio
            </button>
          </div>
        </div>
      )}

      {tab === 'busca' && (
        <div className={styles.card}>
          <h2 className={styles.sectionTitle}>Busca API-Football</h2>
          {!hasApiFootballKey() && (
            <p className={styles.warning} style={{ marginTop: 10 }}>
              Defina <code>VITE_API_FOOTBALL_KEY</code> no .env (chave em api-football.com / api-sports).
            </p>
          )}
          <div className={styles.formGrid} style={{ marginTop: 14 }}>
            <label className={`${styles.label} ${styles.formFull}`}>
              Nome (mín. 3 letras)
              <input
                className={styles.input}
                value={searchName}
                onChange={e => setSearchName(e.target.value)}
                placeholder="Ex: Vinicius"
              />
            </label>
            <label className={styles.label}>
              Nacionalidade
              <input className={styles.input} value={searchNat} onChange={e => setSearchNat(e.target.value)} />
            </label>
            <label className={styles.label}>
              Posição ClubOS
              <select className={styles.select} value={searchPos} onChange={e => setSearchPos(e.target.value)}>
                <option value="">Qualquer</option>
                {Object.entries(POSITION_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </label>
            <label className={styles.label}>
              Idade mín.
              <input className={styles.input} type="number" value={searchMinAge} onChange={e => setSearchMinAge(e.target.value)} />
            </label>
            <label className={styles.label}>
              Idade máx.
              <input className={styles.input} type="number" value={searchMaxAge} onChange={e => setSearchMaxAge(e.target.value)} />
            </label>
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.btnPrimary}
              disabled={searchBusy || searchName.trim().length < 3}
              onClick={() => void runSearch()}
            >
              {searchBusy ? 'Buscando…' : 'Buscar'}
            </button>
          </div>
          {searchErr && <p className={styles.warning} style={{ marginTop: 12 }}>{searchErr}</p>}
          <div className={styles.searchResults}>
            {searchHits.map(h => (
              <div key={h.id} className={styles.searchHit}>
                {h.photoUrl ? (
                  <img src={h.photoUrl} alt="" className={styles.photo} />
                ) : (
                  <div className={styles.photoPlaceholder}>+</div>
                )}
                <div style={{ flex: 1 }}>
                  <p className={styles.playerName}>{h.name}</p>
                  <p className={styles.playerMeta}>
                    {POSITION_LABELS[h.position as keyof typeof POSITION_LABELS] ?? h.position}
                    {h.age != null ? ` · ${h.age} anos (temp. ${season})` : ''}
                    {h.birthDate ? ` · nasc. ${h.birthDate}` : ''}
                    {` · ${h.clubName}`}
                    {h.nationality ? ` · ${h.nationality}` : ''}
                  </p>
                </div>
                <button type="button" className={styles.btnPrimary} onClick={() => addFromSearch(h)}>
                  + Lista
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'historico' && (
        <>
          {transfers.history.length === 0 ? (
            <p className={styles.empty}>Nenhuma operação registrada.</p>
          ) : (
            <div className={styles.list}>
              {transfers.history.map(r => (
                <div key={r.id} className={styles.playerRow}>
                  <span className={`${styles.badge} ${badgeClass(r.type)}`}>{badgeLabel(r.type)}</span>
                  <div style={{ flex: 1 }}>
                    <p className={styles.playerName}>{r.playerSnapshot.name}</p>
                    <p className={styles.playerMeta}>
                      {r.fromClub} → {r.toClub} · {r.date}
                      {r.fee > 0
                        ? ` · ${formatMoney(r.type === 'sell' || r.type === 'loan_out' ? r.fee : -r.fee, finance.currency)}`
                        : ' · Grátis'}
                      {r.paymentMethod === 'installment'
                        ? ` · ${r.installmentCount}x`
                        : r.paymentMethod === 'cash'
                          ? ' · à vista'
                          : ''}
                      {r.notes ? ` · ${r.notes}` : ''}
                    </p>
                    {editHistId === r.id && (
                      <div className={styles.editPanel}>
                        <div className={styles.formGrid}>
                          <label className={styles.label}>
                            Data
                            <input
                              className={styles.input}
                              type="date"
                              value={histDraft.date ?? r.date}
                              onChange={e => setHistDraft(d => ({ ...d, date: e.target.value }))}
                            />
                          </label>
                          <label className={styles.label}>
                            Taxa
                            <input
                              className={styles.input}
                              type="number"
                              value={histDraft.fee ?? r.fee}
                              onChange={e =>
                                setHistDraft(d => ({ ...d, fee: parseFloat(e.target.value) || 0 }))
                              }
                            />
                          </label>
                          <label className={styles.label}>
                            De
                            <input
                              className={styles.input}
                              value={histDraft.fromClub ?? r.fromClub}
                              onChange={e => setHistDraft(d => ({ ...d, fromClub: e.target.value }))}
                            />
                          </label>
                          <label className={styles.label}>
                            Para
                            <input
                              className={styles.input}
                              value={histDraft.toClub ?? r.toClub}
                              onChange={e => setHistDraft(d => ({ ...d, toClub: e.target.value }))}
                            />
                          </label>
                          <label className={`${styles.label} ${styles.formFull}`}>
                            Notas
                            <input
                              className={styles.input}
                              value={histDraft.notes ?? r.notes ?? ''}
                              onChange={e => setHistDraft(d => ({ ...d, notes: e.target.value }))}
                            />
                          </label>
                        </div>
                        <div className={styles.actions}>
                          <button type="button" className={styles.btnPrimary} onClick={saveHistEdit}>
                            Salvar
                          </button>
                          <button
                            type="button"
                            className={styles.btnGhost}
                            onClick={() => setEditHistId(null)}
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className={styles.rowActions}>
                    <button
                      type="button"
                      className={styles.btnGhost}
                      onClick={() =>
                        editHistId === r.id ? setEditHistId(null) : startHistEdit(r)
                      }
                    >
                      {editHistId === r.id ? 'Fechar' : 'Editar'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function WatchEditForm({
  player,
  onSave,
  onCancel,
}: {
  player: WatchlistPlayer;
  onSave: (u: Partial<WatchlistPlayer>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(player.name);
  const [position, setPosition] = useState(player.position);
  const [age, setAge] = useState(String(player.age ?? ''));
  const [overall, setOverall] = useState(String(player.overall ?? ''));
  const [clubName, setClubName] = useState(player.clubName);
  const [marketValue, setMarketValue] = useState(String(player.marketValue ?? ''));
  const [nationality, setNationality] = useState(player.nationality ?? '');
  const [notes, setNotes] = useState(player.notes ?? '');
  const [birthDate, setBirthDate] = useState(player.birthDate ?? '');

  return (
    <div className={styles.editPanel}>
      <div className={styles.formGrid}>
        <label className={`${styles.label} ${styles.formFull}`}>
          Nome
          <input className={styles.input} value={name} onChange={e => setName(e.target.value)} />
        </label>
        <label className={styles.label}>
          Posição
          <select className={styles.select} value={position} onChange={e => setPosition(e.target.value)}>
            {Object.entries(POSITION_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
        <label className={styles.label}>
          Idade
          <input className={styles.input} type="number" value={age} onChange={e => setAge(e.target.value)} />
        </label>
        <label className={styles.label}>
          Nascimento
          <input className={styles.input} type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} />
        </label>
        <label className={styles.label}>
          Overall
          <input className={styles.input} type="number" value={overall} onChange={e => setOverall(e.target.value)} />
        </label>
        <label className={styles.label}>
          Clube
          <input className={styles.input} value={clubName} onChange={e => setClubName(e.target.value)} />
        </label>
        <label className={styles.label}>
          Valor
          <input className={styles.input} type="number" value={marketValue} onChange={e => setMarketValue(e.target.value)} />
        </label>
        <label className={styles.label}>
          Nacionalidade
          <input className={styles.input} value={nationality} onChange={e => setNationality(e.target.value)} />
        </label>
        <label className={`${styles.label} ${styles.formFull}`}>
          Notas
          <input className={styles.input} value={notes} onChange={e => setNotes(e.target.value)} />
        </label>
      </div>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.btnPrimary}
          onClick={() =>
            onSave({
              name: name.trim(),
              position,
              age: age ? parseInt(age) : undefined,
              overall: overall ? parseInt(overall) : undefined,
              clubName: clubName.trim(),
              marketValue: marketValue ? parseFloat(marketValue) : undefined,
              nationality: nationality.trim() || undefined,
              notes: notes.trim() || undefined,
              birthDate: birthDate || undefined,
            })
          }
        >
          Salvar
        </button>
        <button type="button" className={styles.btnGhost} onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
