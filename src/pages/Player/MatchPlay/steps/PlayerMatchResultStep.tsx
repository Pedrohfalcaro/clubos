import { useState } from 'react';
import MinuteInput from '../../../../components/MinuteInput/MinuteInput';
import CollapsibleEventBlock from '../../../../components/CollapsibleEventBlock/CollapsibleEventBlock';
import MatchTimeline, { type TimelineEvent } from '../../../../components/MatchTimeline/MatchTimeline';
import type { Teammate } from '../../../../types/Teammate';
import type { TeamGoalEntry, TeamCardEntry, OpponentGoalEntry } from '../../../../types/Match';
import { addDaysIso } from '../../../../livelife';
import { defaultMinute, formatMinute, uid } from '../../../../utils/matchEvents';
import type { PlayerInjuryDraft, SubOutDraft } from './PlayerIncidentsStep';
import resultStyles from '../../../MatchPlay/MatchResultStep.module.css';
import extra from '../PlayerMatchPlay.module.css';

interface ScorerOption {
  id: string;
  name: string;
  gold: boolean;
}

interface PlayerMatchResultStepProps {
  teamName: string;
  opponentName: string;
  homeTeam: string;
  awayTeam: string;
  isTeamHome: boolean;
  goalsFor: number;
  goalsAgainst: number;
  onGoalsForChange: (v: number) => void;
  onGoalsAgainstChange: (v: number) => void;
  selfId: string;
  selfName: string;
  teammates: Teammate[];
  teamGoals: TeamGoalEntry[];
  onTeamGoalsChange: (g: TeamGoalEntry[]) => void;
  cards: TeamCardEntry[];
  onCardsChange: (c: TeamCardEntry[]) => void;
  injury: PlayerInjuryDraft | null;
  onInjuryChange: (i: PlayerInjuryDraft | null) => void;
  subOut: SubOutDraft | null;
  onSubOutChange: (s: SubOutDraft | null) => void;
  opponentGoals: OpponentGoalEntry[];
  onOpponentGoalsChange: (g: OpponentGoalEntry[]) => void;
  currentDate: string | null;
}

export default function PlayerMatchResultStep({
  teamName,
  opponentName,
  homeTeam,
  awayTeam,
  isTeamHome,
  goalsFor,
  goalsAgainst,
  onGoalsForChange,
  onGoalsAgainstChange,
  selfId,
  selfName,
  teammates,
  teamGoals,
  onTeamGoalsChange,
  cards,
  onCardsChange,
  injury,
  onInjuryChange,
  subOut,
  onSubOutChange,
  opponentGoals,
  onOpponentGoalsChange,
  currentDate,
}: PlayerMatchResultStepProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [injuryForm, setInjuryForm] = useState(false);
  const [injuryType, setInjuryType] = useState('');
  const [injuryMinute, setInjuryMinute] = useState(defaultMinute());
  const [injuryReturn, setInjuryReturn] = useState(() => addDaysIso(currentDate ?? new Date().toISOString().slice(0, 10), 14));
  const [subForm, setSubForm] = useState(false);
  const [subMinute, setSubMinute] = useState(defaultMinute());
  const [replacementId, setReplacementId] = useState('');

  const scorerOptions: ScorerOption[] = [
    { id: selfId, name: selfName, gold: true },
    ...teammates.slice().sort((a, b) => a.number - b.number).map(t => ({ id: t.id, name: `${t.name} (${t.number})`, gold: false })),
  ];

  function openEdit(id: string) {
    setExpandedIds(prev => new Set(prev).add(id));
  }

  function updateGoal(index: number, patch: Partial<TeamGoalEntry>) {
    onTeamGoalsChange(teamGoals.map((g, i) => (i === index ? { ...g, ...patch } : g)));
  }

  function nameFor(id?: string): string {
    if (!id) return '—';
    if (id === selfId) return selfName;
    return teammates.find(t => t.id === id)?.name ?? '—';
  }

  function addCard(type: 'yellow' | 'red') {
    onCardsChange([...cards, { id: uid(), playerId: selfId, playerName: selfName, type, minute: defaultMinute() }]);
  }

  function submitInjury() {
    if (!injuryType.trim() || !injuryReturn) return;
    onInjuryChange({ minute: injuryMinute, type: injuryType.trim(), returnDate: injuryReturn });
    setInjuryForm(false);
    setInjuryType('');
    // Lesão obriga sair de campo — já abre a substituição com o mesmo minuto.
    setSubMinute(injuryMinute);
    setSubForm(true);
    setInjuryMinute(defaultMinute());
  }

  function submitSub() {
    const t = teammates.find(x => x.id === replacementId);
    if (!t) return;
    onSubOutChange({ minute: subMinute, replacementId: t.id, replacementName: t.name });
    setSubForm(false);
    setReplacementId('');
    setSubMinute(defaultMinute());
  }

  const homeGoalsVal = isTeamHome ? goalsFor : goalsAgainst;
  const awayGoalsVal = isTeamHome ? goalsAgainst : goalsFor;

  function buildTeamTimeline(): TimelineEvent[] {
    const side: 'home' | 'away' = isTeamHome ? 'home' : 'away';
    const events: TimelineEvent[] = [];
    for (const g of teamGoals) {
      if (!g.playerId) continue;
      events.push({
        id: g.id,
        side,
        kind: 'goal',
        minute: g.minute,
        scorer: nameFor(g.playerId),
        assist: g.assistPlayerId ? nameFor(g.assistPlayerId) : undefined,
      });
    }
    for (const c of cards) {
      events.push({ id: c.id, side, kind: c.type, minute: c.minute, player: c.playerName });
    }
    if (subOut) {
      events.push({
        id: 'self-sub',
        side,
        kind: 'sub',
        minute: subOut.minute,
        playerIn: subOut.replacementName,
        playerOut: selfName,
      });
    }
    return events;
  }

  function buildOpponentTimeline(): TimelineEvent[] {
    const side: 'home' | 'away' = isTeamHome ? 'away' : 'home';
    return opponentGoals
      .filter(g => g.scorerName.trim())
      .map(g => ({ id: g.id, side, kind: 'goal' as const, minute: g.minute, scorer: g.scorerName, assist: g.assistName }));
  }

  const homeTimeline = isTeamHome ? buildTeamTimeline() : buildOpponentTimeline();
  const awayTimeline = isTeamHome ? buildOpponentTimeline() : buildTeamTimeline();

  const teamPanel = (
    <div className={resultStyles.sidePanel}>
      <h3 className={resultStyles.panelTitle}>{teamName}</h3>

      {teamGoals.map((g, i) => {
        const complete = !!g.playerId;
        const assist = g.assistPlayerId ? ` (${nameFor(g.assistPlayerId)})` : '';
        const summary = `${formatMinute(g.minute)} · ⚽ ${nameFor(g.playerId)}${assist}`;
        return (
          <CollapsibleEventBlock
            key={g.id}
            isComplete={complete}
            expanded={expandedIds.has(g.id) || !complete}
            summary={summary}
            onEdit={() => openEdit(g.id)}
          >
            <div className={resultStyles.eventFields}>
              <div className={resultStyles.minuteRow}>
                <span className={resultStyles.fieldLabel}>Minuto</span>
                <MinuteInput value={g.minute} onChange={m => updateGoal(i, { minute: m })} />
              </div>
              <select
                className={extra.select}
                value={g.playerId ?? ''}
                onChange={e => updateGoal(i, { playerId: e.target.value || undefined, type: 'team' })}
              >
                <option value="">Quem marcou...</option>
                {scorerOptions.map(o => (
                  <option key={o.id} value={o.id} style={o.gold ? { color: '#d4af37', fontWeight: 700 } : undefined}>
                    {o.gold ? '★ ' : ''}{o.name}
                  </option>
                ))}
              </select>
              <div className={resultStyles.assistRow}>
                <span className={resultStyles.assistLabel}>Assistência (opcional)</span>
                <select
                  className={extra.select}
                  value={g.assistPlayerId ?? ''}
                  onChange={e => updateGoal(i, { assistPlayerId: e.target.value || undefined })}
                >
                  <option value="">Sem assistência</option>
                  {scorerOptions.filter(o => o.id !== g.playerId).map(o => (
                    <option key={o.id} value={o.id} style={o.gold ? { color: '#d4af37', fontWeight: 700 } : undefined}>
                      {o.gold ? '★ ' : ''}{o.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CollapsibleEventBlock>
        );
      })}

      <div className={resultStyles.cardSection}>
        {cards.map(card => (
          <CollapsibleEventBlock
            key={card.id}
            isComplete
            expanded={expandedIds.has(card.id)}
            summary={`${formatMinute(card.minute)} · ${card.type === 'yellow' ? '🟨' : '🟥'} ${card.playerName}`}
            onEdit={() => openEdit(card.id)}
            onRemove={() => onCardsChange(cards.filter(c => c.id !== card.id))}
          >
            <div className={resultStyles.eventFields}>
              <div className={resultStyles.minuteRow}>
                <span className={resultStyles.fieldLabel}>Minuto</span>
                <MinuteInput
                  value={card.minute}
                  onChange={m => onCardsChange(cards.map(c => (c.id === card.id ? { ...c, minute: m } : c)))}
                />
              </div>
            </div>
          </CollapsibleEventBlock>
        ))}
        <div className={resultStyles.cardBtns}>
          <button type="button" className={resultStyles.yellowBtn} onClick={() => addCard('yellow')}>🟨 Amarelo</button>
          <button type="button" className={resultStyles.redBtn} onClick={() => addCard('red')}>🟥 Vermelho</button>
        </div>
      </div>

      <div className={resultStyles.cardSection}>
        {injury ? (
          <CollapsibleEventBlock
            isComplete
            expanded={false}
            summary={`${formatMinute(injury.minute)} · ✚ ${selfName} · ${injury.type}`}
            onEdit={() => {}}
            onRemove={() => onInjuryChange(null)}
          >
            <span />
          </CollapsibleEventBlock>
        ) : injuryForm ? (
          <div className={resultStyles.eventFields}>
            <div className={resultStyles.minuteRow}>
              <span className={resultStyles.fieldLabel}>Minuto</span>
              <MinuteInput value={injuryMinute} onChange={setInjuryMinute} />
            </div>
            <input
              className={resultStyles.textInput}
              placeholder="Tipo de lesão"
              value={injuryType}
              onChange={e => setInjuryType(e.target.value)}
            />
            <input
              className={resultStyles.textInput}
              type="date"
              value={injuryReturn}
              min={currentDate ?? undefined}
              onChange={e => setInjuryReturn(e.target.value)}
            />
            <div className={resultStyles.cardBtns}>
              <button type="button" className={resultStyles.subBtn} onClick={() => setInjuryForm(false)}>Cancelar</button>
              <button type="button" className={resultStyles.yellowBtn} disabled={!injuryType.trim()} onClick={submitInjury}>
                Confirmar lesão
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className={resultStyles.subBtn} onClick={() => setInjuryForm(true)}>
            ✚ Lesão
          </button>
        )}
      </div>

      {injury && !subOut && !subForm && (
        <p className={resultStyles.error}>Lesão registrada — você precisa sair de campo. Registre a substituição.</p>
      )}

      <div className={resultStyles.cardSection}>
        {subOut ? (
          <CollapsibleEventBlock
            isComplete
            expanded={false}
            summary={`${formatMinute(subOut.minute)} · 🔄 ${selfName} sai · ${subOut.replacementName} entra`}
            onEdit={() => {}}
            onRemove={() => onSubOutChange(null)}
          >
            <span />
          </CollapsibleEventBlock>
        ) : subForm ? (
          <div className={resultStyles.eventFields}>
            <div className={resultStyles.minuteRow}>
              <span className={resultStyles.fieldLabel}>Minuto</span>
              <MinuteInput value={subMinute} onChange={setSubMinute} />
            </div>
            <select className={extra.select} value={replacementId} onChange={e => setReplacementId(e.target.value)}>
              <option value="">Quem entra...</option>
              {teammates.slice().sort((a, b) => a.number - b.number).map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.number})</option>
              ))}
            </select>
            <div className={resultStyles.cardBtns}>
              {!injury && (
                <button type="button" className={resultStyles.subBtn} onClick={() => setSubForm(false)}>Cancelar</button>
              )}
              <button type="button" className={resultStyles.yellowBtn} disabled={!replacementId} onClick={submitSub}>
                Confirmar substituição
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className={resultStyles.subBtn} onClick={() => setSubForm(true)}>
            🔄 Substituição
          </button>
        )}
      </div>
    </div>
  );

  const opponentPanel = (
    <div className={resultStyles.sidePanel}>
      <h3 className={resultStyles.panelTitle}>{opponentName}</h3>
      <p className={resultStyles.optionalHint}>Todos os campos opcionais — apenas texto</p>

      {opponentGoals.map((g, i) => {
        const complete = !!g.scorerName.trim();
        const assist = g.assistName ? ` (${g.assistName})` : '';
        const summary = `${formatMinute(g.minute)} · ⚽ ${g.scorerName || '—'}${assist}`;
        return (
          <CollapsibleEventBlock
            key={g.id}
            isComplete={complete}
            expanded={expandedIds.has(g.id) || !complete}
            summary={summary}
            onEdit={() => openEdit(g.id)}
          >
            <div className={resultStyles.eventFields}>
              <div className={resultStyles.minuteRow}>
                <span className={resultStyles.fieldLabel}>Minuto</span>
                <MinuteInput
                  value={g.minute}
                  onChange={m => onOpponentGoalsChange(opponentGoals.map((og, j) => (j === i ? { ...og, minute: m } : og)))}
                />
              </div>
              <input
                className={resultStyles.textInput}
                placeholder="Autor do gol"
                value={g.scorerName}
                onChange={e => onOpponentGoalsChange(opponentGoals.map((og, j) => (j === i ? { ...og, scorerName: e.target.value } : og)))}
              />
              <div className={resultStyles.assistRow}>
                <span className={resultStyles.assistLabel}>Assistência (opcional)</span>
                <input
                  className={resultStyles.textInput}
                  placeholder="Nome do assistente"
                  value={g.assistName ?? ''}
                  onChange={e => onOpponentGoalsChange(opponentGoals.map((og, j) => (j === i ? { ...og, assistName: e.target.value } : og)))}
                />
              </div>
            </div>
          </CollapsibleEventBlock>
        );
      })}
    </div>
  );

  return (
    <div className={resultStyles.wrap}>
      <div className={resultStyles.scoreboard}>
        <div className={resultStyles.teamCol}>
          <span className={resultStyles.teamLabel}>{homeTeam}</span>
          <div className={resultStyles.timelineWrap}>
            <MatchTimeline events={homeTimeline} align="left" />
          </div>
        </div>
        <div className={resultStyles.scoreCol}>
          <input
            type="number"
            min={0}
            max={30}
            className={resultStyles.scoreInput}
            value={homeGoalsVal}
            onChange={e => {
              const v = Number(e.target.value);
              if (isTeamHome) onGoalsForChange(v);
              else onGoalsAgainstChange(v);
            }}
          />
          <span className={resultStyles.scoreSep}>×</span>
          <input
            type="number"
            min={0}
            max={30}
            className={resultStyles.scoreInput}
            value={awayGoalsVal}
            onChange={e => {
              const v = Number(e.target.value);
              if (isTeamHome) onGoalsAgainstChange(v);
              else onGoalsForChange(v);
            }}
          />
        </div>
        <div className={resultStyles.teamCol}>
          <span className={resultStyles.teamLabel}>{awayTeam}</span>
          <div className={resultStyles.timelineWrap}>
            <MatchTimeline events={awayTimeline} align="right" />
          </div>
        </div>
      </div>

      <div className={resultStyles.columns}>
        {isTeamHome ? (<>{teamPanel}{opponentPanel}</>) : (<>{opponentPanel}{teamPanel}</>)}
      </div>
    </div>
  );
}
