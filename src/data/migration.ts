import type { FirestoreRepository } from './firestoreRepository';
import { db } from './db';

const DONE_KEY = 'flow.migratedTo';

/** Nombre de transactions présentes dans le stockage local de l'appareil. */
export async function countLocalTransactions(): Promise<number> {
  try {
    return await db.transactions.count();
  } catch {
    return 0;
  }
}

/** true si ce compte n'a jamais absorbé les données locales de cet appareil. */
export function migrationPending(uid: string): boolean {
  return localStorage.getItem(`${DONE_KEY}.${uid}`) !== '1';
}

export function dismissMigration(uid: string): void {
  localStorage.setItem(`${DONE_KEY}.${uid}`, '1');
}

/**
 * Copie les transactions locales vers le compte connecté.
 * Les catégories et badges par défaut existent déjà côté compte : on ne
 * transfère que les transactions et les éléments personnalisés absents.
 */
export async function migrateLocalToCloud(
  repo: FirestoreRepository,
  uid: string,
): Promise<number> {
  const [localTxs, localCats, localBadges, remote] = await Promise.all([
    db.transactions.toArray(),
    db.categories.toArray(),
    db.badges.toArray(),
    repo.exportAll(),
  ]);

  const knownCats = new Set(remote.categories.map((c) => c.id));
  const knownBadges = new Set(remote.badges.map((b) => b.id));
  const knownTxs = new Set(remote.transactions.map((t) => t.id));

  for (const cat of localCats) {
    if (!knownCats.has(cat.id)) await repo.addCategory(cat);
  }
  for (const badge of localBadges) {
    if (!knownBadges.has(badge.id)) await repo.addBadge(badge);
  }

  let imported = 0;
  for (const tx of localTxs) {
    if (knownTxs.has(tx.id)) continue;
    const { id: _id, createdAt: _c, updatedAt: _u, nextDueDate: _n, ...rest } = tx;
    await repo.addTransaction(rest);
    imported++;
  }

  dismissMigration(uid);
  return imported;
}
