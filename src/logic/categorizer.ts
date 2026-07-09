import type { Category, RecurringFrequency, Scope, TxType } from '../types';
import { DEFAULT_CATEGORIES } from '../data/seed';

/**
 * Moteur de catégorisation 100 % offline.
 * Matching par inclusion sur libellé normalisé (minuscules, sans accents),
 * base de marques d'abonnements connues pour proposer isRecurring.
 */

export interface CategorySuggestion {
  category: Category;
  icon: string;
  isRecurring: boolean;
  frequency?: RecurringFrequency;
}

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[-_/.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Marques d'abonnements connues → fréquence proposée. */
export const SUBSCRIPTION_BRANDS: Array<{ match: string; frequency: RecurringFrequency }> = [
  { match: 'netflix', frequency: 'monthly' },
  { match: 'spotify', frequency: 'monthly' },
  { match: 'disney', frequency: 'monthly' },
  { match: 'prime video', frequency: 'monthly' },
  { match: 'amazon prime', frequency: 'yearly' },
  { match: 'deezer', frequency: 'monthly' },
  { match: 'youtube premium', frequency: 'monthly' },
  { match: 'canal', frequency: 'monthly' },
  { match: 'crunchyroll', frequency: 'monthly' },
  { match: 'apple music', frequency: 'monthly' },
  { match: 'apple tv', frequency: 'monthly' },
  { match: 'icloud', frequency: 'monthly' },
  { match: 'google one', frequency: 'monthly' },
  { match: 'dropbox', frequency: 'monthly' },
  { match: 'onedrive', frequency: 'monthly' },
  { match: 'chatgpt', frequency: 'monthly' },
  { match: 'openai', frequency: 'monthly' },
  { match: 'claude', frequency: 'monthly' },
  { match: 'anthropic', frequency: 'monthly' },
  { match: 'midjourney', frequency: 'monthly' },
  { match: 'notion', frequency: 'monthly' },
  { match: 'figma', frequency: 'monthly' },
  { match: 'adobe', frequency: 'monthly' },
  { match: 'canva', frequency: 'monthly' },
  { match: 'envato', frequency: 'monthly' },
  { match: 'github', frequency: 'monthly' },
  { match: 'copilot', frequency: 'monthly' },
  { match: 'vercel', frequency: 'monthly' },
  { match: 'jetbrains', frequency: 'yearly' },
  { match: 'basic fit', frequency: 'monthly' },
  { match: 'fitness park', frequency: 'monthly' },
  { match: 'neoness', frequency: 'monthly' },
  { match: 'free', frequency: 'monthly' },
  { match: 'orange', frequency: 'monthly' },
  { match: 'sfr', frequency: 'monthly' },
  { match: 'bouygues', frequency: 'monthly' },
  { match: 'sosh', frequency: 'monthly' },
  { match: 'ovh', frequency: 'yearly' },
  { match: 'hostinger', frequency: 'yearly' },
  { match: 'o2switch', frequency: 'yearly' },
  { match: 'nordvpn', frequency: 'yearly' },
  { match: 'proton', frequency: 'monthly' },
  { match: '1password', frequency: 'monthly' },
  { match: 'playstation plus', frequency: 'monthly' },
  { match: 'psn', frequency: 'monthly' },
  { match: 'game pass', frequency: 'monthly' },
  { match: 'nintendo online', frequency: 'yearly' },
  { match: 'twitch', frequency: 'monthly' },
  { match: 'microsoft 365', frequency: 'yearly' },
  { match: 'office 365', frequency: 'yearly' },
  { match: 'mutuelle', frequency: 'monthly' },
  { match: 'loyer', frequency: 'monthly' },
  { match: 'navigo', frequency: 'monthly' },
  { match: 'urssaf', frequency: 'monthly' },
];

function detectRecurring(normalized: string): { isRecurring: boolean; frequency?: RecurringFrequency } {
  for (const brand of SUBSCRIPTION_BRANDS) {
    if (normalized.includes(brand.match)) return { isRecurring: true, frequency: brand.frequency };
  }
  if (/\babonnement|\bmensuel|\bsubscription/.test(normalized)) {
    return { isRecurring: true, frequency: 'monthly' };
  }
  return { isRecurring: false };
}

function categoryMatches(cat: Category, scope?: Scope, type?: TxType): boolean {
  if (scope && cat.scope !== 'both' && cat.scope !== scope) return false;
  if (type && cat.type !== 'both' && cat.type !== type) return false;
  return true;
}

/**
 * Retourne la meilleure catégorie + icône pour un libellé.
 * `categories` permet d'utiliser les catégories vivantes (éditées par
 * l'utilisateur) ; par défaut, la base embarquée.
 */
export function suggestCategory(
  label: string,
  opts?: { scope?: Scope; type?: TxType; categories?: Category[] },
): CategorySuggestion {
  const categories = opts?.categories ?? DEFAULT_CATEGORIES;
  const normalized = normalize(label);
  const recurring = detectRecurring(normalized);

  let best: { category: Category; score: number } | null = null;
  if (normalized.length >= 2) {
    for (const cat of categories) {
      if (!categoryMatches(cat, opts?.scope, opts?.type)) continue;
      for (const keyword of cat.keywords) {
        const kw = normalize(keyword);
        if (!kw) continue;
        if (normalized.includes(kw) || kw.includes(normalized)) {
          // Les mots-clés plus longs gagnent (match plus spécifique).
          const score = kw.length + (normalized.includes(kw) ? 2 : 0);
          if (!best || score > best.score) best = { category: cat, score };
        }
      }
    }
  }

  const fallback =
    categories.find((cat) => cat.id === 'cat-autre') ??
    categories[categories.length - 1] ??
    DEFAULT_CATEGORIES[DEFAULT_CATEGORIES.length - 1];

  const category = best?.category ?? fallback;
  return {
    category,
    icon: category.icon,
    isRecurring: recurring.isRecurring,
    frequency: recurring.frequency,
  };
}
