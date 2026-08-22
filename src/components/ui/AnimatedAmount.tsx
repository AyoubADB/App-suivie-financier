import { animate, useMotionValue } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { formatCentsCompact } from '../../logic/money';

interface AnimatedAmountProps {
  cents: number;
  currency?: string;
  className?: string;
}

/** Montant animé façon compteur (mono, tabular-nums). */
export function AnimatedAmount({ cents, currency, className = '' }: AnimatedAmountProps) {
  const settings = useSettings();
  const cur = currency ?? settings.currency;
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

  // Mode confidentialité : la mise en page reste identique, seuls les
  // chiffres sont remplacés — pratique pour une capture ou en public.
  if (settings.privacyMode) {
    return <span className={`amount ${className}`}>•••••</span>;
  }

  return <span className={`amount ${className}`}>{formatCentsCompact(display, cur)}</span>;
}
