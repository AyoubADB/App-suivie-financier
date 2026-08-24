import type { Activity, ScopeFilter, Transaction, UserSettings } from '../types';
import { matchesScope } from './analytics';

/** Chiffre d'affaires encaissé sur l'année civile en cours. */
export function yearRevenue(txs: Transaction[], year = new Date().getFullYear()): number {
  const prefix = `${year}-`;
  return txs
    .filter((tx) => tx.scope === 'pro' && tx.type === 'revenue' && tx.date.startsWith(prefix))
    .reduce((acc, tx) => acc + tx.amount, 0);
}

export interface ThresholdStatus {
  revenue: number;
  threshold: number;
  ratio: number;
  level: 'ok' | 'warn' | 'over';
  remaining: number;
}

/** Position du chiffre d'affaires face à un seuil réglementaire. */
export function thresholdStatus(revenue: number, threshold: number): ThresholdStatus {
  const ratio = threshold > 0 ? revenue / threshold : 0;
  return {
    revenue,
    threshold,
    ratio,
    level: ratio >= 1 ? 'over' : ratio >= 0.8 ? 'warn' : 'ok',
    remaining: threshold - revenue,
  };
}

/**
 * Provision de cotisations sur une période.
 * Ce que l'app affiche comme « à toi » n'est pas ce qui reste sur le compte :
 * une part du chiffre d'affaires est due, autant la mettre de côté tout de suite.
 */
export function urssafProvision(
  txs: Transaction[],
  settings: Pick<UserSettings, 'urssafRate'>,
  year = new Date().getFullYear(),
): { revenue: number; provision: number; net: number } {
  const revenue = yearRevenue(txs, year);
  const provision = Math.round(revenue * settings.urssafRate);
  return { revenue, provision, net: revenue - provision };
}

export interface ActivityPerformance {
  activity: Activity | null;
  revenue: number;
  expenses: number;
  margin: number;
  /** Marge nette rapportée au chiffre d'affaires, null si aucun revenu. */
  marginRate: number | null;
  txCount: number;
}

/**
 * Rentabilité par activité sur une période.
 * L'entrée `activity: null` regroupe les transactions pro sans activité
 * rattachée — sans elle, les totaux ne collent pas avec le Dashboard.
 */
export function activityPerformance(
  txs: Transaction[],
  activities: Activity[],
  from?: string,
  to?: string,
): ActivityPerformance[] {
  const pro = txs.filter(
    (tx) =>
      matchesScope(tx, 'pro' as ScopeFilter) &&
      (!from || tx.date >= from) &&
      (!to || tx.date <= to),
  );

  const buckets = new Map<string, Transaction[]>();
  for (const tx of pro) {
    const key = tx.activityId ?? '';
    buckets.set(key, [...(buckets.get(key) ?? []), tx]);
  }

  const rows: ActivityPerformance[] = [];
  for (const [key, list] of buckets) {
    const revenue = list.filter((t) => t.type === 'revenue').reduce((a, t) => a + t.amount, 0);
    const expenses = list.filter((t) => t.type === 'expense').reduce((a, t) => a + t.amount, 0);
    const margin = revenue - expenses;
    rows.push({
      activity: activities.find((a) => a.id === key) ?? null,
      revenue,
      expenses,
      margin,
      marginRate: revenue > 0 ? margin / revenue : null,
      txCount: list.length,
    });
  }

  return rows.sort((a, b) => b.revenue - a.revenue);
}
