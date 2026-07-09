import { motion } from 'framer-motion';
import { useId } from 'react';

interface SegmentedProps<T extends string> {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: 'sm' | 'md';
}

/** Contrôle segmenté avec pilule animée (layoutId partagé). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className = '',
  size = 'md',
}: SegmentedProps<T>) {
  const layoutId = useId();
  const pad = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm';
  return (
    <div
      role="radiogroup"
      className={`glass inline-flex items-center gap-1 rounded-full p-1 ${className}`}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={`relative min-h-[36px] cursor-pointer rounded-full font-medium transition-colors ${pad} ${
              active ? 'text-white' : 'text-ink-2 hover:text-ink'
            }`}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="bg-gradient-flow absolute inset-0 rounded-full"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative z-10">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
