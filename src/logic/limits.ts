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
  /** Parts d'une transaction ventilée. */
  splitsPerTx: 20,
  keywordsPerCategory: 80,
} as const;

/** Message d'erreur si la transaction ne passera pas les règles serveur. */
export function checkTransaction(input: {
  amount: number;
  label: string;
  note?: string;
  imageUrl?: string;
  badges: string[];
  splits?: Array<{ categoryId: string; amount: number }>;
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
  if (input.splits && input.splits.length > 0) {
    if (input.splits.length > LIMITS.splitsPerTx)
      return `Ventilation limitée à ${LIMITS.splitsPerTx} parts.`;
    if (input.splits.some((s) => !Number.isInteger(s.amount) || s.amount <= 0))
      return 'Chaque part de la ventilation doit avoir un montant positif.';
    if (input.splits.some((s) => !s.categoryId))
      return 'Chaque part de la ventilation doit avoir une catégorie.';
    const total = input.splits.reduce((acc, s) => acc + s.amount, 0);
    if (total > input.amount)
      return 'La ventilation dépasse le montant de la transaction.';
  }
  return null;
}
