import { SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { Modal } from '../ui/Modal';
import { Switch } from '../ui/Switch';
import { OVERVIEW_BLOCKS } from './blocks';

/** Choix des blocs affichés sur la vue d'ensemble. */
export function CustomiseOverview() {
  const { hiddenBlocks, proEnabled, update } = useSettings();
  const [open, setOpen] = useState(false);

  const blocks = OVERVIEW_BLOCKS.filter((b) => !b.proOnly || proEnabled);
  const hiddenCount = blocks.filter((b) => hiddenBlocks.includes(b.id)).length;

  function toggle(id: string, visible: boolean) {
    update({
      hiddenBlocks: visible
        ? hiddenBlocks.filter((b) => b !== id)
        : [...new Set([...hiddenBlocks, id])],
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="glass flex min-h-[40px] shrink-0 cursor-pointer items-center gap-1.5 rounded-2xl px-3 text-xs font-medium"
      >
        <SlidersHorizontal size={14} />
        Personnaliser
        {hiddenCount > 0 && <span className="text-ink-3">· {hiddenCount} masqué{hiddenCount > 1 ? 's' : ''}</span>}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Blocs affichés">
        <div className="flex flex-col gap-1">
          <p className="mb-2 text-sm leading-relaxed text-ink-2">
            Garde ce qui te sert, masque le reste. Chaque bloc masqué reste accessible depuis sa
            page détaillée.
          </p>
          <ul className="flex flex-col divide-y divide-line">
            {blocks.map((block) => {
              const visible = !hiddenBlocks.includes(block.id);
              return (
                <li key={block.id} className="flex items-center gap-3 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{block.label}</span>
                    <span className="block text-[11px] text-ink-3">{block.hint}</span>
                  </span>
                  <Switch
                    checked={visible}
                    onChange={(next) => toggle(block.id, next)}
                    label={`Afficher ${block.label}`}
                    size="sm"
                  />
                </li>
              );
            })}
          </ul>
        </div>
      </Modal>
    </>
  );
}
