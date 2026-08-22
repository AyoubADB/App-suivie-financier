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
  const { defaultScope, proEnabled } = useSettings();
  const [stored, setStored] = useState<ScopeFilter>(() => loadScope(defaultScope));

  // Module Pro éteint : l'app est purement personnelle, la notion de scope
  // disparaît de l'interface comme des calculs.
  const scope: ScopeFilter = proEnabled ? stored : 'perso';
  const setScope = proEnabled ? setStored : () => undefined;

  useEffect(() => {
    if (proEnabled) localStorage.setItem(STORAGE_KEY, scope);
  }, [scope, proEnabled]);

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
