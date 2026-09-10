import {
  Briefcase,
  CalendarDays,
  Pencil,
  Percent,
  RefreshCcw,
  Receipt,
  Split,
  Tag,
  Trash2,
  User,
} from 'lucide-react';
import { useActivities, useBadges, useCategories } from '../../context/DataContext';
import { useSettings } from '../../context/SettingsContext';
import { categoryParts } from '../../logic/analytics';
import { FREQUENCY_LABELS, fromISODate } from '../../logic/dates';
import { formatCents } from '../../logic/money';
import type { Transaction } from '../../types';
import { BadgeChip } from '../ui/BadgeChip';
import { getIcon } from '../ui/icons';

interface TransactionDetailProps {
  tx: Transaction;
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * Aperçu en lecture seule d'une transaction. L'image ou l'icône est mise en
 * avant : c'est ce qui rend une ligne reconnaissable d'un coup d'œil.
 */
export function TransactionDetail({ tx, onEdit, onDelete }: TransactionDetailProps) {
  const categories = useCategories();
  const badges = useBadges();
  const activities = useActivities();
  const { privacyMode } = useSettings();

  const category = categories.find((c) => c.id === tx.categoryId);
  const activity = activities.find((a) => a.id === tx.activityId);
  const txBadges = badges.filter((b) => tx.badges.includes(b.id));
  const Icon = getIcon(tx.iconOverride ?? category?.icon ?? 'Tags');
  const accent = category?.color ?? '#82828e';
  const isRevenue = tx.type === 'revenue';
  const parts = tx.splits?.length ? categoryParts(tx) : null;

  return (
    <div className="flex flex-col gap-5">
      {/* Visuel + montant */}
      <div className="flex flex-col items-center gap-3 text-center">
        {tx.imageUrl ? (
          <img
            src={tx.imageUrl}
            alt=""
            className="h-28 w-28 rounded-3xl object-cover ring-1 ring-line"
          />
        ) : (
          <span
            className="flex h-28 w-28 items-center justify-center rounded-3xl"
            style={{ background: `${accent}1f`, color: accent }}
          >
            <Icon size={48} strokeWidth={1.5} />
          </span>
        )}

        <div>
          <h3 className="text-lg font-semibold">{tx.label}</h3>
          <p
            className={`amount mt-1 text-3xl font-bold ${isRevenue ? 'text-pos' : 'text-ink'}`}
          >
            {privacyMode ? '•••••' : `${isRevenue ? '+' : '−'}${formatCents(tx.amount, tx.currency)}`}
          </p>
        </div>

        {tx.isRecurring && (
          <span className="flex items-center gap-1.5 rounded-full bg-accent/12 px-3 py-1 text-xs font-medium text-accent-2">
            <RefreshCcw size={12} />
            {tx.recurringFrequency ? FREQUENCY_LABELS[tx.recurringFrequency] : 'Récurrent'}
            {tx.nextDueDate &&
              ` · prochaine le ${fromISODate(tx.nextDueDate).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
              })}`}
          </span>
        )}
      </div>

      {/* Détails */}
      <dl className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface-2/50">
        <Row icon={CalendarDays} label="Date">
          {fromISODate(tx.date).toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </Row>

        <Row icon={Tag} label="Catégorie">
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: accent }} />
            {parts ? `${parts.length} catégories` : (category?.label ?? 'Autre')}
          </span>
        </Row>

        {tx.vatAmount !== undefined && (
          <Row icon={Percent} label="Dont TVA">
            {privacyMode ? '•••' : formatCents(tx.vatAmount, tx.currency)}
            {tx.vatRate !== undefined && (
              <span className="text-ink-3"> · {String(tx.vatRate).replace('.', ',')} %</span>
            )}
          </Row>
        )}

        {tx.vatAmount !== undefined && (
          <Row icon={Percent} label="Hors taxes">
            {privacyMode ? '•••' : formatCents(tx.amount - tx.vatAmount, tx.currency)}
          </Row>
        )}

        <Row icon={tx.scope === 'pro' ? Briefcase : User} label="Portée">
          {tx.scope === 'pro' ? 'Professionnel' : 'Personnel'}
          {activity && ` · ${activity.label}`}
        </Row>
      </dl>

      {parts && (
        <div className="rounded-2xl border border-line bg-surface-2/50 px-4 py-3">
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-3">
            <Split size={12} />
            Ventilation
          </p>
          <ul className="flex flex-col gap-1.5">
            {parts.map((part, i) => {
              const cat = categories.find((c) => c.id === part.categoryId);
              return (
                <li key={`${part.categoryId}-${i}`} className="flex items-center gap-2 text-sm">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: cat?.color ?? '#82828e' }}
                  />
                  <span className="min-w-0 flex-1 truncate text-ink-2">
                    {cat?.label ?? 'Autre'}
                  </span>
                  <span className="amount shrink-0 font-medium">
                    {privacyMode ? '•••' : formatCents(part.amount, tx.currency)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {tx.receiptUrl && (
        <div className="rounded-2xl border border-line bg-surface-2/50 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-3">
            <Receipt size={12} />
            Justificatif
          </p>
          <a href={tx.receiptUrl} target="_blank" rel="noreferrer">
            <img
              src={tx.receiptUrl}
              alt="Justificatif de la transaction"
              className="max-h-72 w-full rounded-xl object-contain"
            />
          </a>
        </div>
      )}

      {txBadges.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {txBadges.map((b) => (
            <BadgeChip key={b.id} badge={b} size="md" />
          ))}
        </div>
      )}

      {tx.note && (
        <div className="rounded-2xl border border-line bg-surface-2/50 px-4 py-3">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-3">Note</p>
          <p className="whitespace-pre-wrap text-sm text-ink-2">{tx.note}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="bg-gradient-flow flex min-h-[48px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl font-semibold text-white transition-transform active:scale-[0.99]"
        >
          <Pencil size={17} />
          Modifier
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Supprimer la transaction"
          className="flex min-h-[48px] w-14 cursor-pointer items-center justify-center rounded-2xl border border-neg/40 text-neg transition-colors hover:bg-neg/10"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Tag;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Icon size={15} className="shrink-0 text-ink-3" />
      <dt className="text-sm text-ink-3">{label}</dt>
      <dd className="ml-auto text-right text-sm font-medium">{children}</dd>
    </div>
  );
}
