import { useLiveQuery } from 'dexie-react-hooks';
import type { Badge, Category, Transaction } from '../types';
import { db } from './db';

export function useTransactions(): Transaction[] | undefined {
  return useLiveQuery(() => db.transactions.orderBy('date').reverse().toArray(), []);
}

export function useCategories(): Category[] | undefined {
  return useLiveQuery(() => db.categories.toArray(), []);
}

export function useBadges(): Badge[] | undefined {
  return useLiveQuery(() => db.badges.toArray(), []);
}
