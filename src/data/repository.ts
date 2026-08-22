import type { Activity, Badge, Budget, Category, Transaction } from '../types';
import { computeNextDueDate } from '../logic/dates';
import { db } from './db';
import { DEFAULT_BADGES, DEFAULT_CATEGORIES } from './seed';

/**
 * Couche d'accès aux données isolée (pattern repository).
 * L'UI ne parle qu'à `repo` — brancher Firebase plus tard revient à
 * fournir une autre implémentation de FlowRepository.
 */

export interface ExportPayload {
  version: 1;
  exportedAt: string;
  transactions: Transaction[];
  categories: Category[];
  badges: Badge[];
  budgets?: Budget[];
  activities?: Activity[];
}

export type NewTransaction = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'nextDueDate'>;

export interface FlowRepository {
  addTransaction(input: NewTransaction): Promise<Transaction>;
  updateTransaction(id: string, patch: Partial<Transaction>): Promise<void>;
  deleteTransaction(id: string): Promise<void>;

  addCategory(input: Omit<Category, 'id'>): Promise<Category>;
  updateCategory(id: string, patch: Partial<Category>): Promise<void>;
  deleteCategory(id: string): Promise<void>;

  addBadge(input: Omit<Badge, 'id'>): Promise<Badge>;
  updateBadge(id: string, patch: Partial<Badge>): Promise<void>;
  deleteBadge(id: string): Promise<void>;

  setBudget(input: Omit<Budget, 'id'> & { id?: string }): Promise<Budget>;
  deleteBudget(id: string): Promise<void>;

  setActivity(input: Omit<Activity, 'id'> & { id?: string }): Promise<Activity>;
  deleteActivity(id: string): Promise<void>;

  exportAll(): Promise<ExportPayload>;
  importAll(payload: ExportPayload): Promise<void>;
  resetAll(): Promise<void>;
}

function uid(): string {
  return crypto.randomUUID();
}

function withNextDue<T extends Pick<Transaction, 'isRecurring' | 'recurringFrequency' | 'date'>>(
  tx: T,
): T & { nextDueDate?: string } {
  if (tx.isRecurring && tx.recurringFrequency) {
    return { ...tx, nextDueDate: computeNextDueDate(tx.date, tx.recurringFrequency) };
  }
  return { ...tx, nextDueDate: undefined };
}

class DexieRepository implements FlowRepository {
  async addTransaction(input: NewTransaction): Promise<Transaction> {
    const now = new Date().toISOString();
    const tx: Transaction = withNextDue({
      ...input,
      id: uid(),
      createdAt: now,
      updatedAt: now,
    });
    await db.transactions.add(tx);
    return tx;
  }

  async updateTransaction(id: string, patch: Partial<Transaction>): Promise<void> {
    const existing = await db.transactions.get(id);
    if (!existing) return;
    const merged = withNextDue({ ...existing, ...patch, updatedAt: new Date().toISOString() });
    await db.transactions.put(merged);
  }

  async deleteTransaction(id: string): Promise<void> {
    await db.transactions.delete(id);
  }

  async addCategory(input: Omit<Category, 'id'>): Promise<Category> {
    const cat: Category = { ...input, id: uid() };
    await db.categories.add(cat);
    return cat;
  }

  async updateCategory(id: string, patch: Partial<Category>): Promise<void> {
    await db.categories.update(id, patch);
  }

  async deleteCategory(id: string): Promise<void> {
    await db.transaction('rw', db.categories, db.transactions, async () => {
      await db.categories.delete(id);
      // Les transactions orphelines retombent sur « Autre ».
      await db.transactions.where('categoryId').equals(id).modify({ categoryId: 'cat-autre' });
    });
  }

  async addBadge(input: Omit<Badge, 'id'>): Promise<Badge> {
    const badge: Badge = { ...input, id: uid() };
    await db.badges.add(badge);
    return badge;
  }

  async updateBadge(id: string, patch: Partial<Badge>): Promise<void> {
    await db.badges.update(id, patch);
  }

  async deleteBadge(id: string): Promise<void> {
    await db.transaction('rw', db.badges, db.transactions, async () => {
      await db.badges.delete(id);
      await db.transactions
        .filter((tx) => tx.badges.includes(id))
        .modify((tx) => {
          tx.badges = tx.badges.filter((b) => b !== id);
        });
    });
  }

  async setBudget(input: Omit<Budget, 'id'> & { id?: string }): Promise<Budget> {
    const budget: Budget = { ...input, id: input.id ?? uid() };
    await db.budgets.put(budget);
    return budget;
  }

  async deleteBudget(id: string): Promise<void> {
    await db.budgets.delete(id);
  }

  async setActivity(input: Omit<Activity, 'id'> & { id?: string }): Promise<Activity> {
    const activity: Activity = { ...input, id: input.id ?? uid() };
    await db.activities.put(activity);
    return activity;
  }

  /** L'activité est archivée, jamais effacée : l'historique doit rester lisible. */
  async deleteActivity(id: string): Promise<void> {
    await db.activities.update(id, { archived: true });
  }

  async exportAll(): Promise<ExportPayload> {
    const [transactions, categories, badges, budgets, activities] = await Promise.all([
      db.transactions.toArray(),
      db.categories.toArray(),
      db.badges.toArray(),
      db.budgets.toArray(),
      db.activities.toArray(),
    ]);
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      transactions,
      categories,
      badges,
      budgets,
      activities,
    };
  }

  async importAll(payload: ExportPayload): Promise<void> {
    if (payload.version !== 1 || !Array.isArray(payload.transactions)) {
      throw new Error(
        payload?.version !== 1
          ? `Format non reconnu (version ${String(payload?.version ?? 'absente')}). Attendu : un export FLOW version 1.`
          : "Le fichier ne contient pas de liste de transactions — ce n'est pas un export FLOW.",
      );
    }
    await db.transaction('rw', db.transactions, db.categories, db.badges, db.budgets, db.activities, async () => {
      await Promise.all([
        db.transactions.clear(),
        db.categories.clear(),
        db.badges.clear(),
        db.budgets.clear(),
        db.activities.clear(),
      ]);
      await db.categories.bulkAdd(payload.categories.length ? payload.categories : DEFAULT_CATEGORIES);
      await db.badges.bulkAdd(payload.badges.length ? payload.badges : DEFAULT_BADGES);
      await db.transactions.bulkAdd(payload.transactions);
      if (payload.budgets?.length) await db.budgets.bulkAdd(payload.budgets);
      if (payload.activities?.length) await db.activities.bulkAdd(payload.activities);
    });
  }

  async resetAll(): Promise<void> {
    await db.transaction('rw', db.transactions, db.categories, db.badges, db.budgets, db.activities, async () => {
      await Promise.all([
        db.transactions.clear(),
        db.categories.clear(),
        db.badges.clear(),
        db.budgets.clear(),
        db.activities.clear(),
      ]);
      await db.categories.bulkAdd(DEFAULT_CATEGORIES);
      await db.badges.bulkAdd(DEFAULT_BADGES);
    });
  }
}

export const repo: FlowRepository = new DexieRepository();
