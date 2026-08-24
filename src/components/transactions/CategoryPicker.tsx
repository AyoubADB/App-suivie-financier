import { Check, ChevronDown, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { normalize } from '../../logic/categorizer';
import type { Category, Scope, TxType } from '../../types';
import { getIcon } from '../ui/icons';

interface CategoryPickerProps {
  categories: Category[];
  value: string;
  onChange: (categoryId: string) => void;
  scope: Scope;
  type: TxType;
}

/**
 * Remplace le `<select>` natif, dont la liste déroulante était trop courte
 * pour se parcourir et masquait les catégories des autres portées.
 * Les catégories pertinentes sont proposées d'abord, les autres restent
 * accessibles plus bas — rien n'est caché.
 */
export function CategoryPicker({ categories, value, onChange, scope, type }: CategoryPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => inputRef.current?.focus());
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

  const { suggested, others } = useMemo(() => {
    const q = normalize(query);
    const matches = (c: Category) =>
      !q || normalize(c.label).includes(q) || c.keywords.some((k) => normalize(k).includes(q));
    const fits = (c: Category) =>
      (c.scope === 'both' || c.scope === scope) && (c.type === 'both' || c.type === type);

    const all = categories.filter(matches).sort((a, b) => a.label.localeCompare(b.label, 'fr'));
    return { suggested: all.filter(fits), others: all.filter((c) => !fits(c)) };
  }, [categories, query, scope, type]);

  const selected = categories.find((c) => c.id === value);
  const SelectedIcon = getIcon(selected?.icon ?? 'Tags');

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex min-h-[48px] w-full cursor-pointer items-center gap-3 rounded-2xl border border-line bg-surface-2 px-4 text-left transition-colors hover:border-line-strong"
      >
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
          style={{
            background: `${selected?.color ?? '#82828e'}22`,
            color: selected?.color ?? '#82828e',
          }}
        >
          <SelectedIcon size={14} />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm">
          {selected?.label ?? 'Choisir une catégorie'}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-ink-3 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute inset-x-0 top-full z-50 mt-1.5 overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl"
        >
          <div className="flex items-center gap-2 border-b border-line px-3 py-2">
            <Search size={15} className="shrink-0 text-ink-3" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filtrer les catégories…"
              className="min-h-[34px] w-full bg-transparent text-sm text-ink placeholder:text-ink-3 focus:outline-none"
            />
          </div>

          <div className="max-h-64 overflow-y-auto p-1.5">
            {suggested.length === 0 && others.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-ink-3">
                Aucune catégorie ne correspond. Crée-la depuis Réglages → Catégories.
              </p>
            )}

            {suggested.map((c) => (
              <Row key={c.id} cat={c} selected={c.id === value} onPick={pick} />
            ))}

            {others.length > 0 && (
              <>
                <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-ink-3">
                  Autres portées
                </p>
                {others.map((c) => (
                  <Row key={c.id} cat={c} selected={c.id === value} onPick={pick} muted />
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );

  function pick(id: string) {
    onChange(id);
    setQuery('');
    setOpen(false);
  }
}

function Row({
  cat,
  selected,
  onPick,
  muted = false,
}: {
  cat: Category;
  selected: boolean;
  onPick: (id: string) => void;
  muted?: boolean;
}) {
  const Icon = getIcon(cat.icon);
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={() => onPick(cat.id)}
      className={`flex min-h-[42px] w-full cursor-pointer items-center gap-3 rounded-xl px-2.5 text-left transition-colors hover:bg-surface-2 ${
        selected ? 'bg-surface-2' : ''
      } ${muted ? 'opacity-70' : ''}`}
    >
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
        style={{ background: `${cat.color}22`, color: cat.color }}
      >
        <Icon size={14} />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm">{cat.label}</span>
      <span className="shrink-0 text-[10px] text-ink-3">
        {cat.scope === 'both' ? 'perso + pro' : cat.scope}
      </span>
      {selected && <Check size={15} className="shrink-0 text-accent-2" />}
    </button>
  );
}
