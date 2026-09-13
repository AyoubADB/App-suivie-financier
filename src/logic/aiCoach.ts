import type { Category, Insight, PeriodStats, ScopeFilter, Transaction } from '../types';
import { activeSubscriptions, monthlyEquivalent } from './analytics';
import { anthropicClient, describeApiError } from './anthropic';

/**
 * Coach IA — mode B (optionnel). Appel direct à l'API Anthropic depuis le
 * navigateur avec la clé fournie par l'utilisateur (stockée localement,
 * jamais en dur). On n'envoie qu'un résumé anonymisé : chiffres, ratios,
 * top catégories et liste d'abonnements — aucune note ni donnée inutile.
 */

/** Analyse approfondie, à la demande : on prend le modèle le plus capable. */
const MODEL = 'claude-opus-5';

const SYSTEM_PROMPT = `Tu es un coach financier bienveillant et concret pour un particulier qui gère aussi une petite activité indépendante multi-casquettes. Réponds en français, ton direct, sans jargon. À partir du résumé chiffré fourni, donne 3 à 5 recommandations actionnables et chiffrées (montants en euros, pourcentages), classées par impact. Formate en liste à puces courtes. Pas d'introduction ni de conclusion.`;

export interface CoachSummary {
  periode: string;
  scope: ScopeFilter;
  devise: string;
  revenus: number;
  depenses: number;
  soldeNet: number;
  tauxEpargne: number | null;
  variationDepenses: number | null;
  variationRevenus: number | null;
  topCategories: Array<{ categorie: string; total: number; part: number }>;
  abonnements: Array<{ nom: string; coutMensuel: number; frequence?: string }>;
  poidsAbonnements: number | null;
  conseilsHeuristiques: string[];
}

export function buildCoachSummary(
  stats: PeriodStats,
  allTxs: Transaction[],
  _categories: Category[],
  scope: ScopeFilter,
  periodLabel: string,
  currency: string,
  heuristics: Insight[],
): CoachSummary {
  return {
    periode: periodLabel,
    scope,
    devise: currency,
    revenus: stats.revenues / 100,
    depenses: stats.expenses / 100,
    soldeNet: stats.net / 100,
    tauxEpargne: stats.savingsRate,
    variationDepenses: stats.expensesDelta,
    variationRevenus: stats.revenuesDelta,
    topCategories: stats.byCategory.slice(0, 6).map((cat) => ({
      categorie: cat.label,
      total: cat.total / 100,
      part: cat.pct,
    })),
    abonnements: activeSubscriptions(allTxs, scope).map((tx) => ({
      nom: tx.label,
      coutMensuel: monthlyEquivalent(tx) / 100,
      frequence: tx.recurringFrequency,
    })),
    poidsAbonnements: stats.subscriptionWeight,
    conseilsHeuristiques: heuristics.map((insight) => insight.title),
  };
}

export async function askAiCoach(summary: CoachSummary, apiKey: string): Promise<string> {
  try {
    const client = await anthropicClient(apiKey);
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Voici mon résumé financier :\n${JSON.stringify(summary, null, 2)}`,
        },
      ],
    });

    if (response.stop_reason === 'refusal') {
      throw new Error('La requête a été refusée par les garde-fous du modèle. Réessaie plus tard.');
    }

    const text = response.content
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('\n')
      .trim();
    if (!text) throw new Error('Réponse vide du coach IA.');
    return text;
  } catch (error) {
    throw new Error(await describeApiError(error));
  }
}
