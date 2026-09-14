import { useActivities } from '../../context/DataContext';
import { getIcon } from '../ui/icons';

/** Valeur du filtre quand aucune activité n'est isolée. */
export const ALL_ACTIVITIES = '__all__';

/**
 * Choix d'une activité professionnelle, ou de toutes.
 *
 * Cumuler plusieurs casquettes n'a d'intérêt que si on peut les regarder
 * séparément : la moyenne de deux activités ne décrit aucune des deux.
 */
export function ActivityFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const activities = useActivities().filter((a) => !a.archived);
  if (activities.length === 0) return null;

  return (
    <div className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
      <Chip active={value === ALL_ACTIVITIES} onClick={() => onChange(ALL_ACTIVITIES)}>
        Toutes les activités
      </Chip>
      {activities.map((activity) => {
        const Icon = getIcon(activity.icon);
        return (
          <Chip
            key={activity.id}
            active={value === activity.id}
            onClick={() => onChange(activity.id)}
          >
            <Icon size={13} style={{ color: value === activity.id ? undefined : activity.color }} />
            {activity.label}
          </Chip>
        );
      })}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active}
      className={`flex min-h-[36px] shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-xs font-medium transition-colors ${
        active ? 'bg-surface-2 text-ink ring-1 ring-line' : 'text-ink-3 hover:text-ink-2'
      }`}
    >
      {children}
    </button>
  );
}
