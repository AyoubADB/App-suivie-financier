import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { DateRange, PeriodKind } from '../types';
import { fromISODate, getRange, toISODate } from '../logic/dates';

interface PeriodContextValue {
  period: PeriodKind;
  range: DateRange;
  customFrom: string;
  customTo: string;
  setPeriod: (period: PeriodKind) => void;
  setCustom: (fromISO: string, toISO: string) => void;
}

const STORAGE_KEY = 'flow.period';

const PeriodContext = createContext<PeriodContextValue | null>(null);

interface Persisted {
  period: PeriodKind;
  customFrom: string;
  customTo: string;
}

function loadPersisted(): Persisted {
  const today = toISODate(new Date());
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Persisted>;
      const kinds: PeriodKind[] = ['day', 'week', 'month', 'quarter', 'year', 'custom'];
      if (parsed.period && kinds.includes(parsed.period)) {
        return {
          period: parsed.period,
          customFrom: parsed.customFrom ?? today,
          customTo: parsed.customTo ?? today,
        };
      }
    }
  } catch {
    // stockage corrompu — on repart sur le défaut
  }
  return { period: 'month', customFrom: today, customTo: today };
}

export function PeriodProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Persisted>(loadPersisted);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const value = useMemo<PeriodContextValue>(() => {
    const custom: DateRange = {
      from: fromISODate(state.customFrom),
      to: fromISODate(state.customTo),
    };
    return {
      period: state.period,
      range: getRange(state.period, new Date(), custom),
      customFrom: state.customFrom,
      customTo: state.customTo,
      setPeriod: (period) => setState((s) => ({ ...s, period })),
      setCustom: (customFrom, customTo) =>
        setState((s) => ({
          ...s,
          period: 'custom',
          customFrom,
          customTo: customTo < customFrom ? customFrom : customTo,
        })),
    };
  }, [state]);

  return <PeriodContext.Provider value={value}>{children}</PeriodContext.Provider>;
}

export function usePeriod(): PeriodContextValue {
  const ctx = useContext(PeriodContext);
  if (!ctx) throw new Error('usePeriod doit être utilisé sous <PeriodProvider>');
  return ctx;
}
