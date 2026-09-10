import { useMemo, useState } from 'react';
import { CategoryDonut } from '../../components/charts/CategoryDonut';
import { TxVisual } from '../../components/transactions/TxVisual';
import { Card } from '../../components/ui/Card';
import { Segmented } from '../../components/ui/Segmented';
import { getIcon } from '../../components/ui/icons';
import { useCategories, useTransactions } from '../../context/DataContext';
import { usePeriod } from '../../context/PeriodContext';
import { useScope } from '../../context/ScopeContext';
import { useSettings } from '../../context/SettingsContext';
import { categoryParts, inRange, matchesScope } from '../../logic/analytics';
import { fromISODate } from '../../logic/dates';
import { formatCents, formatPct } from '../../logic/money';
import type { CategoryBreakdown, TxType } from '../../types';

/**
 * Répartition détaillée par catégorie.
 * Le camembert du tableau de bord se lit en un coup d'œil mais ne dit ni
 * combien de mouvements, ni lesquels : on déplie ici catégorie par catégorie.
 */
export function BreakdownSection() {
  const txs = useTransactions();
  const categories = useCategories();
  const { scope } = useScope();
  const { range } = usePeriod();
  const { currency, privacyMode } = useSettings();
  const [type, setType] = useState<TxType>('expense');
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  const periodTxs = useMemo(
    () => txs.filter((tx) => tx.type === type && matchesScope(tx, scope) && inRange(tx, range)),
    [txs, type, scope, range],
  );

  const rows = useMemo(() => {
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
          pct: sum > 0 ? row.total / sum : 0,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [periodTxs, categories]);

  const donutData: CategoryBreakdown[] = rows.map((r) => ({
    categoryId: r.categoryId,
    label: r.label,
    color: r.color,
    icon: r.icon,
    total: r.total,
    pct: r.pct,
  }));

  const total = rows.reduce((acc, r) => acc + r.total, 0);
  const hide = (cents: number) => (privacyMode ? '•••' : formatCents(cents, currency));

  return (
    <div className="flex flex-col gap-4">
      <Card delay={0}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <Segmented
            options={[
              { value: 'expense', label: 'Dépenses' },
              { value: 'revenue', label: 'Revenus' },
            ]}
            value={type}
            onChange={setType}
            size="sm"
          />
          <span className="amount text-lg font-bold">{hide(total)}</span>
        </div>
        <CategoryDonut breakdown={donutData} currency={currency} />
      </Card>

      <Card delay={0.05}>
        <h2 className="mb-3 text-base font-semibold">
          {rows.length} catégorie{rows.length > 1 ? 's' : ''} sur la période
        </h2>
        {rows.length === 0 ? (
          <p className="py-2 text-sm text-ink-3">Aucun mouvement sur la période.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {rows.map((row) => {
              const Icon = getIcon(row.icon);
              const open = openCategory === row.categoryId;
              const inCategory = periodTxs
                .filter((tx) => categoryParts(tx).some((p) => p.categoryId === row.categoryId))
                .sort((a, b) => b.amount - a.amount)
                .slice(0, 12);

              return (
                <li key={row.categoryId} className="py-2">
                  <button
                    type="button"
                    onClick={() => setOpenCategory(open ? null : row.categoryId)}
                    aria-expanded={open}
                    className="flex w-full cursor-pointer items-center gap-2.5 text-left"
                  >
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                      style={{ background: `${row.color}22`, color: row.color }}
                    >
                      <Icon size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{row.label}</span>
                      <span className="text-[11px] text-ink-3">
                        {row.count} mouvement{row.count > 1 ? 's' : ''} · {formatPct(row.pct)} du
                        total
                      </span>
                    </span>
                    <span className="amount shrink-0 text-sm font-semibold">{hide(row.total)}</span>
                  </button>

                  {open && (
                    <ul className="mt-2 flex flex-col gap-1 pl-11">
                      {inCategory.map((tx) => (
                        <li key={tx.id} className="flex items-center gap-2.5 py-1">
                          <TxVisual
                            tx={tx}
                            category={categories.find((c) => c.id === tx.categoryId)}
                            size={28}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px]">{tx.label}</span>
                            <span className="text-[10px] text-ink-3">
                              {fromISODate(tx.date).toLocaleDateString('fr-FR', {
                                day: 'numeric',
                                month: 'short',
                              })}
                            </span>
                          </span>
                          <span className="amount shrink-0 text-[13px] font-medium">
                            {hide(tx.amount)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
