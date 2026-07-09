import {
  Download,
  KeyRound,
  Moon,
  Palette,
  Pencil,
  Plus,
  Sun,
  Tags,
  Trash2,
  TriangleAlert,
  Upload,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { Card } from '../components/ui/Card';
import { BadgeChip } from '../components/ui/BadgeChip';
import { Modal } from '../components/ui/Modal';
import { Segmented } from '../components/ui/Segmented';
import { IconPicker } from '../components/transactions/IconPicker';
import { getIcon } from '../components/ui/icons';
import { useTheme } from '../context/ThemeContext';
import { useBadges, useCategories } from '../data/hooks';
import { repo, type ExportPayload } from '../data/repository';
import { CATEGORY_COLORS } from '../data/seed';
import type { Badge, Category, Scope, TxType } from '../types';

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'MAD'];

function SectionTitle({ icon: Icon, children }: { icon: typeof Palette; children: string }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
      <Icon size={17} className="text-accent" />
      {children}
    </h2>
  );
}

const inputClass =
  'min-h-[44px] w-full rounded-2xl border border-line bg-surface-2 px-4 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none';

// ---------------------------------------------------------------- Catégories

function CategoryForm({ editing, onDone }: { editing: Category | null; onDone: () => void }) {
  const [label, setLabel] = useState(editing?.label ?? '');
  const [scope, setScope] = useState<Scope | 'both'>(editing?.scope ?? 'both');
  const [type, setType] = useState<TxType | 'both'>(editing?.type ?? 'expense');
  const [icon, setIcon] = useState(editing?.icon ?? 'Tags');
  const [color, setColor] = useState(editing?.color ?? CATEGORY_COLORS[0]);
  const [keywords, setKeywords] = useState(editing?.keywords.join(', ') ?? '');

  async function submit() {
    if (!label.trim()) return;
    const payload = {
      label: label.trim(),
      scope,
      type,
      icon,
      color,
      keywords: keywords
        .split(',')
        .map((k) => k.trim().toLowerCase())
        .filter(Boolean),
    };
    if (editing) await repo.updateCategory(editing.id, payload);
    else await repo.addCategory(payload);
    onDone();
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="flex flex-col gap-3"
    >
      <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Nom de la catégorie" className={inputClass} autoFocus />
      <div className="flex flex-wrap gap-2">
        <Segmented
          options={[
            { value: 'perso', label: 'Perso' },
            { value: 'pro', label: 'Pro' },
            { value: 'both', label: 'Les deux' },
          ]}
          value={scope}
          onChange={setScope}
          size="sm"
        />
        <Segmented
          options={[
            { value: 'expense', label: 'Dépense' },
            { value: 'revenue', label: 'Revenu' },
            { value: 'both', label: 'Les deux' },
          ]}
          value={type}
          onChange={setType}
          size="sm"
        />
      </div>
      <div className="flex items-center gap-2">
        {CATEGORY_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Couleur ${c}`}
            onClick={() => setColor(c)}
            style={{ background: c }}
            className={`h-8 w-8 cursor-pointer rounded-full transition-transform ${
              color === c ? 'scale-110 ring-2 ring-ink ring-offset-2 ring-offset-surface' : ''
            }`}
          />
        ))}
      </div>
      <IconPicker value={icon} onChange={setIcon} />
      <textarea
        value={keywords}
        onChange={(e) => setKeywords(e.target.value)}
        placeholder="Mots-clés de catégorisation auto, séparés par des virgules (ex : netflix, spotify)"
        rows={2}
        className="w-full rounded-2xl border border-line bg-surface-2 px-4 py-3 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
      />
      <button type="submit" className="bg-gradient-flow min-h-[48px] cursor-pointer rounded-2xl font-semibold text-white">
        {editing ? 'Enregistrer' : 'Créer la catégorie'}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------- Badges

function BadgeForm({ editing, onDone }: { editing: Badge | null; onDone: () => void }) {
  const [label, setLabel] = useState(editing?.label ?? '');
  const [color, setColor] = useState(editing?.color ?? CATEGORY_COLORS[4]);

  async function submit() {
    if (!label.trim()) return;
    const payload = { label: label.trim(), color, icon: editing?.icon };
    if (editing) await repo.updateBadge(editing.id, payload);
    else await repo.addBadge(payload);
    onDone();
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="flex flex-col gap-3"
    >
      <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Nom du badge (ex : Urgent)" className={inputClass} autoFocus />
      <div className="flex items-center gap-2">
        {CATEGORY_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Couleur ${c}`}
            onClick={() => setColor(c)}
            style={{ background: c }}
            className={`h-8 w-8 cursor-pointer rounded-full transition-transform ${
              color === c ? 'scale-110 ring-2 ring-ink ring-offset-2 ring-offset-surface' : ''
            }`}
          />
        ))}
      </div>
      <button type="submit" className="bg-gradient-flow min-h-[48px] cursor-pointer rounded-2xl font-semibold text-white">
        {editing ? 'Enregistrer' : 'Créer le badge'}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------- Page

export function Settings() {
  const { theme, setTheme } = useTheme();
  const categories = useCategories() ?? [];
  const badges = useBadges() ?? [];
  const fileInput = useRef<HTMLInputElement>(null);

  const [currency, setCurrency] = useState(localStorage.getItem('flow.currency') ?? 'EUR');
  const [apiKey, setApiKey] = useState(localStorage.getItem('flow.apiKey') ?? '');
  const [catModal, setCatModal] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [badgeModal, setBadgeModal] = useState(false);
  const [editingBadge, setEditingBadge] = useState<Badge | null>(null);
  const [importMsg, setImportMsg] = useState('');

  function saveCurrency(value: string) {
    setCurrency(value);
    localStorage.setItem('flow.currency', value);
  }

  function saveApiKey(value: string) {
    setApiKey(value);
    if (value.trim()) localStorage.setItem('flow.apiKey', value.trim());
    else localStorage.removeItem('flow.apiKey');
  }

  async function exportData() {
    const payload = await repo.exportAll();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flow-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importData(file: File | undefined) {
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text()) as ExportPayload;
      await repo.importAll(payload);
      setImportMsg(`Import réussi : ${payload.transactions.length} transactions.`);
    } catch (err) {
      setImportMsg(err instanceof Error ? err.message : 'Import impossible.');
    }
  }

  async function resetAll() {
    if (window.confirm('Tout effacer ? Cette action est irréversible (pense à exporter avant).')) {
      await repo.resetAll();
      setImportMsg('Données réinitialisées.');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Apparence & devise */}
      <Card>
        <SectionTitle icon={Palette}>Apparence & devise</SectionTitle>
        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            options={[
              { value: 'dark', label: 'Sombre' },
              { value: 'light', label: 'Clair' },
            ]}
            value={theme}
            onChange={setTheme}
            size="sm"
          />
          {theme === 'dark' ? <Moon size={16} className="text-ink-3" /> : <Sun size={16} className="text-ink-3" />}
          <select
            value={currency}
            onChange={(e) => saveCurrency(e.target.value)}
            aria-label="Devise"
            className="min-h-[40px] cursor-pointer rounded-2xl border border-line bg-surface-2 px-4 text-sm"
          >
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
      </Card>

      {/* Catégories */}
      <Card>
        <div className="flex items-center justify-between">
          <SectionTitle icon={Tags}>Catégories</SectionTitle>
          <button
            onClick={() => {
              setEditingCat(null);
              setCatModal(true);
            }}
            className="glass flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-full px-4 text-xs font-medium"
          >
            <Plus size={14} />
            Nouvelle
          </button>
        </div>
        <ul className="flex flex-col">
          {categories.map((cat) => {
            const Icon = getIcon(cat.icon);
            return (
              <li key={cat.id} className="flex min-h-[52px] items-center gap-3 border-b border-line py-2 last:border-0">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${cat.color}22`, color: cat.color }}
                >
                  <Icon size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{cat.label}</p>
                  <p className="text-[11px] text-ink-3">
                    {cat.scope === 'both' ? 'perso + pro' : cat.scope} ·{' '}
                    {cat.type === 'both' ? 'dépense + revenu' : cat.type === 'expense' ? 'dépense' : 'revenu'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setEditingCat(cat);
                    setCatModal(true);
                  }}
                  aria-label={`Modifier ${cat.label}`}
                  className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink"
                >
                  <Pencil size={15} />
                </button>
                {cat.id !== 'cat-autre' && (
                  <button
                    onClick={() => {
                      if (window.confirm(`Supprimer « ${cat.label} » ? Ses transactions passeront en « Autre ».`))
                        void repo.deleteCategory(cat.id);
                    }}
                    aria-label={`Supprimer ${cat.label}`}
                    className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-ink-3 hover:bg-neg/15 hover:text-neg"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      {/* Badges */}
      <Card>
        <div className="flex items-center justify-between">
          <SectionTitle icon={Tags}>Badges</SectionTitle>
          <button
            onClick={() => {
              setEditingBadge(null);
              setBadgeModal(true);
            }}
            className="glass flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-full px-4 text-xs font-medium"
          >
            <Plus size={14} />
            Nouveau
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {badges.map((b) => (
            <span key={b.id} className="flex items-center gap-1">
              <BadgeChip
                badge={b}
                size="md"
                onClick={() => {
                  setEditingBadge(b);
                  setBadgeModal(true);
                }}
              />
              <button
                onClick={() => {
                  if (window.confirm(`Supprimer le badge « ${b.label} » ?`)) void repo.deleteBadge(b.id);
                }}
                aria-label={`Supprimer ${b.label}`}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-ink-3 hover:text-neg"
              >
                <Trash2 size={13} />
              </button>
            </span>
          ))}
        </div>
      </Card>

      {/* Coach IA */}
      <Card>
        <SectionTitle icon={KeyRound}>Coach IA (optionnel)</SectionTitle>
        <p className="mb-2 text-xs leading-relaxed text-ink-3">
          Clé API Anthropic pour l'analyse approfondie. Stockée uniquement sur cet appareil,
          jamais envoyée ailleurs qu'à l'API. L'app fonctionne à 100 % sans.
        </p>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => saveApiKey(e.target.value)}
          placeholder="sk-ant-…"
          autoComplete="off"
          className={inputClass}
        />
      </Card>

      {/* Données */}
      <Card>
        <SectionTitle icon={Download}>Données</SectionTitle>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => void exportData()}
            className="glass flex min-h-[44px] cursor-pointer items-center gap-2 rounded-2xl px-4 text-sm font-medium"
          >
            <Download size={16} />
            Exporter (JSON)
          </button>
          <button
            onClick={() => fileInput.current?.click()}
            className="glass flex min-h-[44px] cursor-pointer items-center gap-2 rounded-2xl px-4 text-sm font-medium"
          >
            <Upload size={16} />
            Importer
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => void importData(e.target.files?.[0])}
          />
          <button
            onClick={() => void resetAll()}
            className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-2xl border border-neg/40 px-4 text-sm font-medium text-neg hover:bg-neg/10"
          >
            <TriangleAlert size={16} />
            Tout réinitialiser
          </button>
        </div>
        {importMsg && <p className="mt-3 text-sm text-ink-2">{importMsg}</p>}
      </Card>

      <Modal
        open={catModal}
        onClose={() => setCatModal(false)}
        title={editingCat ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
      >
        <CategoryForm key={editingCat?.id ?? 'new'} editing={editingCat} onDone={() => setCatModal(false)} />
      </Modal>
      <Modal
        open={badgeModal}
        onClose={() => setBadgeModal(false)}
        title={editingBadge ? 'Modifier le badge' : 'Nouveau badge'}
      >
        <BadgeForm key={editingBadge?.id ?? 'new'} editing={editingBadge} onDone={() => setBadgeModal(false)} />
      </Modal>
    </div>
  );
}
