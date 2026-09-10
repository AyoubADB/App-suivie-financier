import { normalize } from './categorizer';
import { toISODate } from './dates';

/**
 * Extraction des informations d'un ticket ou d'une facture, en local.
 *
 * Pas de modèle de langue : des règles écrites pour les tickets français, qui
 * tournent instantanément sur un téléphone et restent inspectables. Chaque
 * champ trouvé est proposé, jamais imposé — l'utilisateur valide.
 */

export interface ReceiptFields {
  /** Enseigne, nettoyée et prête à servir de libellé. */
  merchant?: string;
  dateISO?: string;
  /** Montant TTC en centimes. */
  total?: number;
  /** TVA en centimes, si le ticket la détaille. */
  vatAmount?: number;
  /** Taux dominant en pourcentage. */
  vatRate?: number;
  /** Autres montants repérés, du plus probable au moins probable. */
  candidates: number[];
  confidence: 'haute' | 'moyenne' | 'faible';
}

/** Mots qui désignent le total à payer sur un ticket français. */
const TOTAL_KEYS = [
  'net a payer',
  'total a payer',
  'montant a payer',
  'reste a payer',
  'total ttc',
  'montant ttc',
  'somme due',
  'montant du',
  'total eur',
  'a payer',
  'total',
  'montant',
];

/** Mots qui ressemblent à un total mais n'en sont pas. */
const TOTAL_TRAPS = [
  'total ht',
  'sous total',
  'sous-total',
  'total tva',
  'dont tva',
  'total articles',
  'nombre',
  'quantite',
  'total quantite',
  'total remise',
  'economie',
  'cagnotte',
  'fidelite',
  'points',
  'solde',
  'rendu',
  'especes',
];

/** Enseignes fréquentes : le libellé brut d'un ticket est illisible. */
const BRANDS: Array<{ match: string; label: string }> = [
  { match: 'carrefour market', label: 'Carrefour Market' },
  { match: 'carrefour city', label: 'Carrefour City' },
  { match: 'carrefour', label: 'Carrefour' },
  { match: 'e leclerc', label: 'E.Leclerc' },
  { match: 'leclerc', label: 'E.Leclerc' },
  { match: 'intermarche', label: 'Intermarché' },
  { match: 'super u', label: 'Super U' },
  { match: 'hyper u', label: 'Hyper U' },
  { match: 'systeme u', label: 'Système U' },
  { match: 'auchan', label: 'Auchan' },
  { match: 'monoprix', label: 'Monoprix' },
  { match: 'franprix', label: 'Franprix' },
  { match: 'lidl', label: 'Lidl' },
  { match: 'aldi', label: 'Aldi' },
  { match: 'casino', label: 'Casino' },
  { match: 'picard', label: 'Picard' },
  { match: 'biocoop', label: 'Biocoop' },
  { match: 'grand frais', label: 'Grand Frais' },
  { match: 'action', label: 'Action' },
  { match: 'gifi', label: 'Gifi' },
  { match: 'leroy merlin', label: 'Leroy Merlin' },
  { match: 'castorama', label: 'Castorama' },
  { match: 'brico depot', label: 'Brico Dépôt' },
  { match: 'bricorama', label: 'Bricorama' },
  { match: 'decathlon', label: 'Decathlon' },
  { match: 'fnac', label: 'Fnac' },
  { match: 'darty', label: 'Darty' },
  { match: 'boulanger', label: 'Boulanger' },
  { match: 'ikea', label: 'Ikea' },
  { match: 'totalenergies', label: 'TotalEnergies' },
  { match: 'total access', label: 'TotalEnergies' },
  { match: 'intermarche station', label: 'Station Intermarché' },
  { match: 'esso', label: 'Esso' },
  { match: 'shell', label: 'Shell' },
  { match: 'avia', label: 'Avia' },
  { match: 'vinci autoroutes', label: 'Péage Vinci Autoroutes' },
  { match: 'autoroutes du sud', label: 'Péage ASF' },
  { match: 'cofiroute', label: 'Péage Cofiroute' },
  { match: 'aprr', label: 'Péage APRR' },
  { match: 'sanef', label: 'Péage Sanef' },
  { match: 'escota', label: 'Péage Escota' },
  { match: 'peage', label: 'Péage' },
  { match: 'sncf', label: 'SNCF' },
  { match: 'ratp', label: 'RATP' },
  { match: 'mcdonald', label: "McDonald's" },
  { match: 'burger king', label: 'Burger King' },
  { match: 'kfc', label: 'KFC' },
  { match: 'subway', label: 'Subway' },
  { match: 'pharmacie', label: 'Pharmacie' },
  { match: 'boulangerie', label: 'Boulangerie' },
  { match: 'tabac', label: 'Tabac' },
  { match: 'zara', label: 'Zara' },
  { match: 'sephora', label: 'Sephora' },
  { match: 'amazon', label: 'Amazon' },
  { match: 'cdiscount', label: 'Cdiscount' },
];

/**
 * Cherche une expression en tant que mot entier.
 * En sous-chaîne, « tel » se déclencherait sur « atelier » et « action » sur
 * « transaction » : les faux positifs sont la règle, pas l'exception.
 */
function hasWords(haystack: string, needle: string): boolean {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(haystack);
}

/** Les enseignes les plus spécifiques d'abord : « boulangerie » avant « boulanger ». */
const BRANDS_BY_SPECIFICITY = [...BRANDS].sort((a, b) => b.match.length - a.match.length);

const MONTHS: Record<string, number> = {
  janvier: 1, janv: 1, fevrier: 2, fevr: 2, mars: 3, avril: 4, avr: 4, mai: 5,
  juin: 6, juillet: 7, juil: 7, aout: 8, septembre: 9, sept: 9, octobre: 10,
  oct: 10, novembre: 11, nov: 11, decembre: 12, dec: 12,
};

/** Tous les montants d'une ligne, en centimes. */
function amountsIn(line: string): number[] {
  const out: number[] = [];
  // 1 234,56 · 12.34 · 7,65 € — au moins deux décimales pour éviter de
  // confondre un montant avec une quantité ou une référence produit.
  const re = /(\d{1,3}(?:[  ]\d{3})*|\d+)[.,](\d{2})(?!\d)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    const whole = Number(m[1].replace(/[  ]/g, ''));
    if (!Number.isFinite(whole)) continue;
    const cents = whole * 100 + Number(m[2]);
    if (cents > 0 && cents < 100_000_000) out.push(cents);
  }
  return out;
}

/** Date française sous ses formes courantes. */
export function extractDate(text: string): string | undefined {
  const numeric = /(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/.exec(text);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]);
    let year = Number(numeric[3]);
    if (year < 100) year += 2000;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return `${year}-${`${month}`.padStart(2, '0')}-${`${day}`.padStart(2, '0')}`;
    }
  }

  const written = /(\d{1,2})\s+([a-zA-Zéûôàè]{3,10})\.?\s+(\d{4})/.exec(text);
  if (written) {
    const month = MONTHS[normalize(written[2])];
    const day = Number(written[1]);
    if (month && day >= 1 && day <= 31) {
      return `${written[3]}-${`${month}`.padStart(2, '0')}-${`${day}`.padStart(2, '0')}`;
    }
  }
  return undefined;
}

/** TVA détaillée : montant total et taux dominant. */
function extractVat(lines: string[]): { amount?: number; rate?: number } {
  let amount = 0;
  let bestRate: number | undefined;
  let bestRateAmount = 0;

  for (const line of lines) {
    const flat = normalize(line);
    if (!hasWords(flat, 'tva') && !hasWords(flat, 't v a')) continue;
    // « TOTAL TVA » récapitule les lignes détaillées au-dessus : l'additionner
    // compterait la TVA deux fois. « DONT TVA », lui, est la ligne de TVA.
    const isRecap = hasWords(flat, 'total tva');

    const rateMatch = /(\d{1,2}(?:[.,]\d{1,2})?)\s*%/.exec(line);
    const amounts = amountsIn(line);
    if (amounts.length === 0) continue;

    // Sur « TVA 20,00 % 38,25 12,75 », le dernier nombre est la TVA due.
    const value = amounts[amounts.length - 1];
    if (isRecap) {
      amount = Math.max(amount, value);
      continue;
    }
    amount += value;

    if (rateMatch) {
      const rate = Number(rateMatch[1].replace(',', '.'));
      if (rate > 0 && rate <= 30 && value > bestRateAmount) {
        bestRate = rate;
        bestRateAmount = value;
      }
    }
  }

  return { amount: amount > 0 ? amount : undefined, rate: bestRate };
}

/** Enseigne, depuis les premières lignes ou une marque connue. */
function extractMerchant(lines: string[], fullText: string): string | undefined {
  const flat = normalize(fullText);
  for (const brand of BRANDS_BY_SPECIFICITY) {
    if (hasWords(flat, brand.match)) return brand.label;
  }

  const noise = [
    'ticket', 'facture', 'recu', 'siret', 'siren', 'tva intra', 'tel', 'merci',
    'bienvenue', 'caisse', 'vendeur', 'client', 'rcs', 'ape', 'naf', 'www',
  ];
  for (const line of lines.slice(0, 6)) {
    const clean = line.replace(/[^\p{L}\p{N}&'’. -]/gu, ' ').replace(/\s+/g, ' ').trim();
    const flatLine = normalize(clean);
    if (clean.length < 3 || clean.length > 40) continue;
    if (noise.some((n) => hasWords(flatLine, n))) continue;
    // Une ligne majoritairement numérique est une adresse ou un code.
    const letters = (clean.match(/\p{L}/gu) ?? []).length;
    if (letters < clean.length * 0.5) continue;
    return titleCase(clean);
  }
  return undefined;
}

function titleCase(s: string): string {
  return s
    .toLocaleLowerCase('fr-FR')
    .split(' ')
    .map((w) => (w.length > 2 ? w.charAt(0).toLocaleUpperCase('fr-FR') + w.slice(1) : w))
    .join(' ')
    .trim();
}

/**
 * Analyse le texte d'un ticket.
 * Le total est cherché par mot-clé ; à défaut, le plus gros montant du
 * document fait presque toujours l'affaire sur un ticket de caisse.
 */
export function extractReceipt(text: string): ReceiptFields {
  const lines = text
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const all: number[] = [];
  for (const line of lines) all.push(...amountsIn(line));

  let total: number | undefined;
  let confidence: ReceiptFields['confidence'] = 'faible';

  outer: for (const key of TOTAL_KEYS) {
    for (let i = 0; i < lines.length; i++) {
      const flat = normalize(lines[i]);
      if (!hasWords(flat, key)) continue;
      if (TOTAL_TRAPS.some((trap) => hasWords(flat, trap))) continue;

      const here = amountsIn(lines[i]);
      if (here.length > 0) {
        total = here[here.length - 1];
        confidence = 'haute';
        break outer;
      }
      // Certains tickets renvoient le montant à la ligne suivante.
      const next = lines[i + 1] ? amountsIn(lines[i + 1]) : [];
      if (next.length > 0) {
        total = next[0];
        confidence = 'moyenne';
        break outer;
      }
    }
  }

  if (total === undefined && all.length > 0) {
    total = Math.max(...all);
    confidence = 'faible';
  }

  const vat = extractVat(lines);
  const candidates = [...new Set(all)].sort((a, b) => b - a).slice(0, 8);

  return {
    merchant: extractMerchant(lines, text),
    dateISO: extractDate(text) ?? toISODate(new Date()),
    total,
    vatAmount: vat.amount,
    vatRate: vat.rate,
    candidates,
    confidence,
  };
}
