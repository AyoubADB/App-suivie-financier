import { AlarmClockOff, ArrowDownUp, RefreshCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { TxVisual } from '../components/transactions/TxVisual';
import { AnimatedAmount } from '../components/ui/AnimatedAmount';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Segmented } from '../components/ui/Segmented';
import { useScope } from '../context/ScopeContext';
import { useCategories, useTransactions } from '../data/hooks';
import { dormantSubscriptions, monthlyEquivalent, yearlyEquivalent } from '../logic/analytics';
import { FREQUENCY_LABELS, fromISODate } from '../logic/dates';
import { formatCents, formatCentsCompact } from '../logic/money';
import type { Scope, Transaction } from '../types';

type SortKey = 'amount' | 'due';

/**
 * Vue agrégée des transactions récurrentes, groupées Perso / Pro.
 * Le scope global s'applique aussi ici : « Les deux » montre les 2 sections.
 */
export function Subscriptions() {
  const txs = useTransactions() ?? [];
  const categories = useCategories() ?? [];
  const { scope } = useScope();
  const [sort, setSort] = useState<SortKey>('amount');
  const currency = localStorage.getItem('flow.currency') ?? 'EUR';

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const dormantIds = useMemo(
    () => new Set(dormantSubscriptions(txs, 'both').map((tx) => tx.id)),
    [txs],
  );

  const allSubs = useMemo(
    () => txs.filter((tx) => tx.isRecurring),
    [txs],
  );

  const sections: Array<{ scope: Scope; title: string }> = (
    scope === 'both' ? (['perso', 'pro'] as const) : ([scope] as const)
  ).map((s) => ({ scope: s, title: s === 'perso' ? 'Perso' : 'Pro' }));

  function sortSubs(list: Transaction[]): Transaction[] {
    return [...list].sort((a, b) => {
      if (sort === 'amount') return monthlyEquivalent(b) - monthlyEquivalent(a);
      return (a.nextDueDate ?? '9999') < (b.nextDueDate ?? '9999') ? -1 : 1;
    });
  }

  const globalMonthly = allSubs
    .filter((tx) => tx.type === 'expense' && (scope === 'both' || tx.scope === scope))
    .reduce((acc, tx) => acc + monthlyEquivalent(tx), 0);

  return (
    <div className="flex flex-col gap-4">
      {/* En-tête : coût mensuel global + tri */}
      <Card className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-ink-3">Coût mensuel total ({scope === 'both' ? 'perso + pro' : scope})</p>
          <AnimatedAmount cents={globalMonthly} currency={currency} className="text-2xl font-bold" />
          <p className="mt-0.5 text-[11px] text-ink-3">
            soit {formatCentsCompact(globalMonthly * 12, currency)}/an
          </p>
        </div>
        <Segmented
          options={[
            { value: 'amount', label: 'Montant' },
            { value: 'due', label: 'Échéance' },
          ]}
          value={sort}
          onChange={setSort}
          size="sm"
        />
      </Card>

      {sections.map(({ scope: s, title }, sectionIndex) => {
        const subs = sortSubs(allSubs.filter((tx) => tx.scope === s && tx.type === 'expense'));
        const revenueSubs = sortSubs(
          allSubs.filter((tx) => tx.scope === s && tx.type === 'revenue'),
        );
        const monthly = subs.reduce((acc, tx) => acc + monthlyEquivalent(tx), 0);

        return (
          <Card key={s} delay={0.05 + sectionIndex * 0.08}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <RefreshCcw size={16} className={s === 'perso' ? 'text-accent' : 'text-accent-2'} />
                {title}
              </h2>
              <span className="amount text-sm font-semibold text-ink-2">
                {formatCentsCompact(monthly, currency)}/mois
              </span>
            </div>

            {subs.length === 0 && revenueSubs.length === 0 ? (
              <EmptyState
                icon={RefreshCcw}
                title={`Aucun abonnement ${title.toLowerCase()}`}
                hint="Les transactions marquées « récurrent » dans Perso / Pro apparaissent ici automatiquement."
              />
            ) : (
              <ul className="flex flex-col gap-1">
                {[...subs, ...revenueSubs].map((tx) => {
                  const dormant = dormantIds.has(tx.id) && tx.type === 'expense';
                  return (
                    <li
                      key={tx.id}
                      className={`flex items-center gap-3 rounded-2xl px-2 py-2.5 ${
                        dormant ? 'bg-warn/8 ring-1 ring-warn/30' : 'hover:bg-surface-2/60'
                      }`}
                    >
                      <TxVisual tx={tx} category={catById.get(tx.categoryId)} size={40} />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 truncate text-sm font-medium">
                          {tx.label}
                          {dormant && (
                            <span className="flex shrink-0 items-center gap-1 rounded-full bg-warn/15 px-2 py-0.5 text-[10px] font-semibold text-warn">
                              <AlarmClockOff size={10} />
                              Dormant
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-ink-3">
                          {tx.recurringFrequency ? FREQUENCY_LABELS[tx.recurringFrequency] : 'Mensuel'}
                          {tx.nextDueDate &&
                            ` · prochaine : ${fromISODate(tx.nextDueDate).toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'short',
                            })}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`amount text-sm font-semibold ${tx.type === 'revenue' ? 'text-pos' : ''}`}>
                          {tx.type === 'revenue' ? '+' : ''}
                          {formatCents(tx.amount, tx.currency)}
                        </p>
                        <p className="amount text-[11px] text-ink-3">
                          {formatCentsCompact(yearlyEquivalent(tx), currency)}/an
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        );
      })}

      <p className="flex items-center gap-2 px-2 text-[11px] text-ink-3">
        <ArrowDownUp size={12} />
        Un abonnement = une transaction récurrente créée dans Perso ou Pro. Cette vue est une
        agrégation, l'édition se fait depuis ces écrans.
      </p>
    </div>
  );
}
