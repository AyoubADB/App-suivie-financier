import { Percent } from 'lucide-react';
import { formatCents, parseAmountToCents } from '../../logic/money';
import { VAT_RATES, VAT_RATE_LABELS, vatFromTtc } from '../../logic/vat';
import { Switch } from '../ui/Switch';

interface VatFieldProps {
  /** Montant TTC saisi, en centimes. */
  amount: number;
  currency: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  rate: number;
  onRateChange: (rate: number) => void;
  /** TVA en centimes ; null tant qu'elle suit automatiquement le taux. */
  override: number | null;
  onOverrideChange: (cents: number | null) => void;
}

/**
 * Séparation HT / TVA d'une transaction.
 * Le montant saisi reste le TTC — c'est lui qui quitte le compte — et la
 * TVA en est déduite, avec possibilité de la corriger à la main quand la
 * facture affiche un arrondi différent.
 */
export function VatField({
  amount,
  currency,
  enabled,
  onToggle,
  rate,
  onRateChange,
  override,
  onOverrideChange,
}: VatFieldProps) {
  const computed = vatFromTtc(amount, rate);
  const vat = override ?? computed;
  const ht = Math.max(0, amount - vat);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface-2/40 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Percent size={15} className="text-accent-2" />
            Séparer la TVA
          </p>
          <p className="mt-0.5 text-[11px] text-ink-3">
            Isole le hors-taxes et la TVA à partir du montant TTC.
          </p>
        </div>
        <Switch checked={enabled} onChange={onToggle} label="Séparer la TVA" size="sm" />
      </div>

      {enabled && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {VAT_RATES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  onRateChange(r);
                  onOverrideChange(null);
                }}
                title={VAT_RATE_LABELS[r]}
                aria-pressed={rate === r}
                className={`min-h-[40px] cursor-pointer rounded-full px-3.5 text-xs font-semibold transition-colors ${
                  rate === r
                    ? 'bg-gradient-flow text-white'
                    : 'border border-line bg-surface text-ink-2 hover:text-ink'
                }`}
              >
                {r === 0 ? 'Exonéré' : `${String(r).replace('.', ',')} %`}
              </button>
            ))}
          </div>

          <p className="text-[11px] leading-relaxed text-ink-3">{VAT_RATE_LABELS[rate]}</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-surface px-3 py-2.5">
              <p className="text-[11px] text-ink-3">Hors taxes</p>
              <p className="amount text-base font-semibold">{formatCents(ht, currency)}</p>
            </div>
            <label className="rounded-xl bg-surface px-3 py-2.5">
              <span className="text-[11px] text-ink-3">TVA</span>
              <input
                value={(vat / 100).toFixed(2).replace('.', ',')}
                onChange={(e) => {
                  const parsed = parseAmountToCents(e.target.value);
                  onOverrideChange(parsed === null ? null : Math.min(parsed, amount));
                }}
                inputMode="decimal"
                aria-label="Montant de TVA"
                className="amount w-full border-0 bg-transparent p-0 text-base font-semibold text-ink focus:outline-none"
              />
            </label>
          </div>

          {override !== null && override !== computed && (
            <button
              type="button"
              onClick={() => onOverrideChange(null)}
              className="cursor-pointer self-start text-[11px] text-accent-2 hover:underline"
            >
              Recalculer depuis le taux ({formatCents(computed, currency)})
            </button>
          )}
        </>
      )}
    </div>
  );
}
