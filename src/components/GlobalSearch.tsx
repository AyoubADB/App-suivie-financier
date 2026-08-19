import { AnimatePresence, motion } from 'framer-motion';
import { CornerDownLeft, RefreshCcw, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useBadges, useCategories, useTransactions } from '../context/DataContext';
import { normalize } from '../logic/categorizer';
import { fromISODate } from '../logic/dates';
import { formatCents } from '../logic/money';
import type { Transaction } from '../types';
import { TxVisual } from './transactions/TxVisual';

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
  onPick: (tx: Transaction) => void;
}

/**
 * Recherche transverse : ignore la période et le scope courants,
 * cherche dans les libellés, notes, catégories et badges de tout l'historique.
 */
export function GlobalSearch({ open, onClose, onPick }: GlobalSearchProps) {
  const txs = useTransactions();
  const categories = useCategories();
  const badges = useBadges();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const badgeById = useMemo(() => new Map(badges.map((b) => [b.id, b])), [badges]);

  useEffect(() => {
    if (open) {
      setQuery('');
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const results = useMemo(() => {
    const q = normalize(query.trim());
    if (q.length < 1) return [];
    return txs
      .filter((tx) => {
        const cat = catById.get(tx.categoryId)?.label ?? '';
        const badgeLabels = tx.badges.map((b) => badgeById.get(b)?.label ?? '').join(' ');
        return normalize(`${tx.label} ${tx.note ?? ''} ${cat} ${badgeLabels}`).includes(q);
      })
      .slice(0, 40);
  }, [query, txs, catById, badgeById]);

  const total = results.reduce(
    (acc, tx) => acc + (tx.type === 'expense' ? tx.amount : -tx.amount),
    0,
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 px-4 pt-[8vh] backdrop-blur-sm"
        >
          <motion.div
            role="dialog"
            aria-label="Recherche globale"
            initial={{ opacity: 0, y: -16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.98 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            className="glass flex max-h-[75vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl shadow-2xl"
          >
            <div className="flex items-center gap-3 border-b border-line px-4 py-3">
              <Search size={18} className="shrink-0 text-ink-3" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Chercher partout : Netflix, loyer, client…"
                className="min-h-[40px] w-full bg-transparent text-base text-ink placeholder:text-ink-3 focus:outline-none"
              />
              <button
                onClick={onClose}
                aria-label="Fermer"
                className="shrink-0 cursor-pointer text-ink-3 hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {query.trim().length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-ink-3">
                  Cherche dans tout l'historique, toutes périodes et scopes confondus.
                </p>
              ) : results.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-ink-3">
                  Aucun résultat pour « {query} ».
                </p>
              ) : (
                <ul className="flex flex-col gap-0.5">
                  {results.map((tx) => (
                    <li key={tx.id}>
                      <button
                        onClick={() => {
                          onPick(tx);
                          onClose();
                        }}
                        className="flex w-full cursor-pointer items-center gap-3 rounded-2xl px-2 py-2 text-left transition-colors hover:bg-surface-2"
                      >
                        <TxVisual tx={tx} category={catById.get(tx.categoryId)} size={38} />
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                            {tx.label}
                            {tx.isRecurring && (
                              <RefreshCcw size={11} className="shrink-0 text-accent-2" />
                            )}
                          </p>
                          <p className="truncate text-[11px] text-ink-3">
                            {tx.scope === 'perso' ? 'Perso' : 'Pro'} ·{' '}
                            {catById.get(tx.categoryId)?.label ?? 'Autre'} ·{' '}
                            {fromISODate(tx.date).toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </p>
                        </div>
                        <span
                          className={`amount shrink-0 text-sm font-semibold ${tx.type === 'revenue' ? 'text-pos' : ''}`}
                        >
                          {tx.type === 'revenue' ? '+' : '−'}
                          {formatCents(tx.amount, tx.currency)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {results.length > 0 && (
              <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5 text-[11px] text-ink-3">
                <span>
                  {results.length} résultat{results.length > 1 ? 's' : ''}
                </span>
                <span className="amount">
                  Net : {total >= 0 ? '−' : '+'}
                  {formatCents(Math.abs(total))}
                </span>
                <span className="hidden items-center gap-1 sm:flex">
                  <CornerDownLeft size={11} /> pour ouvrir
                </span>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
