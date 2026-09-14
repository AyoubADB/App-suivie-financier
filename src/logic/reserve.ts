import type { ScheduledEntry, ScopeFilter, Transaction } from '../types';
import { matchesScope } from './analytics';
import { fromISODate, toISODate } from './dates';
import { upcomingOccurrences, upcomingSubscriptions } from './scheduled';

/**
 * Ce qui est déjà engagé avant la prochaine paie.
 *
 * Un solde disponible est trompeur tant qu'on n'a pas retiré ce qui va partir
 * tout seul : abonnements et prélèvements programmés. L'idée est de répondre à
 * « combien puis-je dépenser sans me retrouver à court avant d'être payé ».
 */

export interface ReserveItem {
  label: string;
  amount: number;
  dateISO: string;
  kind: 'abonnement' | 'échéance';
}

export interface Reserve {
  /** Date jusqu'à laquelle on projette. */
  untilISO: string;
  /** Vrai si cette date est une paie identifiée, faux si c'est un horizon. */
  fromSalary: boolean;
  /** Libellé de la rentrée attendue, quand il y en a une. */
  salaryLabel?: string;
  items: ReserveItem[];
  /** Total à garder de côté. */
  committed: number;
}

/** Nombre de jours explorés à la recherche de la prochaine rentrée. */
const HORIZON_DAYS = 45;

/** Horizon retenu quand aucune paie n'est programmée. */
const FALLBACK_DAYS = 30;

export function computeReserve(
  txs: Transaction[],
  scheduled: ScheduledEntry[],
  scope: ScopeFilter,
  now = new Date(),
): Reserve {
  const scoped = txs.filter((tx) => matchesScope(tx, scope));

  // La prochaine rentrée programmée fixe la borne : c'est le moment où la
  // trésorerie se reconstitue.
  const nextIncome = upcomingOccurrences(scheduled, HORIZON_DAYS, now)
    .filter((o) => o.entry.type === 'revenue' && (scope === 'both' || o.entry.scope === scope))
    .sort((a, b) => (a.dateISO < b.dateISO ? -1 : 1))[0];

  const fallback = new Date(now);
  fallback.setDate(fallback.getDate() + FALLBACK_DAYS);
  const untilISO = nextIncome?.dateISO ?? toISODate(fallback);
  const until = fromISODate(untilISO);
  const days = Math.max(1, Math.ceil((until.getTime() - now.getTime()) / 86_400_000));

  const items: ReserveItem[] = [];

  for (const { entry, dateISO } of upcomingOccurrences(scheduled, days, now)) {
    if (entry.type !== 'expense') continue;
    if (scope !== 'both' && entry.scope !== scope) continue;
    if (dateISO > untilISO) continue;
    items.push({ label: entry.label, amount: entry.amount, dateISO, kind: 'échéance' });
  }

  for (const { tx, dateISO } of upcomingSubscriptions(scoped, days, now)) {
    if (tx.type !== 'expense') continue;
    if (dateISO > untilISO) continue;
    items.push({ label: tx.label, amount: tx.amount, dateISO, kind: 'abonnement' });
  }

  items.sort((a, b) => (a.dateISO < b.dateISO ? -1 : 1));

  return {
    untilISO,
    fromSalary: Boolean(nextIncome),
    salaryLabel: nextIncome?.entry.label,
    items,
    committed: items.reduce((acc, i) => acc + i.amount, 0),
  };
}
