import type { Budget, BudgetStatus, Category, DateRange, Transaction } from '../types';
import { inRange } from './analytics';

/** Seuil à partir duquel un budget passe en alerte avant dépassement. */
const WARN_RATIO = 0.85;

/**
 * Croise les budgets avec les dépenses de la période.
 * Le scope d'un budget filtre les transactions prises en compte :
 * un budget « perso » ignore les dépenses pro, et inversement.
 */
export function computeBudgetStatuses(
  budgets: Budget[],
  txs: Transaction[],
  categories: Category[],
  range: DateRange,
): BudgetStatus[] {
  const catById = new Map(categories.map((c) => [c.id, c]));
  const periodExpenses = txs.filter((tx) => tx.type === 'expense' && inRange(tx, range));

  return budgets
    .map((budget) => {
      const cat = catById.get(budget.categoryId);
      const spent = periodExpenses
        .filter(
          (tx) =>
            tx.categoryId === budget.categoryId &&
            (budget.scope === 'both' || tx.scope === budget.scope),
        )
        .reduce((acc, tx) => acc + tx.amount, 0);

      const ratio = budget.amount > 0 ? spent / budget.amount : 0;
      return {
        budget,
        categoryLabel: cat?.label ?? 'Catégorie supprimée',
        categoryColor: cat?.color ?? '#82828e',
        categoryIcon: cat?.icon ?? 'Tags',
        spent,
        ratio,
        remaining: budget.amount - spent,
        level: ratio >= 1 ? 'over' : ratio >= WARN_RATIO ? 'warn' : 'ok',
      } satisfies BudgetStatus;
    })
    .sort((a, b) => b.ratio - a.ratio);
}

/** Total alloué et total consommé, pour l'en-tête de la section budgets. */
export function budgetTotals(statuses: BudgetStatus[]): { allocated: number; spent: number } {
  return statuses.reduce(
    (acc, s) => ({ allocated: acc.allocated + s.budget.amount, spent: acc.spent + s.spent }),
    { allocated: 0, spent: 0 },
  );
}
