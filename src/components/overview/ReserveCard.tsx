import { CalendarClock, PiggyBank, Wallet } from 'lucide-react';
import { useMemo } from 'react';
import { useScheduled, useTransactions } from '../../context/DataContext';
import { useScope } from '../../context/ScopeContext';
import { useSettings } from '../../context/SettingsContext';
import { fromISODate } from '../../logic/dates';
import { formatCents } from '../../logic/money';
import { computeReserve } from '../../logic/reserve';
import { Card } from '../ui/Card';
import { DetailLink } from '../ui/DetailLink';

/**
 * Ce qu'il reste vraiment, une fois mis de côté ce qui va partir tout seul.
 *
 * Le solde d'une période ne dit pas grand-chose tant qu'on n'a pas retiré les
 * abonnements et prélèvements à venir. Cette carte répond à la seule question
 * qui compte au quotidien : combien puis-je dépenser d'ici ma prochaine paie.
 */
export function ReserveCard({ net, detailTo }: { net: number; detailTo?: string }) {
  const txs = useTransactions();
  const scheduled = useScheduled();
  const { scope } = useScope();
  const { currency, privacyMode } = useSettings();

  const reserve = useMemo(
    () => computeReserve(txs, scheduled, scope),
    [txs, scheduled, scope],
  );

  const available = net - reserve.committed;
  const hide = (cents: number) => (privacyMode ? '•••' : formatCents(cents, currency));
  const until = fromISODate(reserve.untilISO).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
  });

  return (
    <Card delay={0.18}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Wallet size={17} className="text-accent" />
          Reste à vivre
        </h2>
        {detailTo && <DetailLink to={detailTo} />}
      </div>

      {reserve.items.length === 0 ? (
        <p className="py-2 text-sm text-ink-3">
          Rien d'engagé d'ici le {until}. Marque tes abonnements comme récurrents et programme tes
          prélèvements pour voir ce qu'il faut garder de côté.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-surface-2/60 p-3">
              <p className="text-[11px] text-ink-3">Solde de la période</p>
              <p className="amount mt-0.5 text-base font-bold">{hide(net)}</p>
            </div>
            <div className="rounded-2xl bg-warn/10 p-3">
              <p className="text-[11px] text-warn">À garder</p>
              <p className="amount mt-0.5 text-base font-bold text-warn">
                {hide(reserve.committed)}
              </p>
            </div>
            <div className={`rounded-2xl p-3 ${available >= 0 ? 'bg-pos/10' : 'bg-neg/10'}`}>
              <p className={`text-[11px] ${available >= 0 ? 'text-pos' : 'text-neg'}`}>
                Disponible
              </p>
              <p
                className={`amount mt-0.5 text-base font-bold ${
                  available >= 0 ? 'text-pos' : 'text-neg'
                }`}
              >
                {hide(available)}
              </p>
            </div>
          </div>

          <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-ink-2">
            <CalendarClock size={14} className="mt-0.5 shrink-0 text-ink-3" />
            <span>
              {reserve.items.length} prélèvement{reserve.items.length > 1 ? 's' : ''} d'ici le{' '}
              {until}
              {reserve.fromSalary && reserve.salaryLabel
                ? `, date de « ${reserve.salaryLabel} »`
                : ''}
              . En dépensant plus de {hide(Math.max(0, available))}, tu entames de quoi les payer.
            </span>
          </p>

          <ul className="mt-3 flex flex-col divide-y divide-line">
            {reserve.items.slice(0, 5).map((item, i) => (
              <li
                key={`${item.label}-${item.dateISO}-${i}`}
                className="flex items-center gap-3 py-2"
              >
                <PiggyBank size={14} className="shrink-0 text-ink-3" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{item.label}</span>
                  <span className="text-[11px] text-ink-3">
                    {fromISODate(item.dateISO).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                    })}{' '}
                    · {item.kind}
                  </span>
                </span>
                <span className="amount shrink-0 text-sm font-semibold">{hide(item.amount)}</span>
              </li>
            ))}
            {reserve.items.length > 5 && (
              <li className="pt-2 text-[11px] text-ink-3">
                … et {reserve.items.length - 5} autre{reserve.items.length - 5 > 1 ? 's' : ''}
              </li>
            )}
          </ul>
        </>
      )}
    </Card>
  );
}
