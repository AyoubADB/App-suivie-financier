import { AnimatePresence, motion } from 'framer-motion';
import { ImagePlus, Sparkles, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useBadges, useCategories, useRepo } from '../../context/DataContext';
import { type NewTransaction } from '../../data/repository';
import { suggestCategory } from '../../logic/categorizer';
import { FREQUENCY_LABELS, toISODate } from '../../logic/dates';
import { parseAmountToCents } from '../../logic/money';
import type { RecurringFrequency, Scope, Transaction, TxType } from '../../types';
import { BadgeChip } from '../ui/BadgeChip';
import { Segmented } from '../ui/Segmented';
import { IconPicker } from './IconPicker';
import { TxVisual } from './TxVisual';

interface TransactionFormProps {
  /** Scope pré-sélectionné ; reste modifiable dans le formulaire. */
  defaultScope: Scope;
  /** Transaction existante → mode édition. */
  editing?: Transaction | null;
  onSaved: () => void;
}

const FREQ_OPTIONS = (Object.keys(FREQUENCY_LABELS) as RecurringFrequency[]).map((f) => ({
  value: f,
  label: FREQUENCY_LABELS[f],
}));

/** Redimensionne une image en data-URL ≤ 256px (stockée en base64 dans IndexedDB). */
async function fileToDataUrl(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Lecture du fichier impossible'));
    reader.readAsDataURL(file);
  });
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Image invalide'));
    img.src = dataUrl;
  });
  const max = 256;
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  if (scale === 1 && file.size < 150_000) return dataUrl;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/webp', 0.85);
}

export function TransactionForm({ defaultScope, editing, onSaved }: TransactionFormProps) {
  const categories = useCategories();
  const badges = useBadges();
  const repo = useRepo();
  const fileInput = useRef<HTMLInputElement>(null);

  const [scope, setScope] = useState<Scope>(editing?.scope ?? defaultScope);
  const [type, setType] = useState<TxType>(editing?.type ?? 'expense');
  const [label, setLabel] = useState(editing?.label ?? '');
  const [amountText, setAmountText] = useState(
    editing ? (editing.amount / 100).toFixed(2).replace('.', ',') : '',
  );
  const [date, setDate] = useState(editing?.date ?? toISODate(new Date()));
  const [categoryId, setCategoryId] = useState(editing?.categoryId ?? 'cat-autre');
  const [isRecurring, setIsRecurring] = useState(editing?.isRecurring ?? false);
  const [frequency, setFrequency] = useState<RecurringFrequency>(
    editing?.recurringFrequency ?? 'monthly',
  );
  const [selectedBadges, setSelectedBadges] = useState<string[]>(editing?.badges ?? []);
  const [iconOverride, setIconOverride] = useState<string | undefined>(editing?.iconOverride);
  const [imageUrl, setImageUrl] = useState<string | undefined>(editing?.imageUrl);
  const [note, setNote] = useState(editing?.note ?? '');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [error, setError] = useState('');
  // L'utilisateur garde la main : une fois la catégorie choisie manuellement,
  // la suggestion ne l'écrase plus.
  const [userTouchedCategory, setUserTouchedCategory] = useState(!!editing);
  const [userTouchedRecurring, setUserTouchedRecurring] = useState(!!editing);

  const suggestion = useMemo(
    () => (label.trim().length >= 2 ? suggestCategory(label, { scope, type, categories }) : null),
    [label, scope, type, categories],
  );

  useEffect(() => {
    if (!suggestion) return;
    if (!userTouchedCategory) setCategoryId(suggestion.category.id);
    if (!userTouchedRecurring && suggestion.isRecurring) {
      setIsRecurring(true);
      if (suggestion.frequency) setFrequency(suggestion.frequency);
    }
  }, [suggestion, userTouchedCategory, userTouchedRecurring]);

  const category = categories.find((c) => c.id === categoryId);
  const availableCategories = categories.filter(
    (c) => (c.scope === 'both' || c.scope === scope) && (c.type === 'both' || c.type === type),
  );

  async function onPickImage(file: File | undefined) {
    if (!file) return;
    try {
      setImageUrl(await fileToDataUrl(file));
    } catch {
      setError("Impossible de lire cette image.");
    }
  }

  async function submit() {
    const amount = parseAmountToCents(amountText);
    if (!label.trim()) return setError('Ajoute un libellé.');
    if (amount === null || amount <= 0) return setError('Montant invalide (ex : 12,99).');
    setError('');
    const payload: NewTransaction = {
      type,
      scope,
      amount,
      currency: localStorage.getItem('flow.currency') ?? 'EUR',
      label: label.trim(),
      categoryId,
      date,
      isRecurring,
      recurringFrequency: isRecurring ? frequency : undefined,
      iconOverride,
      imageUrl,
      badges: selectedBadges,
      note: note.trim() || undefined,
    };
    if (editing) await repo.updateTransaction(editing.id, payload);
    else await repo.addTransaction(payload);
    onSaved();
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          options={[
            { value: 'expense', label: 'Dépense' },
            { value: 'revenue', label: 'Revenu' },
          ]}
          value={type}
          onChange={(t) => setType(t)}
          size="sm"
        />
        <Segmented
          options={[
            { value: 'perso', label: 'Perso' },
            { value: 'pro', label: 'Pro' },
          ]}
          value={scope}
          onChange={(s) => setScope(s)}
          size="sm"
        />
      </div>

      {/* Libellé → catégorisation auto */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setShowIconPicker((s) => !s)}
          className="cursor-pointer"
          aria-label="Choisir une icône"
        >
          <TxVisual tx={{ iconOverride, imageUrl }} category={category} size={48} />
        </button>
        <input
          autoFocus={!editing}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={type === 'expense' ? 'Ex : Netflix, Loyer, Courses…' : 'Ex : Client HOUSELAND…'}
          className="min-h-[48px] w-full rounded-2xl border border-line bg-surface-2 px-4 text-base text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
        />
      </div>

      {suggestion && !userTouchedCategory && suggestion.category.id !== 'cat-autre' && (
        <p className="flex items-center gap-1.5 text-xs text-accent-2">
          <Sparkles size={13} />
          Suggestion : {suggestion.category.label}
          {suggestion.isRecurring && ' · abonnement détecté'}
        </p>
      )}

      <AnimatePresence>
        {showIconPicker && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-col gap-2 overflow-hidden"
          >
            <IconPicker
              value={iconOverride ?? category?.icon}
              onChange={(name) => {
                setIconOverride(name);
                setImageUrl(undefined);
              }}
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="glass flex min-h-[40px] cursor-pointer items-center gap-2 rounded-full px-4 text-xs font-medium text-ink-2 hover:text-ink"
              >
                <ImagePlus size={15} />
                Image custom
              </button>
              {(imageUrl || iconOverride) && (
                <button
                  type="button"
                  onClick={() => {
                    setImageUrl(undefined);
                    setIconOverride(undefined);
                  }}
                  className="flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-full px-3 text-xs text-ink-3 hover:text-neg"
                >
                  <Trash2 size={14} />
                  Réinitialiser
                </button>
              )}
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => void onPickImage(e.target.files?.[0])}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Montant + date */}
      <div className="grid grid-cols-2 gap-3">
        <div className="relative">
          <input
            value={amountText}
            onChange={(e) => setAmountText(e.target.value)}
            inputMode="decimal"
            placeholder="0,00"
            aria-label="Montant"
            className="amount min-h-[48px] w-full rounded-2xl border border-line bg-surface-2 px-4 pr-8 text-lg text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
          />
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-3">€</span>
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          aria-label="Date"
          className="min-h-[48px] w-full rounded-2xl border border-line bg-surface-2 px-4 text-sm text-ink focus:border-accent focus:outline-none"
        />
      </div>

      {/* Catégorie */}
      <select
        value={categoryId}
        onChange={(e) => {
          setCategoryId(e.target.value);
          setUserTouchedCategory(true);
        }}
        aria-label="Catégorie"
        className="min-h-[48px] w-full cursor-pointer rounded-2xl border border-line bg-surface-2 px-4 text-sm text-ink focus:border-accent focus:outline-none"
      >
        {availableCategories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>

      {/* Récurrence */}
      <div className="glass flex flex-wrap items-center justify-between gap-2 rounded-2xl px-4 py-3">
        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={isRecurring}
            onChange={(e) => {
              setIsRecurring(e.target.checked);
              setUserTouchedRecurring(true);
            }}
            className="h-5 w-5 cursor-pointer accent-[var(--flow-accent)]"
          />
          Abonnement / récurrent
        </label>
        {isRecurring && (
          <Segmented options={FREQ_OPTIONS} value={frequency} onChange={setFrequency} size="sm" />
        )}
      </div>

      {/* Badges */}
      {badges.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {badges.map((b) => (
            <BadgeChip
              key={b.id}
              badge={b}
              size="md"
              active={selectedBadges.includes(b.id)}
              onClick={() =>
                setSelectedBadges((sel) =>
                  sel.includes(b.id) ? sel.filter((id) => id !== b.id) : [...sel, b.id],
                )
              }
            />
          ))}
        </div>
      )}

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (optionnel)"
        rows={2}
        className="w-full rounded-2xl border border-line bg-surface-2 px-4 py-3 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
      />

      {error && <p className="text-sm text-neg">{error}</p>}

      <button
        type="submit"
        className="bg-gradient-flow min-h-[52px] w-full cursor-pointer rounded-2xl text-base font-semibold text-white shadow-lg shadow-accent/25 transition-transform active:scale-[0.98]"
      >
        {editing ? 'Enregistrer' : 'Ajouter'}
      </button>
    </form>
  );
}
