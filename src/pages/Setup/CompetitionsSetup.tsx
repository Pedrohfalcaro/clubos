import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../../context/GameContext';
import { SETUP_COMPETITION_PRESETS, createSeasonCompetition } from '../../utils/competitions';
import type { SeasonCompetition, CompetitionType } from '../../types/Competition';
import type { Currency, PrizeTableEntry } from '../../types/Finance';
import { CURRENCIES, currencyLabel } from '../../types/Finance';
import { prizeTemplate, stadiumTemplate } from '../../utils/livelifeTemplates';
import MoneyAmountHint from '../../components/MoneyAmountHint/MoneyAmountHint';
import styles from './Setup.module.css';

type CompDraft = {
  name: string;
  type: CompetitionType;
  checked: boolean;
  prize: PrizeTableEntry;
};

export default function CompetitionsSetup() {
  const { state, startCareer } = useGame();
  const navigate = useNavigate();
  const team = state.pendingTeam;

  const [currency, setCurrency] = useState<Currency>('BRL');
  const [startDate, setStartDate] = useState(`${state.season}-01-01`);
  const [debtAmount, setDebtAmount] = useState('');
  const [debtInstallments, setDebtInstallments] = useState('12');
  const [debtDay, setDebtDay] = useState('5');
  const [customName, setCustomName] = useState('');
  const [comps, setComps] = useState<CompDraft[]>(() =>
    SETUP_COMPETITION_PRESETS.map(p => ({
      name: p.name,
      type: p.type,
      checked: p.defaultChecked,
      prize: prizeTemplate('BRL', p.type),
    })),
  );

  const selected = useMemo(() => comps.filter(c => c.checked), [comps]);
  const debtN = Math.round(parseFloat(debtAmount.replace(',', '.')) || 0);
  const debtInstN = Math.max(1, Math.min(120, parseInt(debtInstallments, 10) || 0));
  const debtMonthlyPreview =
    debtN > 0 && debtInstN >= 1 ? Math.max(1, Math.round(debtN / debtInstN)) : 0;

  if (!team || !state.manager) {
    navigate('/');
    return null;
  }

  function applyCurrency(next: Currency) {
    setCurrency(next);
    setComps(prev =>
      prev.map(c => ({
        ...c,
        prize: prizeTemplate(next, c.type),
      })),
    );
  }

  function toggle(name: string) {
    setComps(prev =>
      prev.map(c => (c.name === name ? { ...c, checked: !c.checked } : c)),
    );
  }

  function updatePrize(name: string, field: keyof PrizeTableEntry, raw: string) {
    const v = parseInt(raw.replace(/\D/g, ''), 10);
    setComps(prev =>
      prev.map(c =>
        c.name === name
          ? { ...c, prize: { ...c.prize, [field]: isNaN(v) ? undefined : v } }
          : c,
      ),
    );
  }

  function addCustom() {
    const name = customName.trim();
    if (!name) return;
    if (comps.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      setCustomName('');
      return;
    }
    const created = createSeasonCompetition(name);
    setComps(prev => [
      ...prev,
      {
        name: created.name,
        type: created.type,
        checked: true,
        prize: prizeTemplate(currency, created.type),
      },
    ]);
    setCustomName('');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selected.length === 0) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return;

    const seasonCompetitions: SeasonCompetition[] = selected.map(c =>
      createSeasonCompetition(c.name, { type: c.type }),
    );
    const prizeTable: Record<string, PrizeTableEntry> = {};
    for (const c of selected) {
      prizeTable[c.name] = c.prize;
    }

    if (debtN > 0 && debtMonthlyPreview < 1) return;
    startCareer(seasonCompetitions, undefined, startDate, {
      currency,
      prizeTable,
      stadiumConfig: stadiumTemplate(currency),
      openingDebt:
        debtN > 0
          ? {
              amount: debtN,
              monthlyInstallment: debtMonthlyPreview,
              paymentDay: Math.round(parseFloat(debtDay) || 5),
              label: 'Dívida de abertura',
            }
          : undefined,
    });
    navigate('/dashboard');
  }

  return (
    <div className={styles.page}>
      <div className={`${styles.card} ${styles.cardWide}`}>
        <p className={styles.step}>Passo 3 de 3</p>
        <h1 className={styles.title}>Competições da Temporada</h1>
        <p className={styles.sub}>
          Marque as competições do <strong>{team.name}</strong> e defina a premiação de cada uma
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label htmlFor="startDate">Data de início da carreira</label>
              <input
                id="startDate"
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                required
              />
              <span className={styles.fieldHint}>
                Calendário contínuo LiveLife. Default: 01/01/{state.season}
              </span>
            </div>
            <div className={styles.field}>
              <label htmlFor="currency">Moeda</label>
              <select
                id="currency"
                value={currency}
                onChange={e => applyCurrency(e.target.value as Currency)}
              >
                {CURRENCIES.map(c => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
              <span className={styles.fieldHint}>
                Premiações e estádio usam valores template em {currencyLabel(currency)}
              </span>
            </div>
          </div>

          <div className={styles.compList}>
            {comps.map(comp => (
              <div
                key={comp.name}
                className={`${styles.compCard} ${comp.checked ? styles.compCardActive : ''}`}
              >
                <label className={styles.compCheck}>
                  <input
                    type="checkbox"
                    checked={comp.checked}
                    onChange={() => toggle(comp.name)}
                  />
                  <span>{comp.name}</span>
                </label>

                {comp.checked && (
                  <div className={styles.prizeGrid}>
                    {([
                      ['win', 'Vitória'],
                      ['draw', 'Empate'],
                      ['knockout', 'Eliminatória'],
                      ['champion', 'Campeão'],
                    ] as [keyof PrizeTableEntry, string][]).map(([field, label]) => (
                      <div key={field} className={styles.prizeField}>
                        <label>{label}</label>
                        <input
                          type="number"
                          min={0}
                          value={comp.prize[field] ?? ''}
                          onChange={e => updatePrize(comp.name, field, e.target.value)}
                          placeholder="—"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className={styles.addCompRow}>
            <input
              className={styles.addCompInput}
              value={customName}
              onChange={e => setCustomName(e.target.value)}
              placeholder="Nova competição…"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustom();
                }
              }}
            />
            <button type="button" className={styles.addCompBtn} onClick={addCustom}>
              + Adicionar
            </button>
          </div>

          <div className={styles.fieldRow} style={{ marginTop: 8 }}>
            <div className={styles.field}>
              <label htmlFor="debtAmount">Dívida inicial (opcional)</label>
              <input
                id="debtAmount"
                type="number"
                min={0}
                value={debtAmount}
                onChange={e => setDebtAmount(e.target.value)}
                placeholder="0"
              />
              <MoneyAmountHint value={debtAmount} currency={currency} />
              <span className={styles.fieldHint}>
                Não altera o caixa — só registra o que o clube deve
              </span>
            </div>
            <div className={styles.field}>
              <label htmlFor="debtInstallments">Nº de parcelas *</label>
              <input
                id="debtInstallments"
                type="number"
                min={1}
                max={120}
                value={debtInstallments}
                onChange={e => setDebtInstallments(e.target.value)}
                placeholder="Ex.: 12"
                disabled={!debtAmount || Number(debtAmount) <= 0}
                required={Number(debtAmount) > 0}
              />
              {debtMonthlyPreview > 0 && (
                <MoneyAmountHint
                  value={debtMonthlyPreview}
                  currency={currency}
                  suffix="/mês"
                />
              )}
              <span className={styles.fieldHint}>
                Valor mensal calculado · ignorar parcela gera juros
              </span>
            </div>
            <div className={styles.field}>
              <label htmlFor="debtDay">Dia da parcela</label>
              <input
                id="debtDay"
                type="number"
                min={1}
                max={28}
                value={debtDay}
                onChange={e => setDebtDay(e.target.value)}
                disabled={!debtAmount || Number(debtAmount) <= 0}
              />
              <span className={styles.fieldHint}>1–28 · aparece no calendário</span>
            </div>
          </div>

          {selected.length === 0 && (
            <p className={styles.error}>Selecione ao menos uma competição</p>
          )}

          <div className={styles.actions}>
            <button type="button" className={styles.backBtn} onClick={() => navigate('/setup/manager')}>
              Voltar
            </button>
            <button type="submit" className={styles.nextBtn} disabled={selected.length === 0}>
              Iniciar Carreira
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
