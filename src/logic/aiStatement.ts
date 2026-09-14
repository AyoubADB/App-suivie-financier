import type { TxType } from '../types';
import { anthropicClient, estimateTokens } from './anthropic';
import { cleanLabel, type StatementLine } from './statementShot';
import { toISODate } from './dates';

/**
 * Relecture d'une capture bancaire par Claude — option payante.
 *
 * Le moteur local fait déjà le travail ; ce mode ne sert qu'aux captures qu'il
 * lit mal : libellés tronqués, signes perdus, colonnes enchevêtrées. Il est
 * donc conçu pour coûter le moins possible :
 *
 *  - on envoie le texte, jamais l'image, dix fois moins cher à jetons égaux ;
 *  - les lignes sans montant sont retirées avant l'envoi ;
 *  - le format de réponse est une ligne par opération, sans JSON ni prose ;
 *  - la catégorisation reste locale : envoyer la liste des catégories
 *    doublerait la facture pour un résultat moins cohérent.
 */

/** Modèle le moins cher du catalogue, suffisant pour de l'extraction. */
const MODEL = 'claude-haiku-4-5';

const SYSTEM = `Tu extrais les opérations d'une capture d'écran bancaire française passée à l'OCR.
Une ligne de sortie par opération, format strict, sans en-tête ni commentaire :
JJ/MM|libellé court|montant|D
D pour un débit (argent qui sort), C pour un crédit (argent qui entre).
Montant positif, deux décimales, séparateur virgule. Ignore soldes, totaux et en-têtes.`;

export interface AiStatementResult {
  lines: StatementLine[];
  /** Jetons réellement consommés, tels que rapportés par l'API. */
  usage: { input: number; output: number };
}

/**
 * Ne garde que ce qui peut contenir une opération.
 * Chaque ligne retirée est un dixième de centime économisé, et surtout une
 * source de confusion en moins pour le modèle.
 */
export function prepareStatementText(text: string, maxLines = 80): string {
  return text
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 2 && /\d[.,]\d{2}/.test(l))
    .slice(0, maxLines)
    .join('\n');
}

/** Ce que l'envoi coûtera, à afficher avant de le déclencher. */
export function estimateStatementCost(text: string): {
  lines: number;
  inputTokens: number;
  outputTokens: number;
} {
  const prepared = prepareStatementText(text);
  const lines = prepared ? prepared.split('\n').length : 0;
  return {
    lines,
    inputTokens: estimateTokens(SYSTEM) + estimateTokens(prepared),
    // Une ligne de sortie est plus courte qu'une ligne d'entrée.
    outputTokens: Math.ceil(lines * 14),
  };
}

/** `JJ/MM` vers une date complète, sans inventer une année future. */
function resolveDate(fragment: string, now: Date): string {
  const m = /(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?/.exec(fragment);
  if (!m) return toISODate(now);

  const day = Number(m[1]);
  const month = Number(m[2]);
  if (day < 1 || day > 31 || month < 1 || month > 12) return toISODate(now);

  let year = m[3] ? Number(m[3]) : now.getFullYear();
  if (year < 100) year += 2000;

  const candidate = new Date(year, month - 1, day);
  // Une opération datée dans le futur vient de l'année précédente : un relevé
  // de décembre consulté en janvier, par exemple.
  if (!m[3] && candidate.getTime() > now.getTime() + 7 * 86_400_000) {
    return `${year - 1}-${`${month}`.padStart(2, '0')}-${`${day}`.padStart(2, '0')}`;
  }
  return `${year}-${`${month}`.padStart(2, '0')}-${`${day}`.padStart(2, '0')}`;
}

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[^\d,.-]/g, '').replace(',', '.');
  const value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value)) return null;
  const cents = Math.round(Math.abs(value) * 100);
  return cents > 0 ? cents : null;
}

/** Transforme la réponse du modèle en lignes exploitables. */
export function parseAiLines(text: string, now = new Date()): StatementLine[] {
  const out: StatementLine[] = [];
  let index = 0;

  for (const raw of text.split('\n')) {
    const parts = raw.split('|').map((p) => p.trim());
    if (parts.length < 4) continue;

    const [datePart, labelPart, amountPart, sensPart] = parts;
    const amount = parseAmount(amountPart);
    if (!amount) continue;

    const label = cleanLabel(labelPart) || labelPart.slice(0, 120);
    if (label.length < 2) continue;

    const type: TxType = sensPart.toUpperCase().startsWith('C') ? 'revenue' : 'expense';
    out.push({
      id: `ia${index++}`,
      dateISO: resolveDate(datePart, now),
      label: label.slice(0, 120),
      amount,
      type,
      origin: 'signe',
      // Le modèle a relu la capture : son libellé vaut mieux que le nôtre.
      labelSure: true,
      raw,
    });
  }

  return out;
}

/** Relit la capture avec Claude et renvoie les opérations trouvées. */
export async function refineStatement(
  ocrText: string,
  apiKey: string,
  now = new Date(),
): Promise<AiStatementResult> {
  const prepared = prepareStatementText(ocrText);
  if (!prepared) return { lines: [], usage: { input: 0, output: 0 } };

  const client = await anthropicClient(apiKey);
  const response = await client.messages.create({
    model: MODEL,
    // Chaque opération tient en une ligne courte : de quoi en couvrir 80.
    max_tokens: 1500,
    system: SYSTEM,
    messages: [{ role: 'user', content: prepared }],
  });

  if (response.stop_reason === 'refusal') {
    throw new Error("Le modèle a refusé d'analyser cette capture.");
  }

  const text = response.content
    .map((block) => (block.type === 'text' ? block.text : ''))
    .join('\n');

  return {
    lines: parseAiLines(text, now),
    usage: {
      input: response.usage.input_tokens,
      output: response.usage.output_tokens,
    },
  };
}
