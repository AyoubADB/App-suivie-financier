import type { ForecastPoint, ScheduledEntry, ScopeFilter, Transaction } from '../types';
import { matchesScope } from './analytics';
import { toISODate } from './dates';
import { upcomingOccurrences, upcomingSubscriptions } from './scheduled';

/**
 * Projection du solde jour par jour sur `days` jours.
 *
 * Le point de départ est le solde net cumulé de tout l'historique : l'app ne
 * connaît pas le solde bancaire réel, seulement les mouvements saisis. La
 * courbe vaut donc surtout par sa forme et par la date de passage au rouge.
 */
export function forecastBalance(
  txs: Transaction[],
  scheduled: ScheduledEntry[],
  scope: ScopeFilter,
  days = 30,
  now = new Date(),
): ForecastPoint[] {
  const scoped = txs.filter((tx) => matchesScope(tx, scope));
  const start = scoped.reduce(
    (acc, tx) => acc + (tx.type === 'revenue' ? tx.amount : -tx.amount),
    0,
  );

  // Mouvements attendus, regroupés par jour.
  const byDay = new Map<string, { delta: number; events: string[] }>();
  const add = (dateISO: string, delta: number, label: string) => {
    const slot = byDay.get(dateISO) ?? { delta: 0, events: [] };
    slot.delta += delta;
    slot.events.push(label);
    byDay.set(dateISO, slot);
  };

  for (const { entry, dateISO } of upcomingOccurrences(scheduled, days, now)) {
    if (scope !== 'both' && entry.scope !== scope) continue;
    add(dateISO, entry.type === 'revenue' ? entry.amount : -entry.amount, entry.label);
  }

  for (const { tx, dateISO } of upcomingSubscriptions(scoped, days, now)) {
    add(dateISO, tx.type === 'revenue' ? tx.amount : -tx.amount, tx.label);
  }

  const points: ForecastPoint[] = [];
  let balance = start;
  for (let i = 0; i <= days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const iso = toISODate(d);
    const slot = byDay.get(iso);
    if (slot) balance += slot.delta;
    points.push({
      dateISO: iso,
      label: d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
      balance,
      events: slot?.events ?? [],
    });
  }
  return points;
}

/** Premier jour où la projection passe sous zéro, s'il existe. */
export function firstNegativeDay(points: ForecastPoint[]): ForecastPoint | null {
  return points.find((p) => p.balance < 0) ?? null;
}
