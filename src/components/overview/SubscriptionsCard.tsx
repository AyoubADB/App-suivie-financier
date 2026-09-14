import { RefreshCcw, TriangleAlert } from 'lucide-react';
import { useMemo } from 'react';
import { useCategories, useTransactions } from '../../context/DataContext';
import { useSettings } from '../../context/SettingsContext';
import {
  activeSubscriptions,
  dormantSubscriptions,
  monthlyEquivalent,
  yearlyEquivalent,
} from '../../logic/analytics';
import { formatCents } from '../../logic/money';
import { TxVisual } from '../transactions/TxVisual';
import { Card } from '../ui/Card';
import { DetailLink } from '../ui/DetailLink';

/**
 * Tous les abonnements, perso et pro réunis.
 *
 * Volontairement indifférent au filtre de portée : un abonnement oublié l'est
 * des deux côtés, et le coût total est ce qui fait réagir. Le montant annuel
 * est mis en avant, parce que 13,49 € par mois ne parle à personne.
 */
export function SubscriptionsCard({ detailTo }: { detailTo?: string }) {
  const txs = useTransactions();
  const categories = useCategories();
  const { currency, privacyMode, proEnabled } = useSettings();

  const subs = useMemo(
    () => activeSubscriptions(txs, 'both').sort((a, b) => monthlyEquivalent(b) - monthlyEquivalent(a)),
    [txs],
  );
  const dormant = useMemo(() => dormantSubscriptions(txs, 'both'), [txs]);

  const monthly = subs.reduce((acc, tx) => acc + monthlyEquivalent(tx), 0);
  const yearly = subs.reduce((acc, tx) => acc + yearlyEquivalent(tx), 0);
  const perso = subs
    .filter((tx) => tx.scope === 'perso')
    .reduce((acc, tx) => acc + monthlyEquivalent(tx), 0);
  const pro = monthly - perso;

  const hide = (cents: number) => (privacyMode ? '•••' : formatCents(cents, currency));

  return (
    <Card delay={0.29}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <RefreshCcw size={17} className="text-accent-2" />
          Abonnements
        </h2>
        {detailTo && <DetailLink to={detailTo} />}
      </div>

      {subs.length === 0 ? (
        <p className="py-2 text-sm text-ink-3">
          Aucun abonnement. Coche « Abonnement / récurrent » sur une transaction pour suivre ici ce
          qui part tous les mois sans que tu y penses.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-ink-3">Par mois</p>
              <p className="amount text-2xl font-bold">{hide(monthly)}</p>
            </div>
            <div>
              <p className="text-xs text-ink-3">Sur un an</p>
              <p className="amount text-2xl font-bold text-warn">{hide(yearly)}</p>
            </div>
          </div>

          <p className="mt-2 text-[11px] text-ink-3">
            {subs.length} abonnement{subs.length > 1 ? 's' : ''} actif{subs.length > 1 ? 's' : ''}
            {proEnabled && pro > 0 && ` · ${hide(perso)} perso, ${hide(pro)} pro`}
          </p>

          {dormant.length > 0 && (
            <p className="mt-3 flex items-start gap-2 rounded-2xl bg-warn/10 px-3.5 py-2.5 text-xs leading-relaxed text-warn">
              <TriangleAlert size={14} className="mt-0.5 shrink-0" />
              {dormant.length} abonnement{dormant.length > 1 ? 's' : ''} sans mouvement depuis plus
              de 60 jours, pour{' '}
              {hide(dormant.reduce((acc, tx) => acc + monthlyEquivalent(tx), 0))} par mois.
            </p>
          )}

          <ul className="mt-3 flex flex-col divide-y divide-line">
            {subs.slice(0, 5).map((tx) => (
              <li key={tx.id} className="flex items-center gap-3 py-2">
                <TxVisual
                  tx={tx}
                  category={categories.find((c) => c.id === tx.categoryId)}
                  size={32}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{tx.label}</span>
                  <span className="text-[11px] text-ink-3">
                    {hide(yearlyEquivalent(tx))} par an
                    {proEnabled && ` · ${tx.scope}`}
                  </span>
                </span>
                <span className="amount shrink-0 text-sm font-semibold">
                  {hide(monthlyEquivalent(tx))}
                </span>
              </li>
            ))}
            {subs.length > 5 && (
              <li className="pt-2 text-[11px] text-ink-3">
                … et {subs.length - 5} autre{subs.length - 5 > 1 ? 's' : ''}
              </li>
            )}
          </ul>
        </>
      )}
    </Card>
  );
}
