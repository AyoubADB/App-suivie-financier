import { ICON_NAMES, ICONS } from '../ui/icons';

interface IconPickerProps {
  value?: string;
  onChange: (name: string) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  return (
    <div className="grid max-h-48 grid-cols-8 gap-1 overflow-y-auto rounded-2xl border border-line bg-surface-2 p-2">
      {ICON_NAMES.map((name) => {
        const Icon = ICONS[name];
        const active = value === name;
        return (
          <button
            key={name}
            type="button"
            title={name}
            onClick={() => onChange(name)}
            className={`flex h-9 w-full cursor-pointer items-center justify-center rounded-xl transition-colors ${
              active ? 'bg-gradient-flow text-white' : 'text-ink-2 hover:bg-surface hover:text-ink'
            }`}
          >
            <Icon size={17} />
          </button>
        );
      })}
    </div>
  );
}
