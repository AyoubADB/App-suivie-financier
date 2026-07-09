import { SCOPE_LABELS, useScope } from '../context/ScopeContext';
import type { ScopeFilter } from '../types';
import { Segmented } from './ui/Segmented';

const OPTIONS: Array<{ value: ScopeFilter; label: string }> = [
  { value: 'perso', label: SCOPE_LABELS.perso },
  { value: 'pro', label: SCOPE_LABELS.pro },
  { value: 'both', label: SCOPE_LABELS.both },
];

/** Sélecteur de scope global — présent sur tous les écrans. */
export function ScopeSelector({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const { scope, setScope } = useScope();
  return <Segmented options={OPTIONS} value={scope} onChange={setScope} size={size} />;
}
