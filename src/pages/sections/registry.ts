import {
  CalendarClock,
  ChartColumn,
  ChartPie,
  LayoutDashboard,
  Percent,
  PiggyBank,
  RefreshCcw,
  Sparkles,
  Target,
  TrendingUp,
  Briefcase,
  type LucideIcon,
} from 'lucide-react';

export interface SectionDef {
  /** Segment d'URL sous /vue. */
  slug: string;
  label: string;
  /** Une phrase qui dit ce qu'on vient y faire, pas ce que c'est. */
  hint: string;
  icon: LucideIcon;
  /** Réservé au module professionnel. */
  proOnly?: boolean;
}

/**
 * Sections détaillées de la vue d'ensemble.
 * Le tableau de bord ne montre que l'essentiel ; chaque bloc a sa page où
 * l'on peut creuser et modifier, sans repasser par les réglages.
 */
export const SECTIONS: SectionDef[] = [
  {
    slug: 'depenses',
    label: 'Dépenses',
    hint: 'Où part l’argent, poste par poste',
    icon: ChartColumn,
  },
  {
    slug: 'revenus',
    label: 'Revenus',
    hint: 'Ce qui rentre, et d’où ça vient',
    icon: TrendingUp,
  },
  {
    slug: 'repartition',
    label: 'Répartition',
    hint: 'Le détail par catégorie, en grand',
    icon: ChartPie,
  },
  {
    slug: 'previsionnel',
    label: 'Solde prévisionnel',
    hint: 'Ce qu’il restera d’ici 30 jours',
    icon: CalendarClock,
  },
  {
    slug: 'budgets',
    label: 'Budgets',
    hint: 'Plafonds par catégorie et reports',
    icon: Target,
  },
  {
    slug: 'objectifs',
    label: 'Objectifs d’épargne',
    hint: 'Projets, échéances et effort mensuel',
    icon: PiggyBank,
  },
  {
    slug: 'abonnements',
    label: 'Abonnements',
    hint: 'Récurrents actifs, coût réel et dormants',
    icon: RefreshCcw,
  },
  {
    slug: 'coach',
    label: 'Coach',
    hint: 'Analyse de tes chiffres et pistes concrètes',
    icon: Sparkles,
  },
  {
    slug: 'pro',
    label: 'Activité pro',
    hint: 'Cotisations, seuils et rentabilité',
    icon: Briefcase,
    proOnly: true,
  },
  {
    slug: 'tva',
    label: 'TVA',
    hint: 'Collectée, déductible, à reverser',
    icon: Percent,
    proOnly: true,
  },
];

export const OVERVIEW: SectionDef = {
  slug: '',
  label: 'Vue d’ensemble',
  hint: 'Tout le tableau de bord d’un coup d’œil',
  icon: LayoutDashboard,
};

export function sectionsFor(proEnabled: boolean): SectionDef[] {
  return SECTIONS.filter((s) => proEnabled || !s.proOnly);
}

export function findSection(slug: string | undefined): SectionDef | null {
  return SECTIONS.find((s) => s.slug === slug) ?? null;
}
