import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../../context/SettingsContext';
import { OVERVIEW, sectionsFor, type SectionDef } from '../../pages/sections/registry';

interface SectionSwitcherProps {
  /** Section ouverte ; `OVERVIEW` sur le tableau de bord. */
  current: SectionDef;
}

/**
 * Liste déroulante des vues détaillées.
 * Elle remplace une navigation par onglets qui ne tiendrait pas sur un
 * téléphone : dix sections, un seul contrôle, et le nom de la vue courante
 * reste toujours visible.
 */
export function SectionSwitcher({ current }: SectionSwitcherProps) {
  const { proEnabled } = useSettings();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const options = [OVERVIEW, ...sectionsFor(proEnabled)];

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const CurrentIcon = current.icon;

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="glass flex min-h-[48px] w-full cursor-pointer items-center gap-2.5 rounded-2xl px-4 text-left"
      >
        <CurrentIcon size={18} className="shrink-0 text-accent-2" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{current.label}</span>
          <span className="block truncate text-[11px] text-ink-3">{current.hint}</span>
        </span>
        <ChevronDown
          size={17}
          className={`shrink-0 text-ink-3 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16 }}
            className="glass absolute inset-x-0 top-full z-40 mt-2 max-h-[60vh] overflow-y-auto overscroll-contain rounded-2xl p-1.5 shadow-2xl"
          >
            {options.map((section) => {
              const Icon = section.icon;
              const active = section.slug === current.slug;
              return (
                <li key={section.slug || 'overview'}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      setOpen(false);
                      navigate(section.slug ? `/vue/${section.slug}` : '/');
                    }}
                    className={`flex min-h-[52px] w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-left transition-colors ${
                      active ? 'bg-surface-2' : 'hover:bg-surface-2'
                    }`}
                  >
                    <Icon
                      size={17}
                      className={`shrink-0 ${active ? 'text-accent-2' : 'text-ink-3'}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{section.label}</span>
                      <span className="block truncate text-[11px] text-ink-3">{section.hint}</span>
                    </span>
                    {active && <Check size={15} className="shrink-0 text-accent-2" />}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
