import { Plus, Search, SlidersHorizontal, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PeriodSelector } from '../components/PeriodSelector';
import { TransactionForm } from '../components/transactions/TransactionForm';
import { TransactionItem } from '../components/transactions/TransactionItem';
import { AnimatedAmount } from '../components/ui/AnimatedAmount';
import { BadgeChip } from '../components/ui/BadgeChip';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';
import { Segmented } from '../components/ui/Segmented';
import { usePeriod } from '../context/PeriodContext';
import { useBadges, useCategories, useTransactions } from '../data/hooks';
import { repo } from '../data/repository';
import { inRange } from '../logic/analytics';
import { normalize } from '../logic/categorizer';
import type { Scope, Transaction, TxType } from '../types';

interface TransactionsPageProps {
  scope: Scope;
  title: string;
}

type TypeFilter = TxType | 'all';

/** Écran Perso / Pro — même composant, scope différent. */
export function TransactionsPage({ scope, title }: TransactionsPageProps) {
  const txs = useTransactions() ?? [];
  const categories = useCategories() ?? [];
  const badges = useBadges() ?? [];
  const { range } = usePeriod();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [badgeFilter, setBadgeFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const scoped = useMemo(
    () => txs.filter((tx) => tx.scope === scope && inRange(tx, range)),
    [txs, scope, range],
  );

  const filtered = useMemo(() => {
    const q = normalize(search);
    return scoped.filter((tx) => {
      if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
      if (categoryFilter !== 'all' && tx.categoryId !== categoryFilter) return false;
      if (badgeFilter && !tx.badges.includes(badgeFilter)) return false;
      if (q && !normalize(tx.label).includes(q) && !normalize(tx.note ?? '').includes(q))
        return false;
      return true;
    });
  }, [scoped, typeFilter, categoryFilter, badgeFilter, search]);

  const revenues = scoped.filter((t) => t.type === 'revenue').reduce((a, t) => a + t.amount, 0);
  const expenses = scoped.filter((t) => t.type === 'expense').reduce((a, t) => a + t.amount, 0);

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const usedCategories = categories.filter(
    (c) => (c.scope === 'both' || c.scope === scope),
  );

  // Groupement par jour
  const groups = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const tx of filtered) {
      const list = map.get(tx.date) ?? [];
      list.push(tx);
      map.set(tx.date, list);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [filtered]);

  async function handleDelete(tx: Transaction) {
    if (window.confirm(`Supprimer « ${tx.label} » ?`)) await repo.deleteTransaction(tx.id);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-[57px] z-20 -mx-4 bg-page/85 px-4 py-2 backdrop-blur-xl sm:-mx-6 sm:px-6">
        <PeriodSelector />
      </div>

      {/* Mini-résumé de la période */}
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

      {/* Recherche + filtres */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher…"
            className="min-h-[44px] w-full rounded-2xl border border-line bg-surface px-10 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
          />
        </div>
        <button
          onClick={() => setShowFilters((s) => !s)}
          aria-label="Filtres"
          aria-expanded={showFilters}
          className={`glass flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-2xl transition-colors ${
            showFilters || typeFilter !== 'all' || categoryFilter !== 'all' || badgeFilter
              ? 'text-accent-2'
              : 'text-ink-2'
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
        </Card>
      )}

      {/* Liste groupée par jour */}
      {groups.length === 0 ? (
        <Card>
          <EmptyState
            icon={Wallet}
            title={`Aucune transaction ${title.toLowerCase()} sur la période`}
            hint="Ajoute ta première dépense ou ton premier revenu avec le bouton +."
          />
        </Card>
      ) : (
        groups.map(([date, list], i) => (
          <Card key={date} delay={Math.min(i * 0.04, 0.3)} className="!p-2">
            <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-ink-3">
              {new Date(date).toLocaleDateString('fr-FR', {
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

      {/* Bouton d'ajout flottant */}
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
        title={editing ? 'Modifier la transaction' : `Nouvelle transaction ${title}`}
      >
        <TransactionForm
          key={editing?.id ?? 'new'}
          scope={scope}
          editing={editing}
          onSaved={() => setFormOpen(false)}
        />
      </Modal>
    </div>
  );
}
