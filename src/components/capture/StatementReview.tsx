import {
  Check,
  ChevronDown,
  Coins,
  Loader2,
  Sparkles,
  SquareCheck,
  Square,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useCategories, useRepo, useRules, useTransactions } from '../../context/DataContext';
import { useSettings } from '../../context/SettingsContext';
import { normalize, suggestCategory } from '../../logic/categorizer';
import { estimateStatementCost, refineStatement } from '../../logic/aiStatement';
import { describeApiError, storedApiKey } from '../../logic/anthropic';
import { formatCents, parseAmountToCents } from '../../logic/money';
import { applyRules } from '../../logic/rules';
import type { StatementLine } from '../../logic/statementShot';
import type { Scope, TxType } from '../../types';
import { CategoryPicker } from '../transactions/CategoryPicker';
import { Segmented } from '../ui/Segmented';
import { getIcon } from '../ui/icons';

interface StatementReviewProps {
  lines: StatementLine[];
  /** Texte brut de la capture, pour une éventuelle relecture par Claude. */
  ocrText: string;
  scope: Scope;
  onDone: (added: number) => void;
}

interface Row extends StatementLine {
  categoryId: string;
  selected: boolean;
  duplicate: boolean;
  /** Chaque ligne peut partir en perso ou en pro, indépendamment des autres. */
  scope: Scope;
}

/**
 * Relecture des opérations lues sur une capture de compte.
 *
 * Rien n'est enregistré sans un regard : chaque ligne est cochable, son sens
 * se retourne d'un geste, et les lignes déjà présentes dans l'app sont
 * décochées d'office. L'enjeu est d'éviter le pire résultat possible — vingt
 * écritures fausses ajoutées d'un coup, plus longues à corriger qu'à saisir.
 */
export function StatementReview({ lines, ocrText, scope, onDone }: StatementReviewProps) {
  const categories = useCategories();
  const rules = useRules();
  const existing = useTransactions();
  const repo = useRepo();
  const { currency, proEnabled } = useSettings();

  const apiKey = storedApiKey();

  /** Empreintes des mouvements déjà enregistrés, pour ne pas les dupliquer. */
  const seen = useMemo(() => {
    const set = new Set<string>();
    for (const tx of existing) set.add(`${tx.date}|${tx.amount}|${normalize(tx.label)}`);
    return set;
  }, [existing]);

  /**
   * Habille chaque ligne lue : catégorie proposée, règles appliquées, et
   * détection des doublons déjà enregistrés.
   */
  const decorate = useCallback(
    (source: StatementLine[]): Row[] =>
      source.map((line) => {
        const suggestion = suggestCategory(line.label, {
          scope,
          type: line.type,
          categories,
        });
        const { effects } = applyRules(rules, {
          label: line.label,
          amount: line.amount,
          type: line.type,
          scope,
        });
        const duplicate = seen.has(`${line.dateISO}|${line.amount}|${normalize(line.label)}`);
        return {
          ...line,
          label: effects.renameTo ?? line.label,
          categoryId: effects.categoryId ?? suggestion.category.id,
          selected: !duplicate,
          duplicate,
          scope,
        };
      }),
    [categories, rules, scope, seen],
  );

  const [rows, setRows] = useState<Row[]>(() => decorate(lines));
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  function update(id: string, patch: Partial<Row>) {
    setRows((current) => current.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  /** Retire définitivement une ligne mal lue : plus clair que la décocher. */
  function remove(id: string) {
    setRows((current) => current.filter((r) => r.id !== id));
    setOpen((o) => (o === id ? null : o));
  }

  /** Le sens change : la catégorie suggérée n'est plus la même. */
  function flipType(row: Row) {
    const type: TxType = row.type === 'expense' ? 'revenue' : 'expense';
    const suggestion = suggestCategory(row.label, { scope: row.scope, type, categories });
    update(row.id, { type, categoryId: suggestion.category.id, origin: 'signe' });
  }

  const selected = rows.filter((r) => r.selected);
  const totalIn = selected.filter((r) => r.type === 'revenue').reduce((a, r) => a + r.amount, 0);
  const totalOut = selected.filter((r) => r.type === 'expense').reduce((a, r) => a + r.amount, 0);
  const uncertain = rows.filter((r) => r.origin === 'défaut' && r.selected).length;
  const byColor = rows.filter((r) => r.origin === 'couleur').length;
  const duplicates = rows.filter((r) => r.duplicate).length;

  async function importAll() {
    setBusy(true);
    setError('');
    try {
      for (const row of selected) {
        await repo.addTransaction({
          type: row.type,
          scope: row.scope,
          amount: row.amount,
          currency,
          label: row.label,
          categoryId: row.categoryId,
          date: row.dateISO,
          isRecurring: false,
          badges: [],
        });
      }
      onDone(selected.length);
    } catch {
      setError("L'enregistrement a échoué. Réessaie, rien n'est perdu.");
    } finally {
      setBusy(false);
    }
  }

  async function askClaude() {
    setAiBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await refineStatement(ocrText, apiKey);
      if (result.lines.length === 0) {
        setNotice("Claude n'a trouvé aucune opération de plus que la lecture locale.");
        return;
      }
      setRows(decorate(result.lines));
      setOpen(null);
      setNotice(
        `${result.lines.length} opérations relues · ${result.usage.input + result.usage.output} jetons consommés.`,
      );
    } catch (err) {
      setError(await describeApiError(err));
    } finally {
      setAiBusy(false);
    }
  }

  const cost = estimateStatementCost(ocrText);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-line bg-surface-2/50 p-3.5">
        <p className="text-sm font-medium">
          {rows.length} opération{rows.length > 1 ? 's' : ''} trouvée
          {rows.length > 1 ? 's' : ''}
        </p>
        <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-3">
          <span className="text-pos">+{formatCents(totalIn, currency)}</span>
          <span className="text-neg">−{formatCents(totalOut, currency)}</span>
          <span>{selected.length} sélectionnée{selected.length > 1 ? 's' : ''}</span>
        </p>

        <div className="mt-2.5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setRows((c) => c.map((r) => ({ ...r, selected: true })))}
            className="glass min-h-[36px] cursor-pointer rounded-full px-3 text-xs font-medium"
          >
            Tout cocher
          </button>
          <button
            type="button"
            onClick={() => setRows((c) => c.map((r) => ({ ...r, selected: false })))}
            className="glass min-h-[36px] cursor-pointer rounded-full px-3 text-xs font-medium"
          >
            Tout décocher
          </button>
          {proEnabled && (
            <>
              <button
                type="button"
                onClick={() => setRows((c) => c.map((r) => ({ ...r, scope: 'perso' })))}
                className="glass min-h-[36px] cursor-pointer rounded-full px-3 text-xs font-medium"
              >
                Tout en perso
              </button>
              <button
                type="button"
                onClick={() => setRows((c) => c.map((r) => ({ ...r, scope: 'pro' })))}
                className="glass min-h-[36px] cursor-pointer rounded-full px-3 text-xs font-medium"
              >
                Tout en pro
              </button>
            </>
          )}
        </div>
      </div>

      {duplicates > 0 && (
        <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-3">
          <Check size={14} className="mt-0.5 shrink-0 text-pos" />
          {duplicates} ligne{duplicates > 1 ? 's' : ''} déjà présente
          {duplicates > 1 ? 's' : ''} dans l'app {duplicates > 1 ? 'ont' : 'a'} été décochée
          {duplicates > 1 ? 's' : ''}.
        </p>
      )}

      {byColor > 0 && (
        <p className="flex items-start gap-2 text-xs leading-relaxed text-pos">
          <Check size={14} className="mt-0.5 shrink-0" />
          {byColor} ligne{byColor > 1 ? 's' : ''} {byColor > 1 ? 'ont' : 'a'} été classée
          {byColor > 1 ? 's' : ''} en encaissement d'après la couleur verte du montant.
        </p>
      )}

      {uncertain > 0 && (
        <p className="flex items-start gap-2 text-xs leading-relaxed text-warn">
          <TriangleAlert size={14} className="mt-0.5 shrink-0" />
          {uncertain} ligne{uncertain > 1 ? 's' : ''} sans signe ni mot reconnu {uncertain > 1 ? 'ont' : 'a'} été
          classée{uncertain > 1 ? 's' : ''} en dépense par défaut. Touche la pastille pour corriger.
        </p>
      )}

      <ul className="flex flex-col divide-y divide-line">
        {rows.map((row) => {
          const category = categories.find((c) => c.id === row.categoryId);
          const Icon = getIcon(category?.icon);
          const expanded = open === row.id;

          return (
            <li key={row.id} className={row.selected ? '' : 'opacity-50'}>
              <div className="flex items-center gap-2 py-2.5">
                <button
                  type="button"
                  onClick={() => update(row.id, { selected: !row.selected })}
                  aria-label={row.selected ? `Décocher ${row.label}` : `Cocher ${row.label}`}
                  aria-pressed={row.selected}
                  className="shrink-0 cursor-pointer p-1 text-ink-3"
                >
                  {row.selected ? (
                    <SquareCheck size={20} className="text-accent-2" />
                  ) : (
                    <Square size={20} />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => flipType(row)}
                  aria-label={`Basculer ${row.label} en ${row.type === 'expense' ? 'revenu' : 'dépense'}`}
                  className={`flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl text-base font-bold ${
                    row.type === 'revenue' ? 'bg-pos/12 text-pos' : 'bg-neg/12 text-neg'
                  }`}
                >
                  {row.type === 'revenue' ? '+' : '−'}
                </button>

                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : row.id)}
                  aria-expanded={expanded}
                  className="min-w-0 flex-1 cursor-pointer text-left"
                >
                  <span className="block truncate text-sm font-medium">{row.label}</span>
                  <span className="flex items-center gap-1 text-[11px] text-ink-3">
                    <Icon size={11} style={{ color: category?.color }} />
                    <span className="truncate">{category?.label ?? 'Autre'}</span>
                    <span>
                      · {row.dateISO.slice(8, 10)}/{row.dateISO.slice(5, 7)}
                    </span>
                    {proEnabled && (
                      <span
                        className={`rounded-full px-1.5 font-semibold ${
                          row.scope === 'pro' ? 'bg-accent/15 text-accent-2' : 'bg-surface-2'
                        }`}
                      >
                        {row.scope}
                      </span>
                    )}
                  </span>
                </button>

                <span
                  className={`amount shrink-0 text-sm font-semibold ${
                    row.type === 'revenue' ? 'text-pos' : ''
                  }`}
                >
                  {formatCents(row.amount, currency)}
                </span>

                <ChevronDown
                  size={15}
                  className={`shrink-0 text-ink-3 transition-transform ${expanded ? 'rotate-180' : ''}`}
                />
              </div>

              {expanded && (
                <div className="flex flex-col gap-3 pb-3 pl-9">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs text-ink-2">Libellé</span>
                    <input
                      value={row.label}
                      onChange={(e) => update(row.id, { label: e.target.value })}
                      maxLength={140}
                      className="min-h-[44px] w-full rounded-2xl border border-line bg-surface-2 px-3 text-base focus:border-accent focus:outline-none"
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs text-ink-2">Montant</span>
                      <input
                        value={(row.amount / 100).toFixed(2).replace('.', ',')}
                        onChange={(e) =>
                          update(row.id, { amount: parseAmountToCents(e.target.value) ?? row.amount })
                        }
                        inputMode="decimal"
                        className="amount min-h-[44px] w-full rounded-2xl border border-line bg-surface-2 px-3 text-base focus:border-accent focus:outline-none"
                      />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs text-ink-2">Date</span>
                      <input
                        type="date"
                        value={row.dateISO}
                        onChange={(e) => e.target.value && update(row.id, { dateISO: e.target.value })}
                        className="min-h-[44px] w-full rounded-2xl border border-line bg-surface-2 px-3 text-sm focus:border-accent focus:outline-none"
                      />
                    </label>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs text-ink-2">Catégorie</span>
                    <CategoryPicker
                      categories={categories}
                      value={row.categoryId}
                      onChange={(categoryId) => update(row.id, { categoryId })}
                      scope={scope}
                      type={row.type}
                    />
                  </div>

                  {proEnabled && (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs text-ink-2">Portée</span>
                      <Segmented
                        options={[
                          { value: 'perso', label: 'Perso' },
                          { value: 'pro', label: 'Pro' },
                        ]}
                        value={row.scope}
                        onChange={(next) => update(row.id, { scope: next })}
                        size="sm"
                        className="self-start"
                      />
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="min-w-0 flex-1 truncate text-[11px] text-ink-3">
                      Lu : « {row.raw} »
                    </p>
                    <button
                      type="button"
                      onClick={() => remove(row.id)}
                      className="flex min-h-[40px] shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-neg/40 px-3 text-xs font-medium text-neg hover:bg-neg/10"
                    >
                      <Trash2 size={14} />
                      Supprimer la ligne
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {notice && <p className="text-xs text-accent-2">{notice}</p>}
      {error && (
        <p role="alert" className="text-sm text-neg">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => void importAll()}
        disabled={busy || selected.length === 0}
        className="bg-gradient-flow flex min-h-[52px] cursor-pointer items-center justify-center gap-2 rounded-2xl font-semibold text-white disabled:opacity-50"
      >
        {busy ? <Loader2 size={17} className="animate-spin" /> : <Check size={17} />}
        {busy
          ? 'Enregistrement…'
          : `Ajouter ${selected.length} mouvement${selected.length > 1 ? 's' : ''}`}
      </button>

      {apiKey ? (
        <button
          type="button"
          onClick={() => void askClaude()}
          disabled={aiBusy}
          className="glass flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-2xl text-sm font-medium disabled:opacity-60"
        >
          {aiBusy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {aiBusy ? 'Relecture…' : 'Relire avec Claude'}
          <span className="flex items-center gap-1 text-[11px] text-ink-3">
            <Coins size={11} />≈ {cost.inputTokens + cost.outputTokens} jetons
          </span>
        </button>
      ) : (
        <p className="text-[11px] leading-relaxed text-ink-3">
          Tout ci-dessus a été lu sur ton téléphone, sans connexion. Si une capture passe mal,
          ajoute une clé API Anthropic dans les réglages : un bouton proposera une relecture par
          Claude, sur le modèle le moins cher et en n'envoyant que le texte, jamais l'image.
        </p>
      )}
    </div>
  );
}
