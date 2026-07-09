import { animate, useMotionValue } from 'framer-motion';
import { useEffect, useState } from 'react';
import { formatCentsCompact } from '../../logic/money';

interface AnimatedAmountProps {
  cents: number;
  currency?: string;
  className?: string;
}

/** Montant animé façon compteur (mono, tabular-nums). */
export function AnimatedAmount({ cents, currency = 'EUR', className = '' }: AnimatedAmountProps) {
  const mv = useMotionValue(cents);
  const [display, setDisplay] = useState(cents);

  useEffect(() => {
    const controls = animate(mv, cents, {
      duration: 0.7,
      ease: [0.21, 1.02, 0.73, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return controls.stop;
  }, [cents, mv]);

  return <span className={`amount ${className}`}>{formatCentsCompact(display, currency)}</span>;
}
