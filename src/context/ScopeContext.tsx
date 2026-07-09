import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { ScopeFilter } from '../types';

interface ScopeContextValue {
  scope: ScopeFilter;
  setScope: (scope: ScopeFilter) => void;
}

const STORAGE_KEY = 'flow.scope';

const ScopeContext = createContext<ScopeContextValue | null>(null);

function loadScope(): ScopeFilter {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === 'perso' || saved === 'pro' || saved === 'both' ? saved : 'both';
}

export function ScopeProvider({ children }: { children: ReactNode }) {
  const [scope, setScope] = useState<ScopeFilter>(loadScope);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, scope);
  }, [scope]);

  return <ScopeContext.Provider value={{ scope, setScope }}>{children}</ScopeContext.Provider>;
}

export function useScope(): ScopeContextValue {
  const ctx = useContext(ScopeContext);
  if (!ctx) throw new Error('useScope doit être utilisé sous <ScopeProvider>');
  return ctx;
}

export const SCOPE_LABELS: Record<ScopeFilter, string> = {
  perso: 'Perso',
  pro: 'Pro',
  both: 'Les deux',
};
