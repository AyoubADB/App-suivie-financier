import { Archive, Briefcase, Pencil, Plus, RotateCcw, Trash2, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useActivities, useRepo, useTransactions } from '../../context/DataContext';
import { CATEGORY_COLORS } from '../../data/seed';
import type { Activity } from '../../types';
import { IconPicker } from '../transactions/IconPicker';
import { Card } from '../ui/Card';
import { Modal } from '../ui/Modal';
import { getIcon } from '../ui/icons';

/**
 * Gestion des activités professionnelles. Une personne peut cumuler
 * plusieurs casquettes et vouloir suivre la rentabilité de chacune.
 */
export function ActivitiesCard() {
  const activities = useActivities();
  const txs = useTransactions();
  const repo = useRepo();
  const [editing, setEditing] = useState<Activity | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Activity | null>(null);

  const live = activities.filter((a) => !a.archived);
  const archived = activities.filter((a) => a.archived);

  /** Nombre de mouvements rattachés à chaque activité, pour prévenir avant suppression. */
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of txs) {
      if (t.activityId) map.set(t.activityId, (map.get(t.activityId) ?? 0) + 1);
    }
    return map;
  }, [txs]);

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Briefcase size={17} className="text-accent" />
          Mes activités
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

      {live.length === 0 ? (
        <p className="py-2 text-sm text-ink-3">
          Aucune activité. Crée-en une par casquette — « AYOVA Réparation », « Dev web », « Atelier
          LED » — pour suivre les revenus et dépenses de chacune séparément.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {live.map((a) => {
            const Icon = getIcon(a.icon);
            const n = counts.get(a.id) ?? 0;
            return (
              <li
                key={a.id}
                className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-surface-2/60"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: `${a.color}22`, color: a.color }}
                >
                  <Icon size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{a.label}</span>
                  <span className="text-[11px] text-ink-3">
                    {n} mouvement{n > 1 ? 's' : ''}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setEditing(a)}
                  aria-label={`Modifier ${a.label}`}
                  className="cursor-pointer p-2 text-ink-3 hover:text-ink"
                >
                  <Pencil size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => void repo.deleteActivity(a.id)}
                  aria-label={`Archiver ${a.label}`}
                  title="Archiver (réversible)"
                  className="cursor-pointer p-2 text-ink-3 hover:text-warn"
                >
                  <Archive size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleting(a)}
                  aria-label={`Supprimer ${a.label}`}
                  title="Supprimer définitivement"
                  className="cursor-pointer p-2 text-ink-3 hover:text-neg"
                >
                  <Trash2 size={15} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {archived.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-ink-3">
            {archived.length} activité{archived.length > 1 ? 's' : ''} archivée
            {archived.length > 1 ? 's' : ''}
          </summary>
          <ul className="mt-2 flex flex-col gap-1">
            {archived.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-2 py-1.5">
                <span className="min-w-0 flex-1 truncate text-sm text-ink-3">{a.label}</span>
                <button
                  type="button"
                  onClick={() => void repo.setActivity({ ...a, archived: false })}
                  className="flex cursor-pointer items-center gap-1 text-xs text-accent-2 hover:underline"
                >
                  <RotateCcw size={12} />
                  Réactiver
                </button>
                <button
                  type="button"
                  onClick={() => setDeleting(a)}
                  aria-label={`Supprimer ${a.label}`}
                  className="flex cursor-pointer items-center gap-1 text-xs text-ink-3 hover:text-neg"
                >
                  <Trash2 size={12} />
                  Supprimer
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="mt-3 text-[11px] text-ink-3">
        Archiver conserve l'historique : les transactions passées gardent leur activité. Supprimer
        efface l'activité pour de bon — les mouvements, eux, sont conservés.
      </p>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Nouvelle activité' : 'Modifier l’activité'}
      >
        {editing && (
          <ActivityForm
            key={editing === 'new' ? 'new' : editing.id}
            editing={editing === 'new' ? null : editing}
            onDelete={editing === 'new' ? undefined : () => setDeleting(editing)}
            onDone={() => setEditing(null)}
          />
        )}
      </Modal>

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Supprimer cette activité ?"
      >
        {deleting && (
          <DeleteConfirm
            activity={deleting}
            count={counts.get(deleting.id) ?? 0}
            onCancel={() => setDeleting(null)}
            onConfirm={async () => {
              await repo.purgeActivity(deleting.id);
              setDeleting(null);
              setEditing(null);
            }}
          />
        )}
      </Modal>
    </Card>
  );
}

/**
 * Confirmation explicite : la suppression est irréversible, mais elle ne
 * détruit aucun mouvement — ceux-ci sont simplement détachés de l'activité.
 */
function DeleteConfirm({
  activity,
  count,
  onCancel,
  onConfirm,
}: {
  activity: Activity;
  count: number;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-3 rounded-2xl border border-neg/30 bg-neg/8 p-4">
        <TriangleAlert size={18} className="mt-0.5 shrink-0 text-neg" />
        <div className="text-sm">
          <p className="font-medium">
            « {activity.label} » sera supprimée définitivement.
          </p>
          <p className="mt-1.5 text-ink-2">
            {count > 0
              ? `Les ${count} mouvement${count > 1 ? 's' : ''} rattaché${count > 1 ? 's' : ''} ne seront pas effacés : ils resteront dans ton historique, simplement sans activité.`
              : 'Aucun mouvement n’est rattaché à cette activité.'}{' '}
            Les échéances programmées de cette activité seront elles aussi détachées.
          </p>
          <p className="mt-1.5 text-ink-3">
            Si tu veux seulement la masquer sans perdre le lien, préfère l’archivage.
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="glass min-h-[48px] flex-1 cursor-pointer rounded-2xl text-sm font-medium"
        >
          Annuler
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void onConfirm().finally(() => setBusy(false));
          }}
          className="min-h-[48px] flex-1 cursor-pointer rounded-2xl bg-neg text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? 'Suppression…' : 'Supprimer définitivement'}
        </button>
      </div>
    </div>
  );
}

function ActivityForm({
  editing,
  onDelete,
  onDone,
}: {
  editing: Activity | null;
  onDelete?: () => void;
  onDone: () => void;
}) {
  const repo = useRepo();
  const [label, setLabel] = useState(editing?.label ?? '');
  const [color, setColor] = useState(editing?.color ?? CATEGORY_COLORS[0]);
  const [icon, setIcon] = useState(editing?.icon ?? 'Briefcase');
  const [error, setError] = useState('');

  async function submit() {
    if (!label.trim()) return setError('Donne un nom à cette activité.');
    setError('');
    await repo.setActivity({
      id: editing?.id,
      label: label.trim(),
      color,
      icon,
      archived: editing?.archived ?? false,
    });
    onDone();
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="flex flex-col gap-4"
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-ink-2">Nom de l’activité</span>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={60}
          autoFocus
          placeholder="Ex : AYOVA Réparation"
          className="min-h-[48px] w-full rounded-2xl border border-line bg-surface-2 px-4 text-base text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
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
          {editing ? 'Enregistrer' : 'Créer l’activité'}
        </button>
        {editing && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            aria-label="Supprimer définitivement"
            className="flex min-h-[48px] cursor-pointer items-center gap-1.5 rounded-2xl border border-neg/40 px-4 text-sm font-medium text-neg hover:bg-neg/10"
          >
            <Trash2 size={15} />
            Supprimer
          </button>
        )}
      </div>
    </form>
  );
}
