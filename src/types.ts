export type Scope = 'perso' | 'pro';
export type ScopeFilter = Scope | 'both';
export type TxType = 'expense' | 'revenue';
export type RecurringFrequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface Category {
  id: string;
  label: string;
  scope: Scope | 'both';
  type: TxType | 'both';
  icon: string; // nom d'icône lucide par défaut
  color: string; // couleur d'accent de la catégorie
  keywords: string[]; // utilisé par le moteur de catégorisation
}

/**
 * Part d'une transaction ventilée sur une autre catégorie.
 * Un passage en caisse mélange souvent courses et produits ménagers :
 * une seule catégorie fausse la répartition et les budgets.
 */
export interface TransactionSplit {
  categoryId: string;
  /** Montant de la part, en centimes. */
  amount: number;
  /** Précision facultative (« croquettes du chat »). */
  label?: string;
}

export interface Transaction {
  id: string;
  type: TxType;
  scope: Scope;
  amount: number; // en centimes pour éviter les flottants
  currency: string; // 'EUR' par défaut
  label: string; // ex "Netflix", "Client HOUSELAND", "Loyer"
  categoryId: string;
  date: string; // ISO (YYYY-MM-DD)
  isRecurring: boolean;
  recurringFrequency?: RecurringFrequency;
  nextDueDate?: string; // calculé pour les récurrents
  iconOverride?: string; // icône choisie manuellement
  imageUrl?: string; // image custom (style Notion) — remplace l'icône si présente
  badges: string[]; // ids de badges
  /** Activité pro rattachée — pertinent uniquement quand scope vaut 'pro'. */
  activityId?: string;
  /**
   * Ventilation sur plusieurs catégories. Le reliquat non ventilé reste
   * imputé à `categoryId`, si bien qu'une ventilation partielle est valide.
   */
  splits?: TransactionSplit[];
  /**
   * Identifiant fourni par la banque (FITID d'un relevé OFX).
   * Permet de réimporter un relevé sans créer de doublon.
   */
  externalId?: string;
  /**
   * Taux de TVA appliqué, en pourcentage (20, 10, 5.5, 2.1…).
   * Présent seulement si l'utilisateur a demandé à isoler la TVA.
   */
  vatRate?: number;
  /**
   * Montant de TVA en centimes, compris dans `amount` qui reste le TTC —
   * c'est le TTC qui quitte le compte, donc lui qui fait foi partout.
   */
  vatAmount?: number;
  /** Image de la facture ou du ticket, en data-URL. */
  receiptUrl?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Badge {
  id: string;
  label: string;
  color: string;
  icon?: string;
}

export type PeriodKind = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

export interface DateRange {
  from: Date; // inclus
  to: Date; // inclus (fin de journée)
}

export interface CategoryBreakdown {
  categoryId: string;
  label: string;
  color: string;
  icon: string;
  total: number; // centimes
  pct: number; // 0..1 de la part des dépenses
}

export interface SeriesPoint {
  label: string;
  dateISO: string;
  expenses: number; // centimes
  revenues: number; // centimes
}

export interface PeriodStats {
  expenses: number;
  revenues: number;
  net: number;
  savingsRate: number | null; // (revenus - dépenses) / revenus, null si revenus = 0
  expensesDelta: number | null; // variation vs période précédente, ratio (-1 = -100%)
  revenuesDelta: number | null;
  byCategory: CategoryBreakdown[];
  subscriptionMonthlyCost: number; // coût mensuel normalisé des abonnements actifs
  subscriptionWeight: number | null; // coût mensuel abonnements / revenus mensualisés
  series: SeriesPoint[];
  txCount: number;
}

export type InsightSeverity = 'good' | 'info' | 'warn';

export interface Insight {
  severity: InsightSeverity;
  title: string;
  message: string;
  potentialSaving?: number; // centimes / mois
}

/** Réponse à la question d'usage posée à la première connexion. */
export type AppUsage = 'perso' | 'pro' | 'both';

/**
 * Activité professionnelle. Une personne peut en cumuler plusieurs
 * (dev web, réparation, atelier…) et suivre chacune séparément.
 */
export interface Activity {
  id: string;
  label: string;
  color: string;
  icon: string;
  /** Une activité archivée reste dans l'historique mais sort des sélecteurs. */
  archived: boolean;
}

/** Préférences utilisateur — synchronisées par compte quand la connexion est active. */
export interface UserSettings {
  currency: string;
  theme: 'dark' | 'light';
  /** Objectif de taux d'épargne, ratio 0..1. */
  savingsGoal: number;
  /**
   * Jour de début du mois budgétaire (1–28). Permet de caler les périodes
   * sur la date de salaire plutôt que sur le 1er du mois.
   */
  monthStartDay: number;
  /** Scope ouvert par défaut au démarrage. */
  defaultScope: ScopeFilter;
  /** Masque les montants — utile en public ou pour une capture d'écran. */
  privacyMode: boolean;
  /** Usage déclaré au premier lancement. */
  usage: AppUsage;
  /**
   * Module professionnel actif. Quand il est désactivé, toute la notion de
   * scope disparaît de l'interface : l'app se comporte comme un outil
   * purement personnel.
   */
  proEnabled: boolean;
  /** Passe à true une fois le questionnaire d'accueil terminé. */
  onboarded: boolean;
  /** Part des revenus pro mise de côté pour les cotisations, ratio 0..1. */
  urssafRate: number;
  /** Seuil de franchise de TVA en centimes (37 500 € en prestations). */
  vatThreshold: number;
  /** Plafond de chiffre d'affaires du régime, en centimes. */
  revenueCeiling: number;
}

/** Plafond de dépense mensuel sur une catégorie. */
export interface Budget {
  id: string;
  categoryId: string;
  scope: ScopeFilter;
  /** Plafond mensuel en centimes. */
  amount: number;
  /** Reporte le reste non dépensé sur le mois suivant (méthode enveloppe). */
  rollover: boolean;
}

/**
 * Revenu ou dépense programmé à date fixe — un salaire, un loyer.
 * Distinct d'un abonnement : le montant réel varie et doit être confirmé.
 */
export interface ScheduledEntry {
  id: string;
  label: string;
  type: TxType;
  scope: Scope;
  categoryId: string;
  activityId?: string;
  /** Montant attendu, en centimes. Ajustable à la confirmation. */
  amount: number;
  /** Jour du mois où l'échéance tombe (1–28). */
  dayOfMonth: number;
  /** Dernier mois généré, au format YYYY-MM. */
  lastGenerated?: string;
  active: boolean;
}

/** Occurrence arrivée à échéance et pas encore confirmée. */
export interface PendingOccurrence {
  entry: ScheduledEntry;
  /** Date théorique de l'échéance. */
  dateISO: string;
  monthKey: string;
}

/** Projet d'épargne avec montant cible et échéance optionnelle. */
export interface SavingsGoal {
  id: string;
  label: string;
  /** Montant visé, en centimes. */
  target: number;
  /** Montant déjà mis de côté, en centimes. */
  saved: number;
  /** Échéance visée, au format ISO. */
  deadline?: string;
  color: string;
  icon: string;
}

/** Ligne prête à devenir une transaction, issue d'un relevé CSV ou OFX. */
export interface ImportDraft {
  date: string;
  label: string;
  /** Toujours positif : le sens est porté par `type`. */
  amount: number;
  type: TxType;
  externalId?: string;
}

/** Champ testé par une règle de catégorisation. */
export type RuleField = 'label' | 'note' | 'amount';

/** Comparateur d'une règle. Les trois derniers ne valent que pour un montant. */
export type RuleOperator = 'contains' | 'startsWith' | 'equals' | 'gt' | 'lt';

/**
 * Règle de catégorisation personnalisée : « si le libellé contient X,
 * alors catégorie Y, badge Z ». Elle prime sur les mots-clés des catégories,
 * qui restent le filet de sécurité.
 */
export interface Rule {
  id: string;
  /** Nom donné par l'utilisateur, affiché quand la règle s'applique. */
  label: string;
  active: boolean;
  /** Ordre d'évaluation, croissant. La première règle qui matche gagne. */
  order: number;
  field: RuleField;
  operator: RuleOperator;
  /** Texte recherché, ou montant en centimes rendu en chaîne. */
  value: string;
  /** Restreint la règle à un type de mouvement. */
  type?: TxType;
  /** Restreint la règle à une portée. */
  scope?: Scope;
  /** Catégorie imposée. */
  categoryId?: string;
  /** Badges ajoutés à ceux déjà présents. */
  addBadges: string[];
  /** Activité pro imposée. */
  activityId?: string;
  /** Remplace le libellé — utile face aux « CB CARREFOUR 4567 » des relevés. */
  renameTo?: string;
  /** Marque la transaction comme récurrente. */
  markRecurring?: boolean;
}

/** Point de la courbe de solde prévisionnel. */
export interface ForecastPoint {
  dateISO: string;
  label: string;
  balance: number;
  /** Libellés des mouvements attendus ce jour-là. */
  events: string[];
}

/** État calculé d'un budget sur la période courante. */
export interface BudgetStatus {
  budget: Budget;
  /** Report des mois précédents, nul si l'enveloppe n'est pas reportable. */
  carried: number;
  /** Plafond réellement disponible : montant + report. */
  effective: number;
  categoryLabel: string;
  categoryColor: string;
  categoryIcon: string;
  spent: number;
  ratio: number;
  remaining: number;
  level: 'ok' | 'warn' | 'over';
}
