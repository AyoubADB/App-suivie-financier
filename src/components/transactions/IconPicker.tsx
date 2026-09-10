import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { normalize } from '../../logic/categorizer';
import { ICONS, ICON_GROUPS } from '../ui/icons';

interface IconPickerProps {
  value?: string;
  onChange: (name: string) => void;
}

/**
 * Sélecteur d'icônes groupé par thème, avec recherche.
 * Le catalogue dépasse les 250 entrées : une grille à plat obligerait à
 * faire défiler à l'aveugle, surtout au doigt.
 */
export function IconPicker({ value, onChange }: IconPickerProps) {
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    const q = normalize(query);
    if (!q) return ICON_GROUPS;
    return ICON_GROUPS.map((g) => ({
      label: g.label,
      icons: g.icons.filter((name) => normalize(name).includes(q)),
    })).filter((g) => g.icons.length > 0);
  }, [query]);

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Chercher une icône (car, food, home…)"
          aria-label="Chercher une icône"
          className="min-h-[44px] w-full rounded-2xl border border-line bg-surface-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
        />
      </div>

      <div className="max-h-56 overflow-y-auto overscroll-contain rounded-2xl border border-line bg-surface-2 p-2">
        {groups.length === 0 ? (
          <p className="px-1 py-3 text-xs text-ink-3">Aucune icône pour « {query} ».</p>
        ) : (
          groups.map((group) => (
            <section key={group.label} className="mb-2 last:mb-0">
              <h4 className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-ink-3">
                {group.label}
              </h4>
              <div className="grid grid-cols-7 gap-1 sm:grid-cols-9">
                {group.icons.map((name) => {
                  const Icon = ICONS[name];
                  const active = value === name;
                  return (
                    <button
                      type="button"
                      key={`${group.label}-${name}`}
                      title={name}
                      aria-label={name}
                      aria-pressed={active}
                      onClick={() => onChange(name)}
                      className={`flex h-10 w-full cursor-pointer items-center justify-center rounded-xl transition-colors ${
                        active
                          ? 'bg-gradient-flow text-white'
                          : 'text-ink-2 hover:bg-surface hover:text-ink'
                      }`}
                    >
                      <Icon size={18} />
                    </button>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
