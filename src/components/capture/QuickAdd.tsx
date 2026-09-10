import { AnimatePresence, motion } from 'framer-motion';
import { Camera, FileSpreadsheet, PencilLine, Plus, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';

export type QuickAddMode = 'manuel' | 'scan' | 'import';

const ACTIONS: Array<{ mode: QuickAddMode; label: string; hint: string; icon: typeof Plus }> = [
  {
    mode: 'manuel',
    label: 'Saisie manuelle',
    hint: 'Un montant, un libellé, c’est réglé',
    icon: PencilLine,
  },
  {
    mode: 'scan',
    label: 'Scanner une facture',
    hint: 'Photo, image ou PDF — le montant est lu',
    icon: Camera,
  },
  {
    mode: 'import',
    label: 'Importer un relevé',
    hint: 'Fichier CSV ou OFX de ta banque',
    icon: FileSpreadsheet,
  },
];

/**
 * Bouton d'ajout et ses trois façons de créer un mouvement.
 * Le déploiement en éventail garde le geste à une main : les actions
 * apparaissent au-dessus du pouce, pas en haut de l'écran.
 */
export function QuickAdd({ onPick }: { onPick: (mode: QuickAddMode) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.button
            type="button"
            aria-label="Fermer le menu d'ajout"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default bg-black/50 backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      <div className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom,0px))] right-4 z-50 flex flex-col items-end gap-2 md:bottom-8 md:right-8">
        <AnimatePresence>
          {open &&
            ACTIONS.map((action, i) => {
              const Icon = action.icon;
              return (
                <motion.button
                  key={action.mode}
                  type="button"
                  initial={{ opacity: 0, y: 12, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 12, scale: 0.9 }}
                  transition={{ delay: (ACTIONS.length - 1 - i) * 0.04 }}
                  onClick={() => {
                    setOpen(false);
                    onPick(action.mode);
                  }}
                  className="glass flex min-h-[56px] cursor-pointer items-center gap-3 rounded-2xl px-4 text-left shadow-xl"
                >
                  <span className="bg-gradient-flow flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white">
                    <Icon size={17} />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{action.label}</span>
                    <span className="block text-[11px] text-ink-3">{action.hint}</span>
                  </span>
                </motion.button>
              );
            })}
        </AnimatePresence>

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'Fermer le menu d’ajout' : 'Ajouter un mouvement'}
          aria-expanded={open}
          className="bg-gradient-flow flex h-14 w-14 cursor-pointer items-center justify-center rounded-full text-white shadow-xl shadow-accent/30 transition-transform active:scale-90"
        >
          <motion.span animate={{ rotate: open ? 45 : 0 }} transition={{ duration: 0.18 }}>
            {open ? <X size={26} /> : <Plus size={26} />}
          </motion.span>
        </button>
      </div>
    </>
  );
}

/** Enveloppe une section d'écran avec le bouton d'ajout flottant. */
export function WithQuickAdd({
  children,
  onPick,
}: {
  children: ReactNode;
  onPick: (mode: QuickAddMode) => void;
}) {
  return (
    <>
      {children}
      <QuickAdd onPick={onPick} />
    </>
  );
}
