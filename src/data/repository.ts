import type { Badge, Category, Transaction } from '../types';
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

  async exportAll(): Promise<ExportPayload> {
    const [transactions, categories, badges] = await Promise.all([
      db.transactions.toArray(),
      db.categories.toArray(),
      db.badges.toArray(),
    ]);
    return { version: 1, exportedAt: new Date().toISOString(), transactions, categories, badges };
  }

  async importAll(payload: ExportPayload): Promise<void> {
    if (payload.version !== 1 || !Array.isArray(payload.transactions)) {
      throw new Error('Fichier d’import invalide.');
    }
    await db.transaction('rw', db.transactions, db.categories, db.badges, async () => {
      await Promise.all([db.transactions.clear(), db.categories.clear(), db.badges.clear()]);
      await db.categories.bulkAdd(payload.categories.length ? payload.categories : DEFAULT_CATEGORIES);
      await db.badges.bulkAdd(payload.badges.length ? payload.badges : DEFAULT_BADGES);
      await db.transactions.bulkAdd(payload.transactions);
    });
  }

  async resetAll(): Promise<void> {
    await db.transaction('rw', db.transactions, db.categories, db.badges, async () => {
      await Promise.all([db.transactions.clear(), db.categories.clear(), db.badges.clear()]);
      await db.categories.bulkAdd(DEFAULT_CATEGORIES);
      await db.badges.bulkAdd(DEFAULT_BADGES);
    });
  }
}

export const repo: FlowRepository = new DexieRepository();
