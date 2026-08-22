import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { ScopeFilter } from '../types';
import { useSettings } from './SettingsContext';

interface ScopeContextValue {
  scope: ScopeFilter;
  setScope: (scope: ScopeFilter) => void;
}

const STORAGE_KEY = 'flow.scope';

const ScopeContext = createContext<ScopeContextValue | null>(null);

/**
 * Le dernier scope utilisé prime ; à défaut on retombe sur la préférence
 * de compte `defaultScope` transmise par <ScopeProvider>.
 */
function loadScope(fallback: ScopeFilter): ScopeFilter {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === 'perso' || saved === 'pro' || saved === 'both' ? saved : fallback;
}

export function ScopeProvider({ children }: { children: ReactNode }) {
  const { defaultScope } = useSettings();
  const [scope, setScope] = useState<ScopeFilter>(() => loadScope(defaultScope));

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
