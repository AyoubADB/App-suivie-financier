import type {
  BudgetStatus,
  Category,
  PeriodStats,
  SavingsGoal,
  ScheduledEntry,
  ScopeFilter,
  Transaction,
} from '../types';
import { categoryParts, inRange, matchesScope, monthlyEquivalent } from './analytics';
import { dormantSubscriptions } from './analytics';
import { firstNegativeDay, forecastBalance } from './forecast';
import { formatCents, formatPct } from './money';
import { urssafProvision } from './pro';

/**
 * Analyse rédigée, produite sur l'appareil.
 *
 * Ce n'est pas un modèle de langue : c'est un générateur de texte qui compose
 * des phrases à partir des chiffres réels du compte. L'avantage est décisif
 * pour un usage quotidien — instantané, hors ligne, gratuit, et jamais
 * inventé, puisque chaque phrase est adossée à un calcul.
 */

export interface LocalReport {
  /** Une phrase qui résume la période. */
  headline: string;
  paragraphs: string[];
  /** L'action la plus rentable, chiffrée. */
  action?: string;
}

export interface LocalCoachInput {
  stats: PeriodStats;
  allTxs: Transaction[];
  categories: Category[];
  scope: ScopeFilter;
  periodLabel: string;
  currency: string;
  budgets?: BudgetStatus[];
  scheduled?: ScheduledEntry[];
  goals?: SavingsGoal[];
  proEnabled?: boolean;
  urssafRate?: number;
  savingsGoal?: number;
}

/** Choix stable d'une formulation : le rapport ne doit pas changer à chaque rendu. */
function pick<T>(options: T[], seed: number): T {
  return options[Math.abs(Math.round(seed)) % options.length];
}

/** Dépense moyenne d'une catégorie sur les mois précédents. */
function categoryAverage(
  txs: Transaction[],
  categoryId: string,
  scope: ScopeFilter,
  months: number,
  now = new Date(),
): number | null {
  let total = 0;
  let counted = 0;
  for (let back = 1; back <= months; back++) {
    const from = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const to = new Date(from.getFullYear(), from.getMonth() + 1, 0, 23, 59, 59, 999);
    const sum = txs
      .filter((tx) => tx.type === 'expense' && matchesScope(tx, scope) && inRange(tx, { from, to }))
      .reduce((acc, tx) => {
        const part = categoryParts(tx).find((p) => p.categoryId === categoryId);
        return acc + (part?.amount ?? 0);
      }, 0);
    if (sum > 0) {
      total += sum;
      counted++;
    }
  }
  return counted > 0 ? Math.round(total / counted) : null;
}

/** Rédige l'analyse de la période. */
export function buildLocalReport(input: LocalCoachInput): LocalReport {
  const {
    stats,
    allTxs,
    categories,
    scope,
    periodLabel,
    currency,
    budgets = [],
    scheduled = [],
    goals = [],
    proEnabled,
    urssafRate,
    savingsGoal = 0.2,
  } = input;

  const money = (cents: number) => formatCents(cents, currency);
  const seed = stats.expenses + stats.revenues + stats.txCount;
  const paragraphs: string[] = [];

  // 1. Le résumé de la période.
  let headline: string;
  if (stats.txCount === 0) {
    headline = `Rien d'enregistré sur ${periodLabel}.`;
    return {
      headline,
      paragraphs: [
        "Ajoute quelques mouvements, ou scanne un ticket avec l'appareil photo : l'analyse se construit toute seule dès qu'il y a de la matière.",
      ],
    };
  }

  if (stats.revenues === 0) {
    headline = `${money(stats.expenses)} dépensés sur ${periodLabel}, sans revenu enregistré.`;
  } else if (stats.savingsRate === null || stats.savingsRate < 0) {
    headline = pick(
      [
        `Tu as dépensé plus que tu n'as gagné sur ${periodLabel}.`,
        `${periodLabel} se termine en négatif de ${money(-stats.net)}.`,
      ],
      seed,
    );
  } else if (stats.savingsRate >= savingsGoal) {
    headline = pick(
      [
        `Objectif tenu : ${formatPct(stats.savingsRate)} mis de côté sur ${periodLabel}.`,
        `${money(stats.net)} conservés sur ${periodLabel}, au-dessus de ton objectif.`,
      ],
      seed,
    );
  } else {
    headline = pick(
      [
        `${formatPct(stats.savingsRate)} d'épargne sur ${periodLabel}, sous ton objectif de ${formatPct(savingsGoal)}.`,
        `Il te reste ${money(stats.net)} sur ${periodLabel}, un peu court face à ton objectif.`,
      ],
      seed,
    );
  }

  // 2. Où part l'argent.
  const top = stats.byCategory.slice(0, 3);
  if (top.length > 0) {
    const parts = top.map((c) => `${c.label} (${money(c.total)}, ${formatPct(c.pct)})`);
    const trend =
      stats.expensesDelta === null
        ? ''
        : stats.expensesDelta > 0.05
          ? ` L'ensemble progresse de ${formatPct(stats.expensesDelta)} par rapport à la période précédente.`
          : stats.expensesDelta < -0.05
            ? ` C'est ${formatPct(-stats.expensesDelta)} de moins que la période précédente.`
            : ' Le niveau est stable par rapport à la période précédente.';
    paragraphs.push(
      `Tes trois principaux postes sont ${parts.join(', ')}.${trend}`,
    );
  }

  // 3. Ce qui sort de l'ordinaire.
  const anomalies: string[] = [];
  for (const cat of stats.byCategory.slice(0, 6)) {
    const average = categoryAverage(allTxs, cat.categoryId, scope, 3);
    if (average === null || average < 2000) continue;
    if (cat.total > average * 1.5) {
      anomalies.push(
        `${cat.label} à ${money(cat.total)} contre ${money(average)} en moyenne les mois précédents`,
      );
    }
  }
  if (anomalies.length > 0) {
    const listed = anomalies.slice(0, 2);
    const intro =
      listed.length === 1 ? 'Un poste sort de tes habitudes' : 'Deux postes sortent de tes habitudes';
    paragraphs.push(
      `${intro} : ${listed.join(', et ')}. Si c'était exceptionnel, tant mieux ; sinon, c'est là qu'il y a de la marge.`,
    );
  }

  // 4. Le mouvement le plus lourd de la période.
  const biggest = allTxs
    .filter((tx) => tx.type === 'expense' && matchesScope(tx, scope))
    .sort((a, b) => b.amount - a.amount)[0];
  if (biggest && stats.expenses > 0 && biggest.amount > stats.expenses * 0.25) {
    const cat = categories.find((c) => c.id === biggest.categoryId);
    paragraphs.push(
      `À elle seule, « ${biggest.label} » (${money(biggest.amount)}${cat ? `, ${cat.label}` : ''}) pèse ${formatPct(biggest.amount / stats.expenses)} de tes dépenses.`,
    );
  }

  // 5. Budgets dépassés.
  const over = budgets.filter((b) => b.level === 'over');
  if (over.length > 0) {
    const worst = over[0];
    paragraphs.push(
      `${over.length} budget${over.length > 1 ? 's sont dépassés' : ' est dépassé'}, ` +
        `le plus loin étant ${worst.categoryLabel} : ${money(worst.spent)} pour un plafond de ${money(worst.effective)}.`,
    );
  }

  // 6. Ce qui arrive.
  const negative = scheduled.length > 0 ? firstNegativeDay(forecastBalance(allTxs, scheduled, scope, 30)) : null;
  if (negative) {
    paragraphs.push(
      `Attention à la suite : au rythme des échéances connues, la projection passe sous zéro le ${new Date(negative.dateISO).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}.`,
    );
  }

  // 7. Volet professionnel.
  if (proEnabled && urssafRate && (scope === 'pro' || scope === 'both')) {
    const { revenue, provision } = urssafProvision(allTxs, { urssafRate });
    if (revenue > 0) {
      paragraphs.push(
        `Côté pro, ${money(revenue)} encaissés cette année : ${money(provision)} sont dus en cotisations et ne t'appartiennent pas. Vire-les sur un compte à part dès l'encaissement.`,
      );
    }
  }

  // 8. Objectifs.
  const activeGoal = goals.find((g) => g.saved < g.target);
  if (activeGoal) {
    const remaining = activeGoal.target - activeGoal.saved;
    paragraphs.push(
      `Ton projet « ${activeGoal.label} » en est à ${formatPct(activeGoal.saved / activeGoal.target)} : il reste ${money(remaining)} à mettre de côté.`,
    );
  }

  // 9. L'action la plus rentable, chiffrée.
  const action = bestAction(input, money);

  return { headline, paragraphs, action };
}

/** La piste qui rapporte le plus, exprimée en euros par mois. */
function bestAction(input: LocalCoachInput, money: (c: number) => string): string | undefined {
  const { allTxs, scope, stats, budgets = [] } = input;

  const dormant = dormantSubscriptions(allTxs, scope);
  const dormantMonthly = dormant.reduce((acc, tx) => acc + monthlyEquivalent(tx), 0);
  if (dormantMonthly > 0) {
    return `Résilier ${dormant.length === 1 ? `« ${dormant[0].label} »` : `les ${dormant.length} abonnements dormants`} libérerait ${money(dormantMonthly)} par mois, soit ${money(dormantMonthly * 12)} sur un an.`;
  }

  const over = budgets.filter((b) => b.level === 'over');
  if (over.length > 0) {
    const total = over.reduce((acc, b) => acc + (b.spent - b.effective), 0);
    return `Revenir dans tes plafonds sur ${over.map((b) => b.categoryLabel).slice(0, 2).join(' et ')} représente ${money(total)} récupérés ce mois-ci.`;
  }

  const top = stats.byCategory[0];
  if (top && top.pct > 0.3 && top.total > 5000) {
    const target = Math.round(top.total * 0.1);
    return `Réduire ${top.label} de 10 % suffirait à dégager ${money(target)} sur la période, sans toucher au reste.`;
  }

  if (stats.savingsRate !== null && stats.savingsRate > 0 && stats.net > 0) {
    return `Mettre ${money(Math.round(stats.net / 2))} de côté dès maintenant fige la moitié de ton excédent avant qu'il ne se dilue.`;
  }

  return undefined;
}
