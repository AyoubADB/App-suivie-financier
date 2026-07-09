import type {
  Category,
  CategoryBreakdown,
  DateRange,
  PeriodKind,
  PeriodStats,
  ScopeFilter,
  SeriesPoint,
  Transaction,
} from '../types';
import {
  bucketFor,
  bucketLabel,
  bucketStart,
  fromISODate,
  nextBucket,
  previousRange,
  rangeDays,
  toISODate,
} from './dates';

/** Jours moyens par mois — pour mensualiser une période arbitraire. */
const DAYS_PER_MONTH = 30.44;

export function matchesScope(tx: Transaction, scope: ScopeFilter): boolean {
  return scope === 'both' || tx.scope === scope;
}

export function inRange(tx: Transaction, range: DateRange): boolean {
  const d = fromISODate(tx.date);
  return d >= range.from && d <= range.to;
}

export function filterTransactions(
  txs: Transaction[],
  scope: ScopeFilter,
  range?: DateRange,
): Transaction[] {
  return txs.filter((tx) => matchesScope(tx, scope) && (!range || inRange(tx, range)));
}

/** Équivalent mensuel d'une transaction récurrente (centimes). */
export function monthlyEquivalent(tx: Transaction): number {
  if (!tx.isRecurring) return 0;
  switch (tx.recurringFrequency) {
    case 'weekly':
      return Math.round((tx.amount * 52) / 12);
    case 'quarterly':
      return Math.round(tx.amount / 3);
    case 'yearly':
      return Math.round(tx.amount / 12);
    case 'monthly':
    default:
      return tx.amount;
  }
}

/** Coût annualisé d'un récurrent (centimes). */
export function yearlyEquivalent(tx: Transaction): number {
  return monthlyEquivalent(tx) * 12;
}

export function sum(txs: Transaction[]): number {
  return txs.reduce((acc, tx) => acc + tx.amount, 0);
}

/** Abonnements actifs = transactions récurrentes (peu importe la période). */
export function activeSubscriptions(txs: Transaction[], scope: ScopeFilter): Transaction[] {
  return txs.filter((tx) => tx.isRecurring && tx.type === 'expense' && matchesScope(tx, scope));
}

export function subscriptionMonthlyCost(txs: Transaction[], scope: ScopeFilter): number {
  return activeSubscriptions(txs, scope).reduce((acc, tx) => acc + monthlyEquivalent(tx), 0);
}

/** Abonnements « dormants » : pas touchés (updatedAt) depuis `days` jours. */
export function dormantSubscriptions(txs: Transaction[], scope: ScopeFilter, days = 60): Transaction[] {
  const cutoff = Date.now() - days * 86_400_000;
  return activeSubscriptions(txs, scope).filter((tx) => new Date(tx.updatedAt).getTime() < cutoff);
}

function breakdownByCategory(
  expenses: Transaction[],
  categories: Category[],
): CategoryBreakdown[] {
  const total = sum(expenses);
  const byId = new Map<string, number>();
  for (const tx of expenses) byId.set(tx.categoryId, (byId.get(tx.categoryId) ?? 0) + tx.amount);
  const catById = new Map(categories.map((cat) => [cat.id, cat]));
  return [...byId.entries()]
    .map(([categoryId, catTotal]) => {
      const cat = catById.get(categoryId);
      return {
        categoryId,
        label: cat?.label ?? 'Autre',
        color: cat?.color ?? '#82828e',
        icon: cat?.icon ?? 'CircleDashed',
        total: catTotal,
        pct: total > 0 ? catTotal / total : 0,
      };
    })
    .sort((a, b) => b.total - a.total);
}

function buildSeries(txs: Transaction[], range: DateRange): SeriesPoint[] {
  const bucket = bucketFor(range);
  const points: SeriesPoint[] = [];
  const index = new Map<string, SeriesPoint>();
  for (let d = bucketStart(range.from, bucket); d <= range.to; d = nextBucket(d, bucket)) {
    const point: SeriesPoint = {
      label: bucketLabel(d, bucket),
      dateISO: toISODate(d),
      expenses: 0,
      revenues: 0,
    };
    points.push(point);
    index.set(toISODate(d), point);
  }
  for (const tx of txs) {
    const key = toISODate(bucketStart(fromISODate(tx.date), bucket));
    const point = index.get(key);
    if (!point) continue;
    if (tx.type === 'expense') point.expenses += tx.amount;
    else point.revenues += tx.amount;
  }
  return points;
}

function delta(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return (current - previous) / previous;
}

/**
 * Statistiques complètes pour une période + un scope.
 * Fonction pure : tout l'état vient des arguments.
 */
export function computePeriodStats(
  allTxs: Transaction[],
  categories: Category[],
  scope: ScopeFilter,
  period: PeriodKind,
  range: DateRange,
): PeriodStats {
  const inScope = allTxs.filter((tx) => matchesScope(tx, scope));
  const current = inScope.filter((tx) => inRange(tx, range));
  const prev = inScope.filter((tx) => inRange(tx, previousRange(period, range)));

  const expensesTxs = current.filter((tx) => tx.type === 'expense');
  const revenuesTxs = current.filter((tx) => tx.type === 'revenue');
  const expenses = sum(expensesTxs);
  const revenues = sum(revenuesTxs);

  const prevExpenses = sum(prev.filter((tx) => tx.type === 'expense'));
  const prevRevenues = sum(prev.filter((tx) => tx.type === 'revenue'));

  // Poids des abonnements : coût mensuel normalisé / revenus mensualisés de la période.
  const subMonthly = subscriptionMonthlyCost(allTxs, scope);
  const monthlyRevenues = revenues * (DAYS_PER_MONTH / rangeDays(range));
  const subscriptionWeight = monthlyRevenues > 0 ? subMonthly / monthlyRevenues : null;

  return {
    expenses,
    revenues,
    net: revenues - expenses,
    savingsRate: revenues > 0 ? (revenues - expenses) / revenues : null,
    expensesDelta: delta(expenses, prevExpenses),
    revenuesDelta: delta(revenues, prevRevenues),
    byCategory: breakdownByCategory(expensesTxs, categories),
    subscriptionMonthlyCost: subMonthly,
    subscriptionWeight,
    series: buildSeries(current, range),
    txCount: current.length,
  };
}

/** Part du premier type de revenu pro (pour l'insight de diversification). */
export function revenueConcentration(
  txs: Transaction[],
  categories: Category[],
): { label: string; share: number } | null {
  const proRevenues = txs.filter((tx) => tx.scope === 'pro' && tx.type === 'revenue');
  const total = sum(proRevenues);
  if (total === 0) return null;
  const byId = new Map<string, number>();
  for (const tx of proRevenues) byId.set(tx.categoryId, (byId.get(tx.categoryId) ?? 0) + tx.amount);
  const top = [...byId.entries()].sort((a, b) => b[1] - a[1])[0];
  const cat = categories.find((c) => c.id === top[0]);
  return { label: cat?.label ?? 'Autre', share: top[1] / total };
}
