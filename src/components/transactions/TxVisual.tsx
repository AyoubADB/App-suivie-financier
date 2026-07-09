import type { Category, Transaction } from '../../types';
import { getIcon } from '../ui/icons';

interface TxVisualProps {
  tx: Pick<Transaction, 'iconOverride' | 'imageUrl'> & { label?: string };
  category?: Category;
  size?: number;
}

/** Visuel d'une transaction : image custom (style Notion) sinon icône. */
export function TxVisual({ tx, category, size = 40 }: TxVisualProps) {
  if (tx.imageUrl) {
    return (
      <img
        src={tx.imageUrl}
        alt=""
        style={{ width: size, height: size }}
        className="shrink-0 rounded-xl object-cover"
      />
    );
  }
  const Icon = getIcon(tx.iconOverride ?? category?.icon);
  const color = category?.color ?? '#82828e';
  return (
    <span
      style={{ width: size, height: size, backgroundColor: `${color}22`, color }}
      className="flex shrink-0 items-center justify-center rounded-xl"
    >
      <Icon size={Math.round(size * 0.5)} />
    </span>
  );
}
