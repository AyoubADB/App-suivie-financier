import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * Renvoi d'une carte du tableau de bord vers sa page détaillée.
 * Discret par défaut : la carte reste lisible seule, le lien n'est là que
 * pour qui veut creuser ou modifier.
 */
export function DetailLink({ to, label = 'Détail' }: { to: string; label?: string }) {
  return (
    <Link
      to={to}
      className="flex min-h-[36px] shrink-0 cursor-pointer items-center gap-0.5 rounded-full px-2 text-xs font-medium text-ink-3 transition-colors hover:text-accent-2"
    >
      {label}
      <ChevronRight size={14} />
    </Link>
  );
}
