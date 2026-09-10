import type { NewTransaction } from '../data/repository';
import type { Rule, Scope, Transaction, TxType } from '../types';
import { normalize } from './categorizer';

/** Ce qu'une règle sait tester d'une transaction, existante ou en cours de saisie. */
export interface RuleSubject {
  label: string;
  amount: number;
  type: TxType;
  scope: Scope;
  note?: string;
}

/** Effets d'une règle, à fusionner dans la transaction. */
export interface RuleEffects {
  categoryId?: string;
  addBadges: string[];
  activityId?: string;
  renameTo?: string;
  markRecurring?: boolean;
}

/** Une règle s'applique-t-elle à cette transaction ? */
export function matchesRule(rule: Rule, subject: RuleSubject): boolean {
  if (!rule.active) return false;
  if (rule.type && rule.type !== subject.type) return false;
  if (rule.scope && rule.scope !== subject.scope) return false;

  if (rule.field === 'amount') {
    const target = Number(rule.value);
    if (!Number.isFinite(target)) return false;
    switch (rule.operator) {
      case 'gt':
        return subject.amount > target;
      case 'lt':
        return subject.amount < target;
      default:
        return subject.amount === target;
    }
  }

  const haystack = normalize(rule.field === 'note' ? (subject.note ?? '') : subject.label);
  const needle = normalize(rule.value);
  if (!needle) return false;
  switch (rule.operator) {
    case 'startsWith':
      return haystack.startsWith(needle);
    case 'equals':
      return haystack === needle;
    default:
      return haystack.includes(needle);
  }
}

/**
 * Applique les règles dans l'ordre.
 * La première règle qui impose une catégorie l'emporte — sinon la dernière
 * écraserait toujours les précédentes — mais les badges de toutes les règles
 * qui matchent s'accumulent : ce sont des étiquettes, pas des exclusivités.
 */
export function applyRules(
  rules: Rule[],
  subject: RuleSubject,
): { effects: RuleEffects; matched: Rule[] } {
  const effects: RuleEffects = { addBadges: [] };
  const matched: Rule[] = [];

  for (const rule of [...rules].sort((a, b) => a.order - b.order)) {
    if (!matchesRule(rule, subject)) continue;
    matched.push(rule);
    if (effects.categoryId === undefined && rule.categoryId) effects.categoryId = rule.categoryId;
    if (effects.activityId === undefined && rule.activityId) effects.activityId = rule.activityId;
    if (effects.renameTo === undefined && rule.renameTo) effects.renameTo = rule.renameTo;
    if (rule.markRecurring) effects.markRecurring = true;
    for (const badge of rule.addBadges) {
      if (!effects.addBadges.includes(badge)) effects.addBadges.push(badge);
    }
  }

  return { effects, matched };
}

/** Fusionne les effets dans une transaction à créer. */
export function applyRulesToDraft(rules: Rule[], draft: NewTransaction): NewTransaction {
  const { effects } = applyRules(rules, {
    label: draft.label,
    amount: draft.amount,
    type: draft.type,
    scope: draft.scope,
    note: draft.note,
  });
  return {
    ...draft,
    label: effects.renameTo ?? draft.label,
    categoryId: effects.categoryId ?? draft.categoryId,
    activityId: draft.scope === 'pro' ? (effects.activityId ?? draft.activityId) : draft.activityId,
    isRecurring: draft.isRecurring || effects.markRecurring === true,
    badges: mergeBadges(draft.badges, effects.addBadges),
  };
}

/**
 * Ce qu'une passe rétroactive changerait sur une transaction existante.
 * Retourne null quand rien ne bouge : appliquer les règles ne doit pas
 * réécrire l'historique pour rien ni gonfler le compteur de modifications.
 */
export function ruleChangesFor(rules: Rule[], tx: Transaction): Partial<Transaction> | null {
  const { effects } = applyRules(rules, tx);
  const patch: Partial<Transaction> = {};

  if (effects.renameTo && effects.renameTo !== tx.label) patch.label = effects.renameTo;
  if (effects.categoryId && effects.categoryId !== tx.categoryId) {
    patch.categoryId = effects.categoryId;
  }
  if (effects.activityId && tx.scope === 'pro' && effects.activityId !== tx.activityId) {
    patch.activityId = effects.activityId;
  }
  if (effects.markRecurring && !tx.isRecurring) patch.isRecurring = true;

  const badges = mergeBadges(tx.badges, effects.addBadges);
  if (badges.length !== tx.badges.length) patch.badges = badges;

  return Object.keys(patch).length > 0 ? patch : null;
}

function mergeBadges(current: string[], added: string[]): string[] {
  const out = [...current];
  for (const badge of added) if (!out.includes(badge)) out.push(badge);
  return out;
}

/** Résumé lisible d'une règle, pour la liste des réglages. */
export function describeRule(
  rule: Rule,
  names: { category?: string; activity?: string; badges: string[] },
): { condition: string; actions: string[] } {
  const fieldLabel = rule.field === 'amount' ? 'le montant' : rule.field === 'note' ? 'la note' : 'le libellé';
  const opLabel: Record<string, string> = {
    contains: 'contient',
    startsWith: 'commence par',
    equals: 'est exactement',
    gt: 'est supérieur à',
    lt: 'est inférieur à',
  };
  const value =
    rule.field === 'amount'
      ? `${(Number(rule.value) / 100).toFixed(2).replace('.', ',')} €`
      : `« ${rule.value} »`;

  let condition = `Si ${fieldLabel} ${opLabel[rule.operator] ?? 'contient'} ${value}`;
  if (rule.type) condition += ` · ${rule.type === 'revenue' ? 'revenus' : 'dépenses'}`;
  if (rule.scope) condition += ` · ${rule.scope}`;

  const actions: string[] = [];
  if (names.category) actions.push(`catégorie ${names.category}`);
  if (names.badges.length > 0) actions.push(`badge${names.badges.length > 1 ? 's' : ''} ${names.badges.join(', ')}`);
  if (names.activity) actions.push(`activité ${names.activity}`);
  if (rule.renameTo) actions.push(`renommer en « ${rule.renameTo} »`);
  if (rule.markRecurring) actions.push('marquer récurrent');

  return { condition, actions };
}
