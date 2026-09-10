import { ArrowRight, TrendingDown, TrendingUp } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { TrendChart } from '../../components/charts/TrendChart';
import { TxVisual } from '../../components/transactions/TxVisual';
import { AnimatedAmount } from '../../components/ui/AnimatedAmount';
import { Card } from '../../components/ui/Card';
import { DeltaPill } from '../../components/ui/DeltaPill';
import { EmptyState } from '../../components/ui/EmptyState';
import { getIcon } from '../../components/ui/icons';
import { useCategories, useTransactions } from '../../context/DataContext';
import { usePeriod } from '../../context/PeriodContext';
import { useScope } from '../../context/ScopeContext';
import { useSettings } from '../../context/SettingsContext';
import { categoryParts, computePeriodStats, inRange, matchesScope } from '../../logic/analytics';
import { formatRangeLabel, fromISODate } from '../../logic/dates';
import { formatCents, formatPct } from '../../logic/money';
import type { Transaction, TxType } from '../../types';

/**
 * Vue détaillée d'un flux — dépenses ou revenus.
 * Le tableau de bord donne le total ; ici on répond à « composé de quoi,
 * et par rapport à quand ».
 */
export function FlowSection({ type }: { type: TxType }) {
  const txs = useTransactions();
  const categories = useCategories();
  const { scope } = useScope();
  const { period, range } = usePeriod();
  const { currency, privacyMode } = useSettings();

  const stats = useMemo(
    () => computePeriodStats(txs, categories, scope, period, range),
    [txs, categories, scope, period, range],
  );

  const isExpense = type === 'expense';
  const total = isExpense ? stats.expenses : stats.revenues;
  const delta = isExpense ? stats.expensesDelta : stats.revenuesDelta;

  const periodTxs = useMemo(
    () => txs.filter((tx) => tx.type === type && matchesScope(tx, scope) && inRange(tx, range)),
    [txs, type, scope, range],
  );

  /** Répartition par catégorie, ventilation comprise. */
  const breakdown = useMemo(() => {
    const byId = new Map<string, { total: number; count: number }>();
    for (const tx of periodTxs) {
      for (const part of categoryParts(tx)) {
        const row = byId.get(part.categoryId) ?? { total: 0, count: 0 };
        row.total += part.amount;
        row.count += 1;
        byId.set(part.categoryId, row);
      }
    }
    const sum = [...byId.values()].reduce((acc, r) => acc + r.total, 0);
    return [...byId.entries()]
      .map(([categoryId, row]) => {
        const cat = categories.find((c) => c.id === categoryId);
        return {
          categoryId,
          label: cat?.label ?? 'Autre',
          color: cat?.color ?? '#82828e',
          icon: cat?.icon ?? 'CircleDashed',
          total: row.total,
          count: row.count,
          share: sum > 0 ? row.total / sum : 0,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [periodTxs, categories]);

  const biggest = useMemo(
    () => [...periodTxs].sort((a, b) => b.amount - a.amount).slice(0, 8),
    [periodTxs],
  );

  const dayCount = Math.max(
    1,
    Math.round((range.to.getTime() - range.from.getTime()) / 86_400_000) + 1,
  );
  const perDay = Math.round(total / dayCount);
  const hide = (cents: number) => (privacyMode ? '•••' : formatCents(cents, currency));

  return (
    <div className="flex flex-col gap-4">
      <Card delay={0}>
        <p className="text-xs text-ink-3">
          {isExpense ? 'Dépenses' : 'Revenus'} · {formatRangeLabel(range)}
        </p>
        <AnimatedAmount
          cents={total}
          currency={currency}
          className={`block text-3xl font-bold ${isExpense ? 'text-ink' : 'text-pos'}`}
        />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <DeltaPill delta={delta} upIsGood={!isExpense} />
          <span className="text-[11px] text-ink-3">
            {periodTxs.length} mouvement{periodTxs.length > 1 ? 's' : ''} · {hide(perDay)} par jour
          </span>
        </div>
      </Card>

      <Card delay={0.05}>
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
          {isExpense ? (
            <TrendingDown size={17} className="text-neg" />
          ) : (
            <TrendingUp size={17} className="text-pos" />
          )}
          Évolution sur la période
        </h2>
        {stats.txCount === 0 ? (
          <EmptyState
            icon={isExpense ? TrendingDown : TrendingUp}
            title="Rien à tracer"
            hint="La courbe apparaîtra dès le premier mouvement de la période."
          />
        ) : (
          <TrendChart series={stats.series} currency={currency} />
        )}
      </Card>

      <Card delay={0.1}>
        <h2 className="mb-3 text-base font-semibold">Par catégorie</h2>
        {breakdown.length === 0 ? (
          <p className="py-2 text-sm text-ink-3">Aucun mouvement sur la période.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {breakdown.map((row) => {
              const Icon = getIcon(row.icon);
              return (
                <li key={row.categoryId}>
                  <div className="mb-1.5 flex items-center gap-2.5">
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                      style={{ background: `${row.color}22`, color: row.color }}
                    >
                      <Icon size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{row.label}</span>
                      <span className="text-[11px] text-ink-3">
                        {row.count} mouvement{row.count > 1 ? 's' : ''} · moyenne{' '}
                        {hide(Math.round(row.total / row.count))}
                      </span>
                    </span>
                    <span className="amount shrink-0 text-right text-sm font-semibold">
                      {hide(row.total)}
                      <span className="block text-[11px] font-normal text-ink-3">
                        {formatPct(row.share)}
                      </span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full transition-[width] duration-500"
                      style={{ width: `${row.share * 100}%`, background: row.color }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card delay={0.15}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">
            {isExpense ? 'Plus grosses dépenses' : 'Plus gros encaissements'}
          </h2>
          <Link
            to={scope === 'pro' ? '/pro' : '/mouvements'}
            className="flex shrink-0 cursor-pointer items-center gap-1 text-xs font-medium text-accent-2 hover:underline"
          >
            Tout voir
            <ArrowRight size={13} />
          </Link>
        </div>
        {biggest.length === 0 ? (
          <p className="py-2 text-sm text-ink-3">Aucun mouvement sur la période.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {biggest.map((tx) => (
              <BiggestRow key={tx.id} tx={tx} currency={currency} privacy={privacyMode} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function BiggestRow({
  tx,
  currency,
  privacy,
}: {
  tx: Transaction;
  currency: string;
  privacy: boolean;
}) {
  const categories = useCategories();
  return (
    <li className="flex items-center gap-3 rounded-2xl px-1 py-2">
      <TxVisual tx={tx} category={categories.find((c) => c.id === tx.categoryId)} size={36} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{tx.label}</span>
        <span className="text-[11px] text-ink-3">
          {fromISODate(tx.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
        </span>
      </span>
      <span className="amount shrink-0 text-sm font-semibold">
        {privacy ? '•••' : formatCents(tx.amount, currency)}
      </span>
    </li>
  );
}
