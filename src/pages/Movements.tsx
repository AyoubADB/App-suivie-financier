import { AlarmClockOff, Plus, RefreshCcw, Search, SlidersHorizontal, Wallet, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PeriodSelector } from '../components/PeriodSelector';
import { TransactionForm } from '../components/transactions/TransactionForm';
import { TransactionItem } from '../components/transactions/TransactionItem';
import { TxVisual } from '../components/transactions/TxVisual';
import { AnimatedAmount } from '../components/ui/AnimatedAmount';
import { BadgeChip } from '../components/ui/BadgeChip';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';
import { Segmented } from '../components/ui/Segmented';
import { usePeriod } from '../context/PeriodContext';
import { useScope } from '../context/ScopeContext';
import { useSettings } from '../context/SettingsContext';
import { useBadges, useCategories, useRepo, useTransactions } from '../context/DataContext';
import { dormantSubscriptions, inRange, monthlyEquivalent, yearlyEquivalent } from '../logic/analytics';
import { normalize } from '../logic/categorizer';
import { FREQUENCY_LABELS, fromISODate } from '../logic/dates';
import { formatCents, formatCentsCompact } from '../logic/money';
import type { Scope, ScopeFilter, Transaction, TxType } from '../types';

type Tab = ScopeFilter | 'subs';
type TypeFilter = TxType | 'all';
type SortKey = 'amount' | 'due';

const TABS: Array<{ value: Tab; label: string }> = [
  { value: 'both', label: 'Tout' },
  { value: 'perso', label: 'Perso' },
  { value: 'pro', label: 'Pro' },
  { value: 'subs', label: 'Abonnements' },
];

/**
 * Écran unique regroupant Perso, Pro et Abonnements.
 * Les onglets pilotent le scope global — plus de double barre de navigation.
 */
export function Movements() {
  const txs = useTransactions();
  const categories = useCategories();
  const badges = useBadges();
  const repo = useRepo();
  const { scope, setScope } = useScope();
  const { range } = usePeriod();

  const [subsView, setSubsView] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [badgeFilter, setBadgeFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState<SortKey>('amount');

  const tab: Tab = subsView ? 'subs' : scope;
  const { currency } = useSettings();
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  // Ouverture directe d'une transaction depuis la recherche globale.
  const [params, setParams] = useSearchParams();
  const requestedId = params.get('tx');
  useEffect(() => {
    if (!requestedId) return;
    const found = txs.find((t) => t.id === requestedId);
    if (found) {
      setEditing(found);
      setFormOpen(true);
      setParams({}, { replace: true });
    }
  }, [requestedId, txs, setParams]);

  function selectTab(next: Tab) {
    if (next === 'subs') {
      setSubsView(true);
    } else {
      setSubsView(false);
      setScope(next);
    }
  }

  const inScope = useMemo(
    () => txs.filter((tx) => scope === 'both' || tx.scope === scope),
    [txs, scope],
  );

  /** Filtres communs aux deux vues (recherche, type, catégorie, badge). */
  const matchesFilters = useMemo(() => {
    const q = normalize(search);
    return (tx: Transaction) => {
      if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
      if (categoryFilter !== 'all' && tx.categoryId !== categoryFilter) return false;
      if (badgeFilter && !tx.badges.includes(badgeFilter)) return false;
      if (q) {
        const cat = catById.get(tx.categoryId)?.label ?? '';
        const haystack = `${tx.label} ${tx.note ?? ''} ${cat}`;
        if (!normalize(haystack).includes(q)) return false;
      }
      return true;
    };
  }, [search, typeFilter, categoryFilter, badgeFilter, catById]);

  const periodTxs = useMemo(
    () => inScope.filter((tx) => inRange(tx, range)),
    [inScope, range],
  );
  const listed = useMemo(() => periodTxs.filter(matchesFilters), [periodTxs, matchesFilters]);

  const revenues = periodTxs.filter((t) => t.type === 'revenue').reduce((a, t) => a + t.amount, 0);
  const expenses = periodTxs.filter((t) => t.type === 'expense').reduce((a, t) => a + t.amount, 0);

  const groups = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const tx of listed) {
      const list = map.get(tx.date) ?? [];
      list.push(tx);
      map.set(tx.date, list);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [listed]);

  // ------------------------------------------------------------ abonnements
  const dormantIds = useMemo(
    () => new Set(dormantSubscriptions(txs, 'both').map((tx) => tx.id)),
    [txs],
  );
  const allSubs = useMemo(
    () => inScope.filter((tx) => tx.isRecurring).filter(matchesFilters),
    [inScope, matchesFilters],
  );
  const subSections: Scope[] = scope === 'both' ? ['perso', 'pro'] : [scope];
  const globalMonthly = allSubs
    .filter((tx) => tx.type === 'expense')
    .reduce((acc, tx) => acc + monthlyEquivalent(tx), 0);

  function sortSubs(list: Transaction[]): Transaction[] {
    return [...list].sort((a, b) =>
      sort === 'amount'
        ? monthlyEquivalent(b) - monthlyEquivalent(a)
        : (a.nextDueDate ?? '9999') < (b.nextDueDate ?? '9999')
          ? -1
          : 1,
    );
  }

  async function handleDelete(tx: Transaction) {
    if (window.confirm(`Supprimer « ${tx.label} » ?`)) await repo.deleteTransaction(tx.id);
  }

  const usedCategories = categories.filter((c) => scope === 'both' || c.scope === 'both' || c.scope === scope);
  const filtersActive = typeFilter !== 'all' || categoryFilter !== 'all' || badgeFilter !== null;

  return (
    <div className="flex flex-col gap-4">
      {/* Onglets — remplacent les 3 pages séparées */}
      <div className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => selectTab(t.value)}
            aria-current={tab === t.value}
            className={`min-h-[40px] shrink-0 cursor-pointer rounded-2xl px-4 text-sm font-semibold transition-colors ${
              tab === t.value
                ? 'bg-gradient-flow text-white shadow-lg shadow-accent/20'
                : 'glass text-ink-2 hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subsView ? (
        <p className="px-1 text-[11px] text-ink-3">
          Portée : {scope === 'both' ? 'perso + pro' : scope} — change-la depuis les onglets.
        </p>
      ) : (
        <PeriodSelector />
      )}

      {/* Recherche + filtres */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={subsView ? 'Rechercher un abonnement…' : 'Rechercher un libellé, une note, une catégorie…'}
            className="min-h-[44px] w-full rounded-2xl border border-line bg-surface px-10 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              aria-label="Effacer la recherche"
              className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-ink-3 hover:text-ink"
            >
              <X size={15} />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters((s) => !s)}
          aria-label="Filtres"
          aria-expanded={showFilters}
          className={`glass flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-2xl transition-colors ${
            showFilters || filtersActive ? 'text-accent-2' : 'text-ink-2'
          }`}
        >
          <SlidersHorizontal size={18} />
        </button>
      </div>

      {showFilters && (
        <Card className="flex flex-col gap-3">
          <Segmented
            options={[
              { value: 'all', label: 'Tout' },
              { value: 'expense', label: 'Dépenses' },
              { value: 'revenue', label: 'Revenus' },
            ]}
            value={typeFilter}
            onChange={setTypeFilter}
            size="sm"
          />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Filtrer par catégorie"
            className="min-h-[44px] w-full cursor-pointer rounded-2xl border border-line bg-surface-2 px-4 text-sm"
          >
            <option value="all">Toutes les catégories</option>
            {usedCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          {badges.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {badges.map((b) => (
                <BadgeChip
                  key={b.id}
                  badge={b}
                  size="md"
                  active={badgeFilter === b.id}
                  onClick={() => setBadgeFilter((cur) => (cur === b.id ? null : b.id))}
                />
              ))}
            </div>
          )}
          {filtersActive && (
            <button
              onClick={() => {
                setTypeFilter('all');
                setCategoryFilter('all');
                setBadgeFilter(null);
              }}
              className="cursor-pointer self-start text-xs text-accent-2 hover:underline"
            >
              Réinitialiser les filtres
            </button>
          )}
        </Card>
      )}

      {subsView ? (
        <>
          <Card className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-ink-3">Coût mensuel des abonnements</p>
              <AnimatedAmount cents={globalMonthly} currency={currency} className="text-2xl font-bold" />
              <p className="mt-0.5 text-[11px] text-ink-3">
                soit {formatCentsCompact(globalMonthly * 12, currency)}/an
              </p>
            </div>
            <Segmented
              options={[
                { value: 'amount', label: 'Montant' },
                { value: 'due', label: 'Échéance' },
              ]}
              value={sort}
              onChange={setSort}
              size="sm"
            />
          </Card>

          {subSections.map((s, i) => {
            const sectionSubs = sortSubs(allSubs.filter((tx) => tx.scope === s));
            const monthly = sectionSubs
              .filter((tx) => tx.type === 'expense')
              .reduce((acc, tx) => acc + monthlyEquivalent(tx), 0);

            return (
              <Card key={s} delay={0.05 + i * 0.08}>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-base font-semibold">
                    <RefreshCcw size={16} className={s === 'perso' ? 'text-accent' : 'text-accent-2'} />
                    {s === 'perso' ? 'Perso' : 'Pro'}
                  </h2>
                  <span className="amount text-sm font-semibold text-ink-2">
                    {formatCentsCompact(monthly, currency)}/mois
                  </span>
                </div>

                {sectionSubs.length === 0 ? (
                  <EmptyState
                    icon={RefreshCcw}
                    title={search ? 'Aucun résultat' : `Aucun abonnement ${s}`}
                    hint={
                      search
                        ? 'Essaie un autre terme de recherche.'
                        : 'Coche « récurrent » sur une transaction pour la voir apparaître ici.'
                    }
                  />
                ) : (
                  <ul className="flex flex-col gap-1">
                    {sectionSubs.map((tx) => {
                      const dormant = dormantIds.has(tx.id) && tx.type === 'expense';
                      return (
                        <li key={tx.id}>
                          <button
                            onClick={() => {
                              setEditing(tx);
                              setFormOpen(true);
                            }}
                            className={`flex w-full cursor-pointer items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition-colors ${
                              dormant ? 'bg-warn/8 ring-1 ring-warn/30' : 'hover:bg-surface-2/60'
                            }`}
                          >
                            <TxVisual tx={tx} category={catById.get(tx.categoryId)} size={40} />
                            <div className="min-w-0 flex-1">
                              <p className="flex items-center gap-2 truncate text-sm font-medium">
                                {tx.label}
                                {dormant && (
                                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-warn/15 px-2 py-0.5 text-[10px] font-semibold text-warn">
                                    <AlarmClockOff size={10} />
                                    Dormant
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-ink-3">
                                {tx.recurringFrequency
                                  ? FREQUENCY_LABELS[tx.recurringFrequency]
                                  : 'Mensuel'}
                                {tx.nextDueDate &&
                                  ` · prochaine : ${fromISODate(tx.nextDueDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`}
                              </p>
                            </div>
                            <div className="text-right">
                              <p
                                className={`amount text-sm font-semibold ${tx.type === 'revenue' ? 'text-pos' : ''}`}
                              >
                                {tx.type === 'revenue' ? '+' : ''}
                                {formatCents(tx.amount, tx.currency)}
                              </p>
                              <p className="amount text-[11px] text-ink-3">
                                {formatCentsCompact(yearlyEquivalent(tx), currency)}/an
                              </p>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            );
          })}
        </>
      ) : (
        <>
          <Card className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs text-ink-3">Revenus</p>
              <AnimatedAmount cents={revenues} className="text-base font-semibold text-pos" />
            </div>
            <div>
              <p className="text-xs text-ink-3">Dépenses</p>
              <AnimatedAmount cents={expenses} className="text-base font-semibold" />
            </div>
            <div className="text-right">
              <p className="text-xs text-ink-3">Net</p>
              <AnimatedAmount
                cents={revenues - expenses}
                className={`text-base font-semibold ${revenues - expenses >= 0 ? 'text-pos' : 'text-neg'}`}
              />
            </div>
          </Card>

          {groups.length === 0 ? (
            <Card>
              <EmptyState
                icon={Wallet}
                title={
                  search || filtersActive
                    ? 'Aucun résultat'
                    : 'Aucune transaction sur cette période'
                }
                hint={
                  search || filtersActive
                    ? 'Modifie ta recherche ou réinitialise les filtres.'
                    : 'Ajoute ta première dépense ou ton premier revenu avec le bouton +.'
                }
              />
            </Card>
          ) : (
            groups.map(([date, list], i) => (
              <Card key={date} delay={Math.min(i * 0.04, 0.3)} className="!p-2">
                <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-ink-3">
                  {fromISODate(date).toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </p>
                <div className="flex flex-col gap-1">
                  {list.map((tx) => (
                    <TransactionItem
                      key={tx.id}
                      tx={tx}
                      category={catById.get(tx.categoryId)}
                      badges={badges}
                      onEdit={(t) => {
                        setEditing(t);
                        setFormOpen(true);
                      }}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </Card>
            ))
          )}
        </>
      )}

      <button
        onClick={() => {
          setEditing(null);
          setFormOpen(true);
        }}
        aria-label="Ajouter une transaction"
        className="bg-gradient-flow fixed bottom-24 right-4 z-40 flex h-14 w-14 cursor-pointer items-center justify-center rounded-full text-white shadow-xl shadow-accent/30 transition-transform active:scale-90 md:bottom-8 md:right-8"
      >
        <Plus size={26} />
      </button>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Modifier la transaction' : 'Nouvelle transaction'}
      >
        <TransactionForm
          key={editing?.id ?? 'new'}
          defaultScope={scope === 'both' ? 'perso' : scope}
          editing={editing}
          onSaved={() => setFormOpen(false)}
        />
      </Modal>
    </div>
  );
}
