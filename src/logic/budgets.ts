import type { Budget, BudgetStatus, Category, DateRange, Transaction } from '../types';
import { amountForCategory, inRange } from './analytics';

/** Nombre de mois passés pris en compte pour le report d'enveloppe. */
const ROLLOVER_LOOKBACK = 6;

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
        .filter((tx) => budget.scope === 'both' || tx.scope === budget.scope)
        .reduce((acc, tx) => acc + amountForCategory(tx, budget.categoryId), 0);

      // Report d'enveloppe : ce qui n'a pas été dépensé les mois précédents
      // vient gonfler le plafond du mois en cours.
      const carried = budget.rollover ? carriedOver(budget, txs, range) : 0;
      const effective = budget.amount + carried;

      const ratio = effective > 0 ? spent / effective : 0;
      return {
        budget,
        carried,
        effective,
        categoryLabel: cat?.label ?? 'Catégorie supprimée',
        categoryColor: cat?.color ?? '#82828e',
        categoryIcon: cat?.icon ?? 'Tags',
        spent,
        ratio,
        remaining: effective - spent,
        level: ratio >= 1 ? 'over' : ratio >= WARN_RATIO ? 'warn' : 'ok',
      } satisfies BudgetStatus;
    })
    .sort((a, b) => b.ratio - a.ratio);
}

/** Total alloué et total consommé, pour l'en-tête de la section budgets. */
export function budgetTotals(statuses: BudgetStatus[]): { allocated: number; spent: number } {
  return statuses.reduce(
    (acc, s) => ({ allocated: acc.allocated + s.effective, spent: acc.spent + s.spent }),
    { allocated: 0, spent: 0 },
  );
}

/**
 * Solde cumulé des mois précédents pour une enveloppe reportable.
 * Un dépassement passé se répercute aussi : le report peut être négatif,
 * sinon l'enveloppe n'aurait aucun effet disciplinant.
 */
function carriedOver(budget: Budget, txs: Transaction[], range: DateRange): number {
  let carry = 0;
  for (let back = ROLLOVER_LOOKBACK; back >= 1; back--) {
    const from = new Date(range.from.getFullYear(), range.from.getMonth() - back, 1);
    const to = new Date(from.getFullYear(), from.getMonth() + 1, 0, 23, 59, 59, 999);
    const spent = txs
      .filter(
        (tx) =>
          tx.type === 'expense' &&
          (budget.scope === 'both' || tx.scope === budget.scope) &&
          inRange(tx, { from, to }),
      )
      .reduce((acc, tx) => acc + amountForCategory(tx, budget.categoryId), 0);
    carry += budget.amount - spent;
  }
  return carry;
}
