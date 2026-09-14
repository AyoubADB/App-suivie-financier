/**
 * Blocs de la vue d'ensemble, et leur ordre d'affichage.
 * Chacun peut être masqué : un tableau de bord utile est un tableau de bord
 * qu'on lit en entier, pas un qu'on fait défiler en cherchant la seule carte
 * qui nous intéresse.
 */
export interface OverviewBlock {
  id: string;
  label: string;
  hint: string;
  /** Réservé au module professionnel. */
  proOnly?: boolean;
}

export const OVERVIEW_BLOCKS: OverviewBlock[] = [
  { id: 'cles', label: 'Chiffres clés', hint: 'Revenus, dépenses, solde, taux d’épargne' },
  { id: 'reserve', label: 'Reste à vivre', hint: 'Ce qui reste une fois les prélèvements gardés' },
  { id: 'evolution', label: 'Évolution', hint: 'Courbe revenus et dépenses de la période' },
  { id: 'repartition', label: 'Répartition', hint: 'Camembert des dépenses par catégorie' },
  { id: 'previsionnel', label: 'Solde prévisionnel', hint: 'Projection à 30 jours' },
  { id: 'budgets', label: 'Budgets', hint: 'Plafonds par catégorie' },
  { id: 'objectifs', label: 'Objectifs d’épargne', hint: 'Projets en cours' },
  { id: 'abonnements', label: 'Abonnements', hint: 'Tous les récurrents, perso et pro' },
  { id: 'pro', label: 'Activité pro', hint: 'Cotisations, seuils, rentabilité', proOnly: true },
  { id: 'coach', label: 'Coach', hint: 'Analyse de la période et pistes concrètes' },
  { id: 'echeances', label: 'Prochaines échéances', hint: 'Abonnements qui tombent bientôt' },
];

export function visibleBlocks(hidden: string[], proEnabled: boolean): Set<string> {
  const shown = new Set<string>();
  for (const block of OVERVIEW_BLOCKS) {
    if (block.proOnly && !proEnabled) continue;
    if (hidden.includes(block.id)) continue;
    shown.add(block.id);
  }
  return shown;
}
