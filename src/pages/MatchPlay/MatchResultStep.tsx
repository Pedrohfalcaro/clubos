import { useMemo, useState } from 'react';
import MinuteInput from '../../components/MinuteInput/MinuteInput';
import SearchableSelect from '../../components/SearchableSelect/SearchableSelect';
import SubstitutionModal from '../../components/SubstitutionModal/SubstitutionModal';
import CollapsibleEventBlock from '../../components/CollapsibleEventBlock/CollapsibleEventBlock';
import MatchTimeline, { type TimelineEvent } from '../../components/MatchTimeline/MatchTimeline';
import type { Player } from '../../types/Player';
import type {
  MatchMinute,
  SubstitutionEvent,
  TeamGoalEntry,
  TeamCardEntry,
  OpponentGoalEntry,
  OpponentCardEntry,
  OpponentSubEntry,
} from '../../types/Match';
import { defaultMinute, formatMinute, uid } from '../../utils/matchEvents';
import { getFieldPlayerIds, isPlayerOnField } from '../../utils/matchPlayHelpers';
import styles from './MatchResultStep.module.css';

interface MatchResultStepProps {
  teamName: string;
  opponentName: string;
  homeTeam: string;
  awayTeam: string;
  isTeamHome: boolean;
  goalsFor: number;
  goalsAgainst: number;
  onGoalsForChange: (v: number) => void;
  onGoalsAgainstChange: (v: number) => void;
  starters: string[];
  bench: string[];
  players: Player[];
  teamGoals: TeamGoalEntry[];
  onTeamGoalsChange: (g: TeamGoalEntry[]) => void;
  teamCards: TeamCardEntry[];
  onTeamCardsChange: (c: TeamCardEntry[]) => void;
  teamSubs: SubstitutionEvent[];
  onTeamSubsChange: (s: SubstitutionEvent[]) => void;
  opponentGoals: OpponentGoalEntry[];
  onOpponentGoalsChange: (g: OpponentGoalEntry[]) => void;
  opponentCards: OpponentCardEntry[];
  onOpponentCardsChange: (c: OpponentCardEntry[]) => void;
  opponentSubs: OpponentSubEntry[];
  onOpponentSubsChange: (s: OpponentSubEntry[]) => void;
}

function isFormOpen(id: string, complete: boolean, expandedIds: Set<string>) {
  return expandedIds.has(id) || !complete;
}

function isTeamGoalComplete(g: TeamGoalEntry): boolean {
  return g.type === 'own' ? !!g.opponentScorerName?.trim() : !!g.playerId;
}

function teamGoalSummary(g: TeamGoalEntry, players: Player[]): string {
  const min = formatMinute(g.minute);
  if (g.type === 'own') return `${min} · GC ${g.opponentScorerName}`;
  const scorer = players.find(p => p.id === g.playerId)?.name ?? '—';
  const assist = g.assistPlayerId ? players.find(p => p.id === g.assistPlayerId)?.name : null;
  return assist ? `${min} · ⚽ ${scorer} (${assist})` : `${min} · ⚽ ${scorer}`;
}

export default function MatchResultStep(props: MatchResultStepProps) {
  const {
    teamName, opponentName, homeTeam, awayTeam, isTeamHome,
    goalsFor, goalsAgainst, onGoalsForChange, onGoalsAgainstChange,
    starters, bench, players,
    teamGoals, onTeamGoalsChange,
    teamCards, onTeamCardsChange,
    teamSubs, onTeamSubsChange,
    opponentGoals, onOpponentGoalsChange,
    opponentCards, onOpponentCardsChange,
    opponentSubs, onOpponentSubsChange,
  } = props;

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [subModal, setSubModal] = useState<{ playerIn: Player; required: boolean } | null>(null);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [voluntarySubOpen, setVoluntarySubOpen] = useState(false);
  const [volIn, setVolIn] = useState('');
  const [volOut, setVolOut] = useState('');
  const [volMinute, setVolMinute] = useState<MatchMinute>(defaultMinute());

  const squadIds = useMemo(() => [...starters, ...bench], [starters, bench]);
  const squadOptions = useMemo(
    () => squadIds.map(id => players.find(p => p.id === id)).filter(Boolean).map(p => ({ value: p!.id, label: p!.name })),
    [squadIds, players],
  );

  const fieldIds = useMemo(() => getFieldPlayerIds(starters, teamSubs), [starters, teamSubs]);
  const fieldOptions = useMemo(
    () => [...fieldIds].map(id => players.find(p => p.id === id)).filter(Boolean).map(p => ({ value: p!.id, label: p!.name })),
    [fieldIds, players],
  );

  function openEdit(id: string) {
    setExpandedIds(prev => new Set(prev).add(id));
  }

  function resolvePlayer(id: string) {
    return players.find(p => p.id === id);
  }

  function ensureOnField(playerId: string, cb: () => void) {
    if (isPlayerOnField(playerId, starters, teamSubs)) {
      cb();
      return;
    }
    const p = resolvePlayer(playerId);
    if (!p) return;
    setSubModal({ playerIn: p, required: true });
    setPendingAction(() => () => cb());
  }

  function handleSubConfirm(data: { playerInId: string; playerOutId: string; minute: MatchMinute }) {
    const pin = resolvePlayer(data.playerInId);
    const pout = resolvePlayer(data.playerOutId);
    if (!pin || !pout) return;
    const sub: SubstitutionEvent = {
      id: uid(),
      playerInId: data.playerInId,
      playerInName: pin.name,
      playerOutId: data.playerOutId,
      playerOutName: pout.name,
      minute: data.minute,
      side: 'team',
    };
    onTeamSubsChange([...teamSubs, sub]);
    setSubModal(null);
    pendingAction?.();
    setPendingAction(null);
  }

  function updateGoal(index: number, patch: Partial<TeamGoalEntry>) {
    onTeamGoalsChange(teamGoals.map((g, i) => (i === index ? { ...g, ...patch } : g)));
  }

  function addCard(type: 'yellow' | 'red') {
    const id = uid();
    onTeamCardsChange([
      ...teamCards,
      { id, playerId: '', playerName: '', type, minute: defaultMinute() },
    ]);
    setExpandedIds(prev => new Set(prev).add(id));
  }

  function updateCard(id: string, patch: Partial<TeamCardEntry>) {
    onTeamCardsChange(teamCards.map(c => (c.id === id ? { ...c, ...patch } : c)));
  }

  function applyCardPlayer(card: TeamCardEntry, playerId: string) {
    const p = resolvePlayer(playerId);
    if (!p) return;
    ensureOnField(playerId, () => {
      const yellows = teamCards.filter(c => c.type === 'yellow' && c.playerId === playerId).length;
      const hasRed = teamCards.some(c => c.type === 'red' && c.playerId === playerId);
      if (card.type === 'red' && hasRed) return;
      if (card.type === 'yellow' && (yellows >= 2 || hasRed)) return;

      let updated = teamCards.map(c =>
        c.id === card.id ? { ...c, playerId, playerName: p.name } : c,
      );

      if (card.type === 'yellow') {
        const totalYellows = updated.filter(c => c.type === 'yellow' && c.playerId === playerId).length;
        if (totalYellows >= 2 && !updated.some(c => c.type === 'red' && c.playerId === playerId)) {
          updated = [...updated, {
            id: uid(),
            playerId,
            playerName: p.name,
            type: 'red' as const,
            minute: card.minute,
          }];
        }
      }
      onTeamCardsChange(updated);
    });
  }

  function buildTeamTimeline(): TimelineEvent[] {
    const side: 'home' | 'away' = isTeamHome ? 'home' : 'away';
    const events: TimelineEvent[] = [];

    for (const g of teamGoals) {
      if (g.type === 'own' && g.opponentScorerName) {
        events.push({ id: g.id, side, kind: 'own_goal', minute: g.minute, scorer: g.opponentScorerName });
      } else if (g.type === 'team' && g.playerId) {
        const scorer = resolvePlayer(g.playerId)?.name ?? '';
        const assist = g.assistPlayerId ? resolvePlayer(g.assistPlayerId)?.name : undefined;
        events.push({ id: g.id, side, kind: 'goal', minute: g.minute, scorer, assist });
      }
    }
    for (const c of teamCards) {
      if (!c.playerId) continue;
      events.push({
        id: c.id,
        side,
        kind: c.type,
        minute: c.minute,
        player: c.playerName,
      });
    }
    for (const s of teamSubs) {
      events.push({
        id: s.id,
        side,
        kind: 'sub',
        minute: s.minute,
        playerIn: s.playerInName,
        playerOut: s.playerOutName,
      });
    }
    return events;
  }

  function buildOpponentTimeline(): TimelineEvent[] {
    const side: 'home' | 'away' = isTeamHome ? 'away' : 'home';
    const events: TimelineEvent[] = [];

    for (const g of opponentGoals) {
      if (!g.scorerName.trim()) continue;
      if (g.isOwnGoal) {
        events.push({ id: g.id, side, kind: 'own_goal', minute: g.minute, scorer: g.scorerName });
      } else {
        events.push({ id: g.id, side, kind: 'goal', minute: g.minute, scorer: g.scorerName, assist: g.assistName });
      }
    }
    for (const c of opponentCards) {
      if (!c.playerName.trim()) continue;
      events.push({ id: c.id, side, kind: c.type, minute: c.minute, player: c.playerName });
    }
    for (const s of opponentSubs) {
      if (!s.playerIn.trim() && !s.playerOut.trim()) continue;
      events.push({ id: s.id, side, kind: 'sub', minute: s.minute, playerIn: s.playerIn, playerOut: s.playerOut });
    }
    return events;
  }

  const homeTimeline = isTeamHome ? buildTeamTimeline() : buildOpponentTimeline();
  const awayTimeline = isTeamHome ? buildOpponentTimeline() : buildTeamTimeline();

  const homeGoalsVal = isTeamHome ? goalsFor : goalsAgainst;
  const awayGoalsVal = isTeamHome ? goalsAgainst : goalsFor;

  const goalsValid = teamGoals.every(g =>
    g.type === 'own' ? !!g.opponentScorerName?.trim() : !!g.playerId,
  );

  const teamPanel = (
    <div className={styles.sidePanel}>
      <h3 className={styles.panelTitle}>{teamName}</h3>

      {teamGoals.map((g, i) => {
        const complete = isTeamGoalComplete(g);
        return (
          <CollapsibleEventBlock
            key={g.id}
            isComplete={complete}
            expanded={isFormOpen(g.id, complete, expandedIds)}
            summary={teamGoalSummary(g, players)}
            onEdit={() => openEdit(g.id)}
          >
            <div className={styles.eventFields}>
              <div className={styles.minuteRow}>
                <span className={styles.fieldLabel}>Minuto</span>
                <MinuteInput value={g.minute} onChange={m => updateGoal(i, { minute: m })} />
              </div>
              <div className={styles.fieldRow}>
                {g.type === 'own' ? (
                  <input
                    className={styles.textInput}
                    placeholder="Autor do gol contra"
                    value={g.opponentScorerName ?? ''}
                    onChange={e => updateGoal(i, { opponentScorerName: e.target.value })}
                  />
                ) : (
                  <SearchableSelect
                    options={squadOptions}
                    value={g.playerId ?? ''}
                    onChange={pid => ensureOnField(pid, () => updateGoal(i, { playerId: pid, type: 'team' }))}
                    placeholder="Autor do gol..."
                  />
                )}
                <button
                  type="button"
                  className={styles.toggleOwn}
                  onClick={() => updateGoal(i, {
                    type: g.type === 'own' ? 'team' : 'own',
                    playerId: '',
                    opponentScorerName: '',
                  })}
                  title="Alternar gol contra"
                >
                  {g.type === 'own' ? '⚽' : '🔴'}
                </button>
              </div>
              {g.type === 'team' && (
                <div className={styles.assistRow}>
                  <span className={styles.assistLabel}>Assistência (opcional)</span>
                  <SearchableSelect
                    options={[{ value: '', label: 'Sem assistência' }, ...squadOptions]}
                    value={g.assistPlayerId ?? ''}
                    onChange={pid => {
                      if (!pid) updateGoal(i, { assistPlayerId: undefined });
                      else ensureOnField(pid, () => updateGoal(i, { assistPlayerId: pid }));
                    }}
                    placeholder="Assistência..."
                  />
                </div>
              )}
            </div>
          </CollapsibleEventBlock>
        );
      })}

      <div className={styles.cardSection}>
        {teamCards.map(card => {
          const complete = !!card.playerId;
          const summary = `${formatMinute(card.minute)} · ${card.type === 'yellow' ? '🟨' : '🟥'} ${card.playerName || '—'}`;
          return (
            <CollapsibleEventBlock
              key={card.id}
              isComplete={complete}
              expanded={isFormOpen(card.id, complete, expandedIds)}
              summary={summary}
              onEdit={() => openEdit(card.id)}
              onRemove={() => onTeamCardsChange(teamCards.filter(c => c.id !== card.id))}
            >
              <div className={styles.eventFields}>
                <div className={styles.minuteRow}>
                  <span className={styles.fieldLabel}>Minuto</span>
                  <span className={card.type === 'yellow' ? styles.cardIconY : styles.cardIconR}>
                    {card.type === 'yellow' ? '🟨' : '🟥'}
                  </span>
                  <MinuteInput value={card.minute} onChange={m => updateCard(card.id, { minute: m })} />
                </div>
                <SearchableSelect
                  options={squadOptions}
                  value={card.playerId}
                  onChange={pid => applyCardPlayer(card, pid)}
                  placeholder="Jogador..."
                />
              </div>
            </CollapsibleEventBlock>
          );
        })}
        <div className={styles.cardBtns}>
          <button type="button" className={styles.yellowBtn} onClick={() => addCard('yellow')}>🟨 Amarelo</button>
          <button type="button" className={styles.redBtn} onClick={() => addCard('red')}>🟥 Vermelho</button>
        </div>
      </div>

      {teamSubs.map(sub => {
        const complete = true;
        const summary = `${formatMinute(sub.minute)} · 🔼 ${sub.playerInName} · 🔽 ${sub.playerOutName}`;
        return (
          <CollapsibleEventBlock
            key={sub.id}
            isComplete={complete}
            expanded={isFormOpen(sub.id, complete, expandedIds)}
            summary={summary}
            onEdit={() => openEdit(sub.id)}
            onRemove={() => onTeamSubsChange(teamSubs.filter(s => s.id !== sub.id))}
          >
            <div className={styles.eventFields}>
              <div className={styles.minuteRow}>
                <span className={styles.fieldLabel}>Minuto</span>
                <MinuteInput
                  value={sub.minute}
                  onChange={m => onTeamSubsChange(teamSubs.map(s => s.id === sub.id ? { ...s, minute: m } : s))}
                />
              </div>
              <p className={styles.subDetail}>Entra: {sub.playerInName}</p>
              <p className={styles.subDetail}>Sai: {sub.playerOutName}</p>
            </div>
          </CollapsibleEventBlock>
        );
      })}

      <button type="button" className={styles.subBtn} onClick={() => setVoluntarySubOpen(true)}>
        🔄 Substituição
      </button>
    </div>
  );

  const opponentPanel = (
    <div className={styles.sidePanel}>
      <h3 className={styles.panelTitle}>{opponentName}</h3>
      <p className={styles.optionalHint}>Todos os campos opcionais — apenas texto</p>

      {opponentGoals.map((g, i) => {
        const complete = !!g.scorerName.trim();
        const assist = g.assistName ? ` (${g.assistName})` : '';
        const summary = `${formatMinute(g.minute)} · ⚽ ${g.scorerName || '—'}${assist}`;
        return (
          <CollapsibleEventBlock
            key={g.id}
            isComplete={complete}
            expanded={isFormOpen(g.id, complete, expandedIds)}
            summary={summary}
            onEdit={() => openEdit(g.id)}
          >
            <div className={styles.eventFields}>
              <div className={styles.minuteRow}>
                <span className={styles.fieldLabel}>Minuto</span>
                <MinuteInput value={g.minute} onChange={m => onOpponentGoalsChange(opponentGoals.map((og, j) => j === i ? { ...og, minute: m } : og))} />
              </div>
              <input
                className={styles.textInput}
                placeholder="Autor do gol"
                value={g.scorerName}
                onChange={e => onOpponentGoalsChange(opponentGoals.map((og, j) => j === i ? { ...og, scorerName: e.target.value } : og))}
              />
              <div className={styles.assistRow}>
                <span className={styles.assistLabel}>Assistência (opcional)</span>
                <input
                  className={styles.textInput}
                  placeholder="Nome do assistente"
                  value={g.assistName ?? ''}
                  onChange={e => onOpponentGoalsChange(opponentGoals.map((og, j) => j === i ? { ...og, assistName: e.target.value } : og))}
                />
              </div>
            </div>
          </CollapsibleEventBlock>
        );
      })}

      {opponentCards.map(card => {
        const complete = !!card.playerName.trim();
        const summary = `${formatMinute(card.minute)} · ${card.type === 'yellow' ? '🟨' : '🟥'} ${card.playerName || '—'}`;
        return (
          <CollapsibleEventBlock
            key={card.id}
            isComplete={complete}
            expanded={isFormOpen(card.id, complete, expandedIds)}
            summary={summary}
            onEdit={() => openEdit(card.id)}
            onRemove={() => onOpponentCardsChange(opponentCards.filter(c => c.id !== card.id))}
          >
            <div className={styles.eventFields}>
              <div className={styles.minuteRow}>
                <span className={styles.fieldLabel}>Minuto</span>
                <span className={card.type === 'yellow' ? styles.cardIconY : styles.cardIconR}>
                  {card.type === 'yellow' ? '🟨' : '🟥'}
                </span>
                <MinuteInput value={card.minute} onChange={m => onOpponentCardsChange(opponentCards.map(c => c.id === card.id ? { ...c, minute: m } : c))} />
              </div>
              <input
                className={styles.textInput}
                placeholder="Nome do jogador"
                value={card.playerName}
                onChange={e => onOpponentCardsChange(opponentCards.map(c => c.id === card.id ? { ...c, playerName: e.target.value } : c))}
              />
            </div>
          </CollapsibleEventBlock>
        );
      })}
      <div className={styles.cardBtns}>
        <button
          type="button"
          className={styles.yellowBtn}
          onClick={() => {
            const id = uid();
            onOpponentCardsChange([...opponentCards, { id, playerName: '', type: 'yellow', minute: defaultMinute() }]);
            setExpandedIds(prev => new Set(prev).add(id));
          }}
        >
          🟨 Amarelo
        </button>
        <button
          type="button"
          className={styles.redBtn}
          onClick={() => {
            const id = uid();
            onOpponentCardsChange([...opponentCards, { id, playerName: '', type: 'red', minute: defaultMinute() }]);
            setExpandedIds(prev => new Set(prev).add(id));
          }}
        >
          🟥 Vermelho
        </button>
      </div>

      {opponentSubs.map((s, i) => {
        const complete = !!(s.playerIn.trim() && s.playerOut.trim());
        const summary = `${formatMinute(s.minute)} · 🔼 ${s.playerIn || '—'} · 🔽 ${s.playerOut || '—'}`;
        return (
          <CollapsibleEventBlock
            key={s.id}
            isComplete={complete}
            expanded={isFormOpen(s.id, complete, expandedIds)}
            summary={summary}
            onEdit={() => openEdit(s.id)}
            onRemove={() => onOpponentSubsChange(opponentSubs.filter((_, j) => j !== i))}
          >
            <div className={styles.eventFields}>
              <div className={styles.minuteRow}>
                <span className={styles.fieldLabel}>Minuto</span>
                <MinuteInput value={s.minute} onChange={m => onOpponentSubsChange(opponentSubs.map((os, j) => j === i ? { ...os, minute: m } : os))} />
              </div>
              <input className={styles.textInput} placeholder="Entra" value={s.playerIn} onChange={e => onOpponentSubsChange(opponentSubs.map((os, j) => j === i ? { ...os, playerIn: e.target.value } : os))} />
              <input className={styles.textInput} placeholder="Sai" value={s.playerOut} onChange={e => onOpponentSubsChange(opponentSubs.map((os, j) => j === i ? { ...os, playerOut: e.target.value } : os))} />
            </div>
          </CollapsibleEventBlock>
        );
      })}
      <button
        type="button"
        className={styles.subBtn}
        onClick={() => {
          const id = uid();
          onOpponentSubsChange([...opponentSubs, { id, playerIn: '', playerOut: '', minute: defaultMinute() }]);
          setExpandedIds(prev => new Set(prev).add(id));
        }}
      >
        🔄 Substituição
      </button>
    </div>
  );

  return (
    <div className={styles.wrap}>
      <div className={styles.scoreboard}>
        <div className={styles.teamCol}>
          <span className={styles.teamLabel}>{homeTeam}</span>
          <div className={styles.timelineWrap}>
            <MatchTimeline events={homeTimeline} align="left" />
          </div>
        </div>
        <div className={styles.scoreCol}>
          <input
            type="number"
            min={0}
            max={30}
            className={styles.scoreInput}
            value={homeGoalsVal}
            onChange={e => {
              const v = Number(e.target.value);
              if (isTeamHome) onGoalsForChange(v);
              else onGoalsAgainstChange(v);
            }}
          />
          <span className={styles.scoreSep}>×</span>
          <input
            type="number"
            min={0}
            max={30}
            className={styles.scoreInput}
            value={awayGoalsVal}
            onChange={e => {
              const v = Number(e.target.value);
              if (isTeamHome) onGoalsAgainstChange(v);
              else onGoalsForChange(v);
            }}
          />
        </div>
        <div className={styles.teamCol}>
          <span className={styles.teamLabel}>{awayTeam}</span>
          <div className={styles.timelineWrap}>
            <MatchTimeline events={awayTimeline} align="right" />
          </div>
        </div>
      </div>

      <div className={styles.columns}>
        {isTeamHome ? (
          <>
            {teamPanel}
            {opponentPanel}
          </>
        ) : (
          <>
            {opponentPanel}
            {teamPanel}
          </>
        )}
      </div>

      {!goalsValid && goalsFor > 0 && (
        <p className={styles.error}>Preencha o autor de cada gol do seu time.</p>
      )}

      {subModal && (
        <SubstitutionModal
          open
          required={subModal.required}
          title="Substituição necessária"
          playerIn={subModal.playerIn}
          onFieldOptions={[...fieldIds].map(id => resolvePlayer(id)).filter(Boolean).map(p => ({ id: p!.id, name: p!.name }))}
          onClose={() => { setSubModal(null); setPendingAction(null); }}
          onConfirm={handleSubConfirm}
        />
      )}

      {voluntarySubOpen && (
        <div className={styles.modalOverlay} onClick={() => setVoluntarySubOpen(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3>Substituição</h3>
            <div className={styles.modalField}>
              <label>Entra</label>
              <SearchableSelect options={squadOptions.filter(o => !fieldIds.has(o.value))} value={volIn} onChange={setVolIn} placeholder="Jogador que entra..." />
            </div>
            <div className={styles.modalField}>
              <label>Sai</label>
              <SearchableSelect options={fieldOptions} value={volOut} onChange={setVolOut} placeholder="Jogador que sai..." />
            </div>
            <div className={styles.modalField}>
              <label>Minuto</label>
              <MinuteInput value={volMinute} onChange={setVolMinute} />
            </div>
            <div className={styles.modalActions}>
              <button type="button" onClick={() => setVoluntarySubOpen(false)}>Cancelar</button>
              <button
                type="button"
                className={styles.confirmSub}
                disabled={!volIn || !volOut}
                onClick={() => {
                  handleSubConfirm({ playerInId: volIn, playerOutId: volOut, minute: volMinute });
                  setVoluntarySubOpen(false);
                  setVolIn('');
                  setVolOut('');
                  setVolMinute(defaultMinute());
                }}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function isResultStepValid(goalsFor: number, teamGoals: TeamGoalEntry[]): boolean {
  if (goalsFor === 0) return teamGoals.length === 0 || teamGoals.every(g => g.type === 'own' ? !!g.opponentScorerName?.trim() : !!g.playerId);
  return teamGoals.length === goalsFor && teamGoals.every(g =>
    g.type === 'own' ? !!g.opponentScorerName?.trim() : !!g.playerId,
  );
}
