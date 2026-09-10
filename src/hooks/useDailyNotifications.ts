import { useEffect, useRef } from 'react';
import {
  useBudgets,
  useCategories,
  useDataReady,
  useScheduled,
  useTransactions,
} from '../context/DataContext';
import { usePeriod } from '../context/PeriodContext';
import { useSettings } from '../context/SettingsContext';
import { computeBudgetStatuses } from '../logic/budgets';
import { runDailyNotifications } from '../logic/notifications';

/**
 * Déclenche le rappel du jour à l'ouverture de l'app.
 * Une seule fois par session : la fonction appelée limite déjà à un rappel
 * par jour, autant ne pas recalculer à chaque rendu.
 */
export function useDailyNotifications(): void {
  const transactions = useTransactions();
  const scheduled = useScheduled();
  const budgets = useBudgets();
  const categories = useCategories();
  const ready = useDataReady();
  const { range } = usePeriod();
  const { currency } = useSettings();
  const fired = useRef(false);

  useEffect(() => {
    if (!ready || fired.current) return;
    fired.current = true;
    const statuses = computeBudgetStatuses(budgets, transactions, categories, range);
    void runDailyNotifications({ transactions, scheduled, budgets: statuses, currency });
  }, [ready, transactions, scheduled, budgets, categories, range, currency]);
}
