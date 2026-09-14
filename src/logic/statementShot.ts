import { normalize } from './categorizer';
import { toISODate } from './dates';
import { hasWords, matchBrand, titleCase } from './receipt';
import type { OcrBox, OcrLine, OcrWord } from './ocr';
import type { TxType } from '../types';

/**
 * Lecture d'une capture d'écran de compte bancaire.
 *
 * Un ticket de caisse donne une seule opération ; l'écran d'une application
 * bancaire en donne dix ou vingt d'affilée. Le travail est donc différent :
 * repérer chaque ligne, en tirer un libellé, un montant et surtout un sens —
 * dépense ou encaissement — que la couleur, perdue à la capture, ne dit plus.
 */

export interface StatementLine {
  /** Clé stable pour l'affichage et la sélection. */
  id: string;
  dateISO: string;
  label: string;
  /** Toujours positif : le sens est porté par `type`. */
  amount: number;
  type: TxType;
  /** D'où vient le sens : signe lu, couleur du montant, mot reconnu, défaut. */
  origin: 'signe' | 'couleur' | 'libellé' | 'défaut';
  /**
   * Le libellé est-il digne de confiance ? Un nom trop court ou un sous-titre
   * générique trahissent une lecture ratée : mieux vaut le dire que laisser
   * l'utilisateur découvrir l'erreur une fois la transaction enregistrée.
   */
  labelSure: boolean;
  /** Ligne d'origine, affichée en cas de doute. */
  raw: string;
}

export interface StatementParse {
  lines: StatementLine[];
  /** Lignes écartées : soldes, en-têtes, navigation. */
  skipped: number;
}

/** Lignes qui ne sont jamais une opération. */
const NOISE = [
  'solde', 'soldes', 'nouveau solde', 'solde au', 'solde comptable',
  'total', 'sous total', 'cumul', 'iban', 'bic', 'rib', 'page',
  'releve de compte', 'releve', 'operations', 'operation', 'mes comptes',
  'compte courant', 'livret', 'epargne', 'rechercher', 'recherche', 'filtrer',
  'a venir', 'en cours', 'derniers mouvements', 'historique', 'voir plus',
  'plafond', 'decouvert', 'autorisation', 'pouvoir d achat', 'disponible',
];

/** Un encaissement : virement reçu, salaire, remboursement, aide. */
const CREDIT_WORDS = [
  'vir recu', 'virement recu', 'virement de', 'vir de', 'vir sepa recu',
  'remboursement', 'remb', 'salaire', 'paie', 'paye', 'traitement',
  'caf', 'pole emploi', 'france travail', 'allocation', 'allocations',
  'pension', 'retraite', 'prime', 'depot', 'versement', 'credit', 'avoir',
  'annulation', 'vente', 'recette', 'encaissement', 'interets', 'dividende',
  'cheque remis', 'remise cheque', 'remise de cheque',
];

/** Un décaissement : carte, prélèvement, retrait, frais. */
const DEBIT_WORDS = [
  'carte', 'cb', 'achat', 'paiement', 'prlv', 'prelevement', 'prelvt',
  'retrait', 'facture', 'cotisation', 'frais', 'abonnement', 'echeance',
  'ech pret', 'assurance', 'commission', 'agios', 'vir emis', 'virement emis',
  'cheque emis', 'loyer',
];

/** Préfixes bancaires à retirer du libellé : ils n'apprennent rien. */
const LABEL_PREFIXES = [
  /^carte\s+(bancaire\s+)?(\d{2}[/.]\d{2}(?:[/.]\d{2,4})?\s*)?/i,
  /^cb\s+(\d{2}[/.]\d{2}(?:[/.]\d{2,4})?\s*)?/i,
  /^achat\s+(cb|carte)\s*/i,
  /^paiement\s+(par\s+)?(cb|carte)\s*/i,
  /^facture\s+carte\s*/i,
  /^prlv\s+(sepa\s+)?/i,
  /^prelevement\s+(sepa\s+)?/i,
  /^prelvt\s+/i,
  /^vir(ement)?\s+(sepa\s+)?(instantane\s+)?(recu\s+)?(emis\s+)?(de\s+)?/i,
  /^retrait\s+(dab|gab)?\s*/i,
  /^remise\s+(de\s+)?cheque\s*/i,
  /^ech(eance)?\s+pret\s*/i,
];

/** Dates en tête de ligne : la colonne date des relevés tabulés. */
const LEADING_DATE = /^\s*\d{1,2}[/.]\d{1,2}([/.]\d{2,4})?\s+/;

/** Suffixes à retirer : numéros de carte, dates de valeur, références. */
const LABEL_SUFFIXES = [
  /\s+\d{2}[/.]\d{2}([/.]\d{2,4})?$/,
  /\s+(cb\s*)?\*{2,}\s*\d{3,}$/i,
  /\s+carte\s+\d{4,}$/i,
  /\s+\d{6,}$/,
  /\s+ref\s*:?\s*\S+$/i,
];

/** Un montant, avec ou sans séparateur de milliers, signe optionnel. */
const AMOUNT_PATTERN = String.raw`[+\-−–—]?\s?(?:\d{1,3}(?:[  ']\d{3})+|\d+)[.,]\d{2}(?!\d)\s*(?:€|EUR)?`;

/** Montant signé d'une ligne : le signe compte autant que la valeur. */
interface SignedAmount {
  cents: number;
  sign: 1 | -1 | 0;
}

function signedAmountsIn(line: string): SignedAmount[] {
  const out: SignedAmount[] = [];
  // Le signe peut être un vrai moins, un tiret typographique, ou absent.
  // Les espaces fines des milliers varient selon l'application bancaire.
  const re =
    /([+\-−–—])?\s?(\d{1,3}(?:[  ']\d{3})+|\d+)[.,](\d{2})(?!\d)\s*(?:€|EUR)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    const whole = Number(m[2].replace(/[  ']/g, ''));
    if (!Number.isFinite(whole)) continue;
    const cents = whole * 100 + Number(m[3]);
    if (cents <= 0 || cents >= 100_000_000) continue;
    const sign: 1 | -1 | 0 = m[1] === '+' ? 1 : m[1] ? -1 : 0;
    out.push({ cents, sign });
  }
  return out;
}

/** Une ligne qui ne sert qu'à dater celles qui suivent. */
function headerDate(line: string, now: Date): string | null {
  const flat = normalize(line);
  if (flat.length > 32) return null;

  if (hasWords(flat, "aujourd hui") || flat === 'aujourdhui') return toISODate(now);
  if (hasWords(flat, 'hier')) {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return toISODate(d);
  }

  // « 12 septembre », « Vendredi 12 septembre 2026 », « 12/09/2026 »
  if (signedAmountsIn(line).length > 0) return null;
  const written = /(\d{1,2})\s+([a-zéûôàè]{3,10})\.?(\s+(\d{4}))?/i.exec(flat);
  const numeric = /^(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?$/.exec(flat.trim());

  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]);
    const year = numeric[3] ? normalizeYear(Number(numeric[3])) : now.getFullYear();
    return isoOf(year, month, day);
  }
  if (written) {
    const month = MONTHS[written[2]];
    if (!month) return null;
    const year = written[4] ? Number(written[4]) : now.getFullYear();
    return isoOf(year, month, Number(written[1]));
  }
  return null;
}

const MONTHS: Record<string, number> = {
  janvier: 1, janv: 1, jan: 1, fevrier: 2, fevr: 2, fev: 2, mars: 3,
  avril: 4, avr: 4, mai: 5, juin: 6, juillet: 7, juil: 7, aout: 8,
  septembre: 9, sept: 9, sep: 9, octobre: 10, oct: 10, novembre: 11,
  nov: 11, decembre: 12, dec: 12,
};

function normalizeYear(y: number): number {
  return y < 100 ? 2000 + y : y;
}

function isoOf(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${`${m}`.padStart(2, '0')}-${`${d}`.padStart(2, '0')}`;
}

/** Date portée par la ligne elle-même, au format court des relevés. */
function inlineDate(line: string, fallbackYear: number): string | null {
  const m = /(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?/.exec(line);
  if (!m) return null;
  const year = m[3] ? normalizeYear(Number(m[3])) : fallbackYear;
  return isoOf(year, Number(m[2]), Number(m[1]));
}

/** Nettoie un libellé bancaire pour en faire un nom lisible. */
export function cleanLabel(raw: string): string {
  return cleanLabelStrict(raw) ?? fallbackLabel(raw);
}

/**
 * Nettoie un libellé, ou renonce.
 *
 * La version qui devine (« Opération ») convient à une lecture ligne à ligne,
 * où la ligne EST l'opération. Sur une capture d'écran, plusieurs fragments se
 * disputent le rôle de libellé — dont l'icône de l'application, que la
 * reconnaissance rend en un caractère isolé. Deviner ferait gagner ce
 * fragment-là contre le vrai nom du commerçant.
 */
export function cleanLabelStrict(raw: string): string | null {
  let label = raw
    .replace(new RegExp(AMOUNT_PATTERN, 'g'), ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(LEADING_DATE, '');

  for (const prefix of LABEL_PREFIXES) label = label.replace(prefix, '').trim();
  for (const suffix of LABEL_SUFFIXES) label = label.replace(suffix, '').trim();

  label = label
    .replace(/\b\d{1,2}[/.]\d{1,2}([/.]\d{2,4})?\b/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .replace(/[^\p{L}\p{N})]+$/u, '')
    .trim();

  // Après nettoyage il peut ne rester qu'un numéro ou un glyphe isolé.
  if (!/\p{L}{2}/u.test(label)) return null;

  const brand = matchBrand(label);
  if (brand) return brand;

  // Les relevés sont en capitales : illisible tel quel dans une liste.
  const letters = label.replace(/[^\p{L}]/gu, '');
  const mostlyUpper =
    letters.length > 2 && letters === letters.toLocaleUpperCase('fr-FR');
  return mostlyUpper ? titleCase(label) : label;
}

/** Nom d'une opération dont le libellé ne dit rien d'exploitable. */
function fallbackLabel(raw: string): string {
  const flat = normalize(raw);
  if (hasWords(flat, 'retrait')) return 'Retrait espèces';
  if (hasWords(flat, 'cheque')) return 'Chèque';
  if (hasWords(flat, 'virement') || hasWords(flat, 'vir')) return 'Virement';
  if (hasWords(flat, 'prelevement') || hasWords(flat, 'prlv')) return 'Prélèvement';
  if (hasWords(flat, 'carte') || hasWords(flat, 'cb')) return 'Paiement carte';
  if (hasWords(flat, 'frais')) return 'Frais bancaires';
  return 'Opération';
}

/** Sens de l'opération quand aucun signe n'a été lu. */
function typeFromWords(text: string): TxType | null {
  const flat = normalize(text);
  for (const word of CREDIT_WORDS) if (hasWords(flat, word)) return 'revenue';
  for (const word of DEBIT_WORDS) if (hasWords(flat, word)) return 'expense';
  return null;
}

/**
 * Le document affiche-t-il une colonne de solde courant ?
 * Sur un relevé tabulé, le dernier montant de chaque ligne est ce solde :
 * le prendre pour l'opération fausserait tout.
 */
function hasBalanceColumn(lines: string[]): boolean {
  return lines.some((line) => {
    const flat = normalize(line);
    if (signedAmountsIn(line).length > 0) return false;
    return hasWords(flat, 'solde') && (hasWords(flat, 'debit') || hasWords(flat, 'credit'));
  });
}

function isNoise(line: string): boolean {
  const flat = normalize(line);
  if (flat.length < 3) return true;
  return NOISE.some((n) => hasWords(flat, n));
}

/**
 * Extrait les opérations d'une capture d'écran de compte.
 *
 * Le sens se décide dans cet ordre : un signe explicite s'il y en a un, sinon
 * un mot reconnu du libellé, sinon dépense — parce qu'un relevé est fait de
 * dépenses à plus de neuf lignes sur dix. Chaque ligne reste modifiable :
 * c'est le garde-fou, aucune heuristique ne remplace un coup d'œil.
 */
export function extractStatement(text: string, now = new Date()): StatementParse {
  const rawLines = text
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const lines: StatementLine[] = [];
  const balanceColumn = hasBalanceColumn(rawLines);
  let skipped = 0;
  let currentDate = toISODate(now);
  let index = 0;

  for (const raw of rawLines) {
    const header = headerDate(raw, now);
    if (header) {
      currentDate = header;
      skipped++;
      continue;
    }

    if (isNoise(raw)) {
      skipped++;
      continue;
    }

    // Un montant seul, sans le moindre mot : c'est le solde affiché en haut
    // de l'écran, pas une opération. Toutes les applis n'écrivent pas
    // « solde » à côté.
    const withoutAmounts = raw.replace(new RegExp(AMOUNT_PATTERN, 'g'), ' ');
    if (!/\p{L}{2}/u.test(withoutAmounts)) {
      skipped++;
      continue;
    }

    let amounts = signedAmountsIn(raw);
    // Sur un relevé à colonne de solde, le dernier montant est ce solde ;
    // ne reste alors que la colonne débit ou crédit réellement remplie.
    if (balanceColumn && amounts.length > 1) amounts = amounts.slice(0, -1);
    if (amounts.length === 0) {
      skipped++;
      continue;
    }

    // Un montant signé l'emporte sur les autres : c'est l'opération.
    const signed = amounts.filter((a) => a.sign !== 0);
    const chosen = signed.length > 0 ? signed[0] : amounts[amounts.length - 1];

    const strict = cleanLabelStrict(raw);
    const label = strict ?? fallbackLabel(raw);
    if (label.length < 2) {
      skipped++;
      continue;
    }

    let type: TxType;
    let origin: StatementLine['origin'];
    if (chosen.sign !== 0) {
      type = chosen.sign > 0 ? 'revenue' : 'expense';
      origin = 'signe';
    } else {
      const guessed = typeFromWords(raw);
      type = guessed ?? 'expense';
      origin = guessed ? 'libellé' : 'défaut';
    }

    lines.push({
      id: `l${index++}`,
      dateISO: inlineDate(raw, new Date(currentDate).getFullYear()) ?? currentDate,
      label: label.slice(0, 120),
      amount: chosen.cents,
      type,
      origin,
      labelSure: strict !== null,
      raw,
    });
  }

  return { lines, skipped };
}

/** Vocabulaire propre aux opérations bancaires. */
const BANK_MARKERS = [
  'carte', 'cb', 'prlv', 'prelevement', 'prelvt', 'virement', 'vir', 'sepa',
  'retrait', 'dab', 'mandat', 'echeance', 'ech',
];

/**
 * Une capture de compte ou un ticket de caisse ?
 *
 * Le nombre de lignes ne suffit pas à trancher : un ticket de supermarché
 * aligne lui aussi vingt lignes chiffrées. Ce qui distingue un relevé, c'est
 * le signe des montants — un ticket n'en a pas — et le vocabulaire bancaire,
 * qu'un ticket n'emploie qu'une fois, sur la ligne du paiement.
 */
export function looksLikeStatement(parse: StatementParse, rawText = ''): boolean {
  if (parse.lines.length < 3) return false;

  // Un montant vert vaut un signe : dans les deux cas le sens est mesuré,
  // pas deviné.
  const measured = parse.lines.filter(
    (l) => l.origin === 'signe' || l.origin === 'couleur',
  ).length;
  if (measured >= 2) return true;

  const bankLines = rawText
    .split('\n')
    .filter((line) => {
      const flat = normalize(line);
      return BANK_MARKERS.some((marker) => hasWords(flat, marker));
    }).length;

  return bankLines >= 3;
}

// ---------------------------------------------------------------------------
// Lecture d'une capture d'écran, en tenant compte de la mise en page
// ---------------------------------------------------------------------------

/**
 * Sous-titres génériques d'une ligne d'opération.
 * « Paiement par carte » sous le nom du commerçant n'est pas un libellé :
 * c'est de la décoration, présente à l'identique sur toutes les lignes.
 */
const GENERIC_SUBTITLES = [
  'paiement par carte', 'paiement carte', 'paiement mobile', 'achat carte',
  'carte bancaire', 'prelevement', 'prelevement sepa', 'virement recu',
  'virement emis', 'virement', 'retrait', 'retrait especes', 'remboursement recu',
  'operation', 'transaction', 'en attente', 'en cours de traitement',
];

function isGenericSubtitle(text: string): boolean {
  const flat = normalize(text);
  return GENERIC_SUBTITLES.some((g) => flat === g || flat.startsWith(`${g} `));
}

/** Couleur dominante du texte d'un montant, quand on peut la mesurer. */
export type AmountColor = 'vert' | 'autre' | 'inconnu';

export interface LayoutOptions {
  /** Couleur du texte dans une zone de l'image d'origine. */
  colorAt?: (box: OcrBox) => AmountColor;
  now?: Date;
}

/** Montant repéré dans la page, avec l'endroit exact où il est écrit. */
interface AmountHit {
  cents: number;
  sign: 1 | -1 | 0;
  box: OcrBox;
  /** Index de la ligne OCR qui le porte. */
  lineIndex: number;
}

function centerY(box: OcrBox): number {
  return (box.y0 + box.y1) / 2;
}

/** Repère les montants d'une ligne et la position de chacun. */
function amountHitsInLine(line: OcrLine, lineIndex: number): AmountHit[] {
  const hits: AmountHit[] = [];
  const re = new RegExp(AMOUNT_PATTERN, 'g');
  let m: RegExpExecArray | null;

  while ((m = re.exec(line.text)) !== null) {
    const raw = m[0];
    const parsed = signedAmountsIn(raw)[0];
    if (!parsed) continue;

    // Retrouve les mots qui composent ce montant, pour connaître sa position.
    const digits = raw.replace(/[^\d]/g, '');
    const box = boxOfWords(
      line.words.filter((w) => {
        const wordDigits = w.text.replace(/[^\d]/g, '');
        return wordDigits.length > 0 && digits.includes(wordDigits);
      }),
    );
    hits.push({ ...parsed, box: box ?? line.box, lineIndex });
  }
  return hits;
}

function boxOfWords(words: OcrWord[]): OcrBox | null {
  if (words.length === 0) return null;
  return {
    x0: Math.min(...words.map((w) => w.box.x0)),
    y0: Math.min(...words.map((w) => w.box.y0)),
    x1: Math.max(...words.map((w) => w.box.x1)),
    y1: Math.max(...words.map((w) => w.box.y1)),
  };
}

/**
 * Extrait les opérations d'une capture d'écran en s'appuyant sur la position
 * des mots.
 *
 * C'est ce qui distingue cette lecture de celle d'un simple texte : dans une
 * application bancaire, le nom du commerçant, son sous-titre et le montant
 * sont trois blocs distincts, que la reconnaissance de texte rend dans un
 * ordre imprévisible. Seule la géométrie dit lequel va avec lequel — le
 * libellé est ce qui est écrit à gauche du montant, à sa hauteur.
 */
export function extractStatementFromLayout(
  lines: OcrLine[],
  options: LayoutOptions = {},
): StatementParse {
  const now = options.now ?? new Date();
  const headers: Array<{ y: number; dateISO: string }> = [];
  const hits: AmountHit[] = [];

  lines.forEach((line, index) => {
    const header = headerDate(line.text, now);
    if (header) {
      headers.push({ y: centerY(line.box), dateISO: header });
      return;
    }
    if (isNoise(line.text)) return;
    hits.push(...amountHitsInLine(line, index));
  });

  // Hauteur de référence : sert à juger ce qui est « à la même hauteur ».
  const heights = hits.map((h) => h.box.y1 - h.box.y0).filter((h) => h > 0);
  const rowHeight = heights.length > 0 ? median(heights) : 24;

  const out: StatementLine[] = [];
  let index = 0;

  for (const hit of hits) {
    const found = labelFor(hit, lines, rowHeight);
    if (!found) continue;
    const label = found.text;

    let type: TxType;
    let origin: StatementLine['origin'];

    if (hit.sign !== 0) {
      type = hit.sign > 0 ? 'revenue' : 'expense';
      origin = 'signe';
    } else {
      // Le vert d'une application bancaire signale un encaissement. La
      // couleur disparaît du texte reconnu : on va la lire dans l'image.
      const color = options.colorAt?.(hit.box) ?? 'inconnu';
      if (color === 'vert') {
        type = 'revenue';
        origin = 'couleur';
      } else {
        const guessed = typeFromWords(`${label} ${lines[hit.lineIndex]?.text ?? ''}`);
        type = guessed ?? 'expense';
        origin = guessed ? 'libellé' : 'défaut';
      }
    }

    const y = centerY(hit.box);
    const header = [...headers].reverse().find((h) => h.y < y);
    const lineText = lines[hit.lineIndex]?.text ?? '';

    out.push({
      id: `g${index++}`,
      dateISO:
        inlineDate(lineText, new Date(header?.dateISO ?? toISODate(now)).getFullYear()) ??
        header?.dateISO ??
        toISODate(now),
      label: label.slice(0, 120),
      amount: hit.cents,
      type,
      origin,
      labelSure: found.sure,
      raw: lineText || label,
    });
  }

  return { lines: out, skipped: Math.max(0, lines.length - out.length) };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * Libellé d'un montant : ce qui est écrit à sa gauche, à sa hauteur.
 * Le sous-titre générique d'une ligne est écarté au profit du nom du
 * commerçant, écrit juste au-dessus.
 */
function labelFor(
  hit: AmountHit,
  lines: OcrLine[],
  rowHeight: number,
): { text: string; sure: boolean } | null {
  const y = centerY(hit.box);
  // Une ligne d'opération tient dans environ deux hauteurs de texte : au-delà
  // on attraperait l'opération voisine.
  const tolerance = rowHeight * 2.2;

  const candidates = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => {
      if (Math.abs(centerY(line.box) - y) > tolerance) return false;
      // Un en-tête de compte ne peut pas servir de libellé : sinon le solde
      // affiché en haut de l'écran deviendrait une opération.
      if (isNoise(line.text)) return false;
      // Le libellé est à gauche du montant ; les mots à droite sont la devise.
      return line.box.x0 < hit.box.x0;
    })
    .map(({ line, index }) => {
      const stripped = stripAmounts(line.text);
      return {
        index,
        text: cleanLabelStrict(stripped),
        generic: isGenericSubtitle(stripped),
        distance: Math.abs(centerY(line.box) - y),
        above: centerY(line.box) <= y,
      };
    })
    .filter((c): c is typeof c & { text: string } => c.text !== null);

  if (candidates.length === 0) return null;

  // Un vrai nom de commerçant prime sur « Paiement par carte » ; à distance
  // comparable, le texte le plus étoffé, puis celui du dessus — le nom est
  // écrit au-dessus du sous-titre.
  const letters = (text: string) => (text.match(/\p{L}/gu) ?? []).length;
  const ranked = [...candidates].sort((a, b) => {
    if (a.generic !== b.generic) return a.generic ? 1 : -1;
    if (Math.abs(a.distance - b.distance) > rowHeight * 0.6) return a.distance - b.distance;
    if (letters(a.text) !== letters(b.text)) return letters(b.text) - letters(a.text);
    return a.above === b.above ? 0 : a.above ? -1 : 1;
  });

  const best = ranked[0];
  const letterCount = letters(best.text);
  return { text: best.text, sure: !best.generic && letterCount >= 3 };
}

function stripAmounts(text: string): string {
  return text.replace(new RegExp(AMOUNT_PATTERN, 'g'), ' ').replace(/\s+/g, ' ').trim();
}
