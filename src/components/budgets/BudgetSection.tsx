import { Plus, Target, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useBudgets, useCategories, useRepo, useTransactions } from '../../context/DataContext';
import { usePeriod } from '../../context/PeriodContext';
import { useScope } from '../../context/ScopeContext';
import { useSettings } from '../../context/SettingsContext';
import { budgetTotals, computeBudgetStatuses } from '../../logic/budgets';
import { formatCents, formatPct } from '../../logic/money';
import { parseAmountToCents } from '../../logic/money';
import type { Budget, ScopeFilter } from '../../types';
import { getIcon } from '../ui/icons';
import { Card } from '../ui/Card';
import { DetailLink } from '../ui/DetailLink';
import { Modal } from '../ui/Modal';
import { Segmented } from '../ui/Segmented';
import { Switch } from '../ui/Switch';

/** Suivi des plafonds mensuels par catégorie, sur la période courante. */
export function BudgetSection({ detailTo }: { detailTo?: string } = {}) {
  const budgets = useBudgets();
  const txs = useTransactions();
  const categories = useCategories();
  const { scope } = useScope();
  const { range } = usePeriod();
  const { currency, privacyMode } = useSettings();
  const [editing, setEditing] = useState<Budget | 'new' | null>(null);

  const visible = useMemo(
    () => budgets.filter((b) => scope === 'both' || b.scope === 'both' || b.scope === scope),
    [budgets, scope],
  );

  const statuses = useMemo(
    () => computeBudgetStatuses(visible, txs, categories, range),
    [visible, txs, categories, range],
  );
  const totals = budgetTotals(statuses);
  const overCount = statuses.filter((s) => s.level === 'over').length;

  return (
    <Card delay={0.28}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Target size={17} className="text-accent" />
          Budgets
          {overCount > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-neg/15 px-2 py-0.5 text-[10px] font-semibold text-neg">
              <TriangleAlert size={10} />
              {overCount} dépassé{overCount > 1 ? 's' : ''}
            </span>
          )}
        </h2>
        <span className="flex shrink-0 items-center gap-1">
          {detailTo && <DetailLink to={detailTo} />}
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="glass flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-xs font-medium"
          >
            <Plus size={14} />
            Nouveau
          </button>
        </span>
      </div>

      {statuses.length === 0 ? (
        <p className="py-3 text-sm text-ink-3">
          Aucun budget défini. Fixe un plafond mensuel sur une catégorie pour être alerté avant de
          le dépasser.
        </p>
      ) : (
        <>
          <div className="mb-3 flex items-baseline justify-between text-sm">
            <span className="text-ink-3">Consommé</span>
            <span className="amount font-semibold">
              {privacyMode ? '•••••' : formatCents(totals.spent, currency)}
              <span className="text-ink-3">
                {' / '}
                {privacyMode ? '•••••' : formatCents(totals.allocated, currency)}
              </span>
            </span>
          </div>

          <ul className="flex flex-col gap-3">
            {statuses.map((s) => {
              const Icon = getIcon(s.categoryIcon);
              const barColor =
                s.level === 'over' ? 'bg-neg' : s.level === 'warn' ? 'bg-warn' : 'bg-pos';
              return (
                <li key={s.budget.id}>
                  <button
                    onClick={() => setEditing(s.budget)}
                    className="w-full cursor-pointer text-left"
                  >
                    <div className="mb-1.5 flex items-center gap-2.5">
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                        style={{ background: `${s.categoryColor}22`, color: s.categoryColor }}
                      >
                        <Icon size={14} />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {s.categoryLabel}
                        {s.budget.scope !== 'both' && (
                          <span className="ml-1.5 text-[10px] text-ink-3">{s.budget.scope}</span>
                        )}
                        {s.budget.rollover && s.carried !== 0 && (
                          <span
                            title="Report des mois précédents"
                            className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                              s.carried > 0 ? 'bg-pos/15 text-pos' : 'bg-neg/15 text-neg'
                            }`}
                          >
                            {s.carried > 0 ? '+' : '−'}
                            {formatCents(Math.abs(s.carried), currency)}
                          </span>
                        )}
                      </span>
                      <span
                        className={`amount shrink-0 text-xs font-semibold ${
                          s.level === 'over' ? 'text-neg' : s.level === 'warn' ? 'text-warn' : 'text-ink-2'
                        }`}
                      >
                        {privacyMode ? '•••' : formatCents(s.spent, currency)}
                        <span className="text-ink-3">
                          {' / '}
                          {privacyMode ? '•••' : formatCents(s.effective, currency)}
                        </span>
                      </span>
                    </div>
                    <div
                      role="progressbar"
                      aria-valuenow={Math.round(s.ratio * 100)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`Budget ${s.categoryLabel}`}
                      className="h-2 w-full overflow-hidden rounded-full bg-surface-2"
                    >
                      <div
                        className={`h-full rounded-full transition-[width] duration-500 ${barColor}`}
                        style={{ width: `${Math.min(100, s.ratio * 100)}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-ink-3">
                      {s.level === 'over'
                        ? `Dépassé de ${formatCents(-s.remaining, currency)}`
                        : `${formatCents(s.remaining, currency)} restants · ${formatPct(s.ratio)} utilisé`}
                      {s.budget.rollover && s.carried !== 0 && (
                        <>
                          {' · plafond '}
                          {formatCents(s.budget.amount, currency)}
                          {s.carried > 0 ? ' + ' : ' − '}
                          {formatCents(Math.abs(s.carried), currency)} de report
                        </>
                      )}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Nouveau budget' : 'Modifier le budget'}
      >
        {editing && (
          <BudgetForm
            key={editing === 'new' ? 'new' : editing.id}
            editing={editing === 'new' ? null : editing}
            onDone={() => setEditing(null)}
          />
        )}
      </Modal>
    </Card>
  );
}

function BudgetForm({ editing, onDone }: { editing: Budget | null; onDone: () => void }) {
  const categories = useCategories();
  const repo = useRepo();
  const { scope: globalScope } = useScope();

  const expenseCats = categories.filter((c) => c.type === 'expense' || c.type === 'both');
  const [categoryId, setCategoryId] = useState(
    editing?.categoryId ?? expenseCats[0]?.id ?? 'cat-autre',
  );
  const [scope, setScope] = useState<ScopeFilter>(editing?.scope ?? globalScope);
  const [amountText, setAmountText] = useState(
    editing ? (editing.amount / 100).toFixed(2).replace('.', ',') : '',
  );
  const [rollover, setRollover] = useState(editing?.rollover ?? false);
  const [error, setError] = useState('');

  async function submit() {
    const amount = parseAmountToCents(amountText);
    if (amount === null || amount <= 0) return setError('Montant invalide (ex : 250).');
    setError('');
    await repo.setBudget({ id: editing?.id, categoryId, scope, amount, rollover });
    onDone();
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="flex flex-col gap-4"
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-ink-2">Catégorie</span>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="min-h-[44px] w-full cursor-pointer rounded-2xl border border-line bg-surface-2 px-4 text-sm"
        >
          {expenseCats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-ink-2">Portée</span>
        <Segmented
          options={[
            { value: 'both', label: 'Tout' },
            { value: 'perso', label: 'Perso' },
            { value: 'pro', label: 'Pro' },
          ]}
          value={scope}
          onChange={setScope}
          size="sm"
          className="self-start"
        />
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-ink-2">Plafond mensuel</span>
        <input
          value={amountText}
          onChange={(e) => setAmountText(e.target.value)}
          inputMode="decimal"
          placeholder="250,00"
          autoFocus
          className="amount min-h-[48px] w-full rounded-2xl border border-line bg-surface-2 px-4 text-base text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
        />
      </label>

      <div className="flex items-start justify-between gap-4 rounded-2xl border border-line bg-surface-2/50 p-4">
        <div>
          <p className="text-sm font-medium">Reporter le reste</p>
          <p className="mt-0.5 text-xs text-ink-3">
            Ce qui n'est pas dépensé ce mois-ci s'ajoute au plafond du mois suivant.
          </p>
        </div>
        <Switch checked={rollover} onChange={setRollover} label="Reporter le reste" size="sm" />
      </div>

      {error && (
        <p role="alert" className="text-xs text-neg">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          className="bg-gradient-flow min-h-[48px] flex-1 cursor-pointer rounded-2xl font-semibold text-white"
        >
          {editing ? 'Enregistrer' : 'Créer le budget'}
        </button>
        {editing && (
          <button
            type="button"
            onClick={() => {
              void repo.deleteBudget(editing.id);
              onDone();
            }}
            className="min-h-[48px] cursor-pointer rounded-2xl border border-neg/40 px-5 text-sm font-medium text-neg hover:bg-neg/10"
          >
            Supprimer
          </button>
        )}
      </div>
    </form>
  );
}
