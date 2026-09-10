import type { ImportDraft } from '../types';

/**
 * Reconnaît un fichier OFX / QFX.
 * Le format existe en deux dialectes : l'ancien SGML (balises non fermées,
 * en-tête `OFXHEADER:100`) et le XML de la version 2. Les deux se lisent
 * avec le même repérage de balises, seul l'en-tête diffère.
 */
export function isOfx(text: string): boolean {
  const head = text.slice(0, 2048).toUpperCase();
  return head.includes('<OFX>') || head.includes('OFXHEADER');
}

/** Contenu d'une balise OFX, sans dépendre de sa fermeture. */
function tagValue(block: string, tag: string): string | null {
  const re = new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i');
  const found = re.exec(block);
  return found ? found[1].trim() : null;
}

/**
 * Date OFX : `AAAAMMJJ` éventuellement suivi de l'heure et du fuseau
 * (`20260824120000[-5:EST]`). Seul le jour nous intéresse.
 */
export function parseOfxDate(raw: string): string | null {
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits.length < 8) return null;
  const y = Number(digits.slice(0, 4));
  const m = Number(digits.slice(4, 6));
  const d = Number(digits.slice(6, 8));
  if (y < 1900 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${`${m}`.padStart(2, '0')}-${`${d}`.padStart(2, '0')}`;
}

/** Montant OFX : toujours un décimal à point, signé. Retourne des centimes. */
export function parseOfxAmount(raw: string): number | null {
  const cleaned = raw.replace(/\s/g, '').replace(',', '.');
  if (!/^[-+]?\d+(\.\d+)?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

export interface OfxResult {
  drafts: ImportDraft[];
  skipped: number;
  /** Devise déclarée par le relevé, si présente. */
  currency?: string;
  /** Numéro de compte, affiché pour que l'utilisateur sache ce qu'il importe. */
  accountId?: string;
}

/**
 * Extrait les mouvements d'un relevé OFX.
 * Chaque mouvement porte un FITID, identifiant stable côté banque : c'est lui
 * qui permet de réimporter un relevé chevauchant sans créer de doublon.
 */
export function parseOfx(text: string): OfxResult {
  const blocks = text.split(/<STMTTRN>/i).slice(1);
  const drafts: ImportDraft[] = [];
  let skipped = 0;

  for (const raw of blocks) {
    const block = raw.split(/<\/STMTTRN>/i)[0];
    const date = parseOfxDate(tagValue(block, 'DTPOSTED') ?? tagValue(block, 'DTUSER') ?? '');
    const signed = parseOfxAmount(tagValue(block, 'TRNAMT') ?? '');
    const name = tagValue(block, 'NAME') ?? '';
    const memo = tagValue(block, 'MEMO') ?? '';
    const label = decodeEntities(name || memo).replace(/\s+/g, ' ').trim();

    if (!date || signed === null || signed === 0 || !label) {
      skipped++;
      continue;
    }

    const fitid = tagValue(block, 'FITID');
    drafts.push({
      date,
      label: label.slice(0, 120),
      amount: Math.abs(signed),
      type: signed > 0 ? 'revenue' : 'expense',
      externalId: fitid ? fitid.slice(0, 64) : undefined,
    });
  }

  return {
    drafts,
    skipped,
    currency: tagValue(text, 'CURDEF') ?? undefined,
    accountId: tagValue(text, 'ACCTID') ?? undefined,
  };
}

/** Les libellés OFX peuvent contenir des entités XML. */
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)));
}
