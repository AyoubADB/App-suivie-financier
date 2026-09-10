import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
  writeBatch,
  deleteField,
  type CollectionReference,
  type Firestore,
} from 'firebase/firestore';
import { computeNextDueDate } from '../logic/dates';
import type {
  Activity,
  Badge,
  Budget,
  Category,
  Rule,
  SavingsGoal,
  ScheduledEntry,
  Transaction,
} from '../types';
import type { ExportPayload, FlowRepository, NewTransaction } from './repository';
import { DEFAULT_BADGES, DEFAULT_CATEGORIES } from './seed';

/**
 * Chaque compte Google possède son propre sous-arbre `users/{uid}` :
 * aucune donnée n'est partagée entre utilisateurs.
 */
export class FirestoreRepository implements FlowRepository {
  private readonly fs: Firestore;
  private readonly uid: string;

  constructor(fs: Firestore, uid: string) {
    this.fs = fs;
    this.uid = uid;
  }

  private col<T>(name: string): CollectionReference<T> {
    return collection(this.fs, 'users', this.uid, name) as CollectionReference<T>;
  }

  /** Crée les catégories/badges par défaut au premier login. */
  async ensureSeeded(): Promise<void> {
    const cats = await getDocs(this.col<Category>('categories'));
    if (!cats.empty) return;
    const batch = writeBatch(this.fs);
    for (const cat of DEFAULT_CATEGORIES) {
      batch.set(doc(this.col<Category>('categories'), cat.id), stripUndefined(cat));
    }
    for (const badge of DEFAULT_BADGES) {
      batch.set(doc(this.col<Badge>('badges'), badge.id), stripUndefined(badge));
    }
    await batch.commit();
  }

  subscribeTransactions(cb: (rows: Transaction[]) => void): () => void {
    return onSnapshot(this.col<Transaction>('transactions'), (snap) => {
      cb(snap.docs.map((d) => d.data()).sort((a, b) => (a.date < b.date ? 1 : -1)));
    });
  }

  subscribeCategories(cb: (rows: Category[]) => void): () => void {
    return onSnapshot(this.col<Category>('categories'), (snap) =>
      cb(snap.docs.map((d) => d.data())),
    );
  }

  subscribeBadges(cb: (rows: Badge[]) => void): () => void {
    return onSnapshot(this.col<Badge>('badges'), (snap) => cb(snap.docs.map((d) => d.data())));
  }

  subscribeBudgets(cb: (rows: Budget[]) => void): () => void {
    return onSnapshot(this.col<Budget>('budgets'), (snap) => cb(snap.docs.map((d) => d.data())));
  }

  async setBudget(input: Omit<Budget, 'id'> & { id?: string }): Promise<Budget> {
    const budget: Budget = { ...input, id: input.id ?? crypto.randomUUID() };
    await setDoc(doc(this.col<Budget>('budgets'), budget.id), stripUndefined(budget));
    return budget;
  }

  async deleteBudget(id: string): Promise<void> {
    await deleteDoc(doc(this.col<Budget>('budgets'), id));
  }

  subscribeActivities(cb: (rows: Activity[]) => void): () => void {
    return onSnapshot(this.col<Activity>('activities'), (snap) =>
      cb(snap.docs.map((d) => d.data())),
    );
  }

  async setActivity(input: Omit<Activity, 'id'> & { id?: string }): Promise<Activity> {
    const activity: Activity = { ...input, id: input.id ?? crypto.randomUUID() };
    await setDoc(doc(this.col<Activity>('activities'), activity.id), stripUndefined(activity));
    return activity;
  }

  /** Archivée plutôt que supprimée : les transactions passées gardent leur libellé. */
  async deleteActivity(id: string): Promise<void> {
    await updateDoc(doc(this.col<Activity>('activities'), id), { archived: true });
  }

  /** Suppression définitive : les transactions liées perdent leur activité. */
  async purgeActivity(id: string): Promise<void> {
    await deleteDoc(doc(this.col<Activity>('activities'), id));
    const [txs, sched] = await Promise.all([
      getDocs(this.col<Transaction>('transactions')),
      getDocs(this.col<ScheduledEntry>('scheduled')),
    ]);
    const batch = writeBatch(this.fs);
    for (const d of txs.docs) {
      if (d.data().activityId === id) batch.update(d.ref, { activityId: deleteField() });
    }
    for (const d of sched.docs) {
      if (d.data().activityId === id) batch.update(d.ref, { activityId: deleteField() });
    }
    await batch.commit();
  }

  subscribeScheduled(cb: (rows: ScheduledEntry[]) => void): () => void {
    return onSnapshot(this.col<ScheduledEntry>('scheduled'), (snap) =>
      cb(snap.docs.map((d) => d.data())),
    );
  }

  async setScheduled(input: Omit<ScheduledEntry, 'id'> & { id?: string }): Promise<ScheduledEntry> {
    const entry: ScheduledEntry = { ...input, id: input.id ?? crypto.randomUUID() };
    await setDoc(doc(this.col<ScheduledEntry>('scheduled'), entry.id), stripUndefined(entry));
    return entry;
  }

  async deleteScheduled(id: string): Promise<void> {
    await deleteDoc(doc(this.col<ScheduledEntry>('scheduled'), id));
  }

  subscribeGoals(cb: (rows: SavingsGoal[]) => void): () => void {
    return onSnapshot(this.col<SavingsGoal>('goals'), (snap) => cb(snap.docs.map((d) => d.data())));
  }

  async setGoal(input: Omit<SavingsGoal, 'id'> & { id?: string }): Promise<SavingsGoal> {
    const goal: SavingsGoal = { ...input, id: input.id ?? crypto.randomUUID() };
    await setDoc(doc(this.col<SavingsGoal>('goals'), goal.id), stripUndefined(goal));
    return goal;
  }

  async deleteGoal(id: string): Promise<void> {
    await deleteDoc(doc(this.col<SavingsGoal>('goals'), id));
  }

  subscribeRules(cb: (rows: Rule[]) => void): () => void {
    return onSnapshot(this.col<Rule>('rules'), (snap) =>
      cb(snap.docs.map((d) => d.data()).sort((a, b) => a.order - b.order)),
    );
  }

  async setRule(input: Omit<Rule, 'id'> & { id?: string }): Promise<Rule> {
    const rule: Rule = { ...input, id: input.id ?? crypto.randomUUID() };
    await setDoc(doc(this.col<Rule>('rules'), rule.id), stripUndefined(rule));
    return rule;
  }

  async deleteRule(id: string): Promise<void> {
    await deleteDoc(doc(this.col<Rule>('rules'), id));
  }

  async addTransaction(input: NewTransaction): Promise<Transaction> {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const tx = stripUndefined<Transaction>({
      ...input,
      id,
      createdAt: now,
      updatedAt: now,
      nextDueDate:
        input.isRecurring && input.recurringFrequency
          ? computeNextDueDate(input.date, input.recurringFrequency)
          : undefined,
    });
    await setDoc(doc(this.col<Transaction>('transactions'), id), tx);
    return tx;
  }

  async updateTransaction(id: string, patch: Partial<Transaction>): Promise<void> {
    const ref = doc(this.col<Transaction>('transactions'), id);
    const merged: Partial<Transaction> = { ...patch, updatedAt: new Date().toISOString() };
    if (patch.isRecurring === false) merged.nextDueDate = undefined;
    else if (patch.isRecurring && patch.recurringFrequency && patch.date) {
      merged.nextDueDate = computeNextDueDate(patch.date, patch.recurringFrequency);
    }
    // Une ventilation retirée, une activité détachée : le champ doit
    // disparaître du document, pas seulement être omis de la mise à jour.
    await updateDoc(ref, clearUndefined(merged));
  }

  async deleteTransaction(id: string): Promise<void> {
    await deleteDoc(doc(this.col<Transaction>('transactions'), id));
  }

  async addCategory(input: Omit<Category, 'id'>): Promise<Category> {
    const cat: Category = { ...input, id: crypto.randomUUID() };
    await setDoc(doc(this.col<Category>('categories'), cat.id), stripUndefined(cat));
    return cat;
  }

  async updateCategory(id: string, patch: Partial<Category>): Promise<void> {
    await updateDoc(doc(this.col<Category>('categories'), id), patch as Record<string, unknown>);
  }

  async deleteCategory(id: string): Promise<void> {
    await deleteDoc(doc(this.col<Category>('categories'), id));
    const snap = await getDocs(this.col<Transaction>('transactions'));
    const batch = writeBatch(this.fs);
    for (const d of snap.docs) {
      if (d.data().categoryId === id) batch.update(d.ref, { categoryId: 'cat-autre' });
    }
    await batch.commit();
  }

  async addBadge(input: Omit<Badge, 'id'>): Promise<Badge> {
    const badge: Badge = { ...input, id: crypto.randomUUID() };
    await setDoc(doc(this.col<Badge>('badges'), badge.id), stripUndefined(badge));
    return badge;
  }

  async updateBadge(id: string, patch: Partial<Badge>): Promise<void> {
    await updateDoc(doc(this.col<Badge>('badges'), id), patch as Record<string, unknown>);
  }

  async deleteBadge(id: string): Promise<void> {
    await deleteDoc(doc(this.col<Badge>('badges'), id));
    const snap = await getDocs(this.col<Transaction>('transactions'));
    const batch = writeBatch(this.fs);
    for (const d of snap.docs) {
      const tx = d.data();
      if (tx.badges.includes(id)) {
        batch.update(d.ref, { badges: tx.badges.filter((b) => b !== id) });
      }
    }
    await batch.commit();
  }

  async exportAll(): Promise<ExportPayload> {
    const [txs, cats, badges, budgets, activities, scheduled, goals, rules] = await Promise.all([
      getDocs(this.col<Transaction>('transactions')),
      getDocs(this.col<Category>('categories')),
      getDocs(this.col<Badge>('badges')),
      getDocs(this.col<Budget>('budgets')),
      getDocs(this.col<Activity>('activities')),
      getDocs(this.col<ScheduledEntry>('scheduled')),
      getDocs(this.col<SavingsGoal>('goals')),
      getDocs(this.col<Rule>('rules')),
    ]);
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      transactions: txs.docs.map((d) => d.data()),
      categories: cats.docs.map((d) => d.data()),
      badges: badges.docs.map((d) => d.data()),
      budgets: budgets.docs.map((d) => d.data()),
      activities: activities.docs.map((d) => d.data()),
      scheduled: scheduled.docs.map((d) => d.data()),
      goals: goals.docs.map((d) => d.data()),
      rules: rules.docs.map((d) => d.data()),
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
    await this.clearAll();
    const batch = writeBatch(this.fs);
    for (const cat of payload.categories.length ? payload.categories : DEFAULT_CATEGORIES) {
      batch.set(doc(this.col<Category>('categories'), cat.id), stripUndefined(cat));
    }
    for (const badge of payload.badges.length ? payload.badges : DEFAULT_BADGES) {
      batch.set(doc(this.col<Badge>('badges'), badge.id), stripUndefined(badge));
    }
    for (const tx of payload.transactions) {
      batch.set(doc(this.col<Transaction>('transactions'), tx.id), stripUndefined(tx));
    }
    for (const b of payload.budgets ?? []) {
      batch.set(doc(this.col<Budget>('budgets'), b.id), stripUndefined(b));
    }
    for (const a of payload.activities ?? []) {
      batch.set(doc(this.col<Activity>('activities'), a.id), stripUndefined(a));
    }
    for (const e of payload.scheduled ?? []) {
      batch.set(doc(this.col<ScheduledEntry>('scheduled'), e.id), stripUndefined(e));
    }
    for (const g of payload.goals ?? []) {
      batch.set(doc(this.col<SavingsGoal>('goals'), g.id), stripUndefined(g));
    }
    for (const r of payload.rules ?? []) {
      batch.set(doc(this.col<Rule>('rules'), r.id), stripUndefined(r));
    }
    await batch.commit();
  }

  async resetAll(): Promise<void> {
    await this.clearAll();
    await this.ensureSeeded();
  }

  private async clearAll(): Promise<void> {
    const [txs, cats, badges, budgets, activities, scheduled, goals, rules] = await Promise.all([
      getDocs(this.col('transactions')),
      getDocs(this.col('categories')),
      getDocs(this.col('badges')),
      getDocs(this.col('budgets')),
      getDocs(this.col('activities')),
      getDocs(this.col('scheduled')),
      getDocs(this.col('goals')),
      getDocs(this.col('rules')),
    ]);
    const batch = writeBatch(this.fs);
    for (const d of [
      ...txs.docs,
      ...cats.docs,
      ...badges.docs,
      ...budgets.docs,
      ...activities.docs,
      ...scheduled.docs,
      ...goals.docs,
      ...rules.docs,
    ]) {
      batch.delete(d.ref);
    }
    batch.delete(doc(this.fs, 'users', this.uid, 'meta', 'settings'));
    await batch.commit();
  }
}

/**
 * Dans une mise à jour, `undefined` veut dire « efface ce champ ».
 * `stripUndefined` conviendrait à une création, mais laisserait ici
 * l'ancienne valeur en place.
 */
function clearUndefined(obj: object): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, v === undefined ? deleteField() : v]),
  );
}

/** Firestore rejette les valeurs `undefined`. */
function stripUndefined<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}
