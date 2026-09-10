import { CalendarClock } from 'lucide-react';
import { useMemo } from 'react';
import { ForecastCard } from '../../components/forecast/ForecastCard';
import { PendingQueue } from '../../components/scheduled/PendingQueue';
import { ScheduledCard } from '../../components/scheduled/ScheduledCard';
import { Card } from '../../components/ui/Card';
import { useScheduled, useTransactions } from '../../context/DataContext';
import { useScope } from '../../context/ScopeContext';
import { useSettings } from '../../context/SettingsContext';
import { matchesScope } from '../../logic/analytics';
import { fromISODate } from '../../logic/dates';
import { formatCents } from '../../logic/money';
import { upcomingOccurrences, upcomingSubscriptions } from '../../logic/scheduled';

/** Solde prévisionnel : la courbe, le détail des échéances, et leur gestion. */
export function ForecastSection() {
  const txs = useTransactions();
  const scheduled = useScheduled();
  const { scope } = useScope();
  const { currency, privacyMode } = useSettings();

  /** Tout ce qui doit tomber dans les 30 jours, échéances et abonnements confondus. */
  const events = useMemo(() => {
    const scoped = txs.filter((tx) => matchesScope(tx, scope));
    const fromScheduled = upcomingOccurrences(scheduled, 30)
      .filter((o) => scope === 'both' || o.entry.scope === scope)
      .map((o) => ({
        key: `${o.entry.id}-${o.dateISO}`,
        dateISO: o.dateISO,
        label: o.entry.label,
        amount: o.entry.amount,
        type: o.entry.type,
        kind: 'Échéance' as const,
      }));
    const fromSubs = upcomingSubscriptions(scoped, 30).map((s) => ({
      key: `${s.tx.id}-${s.dateISO}`,
      dateISO: s.dateISO,
      label: s.tx.label,
      amount: s.tx.amount,
      type: s.tx.type,
      kind: 'Abonnement' as const,
    }));
    return [...fromScheduled, ...fromSubs].sort((a, b) => (a.dateISO < b.dateISO ? -1 : 1));
  }, [txs, scheduled, scope]);

  const totalOut = events
    .filter((e) => e.type === 'expense')
    .reduce((acc, e) => acc + e.amount, 0);
  const totalIn = events.filter((e) => e.type === 'revenue').reduce((acc, e) => acc + e.amount, 0);
  const hide = (cents: number) => (privacyMode ? '•••' : formatCents(cents, currency));

  return (
    <div className="flex flex-col gap-4">
      <PendingQueue />
      <ForecastCard />

      <Card delay={0.05}>
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
          <CalendarClock size={17} className="text-accent-2" />
          Ce qui tombe d'ici 30 jours
        </h2>

        {events.length === 0 ? (
          <p className="py-2 text-sm text-ink-3">
            Rien de programmé. Ajoute une échéance ci-dessous — salaire, loyer, prélèvement — et la
            projection se construira toute seule.
          </p>
        ) : (
          <>
            <div className="mb-3 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-pos/10 p-3">
                <p className="text-[11px] text-pos">À encaisser</p>
                <p className="amount text-lg font-bold text-pos">{hide(totalIn)}</p>
              </div>
              <div className="rounded-2xl bg-neg/10 p-3">
                <p className="text-[11px] text-neg">À décaisser</p>
                <p className="amount text-lg font-bold text-neg">{hide(totalOut)}</p>
              </div>
            </div>

            <ul className="flex flex-col divide-y divide-line">
              {events.map((e) => (
                <li key={e.key} className="flex items-center gap-3 py-2.5">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base ${
                      e.type === 'revenue' ? 'bg-pos/12 text-pos' : 'bg-neg/12 text-neg'
                    }`}
                  >
                    {e.type === 'revenue' ? '↓' : '↑'}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{e.label}</span>
                    <span className="text-[11px] text-ink-3">
                      {fromISODate(e.dateISO).toLocaleDateString('fr-FR', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'long',
                      })}{' '}
                      · {e.kind}
                    </span>
                  </span>
                  <span
                    className={`amount shrink-0 text-sm font-semibold ${
                      e.type === 'revenue' ? 'text-pos' : ''
                    }`}
                  >
                    {hide(e.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <ScheduledCard />
    </div>
  );
}
