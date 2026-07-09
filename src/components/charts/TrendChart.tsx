import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { SeriesPoint } from '../../types';
import { formatCentsCompact } from '../../logic/money';

interface TrendChartProps {
  series: SeriesPoint[];
  currency?: string;
}

const POS = 'var(--flow-pos)';
const NEG = 'var(--flow-neg)';

interface TooltipPayloadEntry {
  dataKey?: string | number;
  value?: number | string;
}

function FlowTooltip({
  active,
  payload,
  label,
  currency,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string | number;
  currency: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 font-semibold text-ink">{label}</p>
      {payload.map((entry) => (
        <p key={String(entry.dataKey)} className="flex items-center gap-2 text-ink-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: entry.dataKey === 'revenues' ? POS : NEG }}
          />
          {entry.dataKey === 'revenues' ? 'Revenus' : 'Dépenses'}
          <span className="amount ml-auto pl-3 font-medium text-ink">
            {formatCentsCompact(Number(entry.value ?? 0), currency)}
          </span>
        </p>
      ))}
    </div>
  );
}

/** Évolution revenus vs dépenses (aires fines, grille discrète, tooltip crosshair). */
export function TrendChart({ series, currency = 'EUR' }: TrendChartProps) {
  return (
    <div>
      <div className="h-56 w-full">
        <ResponsiveContainer>
          <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="fillRev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={POS} stopOpacity={0.25} />
                <stop offset="100%" stopColor={POS} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="fillExp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={NEG} stopOpacity={0.25} />
                <stop offset="100%" stopColor={NEG} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--flow-grid)" strokeWidth={1} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: 'var(--flow-ink-3)', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--flow-grid)' }}
              minTickGap={24}
            />
            <YAxis
              tick={{ fill: 'var(--flow-ink-3)', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => formatCentsCompact(v, currency).replace(/ /g, ' ')}
              width={62}
            />
            <Tooltip
              content={<FlowTooltip currency={currency} />}
              cursor={{ stroke: 'var(--flow-ink-3)', strokeDasharray: '3 3' }}
            />
            <Area
              type="monotone"
              dataKey="revenues"
              stroke={POS}
              strokeWidth={2}
              fill="url(#fillRev)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--flow-surface)' }}
            />
            <Area
              type="monotone"
              dataKey="expenses"
              stroke={NEG}
              strokeWidth={2}
              fill="url(#fillExp)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--flow-surface)' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {/* Légende — l'identité n'est jamais portée par la couleur seule */}
      <div className="mt-2 flex items-center gap-4 text-xs text-ink-2">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: POS }} />
          Revenus
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: NEG }} />
          Dépenses
        </span>
      </div>
    </div>
  );
}
