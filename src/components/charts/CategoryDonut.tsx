import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { CategoryBreakdown } from '../../types';
import { formatCentsCompact, formatPct } from '../../logic/money';

interface CategoryDonutProps {
  breakdown: CategoryBreakdown[];
  currency?: string;
}

const MAX_SLICES = 7;

interface DonutTooltipEntry {
  name?: string | number;
  value?: number | string;
  payload?: { fill?: string };
}

function DonutTooltip({
  active,
  payload,
  currency,
}: {
  active?: boolean;
  payload?: DonutTooltipEntry[];
  currency: string;
}) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  return (
    <div className="glass rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="flex items-center gap-2 text-ink">
        <span className="h-2 w-2 rounded-full" style={{ background: entry.payload?.fill }} />
        <span className="font-medium">{entry.name}</span>
        <span className="amount ml-2">{formatCentsCompact(Number(entry.value ?? 0), currency)}</span>
      </p>
    </div>
  );
}

/**
 * Répartition des dépenses par catégorie.
 * Au-delà de 7 catégories, le reste est replié dans « Autres » (jamais de
 * couleur générée) ; gaps de 2px entre segments + labels directs en légende.
 */
export function CategoryDonut({ breakdown, currency = 'EUR' }: CategoryDonutProps) {
  const main = breakdown.slice(0, MAX_SLICES);
  const rest = breakdown.slice(MAX_SLICES);
  const data = [...main];
  if (rest.length > 0) {
    data.push({
      categoryId: '__rest',
      label: 'Autres',
      color: '#82828e',
      icon: 'CircleDashed',
      total: rest.reduce((a, c) => a + c.total, 0),
      pct: rest.reduce((a, c) => a + c.pct, 0),
    });
  }

  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-ink-3">Aucune dépense sur la période.</p>;
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="h-44 w-44 shrink-0">
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              dataKey="total"
              nameKey="label"
              innerRadius="62%"
              outerRadius="100%"
              paddingAngle={2}
              stroke="var(--flow-surface)"
              strokeWidth={2}
              isAnimationActive
            >
              {data.map((entry) => (
                <Cell key={entry.categoryId} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<DonutTooltip currency={currency} />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      {/* Labels directs : catégorie, part et montant en toutes lettres */}
      <ul className="w-full min-w-0 flex-1 space-y-1.5">
        {data.map((entry) => (
          <li key={entry.categoryId} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 shrink-0 rounded-[4px]" style={{ background: entry.color }} />
            <span className="truncate text-ink-2">{entry.label}</span>
            <span className="ml-auto shrink-0 text-ink-3">{formatPct(entry.pct)}</span>
            <span className="amount w-20 shrink-0 text-right font-medium text-ink">
              {formatCentsCompact(entry.total, currency)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
