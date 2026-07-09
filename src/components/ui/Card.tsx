import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

/** Carte glass très arrondie — surface de base de l'app. */
export function Card({ children, className = '', delay = 0 }: CardProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.21, 1.02, 0.73, 1] }}
      className={`glass rounded-3xl p-4 sm:p-5 ${className}`}
    >
      {children}
    </motion.section>
  );
}
