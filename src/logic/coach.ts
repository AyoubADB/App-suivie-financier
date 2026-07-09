import type { Category, Insight, PeriodStats, ScopeFilter, Transaction } from '../types';
import { dormantSubscriptions, monthlyEquivalent, revenueConcentration } from './analytics';
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

  return insights
    .sort((a, b) => (b.potentialSaving ?? 0) - (a.potentialSaving ?? 0))
    .slice(0, 5);
}
