import type { Badge } from '../../types';
import { getIcon } from './icons';

interface BadgeChipProps {
  badge: Badge;
  active?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md';
}

export function BadgeChip({ badge, active = true, onClick, size = 'sm' }: BadgeChipProps) {
  const Icon = badge.icon ? getIcon(badge.icon) : null;
  const pad = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1.5 text-xs min-h-[36px]';
  const style = active
    ? { backgroundColor: `${badge.color}26`, color: badge.color, borderColor: `${badge.color}55` }
    : undefined;
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag
      // Sans `type`, un bouton dans un formulaire vaut submit et l'envoie.
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      style={style}
      className={`inline-flex items-center gap-1 rounded-full border font-medium ${pad} ${
        active ? '' : 'border-line text-ink-3'
      } ${onClick ? 'cursor-pointer transition-transform active:scale-95' : ''}`}
    >
      {Icon && <Icon size={size === 'sm' ? 11 : 13} />}
      {badge.label}
    </Tag>
  );
}
