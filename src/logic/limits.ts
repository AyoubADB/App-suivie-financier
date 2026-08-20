/**
 * Bornes partagées entre le client et les règles Firestore.
 * Toute modification ici doit être répercutée dans `firestore.rules` —
 * sinon le serveur rejette une écriture que le client croyait valide.
 */
export const LIMITS = {
  /** Montant en centimes : 10 M€. */
  amountMax: 1_000_000_000,
  labelMax: 140,
  noteMax: 800,
  categoryLabelMax: 60,
  badgeLabelMax: 40,
  /** Image base64 — marge sous la limite de 1 Mio par document Firestore. */
  imageDataUrlMax: 400_000,
  badgesPerTx: 24,
  keywordsPerCategory: 80,
} as const;

/** Message d'erreur si la transaction ne passera pas les règles serveur. */
export function checkTransaction(input: {
  amount: number;
  label: string;
  note?: string;
  imageUrl?: string;
  badges: string[];
}): string | null {
  if (!Number.isInteger(input.amount) || input.amount <= 0) return 'Montant invalide (ex : 12,99).';
  if (input.amount > LIMITS.amountMax) return 'Montant trop élevé (maximum 10 000 000 €).';
  if (!input.label.trim()) return 'Ajoute un libellé.';
  if (input.label.length > LIMITS.labelMax)
    return `Libellé trop long (${LIMITS.labelMax} caractères maximum).`;
  if ((input.note?.length ?? 0) > LIMITS.noteMax)
    return `Note trop longue (${LIMITS.noteMax} caractères maximum).`;
  if ((input.imageUrl?.length ?? 0) > LIMITS.imageDataUrlMax)
    return 'Image trop lourde — choisis-en une plus légère.';
  if (input.badges.length > LIMITS.badgesPerTx) return 'Trop de badges sur cette transaction.';
  return null;
}
