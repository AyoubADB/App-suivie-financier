import type { NewTransaction } from '../data/repository';
import type { PendingOccurrence, ScheduledEntry, Transaction } from '../types';
import { toISODate } from './dates';

/** Clé de mois au format YYYY-MM. */
export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}`;
}

/**
 * Marqueur de départ d'une échéance qu'on vient de créer.
 * Sans lui, le rattrapage proposerait les six derniers mois d'un salaire
 * déjà encaissé et saisi à la main : on considère le passé comme soldé.
 */
export function initialLastGenerated(dayOfMonth: number, now = new Date()): string {
  const passed = now.getDate() >= dayOfMonth;
  const ref = passed ? now : new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return monthKey(ref);
}

/**
 * Échéances arrivées à terme et pas encore traitées.
 * Le rattrapage se fait à l'ouverture de l'app : aucun serveur nécessaire.
 * On remonte jusqu'à 6 mois pour couvrir une absence prolongée.
 */
export function pendingOccurrences(
  entries: ScheduledEntry[],
  now = new Date(),
): PendingOccurrence[] {
  const pending: PendingOccurrence[] = [];

  for (const entry of entries) {
    if (!entry.active) continue;

    for (let back = 5; back >= 0; back--) {
      const ref = new Date(now.getFullYear(), now.getMonth() - back, 1);
      const key = monthKey(ref);

      // Déjà généré : ce mois-ci et tous les précédents sont soldés.
      if (entry.lastGenerated && entry.lastGenerated >= key) continue;

      const due = new Date(ref.getFullYear(), ref.getMonth(), entry.dayOfMonth);
      if (due > now) continue;

      pending.push({ entry, dateISO: toISODate(due), monthKey: key });
    }
  }

  return pending.sort((a, b) => (a.dateISO < b.dateISO ? -1 : 1));
}

/** Transaction à créer pour une occurrence confirmée. */
export function occurrenceToTransaction(
  occ: PendingOccurrence,
  amount: number,
  currency: string,
): NewTransaction {
  return {
    type: occ.entry.type,
    scope: occ.entry.scope,
    amount,
    currency,
    label: occ.entry.label,
    categoryId: occ.entry.categoryId,
    date: occ.dateISO,
    isRecurring: false,
    badges: [],
    activityId: occ.entry.activityId,
  };
}

/**
 * Occurrences futures d'ici `days` jours, pour la projection de solde.
 * Ne tient pas compte de `lastGenerated` : il s'agit de ce qui va tomber.
 */
export function upcomingOccurrences(
  entries: ScheduledEntry[],
  days: number,
  now = new Date(),
): Array<{ entry: ScheduledEntry; dateISO: string }> {
  const out: Array<{ entry: ScheduledEntry; dateISO: string }> = [];
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + days);

  for (const entry of entries) {
    if (!entry.active) continue;
    for (let ahead = 0; ahead <= 2; ahead++) {
      const d = new Date(now.getFullYear(), now.getMonth() + ahead, entry.dayOfMonth);
      if (d > now && d <= horizon) out.push({ entry, dateISO: toISODate(d) });
    }
  }
  return out;
}

/** Prochaine échéance d'un abonnement dans la fenêtre de projection. */
export function upcomingSubscriptions(
  txs: Transaction[],
  days: number,
  now = new Date(),
): Array<{ tx: Transaction; dateISO: string }> {
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + days);
  const horizonISO = toISODate(horizon);
  const todayISO = toISODate(now);

  return txs
    .filter((tx) => tx.isRecurring && tx.nextDueDate)
    .filter((tx) => tx.nextDueDate! > todayISO && tx.nextDueDate! <= horizonISO)
    .map((tx) => ({ tx, dateISO: tx.nextDueDate! }));
}
