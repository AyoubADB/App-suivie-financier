import { FileSpreadsheet, TriangleAlert, Upload } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import {
  useActivities,
  useCategories,
  useRepo,
  useTransactions,
} from '../../context/DataContext';
import { useSettings } from '../../context/SettingsContext';
import { normalize, suggestCategory } from '../../logic/categorizer';
import {
  buildDrafts,
  detectColumns,
  parseCsv,
  type ColumnMapping,
  type CsvDraft,
} from '../../logic/csv';
import { formatCents } from '../../logic/money';
import type { Scope } from '../../types';
import { Modal } from '../ui/Modal';
import { Segmented } from '../ui/Segmented';

interface Parsed {
  rows: string[][];
  mapping: ColumnMapping;
  hasHeader: boolean;
  fileName: string;
  /** Horodatage de la lecture : sert de clé pour repartir d'un état vierge. */
  stamp: number;
}

/**
 * Import d'un relevé bancaire CSV.
 * Les colonnes sont devinées puis corrigeables : chaque banque exporte à sa
 * façon, et un mapping figé casserait au premier relevé d'une autre banque.
 */
export function CsvImport() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [error, setError] = useState('');

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError('');
    try {
      const rows = parseCsv(await file.text());
      if (rows.length === 0) {
        setError('Ce fichier ne contient aucune ligne exploitable.');
        return;
      }
      const { mapping, hasHeader } = detectColumns(rows);
      setParsed({ rows, mapping, hasHeader, fileName: file.name, stamp: Date.now() });
    } catch {
      setError('Lecture impossible. Vérifie que le fichier est bien un CSV.');
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => fileInput.current?.click()}
        className="glass flex min-h-[44px] cursor-pointer items-center gap-2 rounded-2xl px-4 text-sm font-medium"
      >
        <FileSpreadsheet size={16} />
        Importer un relevé (CSV)
      </button>
      <input
        ref={fileInput}
        type="file"
        accept=".csv,text/csv,text/plain"
        hidden
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {error && (
        <p role="alert" className="mt-3 w-full text-xs text-neg">
          {error}
        </p>
      )}

      <Modal open={parsed !== null} onClose={() => setParsed(null)} title="Importer un relevé">
        {parsed && (
          <CsvMapper key={parsed.stamp} parsed={parsed} onDone={() => setParsed(null)} />
        )}
      </Modal>
    </>
  );
}

function CsvMapper({ parsed, onDone }: { parsed: Parsed; onDone: () => void }) {
  const repo = useRepo();
  const categories = useCategories();
  const existing = useTransactions();
  const activities = useActivities().filter((a) => !a.archived);
  const { currency, proEnabled, defaultScope } = useSettings();

  const [mapping, setMapping] = useState<ColumnMapping>(parsed.mapping);
  const [hasHeader, setHasHeader] = useState(parsed.hasHeader);
  const [scope, setScope] = useState<Scope>(defaultScope === 'pro' ? 'pro' : 'perso');
  const [activityId, setActivityId] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ added: number; duplicates: number } | null>(null);

  const columns = useMemo(() => {
    const width = Math.max(0, ...parsed.rows.map((r) => r.length));
    const header = hasHeader ? parsed.rows[0] : null;
    return Array.from({ length: width }, (_, i) => ({
      index: i,
      label: header?.[i]?.trim() || `Colonne ${i + 1}`,
    }));
  }, [parsed.rows, hasHeader]);

  const { drafts, skipped } = useMemo(
    () => buildDrafts(parsed.rows, mapping, hasHeader),
    [parsed.rows, mapping, hasHeader],
  );

  /** Une ligne déjà présente (même date, montant et libellé) n'est pas réimportée. */
  const seen = useMemo(() => {
    const set = new Set<string>();
    for (const tx of existing) set.add(`${tx.date}|${tx.amount}|${normalize(tx.label)}`);
    return set;
  }, [existing]);

  const fresh = useMemo(
    () => drafts.filter((d) => !seen.has(`${d.date}|${d.amount}|${normalize(d.label)}`)),
    [drafts, seen],
  );
  const duplicates = drafts.length - fresh.length;

  async function run() {
    setBusy(true);
    for (const draft of fresh) {
      const suggestion = suggestCategory(draft.label, {
        scope,
        type: draft.type,
        categories,
      });
      await repo.addTransaction({
        type: draft.type,
        scope,
        amount: draft.amount,
        currency,
        label: draft.label,
        categoryId: suggestion.category.id,
        date: draft.date,
        isRecurring: false,
        badges: [],
        activityId: scope === 'pro' && activityId ? activityId : undefined,
      });
    }
    setBusy(false);
    setDone({ added: fresh.length, duplicates });
  }

  const selectClass =
    'min-h-[44px] w-full cursor-pointer rounded-2xl border border-line bg-surface-2 px-3 text-sm';

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm">
          <span className="font-semibold text-pos">{done.added} transaction
          {done.added > 1 ? 's' : ''} importée{done.added > 1 ? 's' : ''}</span>
          {done.duplicates > 0 &&
            ` · ${done.duplicates} doublon${done.duplicates > 1 ? 's' : ''} ignoré${
              done.duplicates > 1 ? 's' : ''
            }`}
          .
        </p>
        <p className="text-xs text-ink-3">
          Les catégories ont été devinées à partir des libellés. Passe-les en revue dans
          Mouvements : chaque correction rend la suivante plus juste si tu ajoutes le mot-clé à la
          catégorie.
        </p>
        <button
          type="button"
          onClick={onDone}
          className="bg-gradient-flow min-h-[48px] cursor-pointer rounded-2xl font-semibold text-white"
        >
          Terminé
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-ink-3">
        {parsed.fileName} · {parsed.rows.length} ligne{parsed.rows.length > 1 ? 's' : ''} lue
        {parsed.rows.length > 1 ? 's' : ''}
      </p>

      <label className="flex items-center gap-2 text-sm text-ink-2">
        <input
          type="checkbox"
          checked={hasHeader}
          onChange={(e) => setHasHeader(e.target.checked)}
          className="h-4 w-4 accent-[var(--accent)]"
        />
        La première ligne contient les noms de colonnes
      </label>

      <div className="grid gap-3 sm:grid-cols-3">
        <ColumnSelect
          label="Date"
          value={mapping.date}
          columns={columns}
          onChange={(v) => setMapping({ ...mapping, date: v })}
          className={selectClass}
        />
        <ColumnSelect
          label="Libellé"
          value={mapping.label}
          columns={columns}
          onChange={(v) => setMapping({ ...mapping, label: v })}
          className={selectClass}
        />
        <ColumnSelect
          label="Montant signé"
          value={mapping.amount}
          columns={columns}
          onChange={(v) => setMapping({ ...mapping, amount: v })}
          className={selectClass}
          allowNone
        />
      </div>

      {mapping.amount === -1 && (
        <div className="grid gap-3 sm:grid-cols-2">
          <ColumnSelect
            label="Débit"
            value={mapping.debit}
            columns={columns}
            onChange={(v) => setMapping({ ...mapping, debit: v })}
            className={selectClass}
            allowNone
          />
          <ColumnSelect
            label="Crédit"
            value={mapping.credit}
            columns={columns}
            onChange={(v) => setMapping({ ...mapping, credit: v })}
            className={selectClass}
            allowNone
          />
        </div>
      )}

      {proEnabled && (
        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            options={[
              { value: 'perso', label: 'Perso' },
              { value: 'pro', label: 'Pro' },
            ]}
            value={scope}
            onChange={setScope}
            size="sm"
          />
          {scope === 'pro' && activities.length > 0 && (
            <select
              value={activityId}
              onChange={(e) => setActivityId(e.target.value)}
              aria-label="Activité"
              className="min-h-[40px] cursor-pointer rounded-2xl border border-line bg-surface-2 px-3 text-sm"
            >
              <option value="">Sans activité</option>
              {activities.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-line bg-surface-2/40 p-3">
        <p className="mb-2 text-xs font-medium text-ink-2">
          Aperçu · {fresh.length} à importer
          {duplicates > 0 && ` · ${duplicates} doublon${duplicates > 1 ? 's' : ''}`}
          {skipped > 0 && ` · ${skipped} ligne${skipped > 1 ? 's' : ''} ignorée${skipped > 1 ? 's' : ''}`}
        </p>
        {drafts.length === 0 ? (
          <p className="flex items-start gap-2 py-2 text-xs text-warn">
            <TriangleAlert size={14} className="mt-0.5 shrink-0" />
            Aucune ligne exploitable avec ce découpage. Vérifie les colonnes ci-dessus.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {drafts.slice(0, 6).map((d, i) => (
              <PreviewRow key={`${d.date}-${i}`} draft={d} currency={currency} />
            ))}
            {drafts.length > 6 && (
              <li className="pt-1 text-[11px] text-ink-3">
                … et {drafts.length - 6} ligne{drafts.length - 6 > 1 ? 's' : ''} de plus
              </li>
            )}
          </ul>
        )}
      </div>

      <button
        type="button"
        disabled={busy || fresh.length === 0}
        onClick={() => void run()}
        className="bg-gradient-flow flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-2xl font-semibold text-white disabled:opacity-50"
      >
        <Upload size={16} />
        {busy
          ? 'Import en cours…'
          : `Importer ${fresh.length} transaction${fresh.length > 1 ? 's' : ''}`}
      </button>
    </div>
  );
}

function PreviewRow({ draft, currency }: { draft: CsvDraft; currency: string }) {
  return (
    <li className="flex items-center gap-3 text-xs">
      <span className="amount shrink-0 text-ink-3">{draft.date}</span>
      <span className="min-w-0 flex-1 truncate">{draft.label}</span>
      <span
        className={`amount shrink-0 font-semibold ${draft.type === 'revenue' ? 'text-pos' : ''}`}
      >
        {draft.type === 'revenue' ? '+' : '−'}
        {formatCents(draft.amount, currency)}
      </span>
    </li>
  );
}

function ColumnSelect({
  label,
  value,
  columns,
  onChange,
  className,
  allowNone = false,
}: {
  label: string;
  value: number;
  columns: Array<{ index: number; label: string }>;
  onChange: (value: number) => void;
  className: string;
  allowNone?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-ink-2">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={className}
      >
        {allowNone && <option value={-1}>— aucune —</option>}
        {columns.map((c) => (
          <option key={c.index} value={c.index}>
            {c.label}
          </option>
        ))}
      </select>
    </label>
  );
}
