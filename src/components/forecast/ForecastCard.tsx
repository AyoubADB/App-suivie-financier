import { TrendingDown, TrendingUp } from 'lucide-react';
import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useScheduled, useTransactions } from '../../context/DataContext';
import { useScope } from '../../context/ScopeContext';
import { useSettings } from '../../context/SettingsContext';
import { fromISODate } from '../../logic/dates';
import { firstNegativeDay, forecastBalance } from '../../logic/forecast';
import { formatCents, formatCentsCompact } from '../../logic/money';
import type { ForecastPoint } from '../../types';
import { Card } from '../ui/Card';

/** Projection du solde sur 30 jours à partir des échéances connues. */
export function ForecastCard() {
  const txs = useTransactions();
  const scheduled = useScheduled();
  const { scope } = useScope();
  const { currency, privacyMode } = useSettings();

  const points = useMemo(() => forecastBalance(txs, scheduled, scope, 30), [txs, scheduled, scope]);
  const negative = firstNegativeDay(points);
  const end = points[points.length - 1];
  const start = points[0];
  const trend = end && start ? end.balance - start.balance : 0;
  const hasEvents = points.some((p) => p.events.length > 0);

  return (
    <Card delay={0.22}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          {trend >= 0 ? (
            <TrendingUp size={17} className="text-pos" />
          ) : (
            <TrendingDown size={17} className="text-warn" />
          )}
          Solde prévisionnel · 30 jours
        </h2>
        {end && (
          <span className={`amount text-sm font-semibold ${end.balance < 0 ? 'text-neg' : ''}`}>
            {privacyMode ? '•••••' : formatCents(end.balance, currency)}
          </span>
        )}
      </div>

      {!hasEvents ? (
        <p className="py-3 text-sm text-ink-3">
          Aucune échéance connue sur les 30 prochains jours. Déclare ton salaire dans Réglages →
          Échéances programmées, ou marque tes abonnements comme récurrents : la courbe se
          construira toute seule.
        </p>
      ) : (
        <>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
                <defs>
                  <linearGradient id="forecastFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.32} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: 'var(--ink-3)' }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={28}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--ink-3)' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) =>
                    privacyMode ? '•••' : formatCentsCompact(v, currency)
                  }
                  width={62}
                />
                <ReferenceLine y={0} stroke="var(--neg)" strokeDasharray="4 4" />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0].payload as ForecastPoint;
                    return (
                      <div className="glass rounded-xl px-3 py-2 text-xs shadow-xl">
                        <p className="font-semibold">
                          {fromISODate(p.dateISO).toLocaleDateString('fr-FR', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                          })}
                        </p>
                        <p className={`amount mt-0.5 ${p.balance < 0 ? 'text-neg' : ''}`}>
                          {privacyMode ? '•••••' : formatCents(p.balance, currency)}
                        </p>
                        {p.events.map((e) => (
                          <p key={e} className="mt-0.5 text-ink-3">
                            · {e}
                          </p>
                        ))}
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="balance"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  fill="url(#forecastFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {negative ? (
            <p className="mt-2 rounded-2xl bg-neg/10 px-4 py-2.5 text-xs text-neg">
              Solde négatif prévu le{' '}
              <b>
                {fromISODate(negative.dateISO).toLocaleDateString('fr-FR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              </b>
              {negative.events.length > 0 && ` — ${negative.events.join(', ')}`}.
            </p>
          ) : (
            <p className="mt-2 text-[11px] text-ink-3">
              Projection à partir des échéances programmées et des abonnements. Le point de départ
              est le cumul de tes mouvements, pas ton solde bancaire réel.
            </p>
          )}
        </>
      )}
    </Card>
  );
}
