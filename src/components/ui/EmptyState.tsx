import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  hint?: string;
}

export function EmptyState({ icon: Icon, title, hint }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <div className="bg-gradient-flow flex h-14 w-14 items-center justify-center rounded-2xl text-white opacity-80">
        <Icon size={26} />
      </div>
      <p className="font-medium text-ink-2">{title}</p>
      {hint && <p className="max-w-xs text-sm text-ink-3">{hint}</p>}
    </div>
  );
}
