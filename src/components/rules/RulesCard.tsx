import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, Wand2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  useActivities,
  useBadges,
  useCategories,
  useRepo,
  useRules,
  useTransactions,
} from '../../context/DataContext';
import { useSettings } from '../../context/SettingsContext';
import { parseAmountToCents } from '../../logic/money';
import { describeRule, ruleChangesFor } from '../../logic/rules';
import type { Rule, RuleField, RuleOperator, Scope, TxType } from '../../types';
import { BadgeChip } from '../ui/BadgeChip';
import { Card } from '../ui/Card';
import { Modal } from '../ui/Modal';
import { Segmented } from '../ui/Segmented';
import { Switch } from '../ui/Switch';

/**
 * Règles de catégorisation personnalisées.
 * Les mots-clés d'une catégorie couvrent le cas général ; une règle traite
 * le cas particulier — « ce virement précis, c'est un loyer » — et prime.
 */
export function RulesCard() {
  const rules = useRules();
  const categories = useCategories();
  const badges = useBadges();
  const activities = useActivities();
  const txs = useTransactions();
  const repo = useRepo();
  const [editing, setEditing] = useState<Rule | 'new' | null>(null);
  const [applied, setApplied] = useState('');

  const sorted = useMemo(() => [...rules].sort((a, b) => a.order - b.order), [rules]);

  /** Ce qu'une passe rétroactive changerait, calculé avant de proposer le bouton. */
  const pendingChanges = useMemo(
    () => txs.filter((tx) => ruleChangesFor(rules, tx) !== null).length,
    [txs, rules],
  );

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= sorted.length) return;
    const a = sorted[index];
    const b = sorted[target];
    await repo.setRule({ ...a, order: b.order });
    await repo.setRule({ ...b, order: a.order });
  }

  async function applyToHistory() {
    const targets = txs
      .map((tx) => ({ tx, patch: ruleChangesFor(rules, tx) }))
      .filter((row): row is { tx: (typeof txs)[number]; patch: Partial<(typeof txs)[number]> } =>
        row.patch !== null,
      );
    if (targets.length === 0) return;
    if (
      !window.confirm(
        `Appliquer les règles à ${targets.length} mouvement${targets.length > 1 ? 's' : ''} déjà enregistré${targets.length > 1 ? 's' : ''} ? Les catégories et badges concernés seront réécrits.`,
      )
    ) {
      return;
    }
    for (const { tx, patch } of targets) await repo.updateTransaction(tx.id, patch);
    setApplied(
      `${targets.length} mouvement${targets.length > 1 ? 's' : ''} mis à jour.`,
    );
  }

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Wand2 size={17} className="text-accent" />
          Règles de catégorisation
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

      {sorted.length === 0 ? (
        <p className="py-2 text-sm text-ink-3">
          Aucune règle. Une règle traite ce que les mots-clés ne devinent pas : « si le libellé
          contient VIR DUPONT, alors catégorie Loyer et badge Déductible ». Elles s'appliquent à la
          saisie comme à l'import.
        </p>
      ) : (
        <ul className="flex flex-col">
          {sorted.map((rule, i) => {
            const { condition, actions } = describeRule(rule, {
              category: categories.find((c) => c.id === rule.categoryId)?.label,
              activity: activities.find((a) => a.id === rule.activityId)?.label,
              badges: rule.addBadges
                .map((id) => badges.find((b) => b.id === id)?.label)
                .filter((l): l is string => !!l),
            });
            return (
              <li
                key={rule.id}
                className="flex items-center gap-2 border-b border-line py-2.5 last:border-0"
              >
                <span className="flex shrink-0 flex-col">
                  <button
                    type="button"
                    onClick={() => void move(i, -1)}
                    disabled={i === 0}
                    aria-label={`Monter ${rule.label}`}
                    className="cursor-pointer px-1 text-ink-3 hover:text-ink disabled:opacity-25"
                  >
                    <ArrowUp size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void move(i, 1)}
                    disabled={i === sorted.length - 1}
                    aria-label={`Descendre ${rule.label}`}
                    className="cursor-pointer px-1 text-ink-3 hover:text-ink disabled:opacity-25"
                  >
                    <ArrowDown size={12} />
                  </button>
                </span>

                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-medium ${rule.active ? '' : 'text-ink-3'}`}>
                    {rule.label}
                  </p>
                  <p className="text-[11px] text-ink-3">
                    {condition}
                    {actions.length > 0 && `, alors ${actions.join(' · ')}`}
                  </p>
                </div>

                <Switch
                  checked={rule.active}
                  onChange={(active) => void repo.setRule({ ...rule, active })}
                  label={`Activer ${rule.label}`}
                  size="sm"
                />
                <button
                  type="button"
                  onClick={() => setEditing(rule)}
                  aria-label={`Modifier ${rule.label}`}
                  className="cursor-pointer p-2 text-ink-3 hover:text-ink"
                >
                  <Pencil size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Supprimer la règle « ${rule.label} » ?`))
                      void repo.deleteRule(rule.id);
                  }}
                  aria-label={`Supprimer ${rule.label}`}
                  className="cursor-pointer p-2 text-ink-3 hover:text-neg"
                >
                  <Trash2 size={15} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {sorted.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void applyToHistory()}
            disabled={pendingChanges === 0}
            className="glass flex min-h-[40px] cursor-pointer items-center gap-2 rounded-2xl px-4 text-xs font-medium disabled:opacity-50"
          >
            <Wand2 size={14} />
            {pendingChanges === 0
              ? 'Historique déjà à jour'
              : `Appliquer à ${pendingChanges} mouvement${pendingChanges > 1 ? 's' : ''} existant${pendingChanges > 1 ? 's' : ''}`}
          </button>
          {applied && <span className="text-xs text-pos">{applied}</span>}
        </div>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-ink-3">
        Les règles sont évaluées de haut en bas. La première qui impose une catégorie l'emporte ;
        les badges de toutes les règles qui correspondent s'ajoutent.
      </p>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Nouvelle règle' : 'Modifier la règle'}
      >
        {editing && (
          <RuleForm
            key={editing === 'new' ? 'new' : editing.id}
            editing={editing === 'new' ? null : editing}
            nextOrder={sorted.length > 0 ? Math.max(...sorted.map((r) => r.order)) + 1 : 0}
            onDone={() => setEditing(null)}
          />
        )}
      </Modal>
    </Card>
  );
}

const FIELD_OPTIONS: Array<{ value: RuleField; label: string }> = [
  { value: 'label', label: 'Libellé' },
  { value: 'note', label: 'Note' },
  { value: 'amount', label: 'Montant' },
];

const TEXT_OPERATORS: Array<{ value: RuleOperator; label: string }> = [
  { value: 'contains', label: 'contient' },
  { value: 'startsWith', label: 'commence par' },
  { value: 'equals', label: 'est exactement' },
];

const AMOUNT_OPERATORS: Array<{ value: RuleOperator; label: string }> = [
  { value: 'gt', label: 'supérieur à' },
  { value: 'lt', label: 'inférieur à' },
  { value: 'equals', label: 'égal à' },
];

function RuleForm({
  editing,
  nextOrder,
  onDone,
}: {
  editing: Rule | null;
  nextOrder: number;
  onDone: () => void;
}) {
  const repo = useRepo();
  const categories = useCategories();
  const badges = useBadges();
  const activities = useActivities().filter((a) => !a.archived);
  const { proEnabled } = useSettings();

  const [label, setLabel] = useState(editing?.label ?? '');
  const [field, setField] = useState<RuleField>(editing?.field ?? 'label');
  const [operator, setOperator] = useState<RuleOperator>(editing?.operator ?? 'contains');
  const [value, setValue] = useState(
    editing?.field === 'amount'
      ? (Number(editing.value) / 100).toFixed(2).replace('.', ',')
      : (editing?.value ?? ''),
  );
  const [type, setType] = useState<TxType | 'all'>(editing?.type ?? 'all');
  const [scope, setScope] = useState<Scope | 'all'>(editing?.scope ?? 'all');
  const [categoryId, setCategoryId] = useState(editing?.categoryId ?? '');
  const [addBadges, setAddBadges] = useState<string[]>(editing?.addBadges ?? []);
  const [activityId, setActivityId] = useState(editing?.activityId ?? '');
  const [renameTo, setRenameTo] = useState(editing?.renameTo ?? '');
  const [markRecurring, setMarkRecurring] = useState(editing?.markRecurring ?? false);
  const [error, setError] = useState('');

  const operators = field === 'amount' ? AMOUNT_OPERATORS : TEXT_OPERATORS;

  function changeField(next: RuleField) {
    setField(next);
    // Un opérateur de texte n'a aucun sens sur un montant, et inversement.
    setOperator(next === 'amount' ? 'gt' : 'contains');
    setValue('');
  }

  async function submit() {
    if (!label.trim()) return setError('Donne un nom à cette règle.');
    let stored = value.trim();
    if (field === 'amount') {
      const cents = parseAmountToCents(stored);
      if (cents === null) return setError('Montant de comparaison invalide (ex : 50).');
      stored = String(cents);
    } else if (!stored) {
      return setError('Indique le texte à rechercher.');
    }
    if (!categoryId && addBadges.length === 0 && !activityId && !renameTo.trim() && !markRecurring) {
      return setError('Une règle doit faire au moins une chose : catégorie, badge, activité…');
    }
    setError('');
    await repo.setRule({
      id: editing?.id,
      label: label.trim(),
      active: editing?.active ?? true,
      order: editing?.order ?? nextOrder,
      field,
      operator,
      value: stored,
      type: type === 'all' ? undefined : type,
      scope: scope === 'all' ? undefined : scope,
      categoryId: categoryId || undefined,
      addBadges,
      activityId: activityId || undefined,
      renameTo: renameTo.trim() || undefined,
      markRecurring: markRecurring || undefined,
    });
    onDone();
  }

  const inputClass =
    'min-h-[48px] w-full rounded-2xl border border-line bg-surface-2 px-4 text-base text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none';
  const selectClass =
    'min-h-[48px] w-full cursor-pointer rounded-2xl border border-line bg-surface-2 px-4 text-sm';

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="flex flex-col gap-4"
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-ink-2">Nom de la règle</span>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={80}
          autoFocus
          placeholder="Ex : Loyer mensuel"
          className={inputClass}
        />
      </label>

      <fieldset className="flex flex-col gap-3 rounded-2xl border border-line bg-surface-2/40 p-3">
        <legend className="px-1 text-xs font-medium text-ink-2">Condition</legend>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-ink-2">Champ testé</span>
            <select
              value={field}
              onChange={(e) => changeField(e.target.value as RuleField)}
              className={selectClass}
            >
              {FIELD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-ink-2">Comparateur</span>
            <select
              value={operator}
              onChange={(e) => setOperator(e.target.value as RuleOperator)}
              className={selectClass}
            >
              {operators.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-ink-2">
            {field === 'amount' ? 'Montant de comparaison' : 'Texte recherché'}
          </span>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={140}
            inputMode={field === 'amount' ? 'decimal' : 'text'}
            placeholder={field === 'amount' ? '50' : 'Ex : VIR DUPONT'}
            className={`${field === 'amount' ? 'amount ' : ''}${inputClass}`}
          />
          {field !== 'amount' && (
            <span className="text-[11px] text-ink-3">
              La casse et les accents sont ignorés.
            </span>
          )}
        </label>

        <div className="flex flex-wrap gap-2">
          <Segmented
            options={[
              { value: 'all', label: 'Tous' },
              { value: 'expense', label: 'Dépenses' },
              { value: 'revenue', label: 'Revenus' },
            ]}
            value={type}
            onChange={setType}
            size="sm"
          />
          {proEnabled && (
            <Segmented
              options={[
                { value: 'all', label: 'Partout' },
                { value: 'perso', label: 'Perso' },
                { value: 'pro', label: 'Pro' },
              ]}
              value={scope}
              onChange={setScope}
              size="sm"
            />
          )}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3 rounded-2xl border border-line bg-surface-2/40 p-3">
        <legend className="px-1 text-xs font-medium text-ink-2">Alors</legend>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-ink-2">Catégorie</span>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className={selectClass}
          >
            <option value="">— ne pas changer —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        {badges.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-ink-2">Badges à ajouter</span>
            <div className="flex flex-wrap gap-1.5">
              {badges.map((b) => (
                <BadgeChip
                  key={b.id}
                  badge={b}
                  size="md"
                  active={addBadges.includes(b.id)}
                  onClick={() =>
                    setAddBadges((sel) =>
                      sel.includes(b.id) ? sel.filter((id) => id !== b.id) : [...sel, b.id],
                    )
                  }
                />
              ))}
            </div>
          </div>
        )}

        {proEnabled && activities.length > 0 && (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-ink-2">Activité (mouvements pro)</span>
            <select
              value={activityId}
              onChange={(e) => setActivityId(e.target.value)}
              className={selectClass}
            >
              <option value="">— ne pas changer —</option>
              {activities.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-ink-2">Renommer le libellé (optionnel)</span>
          <input
            value={renameTo}
            onChange={(e) => setRenameTo(e.target.value)}
            maxLength={140}
            placeholder="Ex : Loyer"
            className={inputClass}
          />
          <span className="text-[11px] text-ink-3">
            Pratique face aux libellés bruts des relevés : « CB CARREFOUR 4567 » devient
            « Carrefour ».
          </span>
        </label>

        <div className="flex items-center justify-between gap-4">
          <span className="text-sm">Marquer comme récurrent</span>
          <Switch
            checked={markRecurring}
            onChange={setMarkRecurring}
            label="Marquer comme récurrent"
            size="sm"
          />
        </div>
      </fieldset>

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
          {editing ? 'Enregistrer' : 'Créer la règle'}
        </button>
        {editing && (
          <button
            type="button"
            onClick={() => {
              void repo.deleteRule(editing.id);
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
