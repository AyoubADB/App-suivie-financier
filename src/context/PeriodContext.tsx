import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fromISODate, getRange, shiftReference, toISODate } from '../logic/dates';
import type { DateRange, PeriodKind } from '../types';

interface PeriodContextValue {
  period: PeriodKind;
  range: DateRange;
  offset: number;
  customFrom: string;
  customTo: string;
  setPeriod: (period: PeriodKind) => void;
  setCustom: (fromISO: string, toISO: string) => void;
  shift: (delta: number) => void;
  resetOffset: () => void;
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
  const [offset, setOffset] = useState(0);

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
      range: getRange(state.period, shiftReference(state.period, offset), custom),
      offset,
      customFrom: state.customFrom,
      customTo: state.customTo,
      setPeriod: (period) => {
        setOffset(0);
        setState((s) => ({ ...s, period }));
      },
      setCustom: (customFrom, customTo) => {
        setOffset(0);
        setState((s) => ({
          ...s,
          period: 'custom',
          customFrom,
          customTo: customTo < customFrom ? customFrom : customTo,
        }));
      },
      shift: (delta) => setOffset((o) => o + delta),
      resetOffset: () => setOffset(0),
    };
  }, [state, offset]);

  return <PeriodContext.Provider value={value}>{children}</PeriodContext.Provider>;
}

export function usePeriod(): PeriodContextValue {
  const ctx = useContext(PeriodContext);
  if (!ctx) throw new Error('usePeriod doit être utilisé sous <PeriodProvider>');
  return ctx;
}
