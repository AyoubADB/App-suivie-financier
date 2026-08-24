import type {
  BudgetStatus,
  Category,
  Insight,
  PeriodStats,
  ScopeFilter,
  Transaction,
} from '../types';
import { dormantSubscriptions, matchesScope, monthlyEquivalent, revenueConcentration } from './analytics';
import { formatCents, formatPct } from './money';

const SAVINGS_TARGET = 0.2;

/**
 * Coach financier — mode A (heuristiques offline).
 * Produit des conseils chiffrés à partir des stats de la période,
 * triés par impact financier décroissant.
 */
export function generateInsights(
  stats: PeriodStats,
  allTxs: Transaction[],
  categories: Category[],
  scope: ScopeFilter,
  currency = 'EUR',
  budgets: BudgetStatus[] = [],
): Insight[] {
  const insights: Insight[] = [];
  const scopeLabel = scope === 'both' ? 'perso + pro' : scope;

  // 1. Poids des abonnements + dormants
  const dormant = dormantSubscriptions(allTxs, scope);
  const dormantMonthly = dormant.reduce((acc, tx) => acc + monthlyEquivalent(tx), 0);
  if (stats.subscriptionWeight !== null && stats.subscriptionMonthlyCost > 0) {
    const weightTxt = formatPct(stats.subscriptionWeight);
    if (dormant.length > 0) {
      insights.push({
        severity: stats.subscriptionWeight > 0.15 ? 'warn' : 'info',
        title: `Abonnements : ${weightTxt} de tes revenus ${scopeLabel}`,
        message: `${dormant.length} abonnement${dormant.length > 1 ? 's' : ''} (${dormant
          .map((tx) => tx.label)
          .slice(0, 3)
          .join(', ')}) n'${dormant.length > 1 ? 'ont' : 'a'} pas bougé depuis 60 jours. Les résilier libérerait ${formatCents(dormantMonthly, currency)}/mois.`,
        potentialSaving: dormantMonthly,
      });
    } else if (stats.subscriptionWeight > 0.1) {
      insights.push({
        severity: stats.subscriptionWeight > 0.2 ? 'warn' : 'info',
        title: `Abonnements : ${weightTxt} de tes revenus`,
        message: `Tes récurrents pèsent ${formatCents(stats.subscriptionMonthlyCost, currency)}/mois. Vise moins de 10 % des revenus : chaque abonnement coupé est une économie automatique.`,
      });
    }
  }

  // 2. Catégorie dominante + tendance
  const top = stats.byCategory[0];
  if (top && stats.expenses > 0 && top.pct >= 0.25) {
    const deltaTxt =
      stats.expensesDelta !== null
        ? ` Dépenses globales ${stats.expensesDelta >= 0 ? '+' : ''}${formatPct(stats.expensesDelta)} vs période précédente.`
        : '';
    insights.push({
      severity: top.pct > 0.4 ? 'warn' : 'info',
      title: `${top.label} pèse ${formatPct(top.pct)} de tes dépenses`,
      message: `${formatCents(top.total, currency)} sur la période.${deltaTxt} Réduire ce poste de 15 % économiserait ${formatCents(Math.round(top.total * 0.15), currency)}.`,
      potentialSaving: Math.round(top.total * 0.15),
    });
  }

  // 3. Taux d'épargne vs objectif 20 %
  if (stats.savingsRate !== null) {
    if (stats.savingsRate < 0) {
      insights.push({
        severity: 'warn',
        title: 'Solde négatif sur la période',
        message: `Tu dépenses ${formatCents(-stats.net, currency)} de plus que tes revenus. Premier réflexe : passer en revue ${top ? `la catégorie ${top.label}` : 'tes plus gros postes'} et les abonnements dormants.`,
      });
    } else if (stats.savingsRate < SAVINGS_TARGET) {
      const gap = Math.round(stats.revenues * SAVINGS_TARGET - (stats.revenues - stats.expenses));
      insights.push({
        severity: 'info',
        title: `Taux d'épargne : ${formatPct(stats.savingsRate)}`,
        message: `Objectif recommandé : ${formatPct(SAVINGS_TARGET)}. Il manque ${formatCents(gap, currency)} d'économies sur la période${top ? ` — réduire ${top.label} de ${formatPct(Math.min(1, gap / top.total))} t'y amènerait` : ''}.`,
        potentialSaving: gap,
      });
    } else {
      insights.push({
        severity: 'good',
        title: `Taux d'épargne : ${formatPct(stats.savingsRate)} — solide`,
        message: `Tu mets de côté ${formatCents(stats.net, currency)} sur la période, au-dessus de l'objectif de ${formatPct(SAVINGS_TARGET)}. Continue comme ça.`,
      });
    }
  }

  // 4. Concentration des revenus pro
  if (scope !== 'perso') {
    const conc = revenueConcentration(allTxs, categories);
    if (conc && conc.share >= 0.7) {
      insights.push({
        severity: 'info',
        title: `Activité pro concentrée à ${formatPct(conc.share)} sur « ${conc.label} »`,
        message: `Un seul type de revenu domine ton business. Diversifier (2e casquette, offre récurrente) réduirait le risque si ce flux ralentit.`,
      });
    }
  }

  // 5. Hausse marquée des dépenses
  if (stats.expensesDelta !== null && stats.expensesDelta > 0.2 && stats.expenses > 0) {
    insights.push({
      severity: 'warn',
      title: `Dépenses en hausse de ${formatPct(stats.expensesDelta)}`,
      message: `Tes dépenses passent à ${formatCents(stats.expenses, currency)} contre la période précédente. Vérifie les nouveaux achats non planifiés.`,
    });
  }

  // 6. Budgets dépassés — le conseil le plus actionnable qui soit.
  const over = budgets.filter((b) => b.level === 'over');
  if (over.length > 0) {
    const excess = over.reduce((acc, b) => acc + (b.spent - b.budget.amount), 0);
    insights.push({
      severity: 'warn',
      title: `${over.length} budget${over.length > 1 ? 's' : ''} dépassé${over.length > 1 ? 's' : ''}`,
      message: `${over.map((b) => b.categoryLabel).join(', ')} — ${formatCents(excess, currency)} au-dessus du plafond. Ajuste le plafond s'il était irréaliste, sinon c'est là qu'il faut lever le pied.`,
      potentialSaving: excess,
    });
  }

  // 7. Dépenses du week-end — un poste que personne ne surveille.
  const weekend = weekendShare(allTxs, scope);
  if (weekend && weekend.share > 0.4 && weekend.total > 0) {
    insights.push({
      severity: 'info',
      title: `${formatPct(weekend.share)} de tes dépenses tombent le week-end`,
      message: `${formatCents(weekend.total, currency)} sur les 90 derniers jours, concentrés sur samedi et dimanche. Prévoir une enveloppe week-end est souvent plus efficace que de se restreindre en semaine.`,
    });
  }

  // 8. Petites dépenses répétées — l'effet cumulé passe inaperçu.
  const small = smallRecurringDrain(allTxs, scope);
  if (small && small.count >= 8) {
    insights.push({
      severity: 'info',
      title: `${small.count} petites dépenses sous ${formatCents(small.threshold, currency)}`,
      message: `Elles totalisent ${formatCents(small.total, currency)} sur 90 jours, soit ${formatCents(Math.round(small.total / 3), currency)} par mois. Prises une par une elles semblent négligeables ; c'est le cumul qui pèse.`,
      potentialSaving: Math.round(small.total / 3 / 2),
    });
  }

  // 9. Comparaison au même mois de l'année précédente.
  const yoy = yearOverYear(allTxs, scope);
  if (yoy && Math.abs(yoy.delta) > 0.15) {
    insights.push({
      severity: yoy.delta > 0 ? 'warn' : 'good',
      title:
        yoy.delta > 0
          ? `+${formatPct(yoy.delta)} de dépenses vs l'an dernier`
          : `${formatPct(yoy.delta)} de dépenses vs l'an dernier`,
      message: `Ce mois-ci : ${formatCents(yoy.current, currency)}. Le même mois l'an dernier : ${formatCents(yoy.previous, currency)}. ${yoy.delta > 0 ? "Regarde quelles catégories ont enflé." : 'Continue, la tendance est bonne.'}`,
    });
  }

  // 10. Aucun revenu enregistré : la plupart des ratios deviennent faux.
  if (stats.revenues === 0 && stats.expenses > 0) {
    insights.push({
      severity: 'info',
      title: 'Aucun revenu sur la période',
      message:
        "Ajoute ton salaire ou tes encaissements : sans eux, le taux d'épargne et le poids des abonnements ne veulent rien dire.",
    });
  }

  return insights
    .sort((a, b) => (b.potentialSaving ?? 0) - (a.potentialSaving ?? 0))
    .slice(0, 6);
}

/** Fenêtre d'analyse commune aux heuristiques comportementales. */
function recentExpenses(txs: Transaction[], scope: ScopeFilter, days = 90): Transaction[] {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceISO = since.toISOString().slice(0, 10);
  return txs.filter((tx) => tx.type === 'expense' && matchesScope(tx, scope) && tx.date >= sinceISO);
}

/** Part des dépenses réalisées samedi ou dimanche. */
function weekendShare(
  txs: Transaction[],
  scope: ScopeFilter,
): { share: number; total: number } | null {
  const recent = recentExpenses(txs, scope);
  if (recent.length < 10) return null;
  const all = recent.reduce((acc, tx) => acc + tx.amount, 0);
  if (all === 0) return null;
  const total = recent
    .filter((tx) => {
      const day = new Date(tx.date).getDay();
      return day === 0 || day === 6;
    })
    .reduce((acc, tx) => acc + tx.amount, 0);
  return { share: total / all, total };
}

/**
 * Petites dépenses répétées : chacune est indolore, le cumul ne l'est pas.
 * Le seuil s'adapte au niveau de dépense plutôt que d'être figé.
 */
function smallRecurringDrain(
  txs: Transaction[],
  scope: ScopeFilter,
): { count: number; total: number; threshold: number } | null {
  const recent = recentExpenses(txs, scope).filter((tx) => !tx.isRecurring);
  if (recent.length < 10) return null;
  const median = [...recent].sort((a, b) => a.amount - b.amount)[Math.floor(recent.length / 2)];
  const threshold = Math.max(500, Math.min(2000, Math.round(median.amount / 2)));
  const small = recent.filter((tx) => tx.amount <= threshold);
  return { count: small.length, total: small.reduce((a, tx) => a + tx.amount, 0), threshold };
}

/** Dépenses du mois en cours face au même mois de l'année précédente. */
function yearOverYear(
  txs: Transaction[],
  scope: ScopeFilter,
): { delta: number; current: number; previous: number } | null {
  const now = new Date();
  const monthOf = (d: Date) => `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}`;
  const currentKey = monthOf(now);
  const lastYearKey = monthOf(new Date(now.getFullYear() - 1, now.getMonth(), 1));

  const totalFor = (key: string) =>
    txs
      .filter((tx) => tx.type === 'expense' && matchesScope(tx, scope) && tx.date.startsWith(key))
      .reduce((acc, tx) => acc + tx.amount, 0);

  const previous = totalFor(lastYearKey);
  if (previous === 0) return null;
  const current = totalFor(currentKey);
  if (current === 0) return null;
  return { delta: (current - previous) / previous, current, previous };
}
