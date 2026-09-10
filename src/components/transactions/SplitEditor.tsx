import { Plus, Split, X } from 'lucide-react';
import { useMemo } from 'react';
import { LIMITS } from '../../logic/limits';
import { formatCents, parseAmountToCents } from '../../logic/money';
import type { Category, Scope, TransactionSplit, TxType } from '../../types';
import { CategoryPicker } from './CategoryPicker';

interface SplitEditorProps {
  /** Montant total de la transaction, en centimes. */
  amount: number;
  /** Catégorie principale : elle reçoit le reliquat non ventilé. */
  mainCategoryId: string;
  categories: Category[];
  scope: Scope;
  type: TxType;
  currency: string;
  splits: TransactionSplit[];
  onChange: (splits: TransactionSplit[]) => void;
}

/**
 * Ventilation d'une transaction sur plusieurs catégories.
 * Le reliquat reste sur la catégorie principale : on peut donc sortir
 * seulement la part qui nous intéresse d'un gros ticket, sans devoir
 * détailler tout le reste.
 */
export function SplitEditor({
  amount,
  mainCategoryId,
  categories,
  scope,
  type,
  currency,
  splits,
  onChange,
}: SplitEditorProps) {
  const allocated = useMemo(() => splits.reduce((acc, s) => acc + s.amount, 0), [splits]);
  const rest = amount - allocated;
  const mainCategory = categories.find((c) => c.id === mainCategoryId);
  const full = splits.length >= LIMITS.splitsPerTx;

  /**
   * Une nouvelle part sur la catégorie principale ne veut rien dire :
   * on propose la première autre catégorie compatible, à changer d'un clic.
   */
  const defaultSplitCategory = useMemo(() => {
    const candidate = categories.find(
      (c) =>
        c.id !== mainCategoryId &&
        (c.scope === 'both' || c.scope === scope) &&
        (c.type === 'both' || c.type === type),
    );
    return candidate?.id ?? mainCategoryId;
  }, [categories, mainCategoryId, scope, type]);

  function update(index: number, patch: Partial<TransactionSplit>) {
    onChange(splits.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  if (splits.length === 0) {
    return (
      <button
        type="button"
        onClick={() =>
          onChange([
            { categoryId: defaultSplitCategory, amount: Math.max(0, Math.round(amount / 2)) },
          ])
        }
        className="glass flex min-h-[44px] cursor-pointer items-center gap-2 self-start rounded-2xl px-4 text-sm font-medium text-ink-2 hover:text-ink"
      >
        <Split size={15} />
        Ventiler sur plusieurs catégories
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface-2/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Split size={15} className="text-accent-2" />
          Ventilation
        </p>
        <button
          type="button"
          onClick={() => onChange([])}
          className="cursor-pointer text-xs text-ink-3 hover:text-neg"
        >
          Tout retirer
        </button>
      </div>

      <ul className="flex flex-col gap-2">
        {splits.map((split, i) => (
          <li key={i} className="flex flex-wrap items-start gap-2">
            <div className="min-w-[180px] flex-1">
              <CategoryPicker
                categories={categories}
                value={split.categoryId}
                onChange={(categoryId) => update(i, { categoryId })}
                scope={scope}
                type={type}
              />
            </div>
            <div className="relative w-32">
              <input
                value={split.amount > 0 ? (split.amount / 100).toFixed(2).replace('.', ',') : ''}
                onChange={(e) =>
                  update(i, { amount: parseAmountToCents(e.target.value) ?? 0 })
                }
                inputMode="decimal"
                aria-label={`Montant de la part ${i + 1}`}
                placeholder="0,00"
                className="amount min-h-[44px] w-full rounded-2xl border border-line bg-surface px-3 pr-7 text-base focus:border-accent focus:outline-none"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-3">€</span>
            </div>
            <button
              type="button"
              onClick={() => onChange(splits.filter((_, j) => j !== i))}
              aria-label={`Retirer la part ${i + 1}`}
              className="flex h-11 w-9 cursor-pointer items-center justify-center rounded-xl text-ink-3 hover:text-neg"
            >
              <X size={16} />
            </button>
          </li>
        ))}
      </ul>

      {!full && (
        <button
          type="button"
          onClick={() => onChange([...splits, { categoryId: defaultSplitCategory, amount: 0 }])}
          className="flex cursor-pointer items-center gap-1.5 self-start text-xs font-medium text-accent-2 hover:underline"
        >
          <Plus size={13} />
          Ajouter une part
        </button>
      )}

      <p className={`text-[11px] ${rest < 0 ? 'text-neg' : 'text-ink-3'}`}>
        {rest < 0
          ? `La ventilation dépasse le montant de ${formatCents(-rest, currency)}.`
          : rest === 0
            ? 'Montant entièrement ventilé.'
            : `Reste ${formatCents(rest, currency)} sur « ${mainCategory?.label ?? 'la catégorie principale'} ».`}
      </p>
    </div>
  );
}
