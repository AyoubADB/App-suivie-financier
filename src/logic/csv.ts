import type { TxType } from '../types';

/** Séparateurs rencontrés dans les exports bancaires français. */
const DELIMITERS = [';', ',', '\t', '|'];

/**
 * Découpe un CSV en lignes de champs.
 * Écrit à la main plutôt qu'importé : les relevés bancaires tiennent en
 * quelques milliers de lignes et une dépendance de plus se paie au chargement.
 */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const delimiter = detectDelimiter(clean);

  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let quoted = false;

  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (quoted) {
      if (c === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === delimiter) {
      row.push(field.trim());
      field = '';
    } else if (c === '\n') {
      row.push(field.trim());
      if (row.some((f) => f !== '')) rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  row.push(field.trim());
  if (row.some((f) => f !== '')) rows.push(row);

  return rows;
}

/** Le séparateur le plus régulier d'une ligne à l'autre gagne. */
function detectDelimiter(text: string): string {
  const lines = text.split('\n').filter((l) => l.trim()).slice(0, 5);
  let best = ';';
  let bestScore = -1;
  for (const d of DELIMITERS) {
    const counts = lines.map((l) => l.split(d).length - 1);
    const min = Math.min(...counts);
    const score = min > 0 ? min * 10 - (Math.max(...counts) - min) : 0;
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

export interface ColumnMapping {
  date: number;
  label: number;
  /** Colonne montant signé, ou -1 si le relevé sépare débit et crédit. */
  amount: number;
  debit: number;
  credit: number;
}

const HEADER_HINTS: Record<keyof ColumnMapping, string[]> = {
  date: ['date', 'date operation', "date d'operation", 'date valeur', 'jour'],
  label: ['libelle', 'libellé', 'description', 'label', 'nature', 'intitule', 'motif', 'detail'],
  amount: ['montant', 'amount', 'somme', 'valeur'],
  debit: ['debit', 'débit', 'retrait', 'sortie'],
  credit: ['credit', 'crédit', 'depot', 'entree', 'entrée'],
};

function simplify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Devine le rôle de chaque colonne à partir de l'en-tête, puis du contenu.
 * Un relevé sans en-tête reste exploitable : on repère la colonne de dates
 * et la colonne numérique.
 */
export function detectColumns(rows: string[][]): { mapping: ColumnMapping; hasHeader: boolean } {
  const header = rows[0] ?? [];
  const mapping: ColumnMapping = { date: -1, label: -1, amount: -1, debit: -1, credit: -1 };

  header.forEach((cell, i) => {
    const s = simplify(cell);
    if (!s) return;
    for (const key of Object.keys(HEADER_HINTS) as Array<keyof ColumnMapping>) {
      if (mapping[key] !== -1) continue;
      if (HEADER_HINTS[key].some((h) => s === simplify(h) || s.includes(simplify(h)))) {
        mapping[key] = i;
      }
    }
  });

  // Un en-tête n'en est un que si aucune de ses cellules n'est une date.
  const hasHeader =
    header.length > 0 &&
    !header.some((cell) => parseCsvDate(cell) !== null) &&
    Object.values(mapping).some((v) => v !== -1);

  const body = hasHeader ? rows.slice(1) : rows;
  const sample = body.slice(0, 20);

  if (mapping.date === -1) {
    mapping.date = firstColumnWhere(sample, (v) => parseCsvDate(v) !== null);
  }
  if (mapping.amount === -1 && mapping.debit === -1 && mapping.credit === -1) {
    mapping.amount = firstColumnWhere(
      sample,
      (v) => parseCsvAmount(v) !== null,
      new Set([mapping.date]),
    );
  }
  if (mapping.label === -1) {
    mapping.label = firstColumnWhere(
      sample,
      (v) => v.length > 2 && parseCsvAmount(v) === null && parseCsvDate(v) === null,
      new Set([mapping.date, mapping.amount, mapping.debit, mapping.credit]),
    );
  }

  return { mapping, hasHeader };
}

/** Première colonne dont la majorité des valeurs satisfait le prédicat. */
function firstColumnWhere(
  sample: string[][],
  predicate: (value: string) => boolean,
  exclude = new Set<number>(),
): number {
  const width = Math.max(0, ...sample.map((r) => r.length));
  for (let col = 0; col < width; col++) {
    if (exclude.has(col)) continue;
    const values = sample.map((r) => r[col] ?? '').filter((v) => v !== '');
    if (values.length === 0) continue;
    if (values.filter(predicate).length >= Math.ceil(values.length * 0.6)) return col;
  }
  return -1;
}

/** Date d'un relevé : JJ/MM/AAAA, JJ-MM-AA ou ISO. Retourne du YYYY-MM-DD. */
export function parseCsvDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;

  const iso = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(s);
  if (iso) return isoOf(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const fr = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/.exec(s);
  if (fr) {
    const year = Number(fr[3]);
    return isoOf(year < 100 ? 2000 + year : year, Number(fr[2]), Number(fr[1]));
  }
  return null;
}

function isoOf(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${`${m}`.padStart(2, '0')}-${`${d}`.padStart(2, '0')}`;
}

/**
 * Montant d'un relevé, en centimes, signe conservé.
 * Gère « 1 234,56 », « -45.90 », « 45,90 € » et « (45,90) » pour un débit.
 */
export function parseCsvAmount(raw: string): number | null {
  let s = raw.trim().replace(/[€$£\s ]/g, '');
  if (!s) return null;

  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith('-')) {
    negative = true;
    s = s.slice(1);
  } else if (s.startsWith('+')) s = s.slice(1);

  // Le dernier séparateur rencontré fait office de décimale.
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  const decimalAt = Math.max(lastComma, lastDot);
  let intPart = s;
  let decPart = '';
  if (decimalAt !== -1 && s.length - decimalAt - 1 <= 2) {
    intPart = s.slice(0, decimalAt);
    decPart = s.slice(decimalAt + 1);
  }
  intPart = intPart.replace(/[.,]/g, '');
  if (!/^\d*$/.test(intPart) || !/^\d*$/.test(decPart) || intPart === '') return null;

  const cents = Number(intPart) * 100 + Number(decPart.padEnd(2, '0').slice(0, 2));
  return negative ? -cents : cents;
}

export interface CsvDraft {
  date: string;
  label: string;
  /** Toujours positif : le sens est porté par `type`. */
  amount: number;
  type: TxType;
}

/** Transforme les lignes exploitables en brouillons de transactions. */
export function buildDrafts(
  rows: string[][],
  mapping: ColumnMapping,
  hasHeader: boolean,
): { drafts: CsvDraft[]; skipped: number } {
  const body = hasHeader ? rows.slice(1) : rows;
  const drafts: CsvDraft[] = [];
  let skipped = 0;

  for (const row of body) {
    const date = parseCsvDate(row[mapping.date] ?? '');
    const label = (row[mapping.label] ?? '').replace(/\s+/g, ' ').trim();

    let signed: number | null = null;
    if (mapping.amount !== -1) signed = parseCsvAmount(row[mapping.amount] ?? '');
    else {
      const debit = parseCsvAmount(row[mapping.debit] ?? '');
      const credit = parseCsvAmount(row[mapping.credit] ?? '');
      if (credit !== null && credit !== 0) signed = Math.abs(credit);
      else if (debit !== null && debit !== 0) signed = -Math.abs(debit);
    }

    if (!date || signed === null || signed === 0 || !label) {
      skipped++;
      continue;
    }
    drafts.push({
      date,
      label: label.slice(0, 120),
      amount: Math.abs(signed),
      type: signed > 0 ? 'revenue' : 'expense',
    });
  }

  return { drafts, skipped };
}
