import { AlarmClockOff, RefreshCcw } from 'lucide-react';
import { useMemo } from 'react';
import { TxVisual } from '../../components/transactions/TxVisual';
import { Card } from '../../components/ui/Card';
import { useCategories, useTransactions } from '../../context/DataContext';
import { useScope } from '../../context/ScopeContext';
import { useSettings } from '../../context/SettingsContext';
import {
  activeSubscriptions,
  dormantSubscriptions,
  monthlyEquivalent,
  yearlyEquivalent,
} from '../../logic/analytics';
import { FREQUENCY_LABELS, fromISODate } from '../../logic/dates';
import { formatCents } from '../../logic/money';

/**
 * Abonnements : ce qui part tous les mois sans qu'on y pense.
 * Le coût annualisé est mis en avant — c'est lui qui fait réagir, pas les
 * 13,49 € mensuels.
 */
export function SubscriptionsSection() {
  const txs = useTransactions();
  const categories = useCategories();
  const { scope } = useScope();
  const { currency, privacyMode } = useSettings();

  const subs = useMemo(
    () =>
      activeSubscriptions(txs, scope).sort((a, b) => monthlyEquivalent(b) - monthlyEquivalent(a)),
    [txs, scope],
  );
  const dormant = useMemo(() => dormantSubscriptions(txs, scope), [txs, scope]);
  const dormantIds = new Set(dormant.map((t) => t.id));

  const monthly = subs.reduce((acc, tx) => acc + monthlyEquivalent(tx), 0);
  const yearly = subs.reduce((acc, tx) => acc + yearlyEquivalent(tx), 0);
  const hide = (cents: number) => (privacyMode ? '•••' : formatCents(cents, currency));

  return (
    <div className="flex flex-col gap-4">
      <Card delay={0}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-ink-3">Coût mensuel</p>
            <p className="amount text-2xl font-bold">{hide(monthly)}</p>
          </div>
          <div>
            <p className="text-xs text-ink-3">Sur un an</p>
            <p className="amount text-2xl font-bold text-warn">{hide(yearly)}</p>
          </div>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-ink-3">
          {subs.length} abonnement{subs.length > 1 ? 's' : ''} actif{subs.length > 1 ? 's' : ''}.
          Un abonnement se juge à son coût annuel : c'est ce qu'il coûte vraiment de ne rien faire.
        </p>
      </Card>

      {dormant.length > 0 && (
        <Card delay={0.05} className="border-warn/30">
          <h2 className="mb-2 flex items-center gap-2 text-base font-semibold text-warn">
            <AlarmClockOff size={17} />
            {dormant.length} abonnement{dormant.length > 1 ? 's' : ''} dormant
            {dormant.length > 1 ? 's' : ''}
          </h2>
          <p className="text-sm text-ink-2">
            Pas touché{dormant.length > 1 ? 's' : ''} depuis plus de 60 jours, pour{' '}
            {hide(dormant.reduce((acc, tx) => acc + monthlyEquivalent(tx), 0))} par mois. À
            résilier, ou à confirmer si tu t'en sers encore.
          </p>
        </Card>
      )}

      <Card delay={0.1}>
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
          <RefreshCcw size={17} className="text-accent-2" />
          Tous les abonnements
        </h2>
        {subs.length === 0 ? (
          <p className="py-2 text-sm text-ink-3">
            Aucun abonnement. Coche « Abonnement / récurrent » sur une transaction pour la suivre
            ici.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {subs.map((tx) => (
              <li key={tx.id} className="flex items-center gap-3 py-2.5">
                <TxVisual
                  tx={tx}
                  category={categories.find((c) => c.id === tx.categoryId)}
                  size={38}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {tx.label}
                    {dormantIds.has(tx.id) && (
                      <span className="ml-1.5 rounded-full bg-warn/15 px-1.5 py-0.5 text-[10px] font-semibold text-warn">
                        dormant
                      </span>
                    )}
                  </span>
                  <span className="text-[11px] text-ink-3">
                    {tx.recurringFrequency ? FREQUENCY_LABELS[tx.recurringFrequency] : 'Récurrent'}
                    {tx.nextDueDate &&
                      ` · prochaine le ${fromISODate(tx.nextDueDate).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                      })}`}
                  </span>
                </span>
                <span className="amount shrink-0 text-right text-sm font-semibold">
                  {hide(tx.amount)}
                  <span className="block text-[11px] font-normal text-ink-3">
                    {hide(yearlyEquivalent(tx))} / an
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
