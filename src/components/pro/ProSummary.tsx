import { Briefcase, Landmark, TrendingUp, TriangleAlert } from 'lucide-react';
import { useMemo } from 'react';
import { useActivities, useTransactions } from '../../context/DataContext';
import { usePeriod } from '../../context/PeriodContext';
import { useSettings } from '../../context/SettingsContext';
import { toISODate } from '../../logic/dates';
import { formatCents, formatPct } from '../../logic/money';
import {
  activityPerformance,
  thresholdStatus,
  urssafProvision,
  yearRevenue,
  type ThresholdStatus,
} from '../../logic/pro';
import { Card } from '../ui/Card';
import { getIcon } from '../ui/icons';

/**
 * Tableau de bord de l'activité indépendante : ce qui est dû avant d'être
 * dépensé, la distance aux seuils réglementaires, et la rentabilité de
 * chaque casquette.
 */
export function ProSummary() {
  const txs = useTransactions();
  const activities = useActivities();
  const { range } = usePeriod();
  const { currency, privacyMode, urssafRate, vatThreshold, revenueCeiling } = useSettings();

  const year = new Date().getFullYear();
  const revenue = useMemo(() => yearRevenue(txs, year), [txs, year]);
  const provision = useMemo(
    () => urssafProvision(txs, { urssafRate }, year),
    [txs, urssafRate, year],
  );
  const vat = thresholdStatus(revenue, vatThreshold);
  const ceiling = thresholdStatus(revenue, revenueCeiling);

  const perf = useMemo(
    () => activityPerformance(txs, activities, toISODate(range.from), toISODate(range.to)),
    [txs, activities, range],
  );

  const hide = (cents: number) => (privacyMode ? '•••' : formatCents(cents, currency));

  return (
    <div className="flex flex-col gap-4">
      <Card delay={0.05}>
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
          <Landmark size={17} className="text-accent" />
          Cotisations & seuils {year}
        </h2>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-surface-2/60 p-3.5">
            <p className="text-xs text-ink-3">Chiffre d'affaires encaissé</p>
            <p className="amount mt-1 text-xl font-bold">{hide(revenue)}</p>
          </div>
          <div className="rounded-2xl bg-warn/10 p-3.5">
            <p className="flex items-center gap-1 text-xs text-warn">
              À mettre de côté ({Math.round(urssafRate * 1000) / 10} %)
            </p>
            <p className="amount mt-1 text-xl font-bold text-warn">{hide(provision.provision)}</p>
          </div>
          <div className="rounded-2xl bg-pos/10 p-3.5">
            <p className="text-xs text-pos">Réellement à toi</p>
            <p className="amount mt-1 text-xl font-bold text-pos">{hide(provision.net)}</p>
          </div>
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-ink-3">
          Estimation indicative : le taux de cotisations se règle dans les réglages du module
          professionnel. Elle ne remplace pas ta déclaration.
        </p>

        <div className="mt-4 flex flex-col gap-3">
          <ThresholdBar
            label="Franchise de TVA"
            status={vat}
            currency={currency}
            privacy={privacyMode}
            hint="Au-delà, la TVA devient facturable."
          />
          <ThresholdBar
            label="Plafond du régime"
            status={ceiling}
            currency={currency}
            privacy={privacyMode}
            hint="Au-delà, changement de régime fiscal."
          />
        </div>
      </Card>

      <Card delay={0.1}>
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
          <Briefcase size={17} className="text-accent-2" />
          Rentabilité par activité
        </h2>

        {perf.length === 0 ? (
          <p className="py-2 text-sm text-ink-3">
            Aucun mouvement pro sur la période. Rattache tes transactions à une activité pour voir
            laquelle rapporte vraiment.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {perf.map((row) => {
              const Icon = getIcon(row.activity?.icon ?? 'Briefcase');
              const color = row.activity?.color ?? '#82828e';
              const share = row.revenue > 0 ? Math.min(1, row.margin / row.revenue) : 0;
              return (
                <li key={row.activity?.id ?? 'sans-activite'}>
                  <div className="mb-1.5 flex items-center gap-2.5">
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                      style={{ background: `${color}22`, color }}
                    >
                      <Icon size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {row.activity?.label ?? 'Sans activité'}
                      </span>
                      <span className="text-[11px] text-ink-3">
                        {row.txCount} mouvement{row.txCount > 1 ? 's' : ''} · {hide(row.revenue)}{' '}
                        encaissés · {hide(row.expenses)} dépensés
                      </span>
                    </span>
                    <span
                      className={`amount shrink-0 text-sm font-semibold ${
                        row.margin >= 0 ? 'text-pos' : 'text-neg'
                      }`}
                    >
                      {hide(row.margin)}
                      {row.marginRate !== null && (
                        <span className="ml-1 text-[11px] font-normal text-ink-3">
                          {formatPct(row.marginRate)}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
                    <div
                      className={`h-full rounded-full transition-[width] duration-500 ${
                        row.margin >= 0 ? 'bg-pos' : 'bg-neg'
                      }`}
                      style={{ width: `${Math.abs(share) * 100}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function ThresholdBar({
  label,
  status,
  currency,
  privacy,
  hint,
}: {
  label: string;
  status: ThresholdStatus;
  currency: string;
  privacy: boolean;
  hint: string;
}) {
  const tone =
    status.level === 'over' ? 'text-neg' : status.level === 'warn' ? 'text-warn' : 'text-ink-2';
  const bar = status.level === 'over' ? 'bg-neg' : status.level === 'warn' ? 'bg-warn' : 'bg-accent';

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          {status.level !== 'ok' && <TriangleAlert size={13} className={tone} />}
          {label}
        </span>
        <span className={`amount text-xs font-semibold ${tone}`}>
          {privacy ? '•••' : formatCents(status.revenue, currency)}
          <span className="text-ink-3">
            {' / '}
            {privacy ? '•••' : formatCents(status.threshold, currency)}
          </span>
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={Math.round(status.ratio * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className="h-2 w-full overflow-hidden rounded-full bg-surface-2"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${bar}`}
          style={{ width: `${Math.min(100, status.ratio * 100)}%` }}
        />
      </div>
      <p className="mt-1 text-[11px] text-ink-3">
        {status.level === 'over'
          ? `Seuil dépassé de ${formatCents(-status.remaining, currency)}. ${hint}`
          : `${formatCents(status.remaining, currency)} avant le seuil. ${hint}`}
      </p>
    </div>
  );
}

/** Bandeau compact pour le Dashboard : la provision à mettre de côté. */
export function ProProvisionPill() {
  const txs = useTransactions();
  const { currency, privacyMode, urssafRate } = useSettings();
  const { provision } = useMemo(
    () => urssafProvision(txs, { urssafRate }),
    [txs, urssafRate],
  );

  if (provision <= 0) return null;

  return (
    <span className="flex items-center gap-1.5 rounded-full bg-warn/12 px-3 py-1 text-[11px] font-medium text-warn">
      <TrendingUp size={12} />
      {privacyMode ? '•••' : formatCents(provision, currency)} de cotisations à provisionner
    </span>
  );
}
