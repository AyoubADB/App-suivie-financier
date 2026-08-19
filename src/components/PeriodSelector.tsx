import { AnimatePresence, motion } from 'framer-motion';
import { CalendarRange, ChevronDown, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { usePeriod } from '../context/PeriodContext';
import { PERIOD_LABELS, formatPeriodTitle, formatRangeLabel } from '../logic/dates';
import type { PeriodKind } from '../types';

const PRESETS: Array<Exclude<PeriodKind, 'custom'>> = ['day', 'week', 'month', 'quarter', 'year'];

/**
 * Une seule barre : navigation ← période → au centre, choix de la granularité
 * dans un menu déroulant. Remplace la rangée de 6 boutons côte à côte.
 */
export function PeriodSelector() {
  const { period, range, offset, customFrom, customTo, setPeriod, setCustom, shift, resetOffset } =
    usePeriod();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const navigable = period !== 'custom';

  return (
    <div ref={wrapRef} className="relative">
      <div className="glass flex items-center gap-1 rounded-2xl p-1">
        <button
          onClick={() => shift(-1)}
          disabled={!navigable}
          aria-label="Période précédente"
          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronLeft size={17} />
        </button>

        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-haspopup="dialog"
          className="flex min-h-[38px] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl px-2 transition-colors hover:bg-surface-2"
        >
          <span className="truncate text-sm font-semibold">{formatPeriodTitle(period, range)}</span>
          <ChevronDown
            size={14}
            className={`shrink-0 text-ink-3 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>

        <button
          onClick={() => shift(1)}
          disabled={!navigable || offset >= 0}
          aria-label="Période suivante"
          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronRight size={17} />
        </button>
      </div>

      {offset !== 0 && (
        <button
          onClick={resetOffset}
          className="mt-1.5 flex cursor-pointer items-center gap-1.5 px-1 text-[11px] text-accent-2 hover:underline"
        >
          <RotateCcw size={11} />
          Revenir à aujourd'hui
        </button>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Choisir la période"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="glass absolute left-0 right-0 top-full z-50 mt-2 origin-top rounded-2xl p-3 shadow-2xl"
          >
            <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
              Granularité
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    setPeriod(p);
                    setOpen(false);
                  }}
                  className={`min-h-[40px] cursor-pointer rounded-xl px-2 text-xs font-medium transition-colors ${
                    period === p
                      ? 'bg-gradient-flow text-white'
                      : 'bg-surface-2 text-ink-2 hover:text-ink'
                  }`}
                >
                  {PERIOD_LABELS[p]}
                </button>
              ))}
              <button
                onClick={() => setPeriod('custom')}
                className={`flex min-h-[40px] cursor-pointer items-center justify-center gap-1 rounded-xl px-2 text-xs font-medium transition-colors ${
                  period === 'custom'
                    ? 'bg-gradient-flow text-white'
                    : 'bg-surface-2 text-ink-2 hover:text-ink'
                }`}
              >
                <CalendarRange size={12} />
                Perso.
              </button>
            </div>

            {period === 'custom' && (
              <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
                <label className="flex items-center justify-between gap-2 text-xs text-ink-2">
                  Du
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => e.target.value && setCustom(e.target.value, customTo)}
                    className="rounded-lg border border-line bg-surface-2 px-2 py-1.5 text-xs text-ink"
                  />
                </label>
                <label className="flex items-center justify-between gap-2 text-xs text-ink-2">
                  au
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => e.target.value && setCustom(customFrom, e.target.value)}
                    className="rounded-lg border border-line bg-surface-2 px-2 py-1.5 text-xs text-ink"
                  />
                </label>
              </div>
            )}

            <p className="mt-3 border-t border-line pt-2 text-center text-[11px] text-ink-3">
              {formatRangeLabel(range)}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
