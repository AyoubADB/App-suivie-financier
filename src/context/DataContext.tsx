import { useLiveQuery } from 'dexie-react-hooks';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { db } from '../data/db';
import { FirestoreRepository } from '../data/firestoreRepository';
import { repo as dexieRepo, type FlowRepository } from '../data/repository';
import { firestore } from '../lib/firebase';
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
import { useAuth } from './AuthContext';

interface DataContextValue {
  transactions: Transaction[];
  categories: Category[];
  badges: Badge[];
  budgets: Budget[];
  activities: Activity[];
  scheduled: ScheduledEntry[];
  goals: SavingsGoal[];
  rules: Rule[];
  repo: FlowRepository;
  /** Non nul uniquement en mode connecté — utilisé par la migration locale → cloud. */
  cloudRepo: FirestoreRepository | null;
  ready: boolean;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const { user, mode } = useAuth();
  const uid = mode === 'cloud' ? (user?.uid ?? null) : null;

  const cloudRepo = useMemo(
    () => (firestore && uid ? new FirestoreRepository(firestore, uid) : null),
    [uid],
  );

  const [cloudData, setCloudData] = useState<{
    transactions: Transaction[];
    categories: Category[];
    badges: Badge[];
    budgets: Budget[];
    activities: Activity[];
    scheduled: ScheduledEntry[];
    goals: SavingsGoal[];
    rules: Rule[];
    ready: boolean;
  }>({
    transactions: [],
    categories: [],
    badges: [],
    budgets: [],
    activities: [],
    scheduled: [],
    goals: [],
    rules: [],
    ready: false,
  });

  useEffect(() => {
    if (!cloudRepo) {
      setCloudData({
        transactions: [],
        categories: [],
        badges: [],
        budgets: [],
        activities: [],
        scheduled: [],
        goals: [],
        rules: [],
        ready: false,
      });
      return;
    }
    let cancelled = false;
    void cloudRepo.ensureSeeded();
    const unsubs = [
      cloudRepo.subscribeTransactions((transactions) => {
        if (!cancelled) setCloudData((d) => ({ ...d, transactions, ready: true }));
      }),
      cloudRepo.subscribeCategories((categories) => {
        if (!cancelled) setCloudData((d) => ({ ...d, categories }));
      }),
      cloudRepo.subscribeBadges((badges) => {
        if (!cancelled) setCloudData((d) => ({ ...d, badges }));
      }),
      cloudRepo.subscribeBudgets((budgets) => {
        if (!cancelled) setCloudData((d) => ({ ...d, budgets }));
      }),
      cloudRepo.subscribeActivities((activities) => {
        if (!cancelled) setCloudData((d) => ({ ...d, activities }));
      }),
      cloudRepo.subscribeScheduled((scheduled) => {
        if (!cancelled) setCloudData((d) => ({ ...d, scheduled }));
      }),
      cloudRepo.subscribeGoals((goals) => {
        if (!cancelled) setCloudData((d) => ({ ...d, goals }));
      }),
      cloudRepo.subscribeRules((rules) => {
        if (!cancelled) setCloudData((d) => ({ ...d, rules }));
      }),
    ];
    return () => {
      cancelled = true;
      for (const u of unsubs) u();
    };
  }, [cloudRepo]);

  const localTx = useLiveQuery(() => db.transactions.orderBy('date').reverse().toArray(), []);
  const localCats = useLiveQuery(() => db.categories.toArray(), []);
  const localBadges = useLiveQuery(() => db.badges.toArray(), []);
  const localBudgets = useLiveQuery(() => db.budgets.toArray(), []);
  const localActivities = useLiveQuery(() => db.activities.toArray(), []);
  const localScheduled = useLiveQuery(() => db.scheduled.toArray(), []);
  const localGoals = useLiveQuery(() => db.goals.toArray(), []);
  const localRules = useLiveQuery(() => db.rules.orderBy('order').toArray(), []);

  const value = useMemo<DataContextValue>(
    () =>
      cloudRepo
        ? {
            transactions: cloudData.transactions,
            categories: cloudData.categories,
            badges: cloudData.badges,
            budgets: cloudData.budgets,
            activities: cloudData.activities,
            scheduled: cloudData.scheduled,
            goals: cloudData.goals,
            rules: cloudData.rules,
            repo: cloudRepo,
            cloudRepo,
            ready: cloudData.ready,
          }
        : {
            transactions: localTx ?? [],
            categories: localCats ?? [],
            badges: localBadges ?? [],
            budgets: localBudgets ?? [],
            activities: localActivities ?? [],
            scheduled: localScheduled ?? [],
            goals: localGoals ?? [],
            rules: localRules ?? [],
            repo: dexieRepo,
            cloudRepo: null,
            ready: localTx !== undefined,
          },
    [
      cloudRepo,
      cloudData,
      localTx,
      localCats,
      localBadges,
      localBudgets,
      localActivities,
      localScheduled,
      localGoals,
      localRules,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData doit être utilisé sous <DataProvider>');
  return ctx;
}

export const useTransactions = () => useData().transactions;
export const useCategories = () => useData().categories;
export const useBadges = () => useData().badges;
export const useBudgets = () => useData().budgets;
export const useActivities = () => useData().activities;
export const useScheduled = () => useData().scheduled;
export const useGoals = () => useData().goals;
export const useRules = () => useData().rules;
export const useRepo = () => useData().repo;
export const useCloudRepo = () => useData().cloudRepo;
export const useDataReady = () => useData().ready;
