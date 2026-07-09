import { motion, useAnimation } from 'framer-motion';
import { RefreshCcw, Trash2 } from 'lucide-react';
import type { Badge, Category, Transaction } from '../../types';
import { formatCents } from '../../logic/money';
import { BadgeChip } from '../ui/BadgeChip';
import { TxVisual } from './TxVisual';

interface TransactionItemProps {
  tx: Transaction;
  category?: Category;
  badges: Badge[];
  onEdit: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
  showScope?: boolean;
}

/** Ligne de transaction — tap pour éditer, swipe gauche (mobile) pour supprimer. */
export function TransactionItem({
  tx,
  category,
  badges,
  onEdit,
  onDelete,
  showScope = false,
}: TransactionItemProps) {
  const controls = useAnimation();
  const txBadges = badges.filter((b) => tx.badges.includes(b.id));
  const negative = tx.type === 'expense';

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Zone révélée par le swipe */}
      <div className="absolute inset-y-0 right-0 flex w-24 items-center justify-center bg-neg/90">
        <Trash2 size={20} className="text-white" />
      </div>
      <motion.div
        drag="x"
        dragConstraints={{ left: -96, right: 0 }}
        dragElastic={0.05}
        animate={controls}
        onDragEnd={(_, info) => {
          if (info.offset.x < -70) onDelete(tx);
          else void controls.start({ x: 0 });
        }}
        onClick={() => onEdit(tx)}
        className="relative flex min-h-[64px] cursor-pointer items-center gap-3 bg-surface px-3 py-2.5 transition-colors hover:bg-surface-2"
      >
        <TxVisual tx={tx} category={category} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium">{tx.label}</p>
            {tx.isRecurring && <RefreshCcw size={12} className="shrink-0 text-accent-2" />}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-ink-3">{category?.label ?? 'Autre'}</span>
            {showScope && (
              <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium uppercase text-ink-3">
                {tx.scope}
              </span>
            )}
            {txBadges.map((b) => (
              <BadgeChip key={b.id} badge={b} />
            ))}
          </div>
        </div>
        <div className="text-right">
          <p className={`amount text-sm font-semibold ${negative ? 'text-ink' : 'text-pos'}`}>
            {negative ? '−' : '+'}
            {formatCents(tx.amount, tx.currency)}
          </p>
          <p className="text-[11px] text-ink-3">
            {new Date(tx.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
          </p>
        </div>
        {/* Poubelle visible au survol sur desktop (pas de swipe à la souris) */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(tx);
          }}
          aria-label={`Supprimer ${tx.label}`}
          className="hidden h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-neg/15 hover:text-neg md:flex"
        >
          <Trash2 size={16} />
        </button>
      </motion.div>
    </div>
  );
}
