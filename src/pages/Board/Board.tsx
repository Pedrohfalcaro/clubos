import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../../context/GameContext';
import { boardStatus } from '../../types/Board';
import type { BoardGoal, BoardGoalKind } from '../../types/Board';
import ClubCrest from '../../components/ClubCrest/ClubCrest';
import { DEFAULT_PRIMARY, DEFAULT_SECONDARY } from '../../utils/clubColors';
import { formatMoney, newLedgerEntry } from '../../utils/finance';
import { downloadSaveBackup } from '../../utils/backup';
import { analyzeLiveLifeGaps } from '../../utils/livelifeTemplates';
import { LIVELIFE_CHANGELOG } from '../../types/LiveLife';
import MoneyAmountHint from '../../components/MoneyAmountHint/MoneyAmountHint';
import styles from './Board.module.css';

type Tab = 'confidence' | 'goals' | 'club' | 'season' | 'livelife';

const GOAL_KINDS: { kind: BoardGoalKind; label: string; icon: string; unit: string }[] = [
  { kind: 'league_position', label: 'Posição no campeonato', icon: '🏆', unit: 'posição (1 = 1º)' },
  { kind: 'dont_spend_over', label: 'Não gastar mais que', icon: '💸', unit: 'R$' },
  { kind: 'sell_players', label: 'Vender jogadores', icon: '↗', unit: 'jogadores' },
  { kind: 'wage_bill_cap', label: 'Folha máxima', icon: '📋', unit: 'R$ / mês' },
  { kind: 'win_competition', label: 'Ganhar competição', icon: '🥇', unit: 'conquistas' },
];

const STATUS_LABELS = {
  stable: 'Estável',
  watchful: 'Vigilante',
  crisis: 'Crise',
};

function goalKindIcon(kind: BoardGoalKind): string {
  return GOAL_KINDS.find(g => g.kind === kind)?.icon ?? '◎';
}

function goalKindLabel(kind: BoardGoalKind): string {
  return GOAL_KINDS.find(g => g.kind === kind)?.label ?? kind;
}

export default function Board() {
  const {
    state,
    setBoardGoal,
    removeBoardGoal,
    updateTeam,
    applyLedger,
    getSaveSnapshot,
    advanceSeason,
    setCurrentDate,
    completeLiveLifeOnboarding,
    addClubDebt,
  } = useGame();
  const navigate = useNavigate();
  const {
    board, team, season, finance, matches, players, transfers, currentDate,
    seasonCompetitions, livelife,
  } = state;

  const [tab, setTab] = useState<Tab>('confidence');
  const [showLiveLifeGuide, setShowLiveLifeGuide] = useState(false);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupMsg, setBackupMsg] = useState('');
  const [showAdvanceConfirm, setShowAdvanceConfirm] = useState(false);
  const [advancedTo, setAdvancedTo] = useState<number | null>(null);
  const [showLiveLifeModal, setShowLiveLifeModal] = useState(() => currentDate == null);
  const [careerDate, setCareerDate] = useState(currentDate ?? `${season}-01-01`);
  const [activateDate, setActivateDate] = useState(`${season}-01-01`);
  const [dateSaved, setDateSaved] = useState(false);

  const primary = team?.primaryColor ?? DEFAULT_PRIMARY;
  const secondary = team?.secondaryColor ?? DEFAULT_SECONDARY;
  const conf = team?.boardConfidence ?? 70;
  const status = boardStatus(conf);
  const fanConf = team?.supporterConfidence ?? 65;
  const fanStatus = boardStatus(fanConf);

  // Club edit state
  const [clubName, setClubName] = useState(team?.name ?? '');
  const [description, setDescription] = useState(team?.description ?? '');
  const [fans, setFans] = useState(String(team?.fans ?? ''));
  const [primaryColor, setPrimaryColor] = useState(primary);
  const [secondaryColor, setSecondaryColor] = useState(secondary);
  const [budget, setBudget] = useState(String(finance.balance));
  const [clubSaved, setClubSaved] = useState(false);
  const [debtLabel, setDebtLabel] = useState('Dívida do clube');
  const [debtAmount, setDebtAmount] = useState('');
  const [debtMonthly, setDebtMonthly] = useState('');
  const [debtDay, setDebtDay] = useState('5');
  const [debtSaved, setDebtSaved] = useState(false);

  // Goal form state
  const [goalKind, setGoalKind] = useState<BoardGoalKind>('league_position');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalLabel, setGoalLabel] = useState('');

  function saveClub() {
    updateTeam({
      name: clubName.trim() || team?.name,
      description: description.trim() || undefined,
      fans: parseInt(fans, 10) || team?.fans,
      primaryColor,
      secondaryColor,
    });

    const target = parseFloat(budget.replace(',', '.'));
    if (!isNaN(target) && target !== finance.balance) {
      const delta = target - finance.balance;
      applyLedger(newLedgerEntry(
        'adjustment',
        delta,
        'Ajuste de orçamento pela diretoria',
        season,
        undefined,
        currentDate ?? undefined,
      ));
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(careerDate) && careerDate !== currentDate) {
      setCurrentDate(careerDate);
      setDateSaved(true);
      setShowLiveLifeModal(false);
      setTimeout(() => setDateSaved(false), 2000);
    }

    setClubSaved(true);
    setTimeout(() => setClubSaved(false), 2000);
  }

  function activateLiveLife() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(activateDate)) return;
    setCurrentDate(activateDate);
    setCareerDate(activateDate);
    setShowLiveLifeModal(false);
  }

  async function handleBackup() {
    const snap = getSaveSnapshot();
    if (!snap) {
      setBackupMsg('Nenhum save ativo para baixar.');
      return;
    }
    setBackupBusy(true);
    setBackupMsg('');
    try {
      await downloadSaveBackup(snap, team?.name);
      setBackupMsg('Backup baixado.');
    } catch (err) {
      console.error(err);
      setBackupMsg('Falha ao gerar o ZIP.');
    } finally {
      setBackupBusy(false);
      setTimeout(() => setBackupMsg(''), 3000);
    }
  }

  function submitGoal() {
    const target = parseFloat(goalTarget.replace(',', '.'));
    if (isNaN(target) || target <= 0) return;
    const g: BoardGoal = {
      id: `goal-${Date.now()}`,
      season,
      kind: goalKind,
      label: goalLabel.trim() || goalKindLabel(goalKind),
      target,
      current: 0,
      status: 'active',
    };
    setBoardGoal(g);
    setGoalKind('league_position');
    setGoalTarget('');
    setGoalLabel('');
    setShowGoalForm(false);
  }

  const activeGoals = board.goals.filter(g => g.season === season || g.status === 'active');

  const seasonSummary = useMemo(() => {
    const completed = matches.filter(m => m.status === 'completed');
    const wins = completed.filter(m => m.result === 'win').length;
    const draws = completed.filter(m => m.result === 'draw').length;
    const losses = completed.filter(m => m.result === 'loss').length;
    const gf = completed.reduce((s, m) => s + (m.goalsFor ?? 0), 0);
    const ga = completed.reduce((s, m) => s + (m.goalsAgainst ?? 0), 0);
    const income = finance.ledger
      .filter(e => e.season === season && e.amount > 0)
      .reduce((s, e) => s + e.amount, 0);
    const expense = finance.ledger
      .filter(e => e.season === season && e.amount < 0)
      .reduce((s, e) => s + e.amount, 0);
    const transfersSeason = transfers.history.filter(t => t.season === season);
    const topScorers = [...players]
      .filter(p => p.stats.goals > 0)
      .sort((a, b) => b.stats.goals - a.stats.goals)
      .slice(0, 3);
    const goalsDone = board.goals.filter(g => g.season === season && g.status === 'done').length;
    const goalsActive = board.goals.filter(g => g.season === season && g.status === 'active').length;

    return {
      matches: completed.length,
      wins,
      draws,
      losses,
      gf,
      ga,
      income,
      expense,
      transfers: transfersSeason.length,
      topScorers,
      goalsDone,
      goalsActive,
      confidence: team?.boardConfidence ?? 0,
      balance: finance.balance,
    };
  }, [matches, finance, season, transfers.history, players, board.goals, team?.boardConfidence]);

  function confirmAdvanceSeason() {
    const next = season + 1;
    advanceSeason();
    setShowAdvanceConfirm(false);
    setAdvancedTo(next);
  }

  const confBarColor = status === 'stable' ? '#22c55e' : status === 'watchful' ? '#ca8a04' : '#ef4444';
  const statusClass = status === 'stable' ? styles.statusStable : status === 'watchful' ? styles.statusWatchful : styles.statusCrisis;
  const fanBarColor = fanStatus === 'stable' ? '#22c55e' : fanStatus === 'watchful' ? '#ca8a04' : '#ef4444';
  const fanStatusClass = fanStatus === 'stable' ? styles.statusStable : fanStatus === 'watchful' ? styles.statusWatchful : styles.statusCrisis;

  const liveLifeChecklist = useMemo(() => {
    const gaps = analyzeLiveLifeGaps({
      finance,
      competitions: seasonCompetitions,
      players,
      team,
      currentDate,
    });
    // Spec Fase 4: salários, premiação, estádio
    return gaps.filter(g => g.id === 'salaries' || g.id === 'prizes' || g.id === 'stadium');
  }, [finance, seasonCompetitions, players, team, currentDate]);

  const checklistDone = liveLifeChecklist.every(g => g.ok);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1>Diretoria</h1>
          <p>Temporada {season}</p>
        </div>
      </div>

      <div className={styles.tabs}>
        {([
          ['confidence', 'Confiança'],
          ['goals', 'Metas'],
          ['club', 'Identidade do clube'],
          ['season', 'Temporada'],
          ['livelife', 'LiveLife'],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            className={`${styles.tab} ${tab === key ? styles.tabActive : ''}`}
            onClick={() => setTab(key)}
          >
            {label}
            {key === 'livelife' && !livelife.onboardingComplete && !checklistDone && (
              <span className={styles.tabDot} aria-hidden />
            )}
          </button>
        ))}
      </div>

      {tab === 'confidence' && (
        <>
          <div className={styles.confGrid}>
            <div className={styles.confCard}>
              <div className={styles.confHead}>
                <span className={styles.confLabel}>Confiança da Diretoria</span>
                <span className={`${styles.confStatus} ${statusClass}`}>
                  {STATUS_LABELS[status]}
                </span>
              </div>
              <p className={styles.confValue}>{conf}</p>
              <div className={styles.confBar}>
                <div
                  className={styles.confFill}
                  style={{ width: `${conf}%`, background: confBarColor }}
                />
              </div>
              <p className={styles.confHint}>
                Vitória <strong>+3</strong> · Empate <strong>0</strong> · Derrota <strong>−4</strong>
              </p>
              <p className={styles.confHintMuted}>
                Baixa → mais cobranças no Pulse · Alta → mais apoio e boas notícias
              </p>
            </div>

            <div className={styles.confCard}>
              <div className={styles.confHead}>
                <span className={styles.confLabel}>Moral da Torcida</span>
                <span className={`${styles.confStatus} ${fanStatusClass}`}>
                  {STATUS_LABELS[fanStatus]}
                </span>
              </div>
              <p className={styles.confValue}>{fanConf}</p>
              <div className={styles.confBar}>
                <div
                  className={styles.confFill}
                  style={{ width: `${fanConf}%`, background: fanBarColor }}
                />
              </div>
              <p className={styles.confHint}>
                Vitória <strong>+4</strong> · Empate <strong>−1</strong> · Derrota <strong>−5</strong>
              </p>
              <p className={styles.confHintMuted}>
                Baixa → protestos e críticas · Alta → festa, apoio e idolatria
              </p>
            </div>
          </div>

          {board.notes && (
            <div className={styles.notesCard}>
              "{board.notes}"
            </div>
          )}

          {board.confidenceHistory.length > 0 && (
            <div>
              <h3 className={styles.sectionTitle} style={{ marginBottom: 10 }}>Histórico — Diretoria</h3>
              <div className={styles.confHistory}>
                {board.confidenceHistory.slice(0, 10).map((e, i) => {
                  const prev = board.confidenceHistory[i + 1];
                  const delta = prev ? e.value - prev.value : 0;
                  return (
                    <div key={`b-${i}`} className={styles.confHistEntry}>
                      <span className={styles.confHistDate}>{e.date}</span>
                      <span className={styles.confHistReason}>{e.reason}</span>
                      <span className={`${styles.confHistVal} ${delta > 0 ? styles.up : delta < 0 ? styles.down : ''}`}>
                        {delta > 0 ? '+' : ''}{delta !== 0 ? delta : '—'} → {e.value}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {(board.supporterHistory?.length ?? 0) > 0 && (
            <div>
              <h3 className={styles.sectionTitle} style={{ marginBottom: 10 }}>Histórico — Torcida</h3>
              <div className={styles.confHistory}>
                {board.supporterHistory.slice(0, 10).map((e, i) => {
                  const prev = board.supporterHistory[i + 1];
                  const delta = prev ? e.value - prev.value : 0;
                  return (
                    <div key={`f-${i}`} className={styles.confHistEntry}>
                      <span className={styles.confHistDate}>{e.date}</span>
                      <span className={styles.confHistReason}>{e.reason}</span>
                      <span className={`${styles.confHistVal} ${delta > 0 ? styles.up : delta < 0 ? styles.down : ''}`}>
                        {delta > 0 ? '+' : ''}{delta !== 0 ? delta : '—'} → {e.value}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'goals' && (
        <>
          <div className={styles.sectionHead}>
            <h3 className={styles.sectionTitle}>Metas da temporada {season}</h3>
            <button className={styles.btnPrimary} onClick={() => setShowGoalForm(true)}>
              + Meta
            </button>
          </div>

          {activeGoals.length === 0 ? (
            <div className={styles.emptyState}>
              Nenhuma meta definida ainda. Adicione metas para acompanhar os objetivos da diretoria.
            </div>
          ) : (
            <div className={styles.goalList}>
              {activeGoals.map(goal => (
                <GoalCard key={goal.id} goal={goal} onRemove={() => removeBoardGoal(goal.id)} />
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'club' && team && (
        <div className={styles.editCard}>
          <p className={styles.editTitle}>Identidade do clube</p>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <ClubCrest primary={primaryColor} secondary={secondaryColor} size={52} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Nome do clube</label>
                <input
                  className={styles.formInput}
                  value={clubName}
                  onChange={e => setClubName(e.target.value)}
                  placeholder="Nome do clube"
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Cor primária</label>
              <div className={styles.colorRow}>
                <input
                  type="color"
                  value={primaryColor}
                  onChange={e => setPrimaryColor(e.target.value)}
                  style={{ width: 36, height: 36, border: 'none', background: 'none', cursor: 'pointer', borderRadius: 8 }}
                />
                <input
                  className={styles.formInput}
                  value={primaryColor}
                  onChange={e => setPrimaryColor(e.target.value)}
                  style={{ flex: 1 }}
                  maxLength={7}
                />
              </div>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Cor secundária</label>
              <div className={styles.colorRow}>
                <input
                  type="color"
                  value={secondaryColor}
                  onChange={e => setSecondaryColor(e.target.value)}
                  style={{ width: 36, height: 36, border: 'none', background: 'none', cursor: 'pointer', borderRadius: 8 }}
                />
                <input
                  className={styles.formInput}
                  value={secondaryColor}
                  onChange={e => setSecondaryColor(e.target.value)}
                  style={{ flex: 1 }}
                  maxLength={7}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Torcedores</label>
              <input
                className={styles.formInput}
                value={fans}
                onChange={e => setFans(e.target.value)}
                type="number"
                min={0}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Caixa / orçamento</label>
              <input
                className={styles.formInput}
                value={budget}
                onChange={e => setBudget(e.target.value)}
                type="number"
              />
              <MoneyAmountHint value={budget} currency={finance.currency} />
              <span style={{ fontSize: 11, color: 'var(--text)' }}>
                Atual: {formatMoney(finance.balance, finance.currency)} — a diferença vira um ajuste no extrato
              </span>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Data base da carreira (LiveLife)</label>
            <input
              className={styles.formInput}
              type="date"
              value={careerDate}
              onChange={e => setCareerDate(e.target.value)}
            />
            <span style={{ fontSize: 11, color: 'var(--text)' }}>
              {currentDate
                ? `Clock ativo: ${new Date(`${currentDate}T12:00:00`).toLocaleDateString('pt-BR')}`
                : 'Sem data — o modo contínuo está desativado até você definir.'}
              {dateSaved ? ' · Data salva!' : ''}
            </span>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Descrição do clube</label>
            <textarea
              className={styles.formTextarea}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Uma breve história ou visão do clube..."
              rows={3}
            />
          </div>

          <div className={styles.saveRow}>
            <button className={styles.btnPrimary} onClick={saveClub}>
              {clubSaved ? 'Salvo!' : 'Salvar alterações'}
            </button>
          </div>

          <div className={styles.backupBlock}>
            <p className={styles.editTitle}>Registrar dívida</p>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text)', lineHeight: 1.4 }}>
              Adiciona uma dívida sem mexer no caixa. Parcela mensal obrigatória no dia escolhido
              (calendário); ignorar gera juros.
            </p>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Descrição</label>
              <input
                className={styles.formInput}
                value={debtLabel}
                onChange={e => setDebtLabel(e.target.value)}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Valor total</label>
                <input
                  className={styles.formInput}
                  type="number"
                  min={1}
                  value={debtAmount}
                  onChange={e => setDebtAmount(e.target.value)}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Parcela *</label>
                <input
                  className={styles.formInput}
                  type="number"
                  min={1}
                  value={debtMonthly}
                  onChange={e => setDebtMonthly(e.target.value)}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Dia (1–28)</label>
                <input
                  className={styles.formInput}
                  type="number"
                  min={1}
                  max={28}
                  value={debtDay}
                  onChange={e => setDebtDay(e.target.value)}
                />
              </div>
            </div>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => {
                const amt = Math.round(parseFloat(debtAmount.replace(',', '.')) || 0);
                const monthly = Math.round(parseFloat(debtMonthly.replace(',', '.')) || 0);
                if (amt < 1 || monthly < 1) return;
                addClubDebt({
                  amount: amt,
                  monthlyInstallment: monthly,
                  paymentDay: Math.round(parseFloat(debtDay) || 5),
                  label: debtLabel.trim() || 'Dívida do clube',
                });
                setDebtAmount('');
                setDebtMonthly('');
                setDebtSaved(true);
                setTimeout(() => setDebtSaved(false), 2000);
              }}
            >
              {debtSaved ? 'Dívida registrada!' : 'Adicionar dívida'}
            </button>
          </div>

          <div className={styles.backupBlock}>
            <p className={styles.editTitle}>Backup</p>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text)', lineHeight: 1.4 }}>
              Baixa um ZIP com o save completo da carreira (save.json). Guarde em local seguro.
            </p>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={handleBackup}
              disabled={backupBusy}
            >
              {backupBusy ? 'Gerando...' : 'Criar backup (ZIP)'}
            </button>
            {backupMsg && <p style={{ margin: 0, fontSize: 12, color: 'var(--accent)' }}>{backupMsg}</p>}
          </div>
        </div>
      )}

      {tab === 'livelife' && (
        <div className={styles.liveLifeWrap}>
          <div className={styles.editCard}>
            <p className={styles.editTitle}>LiveLife</p>
            <p className={styles.liveLifeIntro}>
              Modo de calendário contínuo: avance o dia, gerencie bilheteria, folha e disponibilidade do elenco.
            </p>
            <div className={styles.liveLifeActions}>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={() => setShowLiveLifeGuide(true)}
              >
                Tutorial & Guia LiveLife
              </button>
              {!livelife.onboardingComplete && checklistDone && (
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={completeLiveLifeOnboarding}
                >
                  Concluir onboarding
                </button>
              )}
              {livelife.onboardingComplete && (
                <span className={styles.liveLifeBadgeOk}>Guia concluído</span>
              )}
            </div>
          </div>

          <div className={styles.editCard}>
            <p className={styles.editTitle}>Checklist obrigatório</p>
            <ul className={styles.checkList}>
              {liveLifeChecklist.map(item => (
                <li
                  key={item.id}
                  className={`${styles.checkItem} ${item.ok ? styles.checkOk : styles.checkPending}`}
                >
                  <div className={styles.checkText}>
                    <strong>{item.ok ? '✓' : '!'} {item.title}</strong>
                    <span>{item.detail}</span>
                  </div>
                  {!item.ok && (
                    <button
                      type="button"
                      className={styles.checkLink}
                      onClick={() => navigate(item.href)}
                    >
                      Ir →
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.editCard}>
            <p className={styles.editTitle}>Changelog</p>
            <ul className={styles.changelogList}>
              {LIVELIFE_CHANGELOG.map(entry => (
                <li key={entry.version} className={styles.changelogItem}>
                  <div className={styles.changelogHead}>
                    <span className={styles.changelogVer}>{entry.version}</span>
                    <span className={styles.changelogTitle}>{entry.title}</span>
                  </div>
                  <p className={styles.changelogBody}>{entry.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {tab === 'season' && (
        <div className={styles.editCard}>
          <p className={styles.editTitle}>Resumo da temporada {season}</p>

          {advancedTo != null && (
            <div className={styles.seasonBanner}>
              Temporada {advancedTo} iniciada. Elenco envelheceu +1 ano; estatísticas da temporada zeradas.
            </div>
          )}

          <div className={styles.seasonGrid}>
            <div className={styles.seasonStat}>
              <span className={styles.seasonStatVal}>{seasonSummary.matches}</span>
              <span className={styles.seasonStatLbl}>Jogos</span>
            </div>
            <div className={styles.seasonStat}>
              <span className={styles.seasonStatVal}>
                {seasonSummary.wins}-{seasonSummary.draws}-{seasonSummary.losses}
              </span>
              <span className={styles.seasonStatLbl}>V-E-D</span>
            </div>
            <div className={styles.seasonStat}>
              <span className={styles.seasonStatVal}>
                {seasonSummary.gf}:{seasonSummary.ga}
              </span>
              <span className={styles.seasonStatLbl}>Gols (pró/contra)</span>
            </div>
            <div className={styles.seasonStat}>
              <span className={styles.seasonStatVal}>{seasonSummary.confidence}%</span>
              <span className={styles.seasonStatLbl}>Confiança</span>
            </div>
          </div>

          <div className={styles.seasonRows}>
            <div className={styles.seasonRow}>
              <span>Caixa atual</span>
              <strong>{formatMoney(seasonSummary.balance, finance.currency)}</strong>
            </div>
            <div className={styles.seasonRow}>
              <span>Receitas da temporada</span>
              <strong className={styles.seasonIn}>+{formatMoney(seasonSummary.income, finance.currency)}</strong>
            </div>
            <div className={styles.seasonRow}>
              <span>Despesas da temporada</span>
              <strong className={styles.seasonOut}>{formatMoney(seasonSummary.expense, finance.currency)}</strong>
            </div>
            <div className={styles.seasonRow}>
              <span>Transferências</span>
              <strong>{seasonSummary.transfers}</strong>
            </div>
            <div className={styles.seasonRow}>
              <span>Metas (cumpridas / ativas)</span>
              <strong>{seasonSummary.goalsDone} / {seasonSummary.goalsActive}</strong>
            </div>
          </div>

          {seasonSummary.topScorers.length > 0 && (
            <div>
              <p className={styles.editTitle}>Artilharia</p>
              <ul className={styles.seasonScorers}>
                {seasonSummary.topScorers.map(p => (
                  <li key={p.id}>
                    <span>{p.name}</span>
                    <strong>{p.stats.goals} gols</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className={styles.seasonHint}>
            Avançar fecha a temporada {season} e abre {season + 1}: idades +1, stats da temporada zeradas,
            metas ativas marcadas como falhas, Pulse liberado de novo.
          </p>

          <div className={styles.saveRow}>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => {
                setAdvancedTo(null);
                setShowAdvanceConfirm(true);
              }}
            >
              Avançar para {season + 1}
            </button>
          </div>
        </div>
      )}

      {showAdvanceConfirm && (
        <div className={styles.overlay} onClick={() => setShowAdvanceConfirm(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <p className={styles.modalTitle}>Encerrar temporada {season}?</p>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text)', lineHeight: 1.45 }}>
              Resumo rápido: {seasonSummary.matches} jogos ({seasonSummary.wins}V {seasonSummary.draws}E {seasonSummary.losses}D),
              {' '}{seasonSummary.gf} gols feitos, caixa {formatMoney(seasonSummary.balance, finance.currency)}.
              {' '}Isso não pode ser desfeito.
            </p>
            <div className={styles.modalActions}>
              <button type="button" className={styles.btnSecondary} onClick={() => setShowAdvanceConfirm(false)}>
                Cancelar
              </button>
              <button type="button" className={styles.btnPrimary} onClick={confirmAdvanceSeason}>
                Confirmar → {season + 1}
              </button>
            </div>
          </div>
        </div>
      )}

      {showLiveLifeGuide && (
        <div className={styles.overlay} onClick={() => setShowLiveLifeGuide(false)}>
          <div className={`${styles.modal} ${styles.modalWide}`} onClick={e => e.stopPropagation()}>
            <p className={styles.modalTitle}>Tutorial & Guia LiveLife</p>
            <ol className={styles.guideList}>
              <li>
                <strong>Calendário contínuo</strong>
                <span>No Dashboard, use Avançar Dia. No dia de jogo aparece Jogar; no dia 5 cobramos a folha.</span>
              </li>
              <li>
                <strong>Salários do elenco</strong>
                <span>Todo atleta ativo precisa de salário — alimenta a folha mensal.</span>
              </li>
              <li>
                <strong>Premiações</strong>
                <span>Em Financeiro → Premiações, defina vitória/empate por competição.</span>
              </li>
              <li>
                <strong>Estádio</strong>
                <span>Em Financeiro → Estádio, capacidade e preços geram bilheteria após cada partida.</span>
              </li>
            </ol>
            <ul className={styles.checkList}>
              {liveLifeChecklist.map(item => (
                <li
                  key={item.id}
                  className={`${styles.checkItem} ${item.ok ? styles.checkOk : styles.checkPending}`}
                >
                  <div className={styles.checkText}>
                    <strong>{item.ok ? '✓' : '!'} {item.title}</strong>
                    <span>{item.detail}</span>
                  </div>
                </li>
              ))}
            </ul>
            <div className={styles.modalActions}>
              <button type="button" className={styles.btnSecondary} onClick={() => setShowLiveLifeGuide(false)}>
                Fechar
              </button>
              {checklistDone && (
                <button
                  type="button"
                  className={styles.btnPrimary}
                  onClick={() => {
                    completeLiveLifeOnboarding();
                    setShowLiveLifeGuide(false);
                  }}
                >
                  {livelife.onboardingComplete ? 'Ok' : 'Concluir guia'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showLiveLifeModal && currentDate == null && (
        <div className={styles.overlay}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <p className={styles.modalTitle}>Ativar LiveLife</p>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text)', lineHeight: 1.45 }}>
              Esta carreira ainda não tem data base. Defina o dia inicial do calendário contínuo
              para usar <strong>Avançar Dia</strong> no Dashboard.
            </p>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Data base da carreira</label>
              <input
                className={styles.formInput}
                type="date"
                value={activateDate}
                onChange={e => setActivateDate(e.target.value)}
              />
            </div>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setShowLiveLifeModal(false)}
              >
                Depois
              </button>
              <button type="button" className={styles.btnPrimary} onClick={activateLiveLife}>
                Ativar calendário
              </button>
            </div>
          </div>
        </div>
      )}

      {showGoalForm && (
        <div className={styles.overlay} onClick={() => setShowGoalForm(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <p className={styles.modalTitle}>Nova meta</p>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Tipo de meta</label>
              <select
                className={styles.formInput}
                value={goalKind}
                onChange={e => setGoalKind(e.target.value as BoardGoalKind)}
              >
                {GOAL_KINDS.map(g => (
                  <option key={g.kind} value={g.kind}>{g.icon} {g.label}</option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>
                Alvo ({GOAL_KINDS.find(g => g.kind === goalKind)?.unit})
              </label>
              <input
                className={styles.formInput}
                value={goalTarget}
                onChange={e => setGoalTarget(e.target.value)}
                type="number"
                min={0}
                placeholder="Ex: 6"
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Descrição personalizada (opcional)</label>
              <input
                className={styles.formInput}
                value={goalLabel}
                onChange={e => setGoalLabel(e.target.value)}
                placeholder={goalKindLabel(goalKind)}
              />
            </div>

            <div className={styles.modalActions}>
              <button className={styles.btnSecondary} onClick={() => setShowGoalForm(false)}>Cancelar</button>
              <button className={styles.btnPrimary} onClick={submitGoal}>Adicionar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GoalCard({ goal, onRemove }: { goal: BoardGoal; onRemove: () => void }) {
  const statusClass = goal.status === 'done' ? styles.badgeDone : goal.status === 'failed' ? styles.badgeFailed : styles.badgeActive;
  const statusLabel = goal.status === 'done' ? 'Concluída' : goal.status === 'failed' ? 'Falhou' : 'Ativa';
  const cardClass = goal.status === 'done' ? styles.goalDone : goal.status === 'failed' ? styles.goalFailed : '';

  return (
    <div className={`${styles.goalCard} ${cardClass}`}>
      <span className={styles.goalIcon}>{goalKindIcon(goal.kind)}</span>
      <div className={styles.goalBody}>
        <span className={styles.goalName}>{goal.label}</span>
        <span className={styles.goalProgress}>
          Alvo: {goal.target} · Progresso: {goal.current}
        </span>
      </div>
      <span className={`${styles.goalStatusBadge} ${statusClass}`}>{statusLabel}</span>
      <button className={styles.goalRemove} onClick={onRemove}>×</button>
    </div>
  );
}
