import { Minus, PiggyBank, Plus } from 'lucide-react';
import { useState } from 'react';
import { useGoals, useRepo } from '../../context/DataContext';
import { useSettings } from '../../context/SettingsContext';
import { CATEGORY_COLORS } from '../../data/seed';
import { fromISODate, toISODate } from '../../logic/dates';
import { formatCents, parseAmountToCents } from '../../logic/money';
import type { SavingsGoal } from '../../types';
import { IconPicker } from '../transactions/IconPicker';
import { Card } from '../ui/Card';
import { DetailLink } from '../ui/DetailLink';
import { Modal } from '../ui/Modal';
import { getIcon } from '../ui/icons';

/** Projets d'épargne : montant visé, progression et effort mensuel restant. */
export function GoalsCard({ detailTo }: { detailTo?: string } = {}) {
  const goals = useGoals();
  const repo = useRepo();
  const { currency, privacyMode } = useSettings();
  const [editing, setEditing] = useState<SavingsGoal | 'new' | null>(null);

  return (
    <Card delay={0.26}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <PiggyBank size={17} className="text-accent-2" />
          Objectifs d'épargne
        </h2>
        <span className="flex shrink-0 items-center gap-1">
          {detailTo && <DetailLink to={detailTo} />}
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="glass flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-xs font-medium"
          >
            <Plus size={14} />
            Nouveau
          </button>
        </span>
      </div>

      {goals.length === 0 ? (
        <p className="py-3 text-sm text-ink-3">
          Aucun objectif. Fixe un montant et une échéance — « 3 000 € pour juin » — et l'app calcule
          l'effort mensuel nécessaire.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {goals.map((g) => {
            const Icon = getIcon(g.icon);
            const ratio = g.target > 0 ? Math.min(1, g.saved / g.target) : 0;
            const remaining = Math.max(0, g.target - g.saved);
            const months = monthsUntil(g.deadline);
            const perMonth = months && months > 0 ? Math.ceil(remaining / months) : null;
            const done = g.saved >= g.target;

            return (
              <li key={g.id}>
                <div className="mb-1.5 flex items-center gap-2.5">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: `${g.color}22`, color: g.color }}
                  >
                    <Icon size={15} />
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditing(g)}
                    className="min-w-0 flex-1 cursor-pointer truncate text-left text-sm font-medium hover:underline"
                  >
                    {g.label}
                  </button>
                  <span className="amount shrink-0 text-xs font-semibold text-ink-2">
                    {privacyMode ? '•••' : formatCents(g.saved, currency)}
                    <span className="text-ink-3">
                      {' / '}
                      {privacyMode ? '•••' : formatCents(g.target, currency)}
                    </span>
                  </span>
                </div>

                <div
                  role="progressbar"
                  aria-valuenow={Math.round(ratio * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Objectif ${g.label}`}
                  className="h-2 w-full overflow-hidden rounded-full bg-surface-2"
                >
                  <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{ width: `${ratio * 100}%`, background: g.color }}
                  />
                </div>

                <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] text-ink-3">
                    {done
                      ? '🎉 Objectif atteint'
                      : perMonth
                        ? `${formatCents(perMonth, currency)}/mois pendant ${months} mois`
                        : `${formatCents(remaining, currency)} restants`}
                    {g.deadline &&
                      !done &&
                      ` · avant le ${fromISODate(g.deadline).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}`}
                  </p>

                  <div className="flex items-center gap-1">
                    <QuickAdd
                      label={`Retirer de ${g.label}`}
                      icon={Minus}
                      onClick={() =>
                        void repo.setGoal({ ...g, saved: Math.max(0, g.saved - 5000) })
                      }
                    />
                    <QuickAdd
                      label={`Ajouter à ${g.label}`}
                      icon={Plus}
                      onClick={() => void repo.setGoal({ ...g, saved: g.saved + 5000 })}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Nouvel objectif' : "Modifier l'objectif"}
      >
        {editing && (
          <GoalForm
            key={editing === 'new' ? 'new' : editing.id}
            editing={editing === 'new' ? null : editing}
            onDone={() => setEditing(null)}
          />
        )}
      </Modal>
    </Card>
  );
}

function QuickAdd({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: typeof Plus;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title="Par pas de 50 €"
      className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg bg-surface-2 text-ink-3 transition-colors hover:text-ink"
    >
      <Icon size={13} />
    </button>
  );
}

function GoalForm({ editing, onDone }: { editing: SavingsGoal | null; onDone: () => void }) {
  const repo = useRepo();
  const [label, setLabel] = useState(editing?.label ?? '');
  const [targetText, setTargetText] = useState(
    editing ? (editing.target / 100).toFixed(2).replace('.', ',') : '',
  );
  const [savedText, setSavedText] = useState(
    editing ? (editing.saved / 100).toFixed(2).replace('.', ',') : '0',
  );
  const [deadline, setDeadline] = useState(editing?.deadline ?? '');
  const [color, setColor] = useState(editing?.color ?? CATEGORY_COLORS[4]);
  const [icon, setIcon] = useState(editing?.icon ?? 'PiggyBank');
  const [error, setError] = useState('');

  async function submit() {
    const target = parseAmountToCents(targetText);
    const saved = parseAmountToCents(savedText) ?? 0;
    if (!label.trim()) return setError('Donne un nom à cet objectif.');
    if (target === null || target <= 0) return setError('Montant cible invalide (ex : 3000).');
    setError('');
    await repo.setGoal({
      id: editing?.id,
      label: label.trim(),
      target,
      saved,
      deadline: deadline || undefined,
      color,
      icon,
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
        <span className="text-xs text-ink-2">Nom du projet</span>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={80}
          autoFocus
          placeholder="Ex : Vacances en Italie"
          className={inputClass}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-ink-2">Montant visé</span>
          <input
            value={targetText}
            onChange={(e) => setTargetText(e.target.value)}
            inputMode="decimal"
            placeholder="3000"
            className={`amount ${inputClass}`}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-ink-2">Déjà mis de côté</span>
          <input
            value={savedText}
            onChange={(e) => setSavedText(e.target.value)}
            inputMode="decimal"
            className={`amount ${inputClass}`}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-ink-2">Échéance (optionnelle)</span>
        <input
          type="date"
          value={deadline}
          min={toISODate(new Date())}
          onChange={(e) => setDeadline(e.target.value)}
          className={inputClass}
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-ink-2">Couleur</span>
        <div className="flex flex-wrap items-center gap-2">
          {CATEGORY_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Couleur ${c}`}
              onClick={() => setColor(c)}
              style={{ background: c }}
              className={`h-8 w-8 cursor-pointer rounded-full transition-transform ${
                color === c ? 'scale-110 ring-2 ring-ink ring-offset-2 ring-offset-surface' : ''
              }`}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-ink-2">Icône</span>
        <IconPicker value={icon} onChange={setIcon} />
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
          {editing ? 'Enregistrer' : "Créer l'objectif"}
        </button>
        {editing && (
          <button
            type="button"
            onClick={() => {
              void repo.deleteGoal(editing.id);
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

/** Nombre de mois pleins jusqu'à l'échéance, null si absente ou dépassée. */
function monthsUntil(deadline?: string): number | null {
  if (!deadline) return null;
  const target = fromISODate(deadline);
  const now = new Date();
  const months =
    (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth());
  return months > 0 ? months : null;
}
