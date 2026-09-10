import type { DateRange, Transaction } from '../types';
import { inRange } from './analytics';

/** Taux de TVA français courants, en pourcentage. */
export const VAT_RATES = [20, 10, 5.5, 2.1, 0] as const;

export const VAT_RATE_LABELS: Record<number, string> = {
  20: 'Taux normal — la plupart des biens et services',
  10: 'Taux réduit — restauration, transport, travaux de rénovation',
  5.5: 'Taux réduit — alimentaire, livres, énergie',
  2.1: 'Taux particulier — médicaments remboursés, presse',
  0: 'Exonéré ou franchise en base',
};

/**
 * Part de TVA contenue dans un montant TTC.
 * Les montants étant en centimes, l'arrondi se fait au centime le plus
 * proche : c'est la règle appliquée sur une facture.
 */
export function vatFromTtc(ttc: number, rate: number): number {
  if (rate <= 0) return 0;
  return Math.round(ttc - ttc / (1 + rate / 100));
}

/** Montant TTC correspondant à un HT et un taux. */
export function ttcFromHt(ht: number, rate: number): number {
  return Math.round(ht * (1 + rate / 100));
}

/** Montant hors taxes d'une transaction, TVA isolée ou non. */
export function htOf(tx: Pick<Transaction, 'amount' | 'vatAmount'>): number {
  return tx.amount - (tx.vatAmount ?? 0);
}

export interface VatSummary {
  /** TVA facturée aux clients, sur les revenus. */
  collected: number;
  /** TVA payée aux fournisseurs, récupérable sur les dépenses. */
  deductible: number;
  /** Ce qu'il reste à reverser : collectée − déductible. */
  due: number;
  /** Chiffre d'affaires hors taxes de la période. */
  revenueHt: number;
  /** Nombre de mouvements dont la TVA est renseignée. */
  documented: number;
  /** Mouvements pro sans TVA isolée — la synthèse est incomplète sans eux. */
  undocumented: number;
}

/**
 * Synthèse de TVA sur une période.
 * Ne compte que les mouvements dont la TVA a été isolée : deviner un taux
 * sur les autres donnerait un chiffre faux avec l'air d'être juste.
 */
export function vatSummary(txs: Transaction[], range?: DateRange): VatSummary {
  const pro = txs.filter((tx) => tx.scope === 'pro' && (!range || inRange(tx, range)));

  let collected = 0;
  let deductible = 0;
  let revenueHt = 0;
  let documented = 0;
  let undocumented = 0;

  for (const tx of pro) {
    if (tx.vatAmount === undefined) {
      undocumented++;
      if (tx.type === 'revenue') revenueHt += tx.amount;
      continue;
    }
    documented++;
    if (tx.type === 'revenue') {
      collected += tx.vatAmount;
      revenueHt += htOf(tx);
    } else {
      deductible += tx.vatAmount;
    }
  }

  return { collected, deductible, due: collected - deductible, revenueHt, documented, undocumented };
}
