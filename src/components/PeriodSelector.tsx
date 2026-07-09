import { AnimatePresence, motion } from 'framer-motion';
import { CalendarRange } from 'lucide-react';
import { useState } from 'react';
import { usePeriod } from '../context/PeriodContext';
import { PERIOD_LABELS, formatRangeLabel } from '../logic/dates';
import type { PeriodKind } from '../types';

const PRESETS: Array<Exclude<PeriodKind, 'custom'>> = ['day', 'week', 'month', 'quarter', 'year'];

/** Sélecteur de période (prédéfini + personnalisé), réutilisé partout. */
export function PeriodSelector() {
  const { period, range, customFrom, customTo, setPeriod, setCustom } = usePeriod();
  const [showCustom, setShowCustom] = useState(period === 'custom');

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {PRESETS.map((p) => (
          <button
            key={p}
            onClick={() => {
              setPeriod(p);
              setShowCustom(false);
            }}
            className={`min-h-[36px] shrink-0 cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
              period === p
                ? 'bg-gradient-flow text-white'
                : 'glass text-ink-2 hover:text-ink'
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
        <button
          onClick={() => setShowCustom((s) => !s)}
          aria-expanded={showCustom}
          className={`min-h-[36px] shrink-0 cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
            period === 'custom' ? 'bg-gradient-flow text-white' : 'glass text-ink-2 hover:text-ink'
          }`}
        >
          <span className="inline-flex items-center gap-1.5">
            <CalendarRange size={13} />
            Personnalisé
          </span>
        </button>
        <span className="ml-2 hidden shrink-0 text-xs text-ink-3 sm:inline">
          {formatRangeLabel(range)}
        </span>
      </div>
      <AnimatePresence>
        {showCustom && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="glass flex flex-wrap items-center gap-2 rounded-2xl p-3 text-sm">
              <label className="flex items-center gap-2 text-xs text-ink-2">
                Du
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => e.target.value && setCustom(e.target.value, customTo)}
                  className="rounded-lg border border-line bg-surface-2 px-2 py-1.5 text-sm text-ink"
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-ink-2">
                au
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => e.target.value && setCustom(customFrom, e.target.value)}
                  className="rounded-lg border border-line bg-surface-2 px-2 py-1.5 text-sm text-ink"
                />
              </label>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
