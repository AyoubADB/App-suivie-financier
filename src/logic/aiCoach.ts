import type { Category, Insight, PeriodStats, ScopeFilter, Transaction } from '../types';
import { activeSubscriptions, monthlyEquivalent } from './analytics';

/**
 * Coach IA — mode B (optionnel). Appel direct à l'API Anthropic depuis le
 * navigateur avec la clé fournie par l'utilisateur (stockée localement,
 * jamais en dur). On n'envoie qu'un résumé anonymisé : chiffres, ratios,
 * top catégories et liste d'abonnements — aucune note ni donnée inutile.
 */

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-opus-4-8';

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

interface AnthropicContentBlock {
  type: string;
  text?: string;
}

interface AnthropicResponse {
  content: AnthropicContentBlock[];
  stop_reason: string;
  error?: { message: string };
}

export async function askAiCoach(summary: CoachSummary, apiKey: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        // Requis pour un appel direct depuis le navigateur (CORS).
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Voici mon résumé financier :\n${JSON.stringify(summary, null, 2)}`,
          },
        ],
      }),
    });
  } catch {
    throw new Error('Impossible de joindre l’API Anthropic. Vérifie ta connexion internet.');
  }

  if (!response.ok) {
    if (response.status === 401) throw new Error('Clé API invalide. Vérifie-la dans les réglages.');
    if (response.status === 429) throw new Error('Trop de requêtes — réessaie dans une minute.');
    let detail = '';
    try {
      const body = (await response.json()) as AnthropicResponse;
      detail = body.error?.message ?? '';
    } catch {
      // corps non JSON — on garde le message générique
    }
    throw new Error(`Erreur API (${response.status})${detail ? ` : ${detail}` : ''}.`);
  }

  const data = (await response.json()) as AnthropicResponse;
  if (data.stop_reason === 'refusal') {
    throw new Error('La requête a été refusée par les garde-fous du modèle. Réessaie plus tard.');
  }
  const text = data.content
    .filter((block) => block.type === 'text' && block.text)
    .map((block) => block.text)
    .join('\n')
    .trim();
  if (!text) throw new Error('Réponse vide du coach IA.');
  return text;
}
