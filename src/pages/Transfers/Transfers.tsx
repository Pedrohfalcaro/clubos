import { useState, useMemo } from 'react';
import { useGame } from '../../context/GameContext';
import { formatMoney, newLedgerEntry } from '../../utils/finance';
import type { TransferRecord, TransferType } from '../../types/Transfer';
import type { Player } from '../../types/Player';
import type { FinanceLedgerEntry } from '../../types/Finance';
import { POSITION_LABELS } from '../../utils/matchEvents';
import styles from './Transfers.module.css';

type Tab = 'watchlist' | 'operate' | 'history';

const TRANSFER_TYPES: { type: TransferType; label: string }[] = [
  { type: 'buy', label: 'Contratação' },
  { type: 'sell', label: 'Venda' },
  { type: 'loan_in', label: 'Empréstimo (entra)' },
  { type: 'loan_out', label: 'Empréstimo (sai)' },
  { type: 'free', label: 'Livre' },
];

function transferBadgeClass(type: TransferType): string {
  if (type === 'buy' || type === 'loan_in' || type === 'free') return styles.badgeBuy;
  if (type === 'sell' || type === 'loan_out') return styles.badgeSell;
  return styles.badgeFree;
}

function transferBadgeLabel(type: TransferType): string {
  switch (type) {
    case 'buy': return 'Contrat.';
    case 'sell': return 'Venda';
    case 'loan_in': return 'Emprést.';
    case 'loan_out': return 'Emprést.↗';
    case 'free': return 'Livre';
  }
}

function uid() {
  return `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export default function Transfers() {
  const { state, addWatchlist, removeWatchlist, executeTransfer } = useGame();
  const { transfers, players, finance, season, team } = state;

  const [tab, setTab] = useState<Tab>('watchlist');

  // Watchlist add form
  const [showWatchForm, setShowWatchForm] = useState(false);
  const [watchName, setWatchName] = useState('');
  const [watchPos, setWatchPos] = useState('ST');
  const [watchClub, setWatchClub] = useState('');
  const [watchAge, setWatchAge] = useState('');
  const [watchOvr, setWatchOvr] = useState('');
  const [watchMV, setWatchMV] = useState('');
  const [watchNotes, setWatchNotes] = useState('');

  // Transfer operate
  const [transType, setTransType] = useState<TransferType>('buy');
  const [transPlayerSrc, setTransPlayerSrc] = useState<'new' | 'watchlist' | 'squad'>('new');
  const [selectedWatchId, setSelectedWatchId] = useState('');
  const [selectedSquadId, setSelectedSquadId] = useState('');
  // New player fields
  const [pName, setPName] = useState('');
  const [pPos, setPPos] = useState('ST');
  const [pAge, setPAge] = useState('');
  const [pOvr, setPOvr] = useState('');
  const [pNum, setPNum] = useState('');
  // Common fields
  const [fromClub, setFromClub] = useState('');
  const [toClub, setToClub] = useState(team?.name ?? '');
  const [fee, setFee] = useState('');
  const [wage, setWage] = useState('');
  const [marketValue, setMarketValue] = useState('');
  const [loanMonths, setLoanMonths] = useState('');

  const isSelling = transType === 'sell' || transType === 'loan_out';
  // Vendas e empréstimos de saída entram dinheiro — não há limite de caixa
  const canAfford = isSelling || !fee || parseFloat(fee) <= finance.balance;

  // Sync toClub/fromClub with type
  function handleTypeChange(t: TransferType) {
    setTransType(t);
    if (t === 'sell' || t === 'loan_out') {
      setTransPlayerSrc('squad');
      setToClub('');
      setFromClub(team?.name ?? '');
    } else {
      setTransPlayerSrc('new');
      setToClub(team?.name ?? '');
      setFromClub('');
    }
  }

  function addToWatchlist() {
    if (!watchName.trim() || !watchClub.trim()) return;
    addWatchlist({
      id: uid(),
      name: watchName.trim(),
      position: watchPos,
      age: watchAge ? parseInt(watchAge) : undefined,
      overall: watchOvr ? parseInt(watchOvr) : undefined,
      clubName: watchClub.trim(),
      marketValue: watchMV ? parseFloat(watchMV.replace(',', '.')) : undefined,
      notes: watchNotes.trim() || undefined,
    });
    setWatchName(''); setWatchPos('ST'); setWatchClub(''); setWatchAge('');
    setWatchOvr(''); setWatchMV(''); setWatchNotes('');
    setShowWatchForm(false);
  }

  function executeTransferOp() {
    const feeNum = parseFloat(fee.replace(',', '.')) || 0;
    const wageNum = parseFloat(wage.replace(',', '.')) || 0;
    const mvNum = parseFloat(marketValue.replace(',', '.')) || 0;
    const loanNum = parseInt(loanMonths) || undefined;

    let snapshot: TransferRecord['playerSnapshot'];
    let playerId: string | undefined;
    let newPlayerData: Player | undefined;
    let removedId: string | undefined;

    if (isSelling) {
      const sq = players.find(p => p.id === selectedSquadId);
      if (!sq) return;
      snapshot = { name: sq.name, position: sq.position, age: sq.age, overall: sq.overall, number: sq.number };
      playerId = sq.id;
      if (transType === 'sell') removedId = sq.id;
    } else if (transPlayerSrc === 'watchlist') {
      const w = transfers.watchlist.find(p => p.id === selectedWatchId);
      if (!w) return;
      snapshot = { name: w.name, position: w.position, age: w.age, overall: w.overall };
      playerId = w.id;
      newPlayerData = buildNewPlayer(w.name, w.position, w.age, w.overall ?? 70, undefined, wageNum, mvNum);
    } else {
      if (!pName.trim()) return;
      snapshot = { name: pName.trim(), position: pPos, age: parseInt(pAge) || undefined, overall: parseInt(pOvr) || undefined, number: parseInt(pNum) || null };
      newPlayerData = buildNewPlayer(pName.trim(), pPos, parseInt(pAge) || undefined, parseInt(pOvr) || 70, parseInt(pNum) || null, wageNum, mvNum);
    }

    const entries: FinanceLedgerEntry[] = [];
    if (feeNum > 0) {
      const type = transType === 'loan_in' || transType === 'loan_out' ? 'loan_fee' : 'transfer_fee';
      const sign = isSelling ? feeNum : -feeNum;
      entries.push(newLedgerEntry(
        type,
        sign,
        `${isSelling ? 'Venda' : 'Compra'}: ${snapshot.name}`,
        season,
        { relatedPlayerId: playerId },
      ));
    }

    const record: TransferRecord = {
      id: uid(),
      date: new Date().toISOString().slice(0, 10),
      season,
      type: transType,
      playerId,
      playerSnapshot: snapshot,
      fromClub: fromClub.trim() || (team?.name ?? ''),
      toClub: toClub.trim() || (team?.name ?? ''),
      fee: feeNum,
      wage: wageNum,
      loanDurationMonths: loanNum,
      ledgerEntryIds: entries.map(e => e.id),
    };

    executeTransfer(record, newPlayerData, removedId, entries);

    // Reset
    setPName(''); setPPos('ST'); setPAge(''); setPOvr(''); setPNum('');
    setFee(''); setWage(''); setMarketValue(''); setFromClub(''); setToClub(team?.name ?? '');
    setLoanMonths(''); setSelectedSquadId(''); setSelectedWatchId('');
  }

  function buildNewPlayer(
    name: string, position: string, age: number | undefined, overall: number, number: number | null | undefined, salary: number, mv: number,
  ): Player {
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
      status: 'Titular',
      stats: { matches: 0, minutes: 0, goals: 0, assists: 0, cleanSheets: 0, yellowCards: 0, redCards: 0 },
      personality: 'Disciplinado',
      fatigue: 0,
      availability: 'disponivel',
    };
  }

  const squadOptions = useMemo(() =>
    players.filter(p => p.availability !== 'lesionado'),
    [players],
  );

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Transferências</h1>
        <p>Temporada {season}</p>
      </div>

      <div className={styles.tabs}>
        {([
          ['watchlist', 'Observação'],
          ['operate', 'Operar'],
          ['history', 'Histórico'],
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

      {tab === 'watchlist' && (
        <>
          <div className={styles.sectionHead}>
            <h3 className={styles.sectionTitle}>Na mira ({transfers.watchlist.length})</h3>
            <button className={styles.btnPrimary} onClick={() => setShowWatchForm(v => !v)}>
              {showWatchForm ? '− Fechar' : '+ Adicionar'}
            </button>
          </div>

          {showWatchForm && (
            <div className={styles.transferFormCard}>
              <p className={styles.transferTitle}>Adicionar à lista de observação</p>
              <div className={styles.formGrid}>
                <div className={styles.formGroupFull}>
                  <label className={styles.formLabel}>Nome</label>
                  <input className={styles.formInput} value={watchName} onChange={e => setWatchName(e.target.value)} placeholder="Nome do jogador" />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Posição</label>
                  <select className={styles.formSelect} value={watchPos} onChange={e => setWatchPos(e.target.value)}>
                    {Object.entries(POSITION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Clube atual</label>
                  <input className={styles.formInput} value={watchClub} onChange={e => setWatchClub(e.target.value)} placeholder="Ex: PSG" />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Idade</label>
                  <input className={styles.formInput} value={watchAge} onChange={e => setWatchAge(e.target.value)} type="number" min={14} max={45} />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Overall</label>
                  <input className={styles.formInput} value={watchOvr} onChange={e => setWatchOvr(e.target.value)} type="number" min={40} max={99} />
                </div>
                <div className={styles.formGroupFull}>
                  <label className={styles.formLabel}>Valor estimado</label>
                  <input className={styles.formInput} value={watchMV} onChange={e => setWatchMV(e.target.value)} type="number" min={0} placeholder="Ex: 5000000" />
                </div>
                <div className={styles.formGroupFull}>
                  <label className={styles.formLabel}>Notas</label>
                  <input className={styles.formInput} value={watchNotes} onChange={e => setWatchNotes(e.target.value)} placeholder="Notas livres..." />
                </div>
              </div>
              <div className={styles.formActions}>
                <button className={styles.btnSecondary} onClick={() => setShowWatchForm(false)}>Cancelar</button>
                <button className={styles.btnPrimary} onClick={addToWatchlist}>Salvar</button>
              </div>
            </div>
          )}

          {transfers.watchlist.length === 0 ? (
            <div className={styles.emptyState}>
              Lista vazia. Adicione jogadores que você está observando.
            </div>
          ) : (
            <div className={styles.watchList}>
              {transfers.watchlist.map(w => (
                <div key={w.id} className={styles.watchCard}>
                  <div>
                    <p className={styles.watchName}>{w.name}</p>
                    <p className={styles.watchMeta}>
                      {POSITION_LABELS[w.position as keyof typeof POSITION_LABELS] ?? w.position}
                      {w.age ? ` · ${w.age} anos` : ''}
                      {w.overall ? ` · OVR ${w.overall}` : ''}
                      {' · '}{w.clubName}
                      {w.marketValue ? ` · ${formatMoney(w.marketValue, finance.currency)}` : ''}
                    </p>
                    {w.notes && <p className={styles.watchNotes}>{w.notes}</p>}
                  </div>
                  <div className={styles.watchActions}>
                    <button
                      className={styles.watchConvert}
                      onClick={() => {
                        setTransType('buy');
                        setTransPlayerSrc('watchlist');
                        setSelectedWatchId(w.id);
                        setTab('operate');
                        setToClub(team?.name ?? '');
                        setFromClub(w.clubName);
                        setMarketValue(String(w.marketValue ?? ''));
                      }}
                    >
                      Contratar
                    </button>
                    <button className={styles.watchRemove} onClick={() => removeWatchlist(w.id)}>×</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'operate' && (
        <div className={styles.transferFormCard}>
          <p className={styles.transferTitle}>Registrar operação</p>

          <div className={styles.formGroup} style={{ gap: 8 }}>
            <span className={styles.formLabel}>Tipo</span>
            <div className={styles.transferTypeRow}>
              {TRANSFER_TYPES.map(t => (
                <button
                  key={t.type}
                  className={`${styles.typeBtn} ${transType === t.type ? styles.typeBtnActive : ''}`}
                  onClick={() => handleTypeChange(t.type)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Player source */}
          {!isSelling && (
            <div className={styles.formGroup}>
              <span className={styles.formLabel}>Jogador</span>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                {(['new', 'watchlist'] as const).map(src => (
                  <button
                    key={src}
                    className={`${styles.typeBtn} ${transPlayerSrc === src ? styles.typeBtnActive : ''}`}
                    style={{ flex: 1 }}
                    onClick={() => setTransPlayerSrc(src)}
                  >
                    {src === 'new' ? 'Novo' : 'Da observação'}
                  </button>
                ))}
              </div>
              {transPlayerSrc === 'watchlist' ? (
                transfers.watchlist.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--text)' }}>Nenhum jogador na observação.</p>
                ) : (
                  <select
                    className={styles.formSelect}
                    value={selectedWatchId}
                    onChange={e => {
                      setSelectedWatchId(e.target.value);
                      const w = transfers.watchlist.find(p => p.id === e.target.value);
                      if (w) {
                        setFromClub(w.clubName);
                        setMarketValue(String(w.marketValue ?? ''));
                      }
                    }}
                  >
                    <option value="">Selecionar...</option>
                    {transfers.watchlist.map(w => (
                      <option key={w.id} value={w.id}>{w.name} ({w.clubName})</option>
                    ))}
                  </select>
                )
              ) : (
                <div className={styles.formGrid}>
                  <div className={styles.formGroupFull}>
                    <label className={styles.formLabel}>Nome</label>
                    <input className={styles.formInput} value={pName} onChange={e => setPName(e.target.value)} placeholder="Nome do jogador" />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Posição</label>
                    <select className={styles.formSelect} value={pPos} onChange={e => setPPos(e.target.value)}>
                      {Object.entries(POSITION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Número</label>
                    <input className={styles.formInput} value={pNum} onChange={e => setPNum(e.target.value)} type="number" min={1} max={99} />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Idade</label>
                    <input className={styles.formInput} value={pAge} onChange={e => setPAge(e.target.value)} type="number" min={14} max={45} />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Overall</label>
                    <input className={styles.formInput} value={pOvr} onChange={e => setPOvr(e.target.value)} type="number" min={40} max={99} />
                  </div>
                </div>
              )}
            </div>
          )}

          {isSelling && (
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Jogador do elenco</label>
              <select
                className={styles.formSelect}
                value={selectedSquadId}
                onChange={e => setSelectedSquadId(e.target.value)}
              >
                <option value="">Selecionar jogador...</option>
                {squadOptions.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({POSITION_LABELS[p.position] ?? p.position})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>{isSelling ? 'Para o clube' : 'Clube de origem'}</label>
              <input
                className={styles.formInput}
                value={isSelling ? toClub : fromClub}
                onChange={e => isSelling ? setToClub(e.target.value) : setFromClub(e.target.value)}
                placeholder="Nome do clube"
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Taxa de transferência</label>
              <input className={styles.formInput} value={fee} onChange={e => setFee(e.target.value)} type="number" min={0} placeholder="0" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Salário</label>
              <input className={styles.formInput} value={wage} onChange={e => setWage(e.target.value)} type="number" min={0} placeholder="0 / mês" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Valor de mercado</label>
              <input className={styles.formInput} value={marketValue} onChange={e => setMarketValue(e.target.value)} type="number" min={0} />
            </div>
            {(transType === 'loan_in' || transType === 'loan_out') && (
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Duração (meses)</label>
                <input className={styles.formInput} value={loanMonths} onChange={e => setLoanMonths(e.target.value)} type="number" min={1} max={24} />
              </div>
            )}
          </div>

          {!canAfford && fee && (
            <div className={styles.warning}>
              Saldo insuficiente. Caixa atual: {formatMoney(finance.balance, finance.currency)} · Taxa: {formatMoney(parseFloat(fee), finance.currency)}
            </div>
          )}

          <div className={styles.formActions}>
            <button className={styles.btnPrimary} onClick={executeTransferOp}>
              Registrar transferência
            </button>
          </div>
        </div>
      )}

      {tab === 'history' && (
        <>
          {transfers.history.length === 0 ? (
            <div className={styles.emptyState}>Nenhuma operação registrada ainda.</div>
          ) : (
            <div className={styles.historyList}>
              {transfers.history.map(r => (
                <div key={r.id} className={styles.historyRow}>
                  <span className={`${styles.historyBadge} ${transferBadgeClass(r.type)}`}>
                    {transferBadgeLabel(r.type)}
                  </span>
                  <div>
                    <p className={styles.historyName}>{r.playerSnapshot.name}</p>
                    <p className={styles.historyMeta}>
                      {r.fromClub} → {r.toClub} · {r.date}
                    </p>
                  </div>
                  <span className={styles.historyFee}>
                    {r.fee > 0 ? formatMoney(r.type === 'sell' || r.type === 'loan_out' ? r.fee : -r.fee, finance.currency) : 'Grátis'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
