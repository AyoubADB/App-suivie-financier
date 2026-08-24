import { AnimatePresence, motion } from 'framer-motion';
import { Check, Pencil, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRepo, useScheduled } from '../../context/DataContext';
import { useSettings } from '../../context/SettingsContext';
import { fromISODate } from '../../logic/dates';
import { formatCents, parseAmountToCents } from '../../logic/money';
import { occurrenceToTransaction, pendingOccurrences } from '../../logic/scheduled';
import type { PendingOccurrence } from '../../types';
import { Card } from '../ui/Card';

/**
 * Échéances tombées depuis la dernière visite, à confirmer ou ajuster.
 * Un salaire varie d'un mois à l'autre : on propose le montant attendu
 * plutôt que de le créer en silence.
 */
export function PendingQueue() {
  const scheduled = useScheduled();
  const repo = useRepo();
  const { currency } = useSettings();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [adjusting, setAdjusting] = useState<string | null>(null);
  const [amountText, setAmountText] = useState('');

  const pending = useMemo(
    () =>
      pendingOccurrences(scheduled).filter((o) => !dismissed.includes(key(o))),
    [scheduled, dismissed],
  );

  if (pending.length === 0) return null;

  async function confirm(occ: PendingOccurrence, amount: number) {
    await repo.addTransaction(occurrenceToTransaction(occ, amount, currency));
    await repo.setScheduled({ ...occ.entry, lastGenerated: occ.monthKey });
    setAdjusting(null);
  }

  async function skip(occ: PendingOccurrence) {
    await repo.setScheduled({ ...occ.entry, lastGenerated: occ.monthKey });
    setDismissed((d) => [...d, key(occ)]);
  }

  return (
    <Card className="border-accent/30">
      <h2 className="mb-3 text-base font-semibold">
        {pending.length} échéance{pending.length > 1 ? 's' : ''} à confirmer
      </h2>

      <ul className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {pending.map((occ) => {
            const k = key(occ);
            const isAdjusting = adjusting === k;
            const isRevenue = occ.entry.type === 'revenue';

            return (
              <motion.li
                key={k}
                layout
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                className="rounded-2xl border border-line bg-surface-2/50 p-3"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg ${
                      isRevenue ? 'bg-pos/12 text-pos' : 'bg-neg/12 text-neg'
                    }`}
                  >
                    {isRevenue ? '↓' : '↑'}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{occ.entry.label}</p>
                    <p className="text-xs text-ink-3">
                      prévu le{' '}
                      {fromISODate(occ.dateISO).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                      })}
                    </p>
                  </div>

                  {!isAdjusting && (
                    <span
                      className={`amount shrink-0 text-sm font-semibold ${isRevenue ? 'text-pos' : ''}`}
                    >
                      {formatCents(occ.entry.amount, currency)}
                    </span>
                  )}
                </div>

                {isAdjusting ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <input
                      value={amountText}
                      onChange={(e) => setAmountText(e.target.value)}
                      inputMode="decimal"
                      autoFocus
                      aria-label="Montant réel"
                      className="amount min-h-[44px] flex-1 rounded-xl border border-line bg-surface px-3 text-base focus:border-accent focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const amount = parseAmountToCents(amountText);
                        if (amount && amount > 0) void confirm(occ, amount);
                      }}
                      className="bg-gradient-flow min-h-[44px] cursor-pointer rounded-xl px-4 text-sm font-semibold text-white"
                    >
                      Valider
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdjusting(null)}
                      className="min-h-[44px] cursor-pointer px-2 text-sm text-ink-3 hover:text-ink"
                    >
                      Annuler
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => void confirm(occ, occ.entry.amount)}
                      className="bg-gradient-flow flex min-h-[40px] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl text-sm font-semibold text-white"
                    >
                      <Check size={15} />
                      Confirmer
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAdjusting(k);
                        setAmountText((occ.entry.amount / 100).toFixed(2).replace('.', ','));
                      }}
                      className="glass flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl px-3.5 text-sm font-medium text-ink-2"
                    >
                      <Pencil size={14} />
                      Ajuster
                    </button>
                    <button
                      type="button"
                      onClick={() => void skip(occ)}
                      aria-label="Ignorer cette échéance"
                      className="flex min-h-[40px] w-10 cursor-pointer items-center justify-center rounded-xl text-ink-3 hover:text-ink"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </Card>
  );
}

function key(occ: PendingOccurrence): string {
  return `${occ.entry.id}:${occ.monthKey}`;
}
