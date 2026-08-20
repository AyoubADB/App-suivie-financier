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

/** Préférences utilisateur — synchronisées par compte quand la connexion est active. */
export interface UserSettings {
  currency: string;
  theme: 'dark' | 'light';
  /** Objectif de taux d'épargne, ratio 0..1. */
  savingsGoal: number;
}
