import { TrendingDown, TrendingUp } from 'lucide-react';
import { formatPct } from '../../logic/money';

interface DeltaPillProps {
  delta: number | null;
  /** true si une hausse est une bonne nouvelle (revenus), false sinon (dépenses). */
  upIsGood: boolean;
}

/** Variation vs période précédente. */
export function DeltaPill({ delta, upIsGood }: DeltaPillProps) {
  if (delta === null) return <span className="text-xs text-ink-3">—</span>;
  const up = delta >= 0;
  const good = up === upIsGood;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        good ? 'bg-pos/15 text-pos' : 'bg-neg/15 text-neg'
      }`}
    >
      <Icon size={12} />
      {up ? '+' : ''}
      {formatPct(delta)}
    </span>
  );
}
