import type Anthropic from '@anthropic-ai/sdk';

/**
 * Accès à l'API Anthropic depuis le navigateur.
 *
 * Le SDK n'est chargé qu'au moment où l'utilisateur demande une analyse : il
 * pèse quelques centaines de kilo-octets, inutiles pour qui n'a pas de clé.
 * La clé vit dans le stockage local de l'appareil et n'est jamais envoyée
 * ailleurs qu'à l'API.
 */

const API_KEY_STORAGE = 'flow.apiKey';

export function storedApiKey(): string {
  try {
    return localStorage.getItem(API_KEY_STORAGE) ?? '';
  } catch {
    return '';
  }
}

export async function anthropicClient(apiKey: string): Promise<Anthropic> {
  const { default: Client } = await import('@anthropic-ai/sdk');
  // L'appel part du navigateur de l'utilisateur, avec sa propre clé : c'est
  // le seul moyen de ne pas faire transiter ses finances par un serveur.
  return new Client({ apiKey, dangerouslyAllowBrowser: true });
}

/** Traduit une erreur du SDK en phrase compréhensible. */
export async function describeApiError(error: unknown): Promise<string> {
  const { default: Client } = await import('@anthropic-ai/sdk');

  if (error instanceof Client.AuthenticationError) {
    return 'Clé API refusée. Vérifie-la dans les réglages.';
  }
  if (error instanceof Client.RateLimitError) {
    return 'Trop de requêtes d’affilée. Réessaie dans une minute.';
  }
  if (error instanceof Client.BadRequestError) {
    return `Requête refusée : ${error.message}`;
  }
  if (error instanceof Client.APIConnectionError) {
    return 'Connexion impossible à l’API. Vérifie ta connexion internet.';
  }
  if (error instanceof Client.APIError) {
    return `Erreur ${error.status ?? ''} : ${error.message}`;
  }
  return error instanceof Error ? error.message : 'Erreur inconnue.';
}

/**
 * Estimation du nombre de jetons d'un texte français.
 * Approximative et volontairement pessimiste : elle sert à afficher un ordre
 * de grandeur avant d'envoyer, pas à facturer.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.2);
}
