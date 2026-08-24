import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';

interface SwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  size?: 'sm' | 'md';
}

/**
 * Interrupteur animé. Le glissement du curseur et l'icône ✓ / ✕ rendent
 * l'état lisible même sans percevoir la différence de couleur.
 */
export function Switch({ checked, onChange, label, size = 'md' }: SwitchProps) {
  const dims =
    size === 'sm'
      ? { track: 'h-6 w-11', knob: 'h-5 w-5', travel: 20, icon: 11 }
      : { track: 'h-7 w-[52px]', knob: 'h-6 w-6', travel: 24, icon: 13 };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative shrink-0 cursor-pointer rounded-full p-0.5 transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${dims.track} ${
        checked ? 'bg-gradient-flow' : 'bg-surface-2 ring-1 ring-line'
      }`}
    >
      <motion.span
        layout
        animate={{ x: checked ? dims.travel : 0 }}
        transition={{ type: 'spring', stiffness: 520, damping: 34 }}
        className={`flex items-center justify-center rounded-full bg-white shadow-md ${dims.knob}`}
      >
        {checked ? (
          <Check size={dims.icon} className="text-accent" strokeWidth={3} />
        ) : (
          <X size={dims.icon} className="text-ink-3" strokeWidth={3} />
        )}
      </motion.span>
    </button>
  );
}
