/** Toutes les sommes sont en centimes (entiers). Formatage uniquement à l'affichage. */

export function formatCents(cents: number, currency = 'EUR', opts?: { sign?: boolean }): string {
  const formatter = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const value = cents / 100;
  const text = formatter.format(value);
  if (opts?.sign && cents > 0) return `+${text}`;
  return text;
}

/** Format compact pour les grands montants dans les cartes ("1 240 €"). */
export function formatCentsCompact(cents: number, currency = 'EUR'): string {
  const abs = Math.abs(cents);
  const formatter = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: abs % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return formatter.format(cents / 100);
}

/**
 * Parse une saisie utilisateur ("12,99", "1 200.50", "45") en centimes.
 * Retourne null si invalide.
 */
export function parseAmountToCents(input: string): number | null {
  const cleaned = input.replace(/\s|€/g, '').replace(',', '.');
  if (!cleaned || !/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  const value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

export function formatPct(ratio: number, digits = 0): string {
  return `${(ratio * 100).toFixed(digits).replace('.', ',')} %`;
}
