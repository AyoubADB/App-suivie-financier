import { CalendarClock, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import {
  useActivities,
  useCategories,
  useRepo,
  useScheduled,
} from '../../context/DataContext';
import { useSettings } from '../../context/SettingsContext';
import { formatCents, parseAmountToCents } from '../../logic/money';
import { initialLastGenerated } from '../../logic/scheduled';
import type { Scope, ScheduledEntry, TxType } from '../../types';
import { CategoryPicker } from '../transactions/CategoryPicker';
import { Card } from '../ui/Card';
import { Modal } from '../ui/Modal';
import { Segmented } from '../ui/Segmented';
import { Switch } from '../ui/Switch';
import { getIcon } from '../ui/icons';

/**
 * Échéances récurrentes à montant variable : salaire, loyer, prélèvement.
 * Contrairement à un abonnement, rien n'est créé automatiquement — l'app
 * propose l'écriture le jour venu et attend une confirmation.
 */
export function ScheduledCard() {
  const scheduled = useScheduled();
  const categories = useCategories();
  const repo = useRepo();
  const { currency, proEnabled } = useSettings();
  const [editing, setEditing] = useState<ScheduledEntry | 'new' | null>(null);

  const catById = new Map(categories.map((c) => [c.id, c]));

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <CalendarClock size={17} className="text-accent" />
          Échéances récurrentes
        </h2>
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="glass flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-full px-4 text-xs font-medium"
        >
          <Plus size={14} />
          Nouvelle
        </button>
      </div>

      {scheduled.length === 0 ? (
        <p className="py-2 text-sm text-ink-3">
          Aucune échéance. Programme ton salaire et ton loyer : le jour venu, l'app te propose
          l'écriture, tu ajustes le montant réel et tu valides en un geste.
        </p>
      ) : (
        <ul className="flex flex-col">
          {scheduled.map((s) => {
            const cat = catById.get(s.categoryId);
            const Icon = getIcon(cat?.icon ?? 'CalendarClock');
            return (
              <li
                key={s.id}
                className="flex min-h-[56px] items-center gap-3 border-b border-line py-2 last:border-0"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  style={{
                    background: `${cat?.color ?? '#82828e'}22`,
                    color: cat?.color ?? '#82828e',
                  }}
                >
                  <Icon size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-medium ${s.active ? '' : 'text-ink-3'}`}>
                    {s.label}
                  </p>
                  <p className="text-[11px] text-ink-3">
                    le {s.dayOfMonth} de chaque mois · {s.type === 'revenue' ? 'revenu' : 'dépense'}
                    {proEnabled && ` · ${s.scope}`}
                    {!s.active && ' · en pause'}
                  </p>
                </div>
                <span
                  className={`amount shrink-0 text-sm font-semibold ${
                    s.type === 'revenue' ? 'text-pos' : ''
                  }`}
                >
                  {formatCents(s.amount, currency)}
                </span>
                <button
                  type="button"
                  onClick={() => setEditing(s)}
                  aria-label={`Modifier ${s.label}`}
                  className="cursor-pointer p-2 text-ink-3 hover:text-ink"
                >
                  <Pencil size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Supprimer l'échéance « ${s.label} » ?`))
                      void repo.deleteScheduled(s.id);
                  }}
                  aria-label={`Supprimer ${s.label}`}
                  className="cursor-pointer p-2 text-ink-3 hover:text-neg"
                >
                  <Trash2 size={15} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Nouvelle échéance' : "Modifier l'échéance"}
      >
        {editing && (
          <ScheduledForm
            key={editing === 'new' ? 'new' : editing.id}
            editing={editing === 'new' ? null : editing}
            onDone={() => setEditing(null)}
          />
        )}
      </Modal>
    </Card>
  );
}

function ScheduledForm({
  editing,
  onDone,
}: {
  editing: ScheduledEntry | null;
  onDone: () => void;
}) {
  const repo = useRepo();
  const categories = useCategories();
  const activities = useActivities().filter((a) => !a.archived);
  const { proEnabled } = useSettings();

  const [label, setLabel] = useState(editing?.label ?? '');
  const [type, setType] = useState<TxType>(editing?.type ?? 'expense');
  const [scope, setScope] = useState<Scope>(editing?.scope ?? 'perso');
  const [categoryId, setCategoryId] = useState(editing?.categoryId ?? 'cat-autre');
  const [activityId, setActivityId] = useState(editing?.activityId ?? '');
  const [amountText, setAmountText] = useState(
    editing ? (editing.amount / 100).toFixed(2).replace('.', ',') : '',
  );
  const [dayOfMonth, setDayOfMonth] = useState(editing?.dayOfMonth ?? 1);
  const [active, setActive] = useState(editing?.active ?? true);
  const [error, setError] = useState('');

  async function submit() {
    const amount = parseAmountToCents(amountText);
    if (!label.trim()) return setError('Donne un nom à cette échéance.');
    if (amount === null || amount <= 0) return setError('Montant attendu invalide (ex : 1800).');
    setError('');
    await repo.setScheduled({
      id: editing?.id,
      label: label.trim(),
      type,
      scope,
      categoryId,
      activityId: scope === 'pro' && activityId ? activityId : undefined,
      amount,
      dayOfMonth,
      lastGenerated: editing?.lastGenerated ?? initialLastGenerated(dayOfMonth),
      active,
    });
    onDone();
  }

  const inputClass =
    'min-h-[48px] w-full rounded-2xl border border-line bg-surface-2 px-4 text-base text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none';

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="flex flex-col gap-4"
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-ink-2">Libellé</span>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={80}
          autoFocus
          placeholder="Ex : Salaire, Loyer"
          className={inputClass}
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <Segmented
          options={[
            { value: 'expense', label: 'Dépense' },
            { value: 'revenue', label: 'Revenu' },
          ]}
          value={type}
          onChange={setType}
          size="sm"
        />
        {proEnabled && (
          <Segmented
            options={[
              { value: 'perso', label: 'Perso' },
              { value: 'pro', label: 'Pro' },
            ]}
            value={scope}
            onChange={setScope}
            size="sm"
          />
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-ink-2">Catégorie</span>
        <CategoryPicker
          categories={categories}
          value={categoryId}
          onChange={setCategoryId}
          scope={scope}
          type={type}
        />
      </div>

      {proEnabled && scope === 'pro' && activities.length > 0 && (
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-ink-2">Activité</span>
          <select
            value={activityId}
            onChange={(e) => setActivityId(e.target.value)}
            className="min-h-[48px] w-full cursor-pointer rounded-2xl border border-line bg-surface-2 px-4 text-sm"
          >
            <option value="">Aucune</option>
            {activities.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-ink-2">Montant attendu</span>
          <input
            value={amountText}
            onChange={(e) => setAmountText(e.target.value)}
            inputMode="decimal"
            placeholder="1800"
            className={`amount ${inputClass}`}
          />
          <span className="text-[11px] text-ink-3">Ajustable à chaque confirmation.</span>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-ink-2">Jour du mois</span>
          <select
            value={dayOfMonth}
            onChange={(e) => setDayOfMonth(Number(e.target.value))}
            className="min-h-[48px] w-full cursor-pointer rounded-2xl border border-line bg-surface-2 px-4 text-sm"
          >
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-ink-3">Limité à 28 pour exister tous les mois.</span>
        </label>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-surface-2/50 p-4">
        <div>
          <p className="text-sm font-medium">Échéance active</p>
          <p className="mt-0.5 text-xs text-ink-3">
            En pause, elle ne propose plus rien mais reste enregistrée.
          </p>
        </div>
        <Switch checked={active} onChange={setActive} label="Échéance active" size="sm" />
      </div>

      {error && (
        <p role="alert" className="text-xs text-neg">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          className="bg-gradient-flow min-h-[48px] flex-1 cursor-pointer rounded-2xl font-semibold text-white"
        >
          {editing ? 'Enregistrer' : "Créer l'échéance"}
        </button>
        {editing && (
          <button
            type="button"
            onClick={() => {
              void repo.deleteScheduled(editing.id);
              onDone();
            }}
            className="min-h-[48px] cursor-pointer rounded-2xl border border-neg/40 px-5 text-sm font-medium text-neg hover:bg-neg/10"
          >
            Supprimer
          </button>
        )}
      </div>
    </form>
  );
}
