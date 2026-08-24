import { CalendarClock, ChartPie, LineChart, PiggyBank } from 'lucide-react';
import { useMemo } from 'react';
import { BudgetSection } from '../components/budgets/BudgetSection';
import { ForecastCard } from '../components/forecast/ForecastCard';
import { GoalsCard } from '../components/goals/GoalsCard';
import { MigrationBanner } from '../components/MigrationBanner';
import { ProSummary } from '../components/pro/ProSummary';
import { PendingQueue } from '../components/scheduled/PendingQueue';
import { PeriodSelector } from '../components/PeriodSelector';
import { CategoryDonut } from '../components/charts/CategoryDonut';
import { TrendChart } from '../components/charts/TrendChart';
import { CoachSection } from '../components/coach/CoachSection';
import { TxVisual } from '../components/transactions/TxVisual';
import { AnimatedAmount } from '../components/ui/AnimatedAmount';
import { Card } from '../components/ui/Card';
import { DeltaPill } from '../components/ui/DeltaPill';
import { EmptyState } from '../components/ui/EmptyState';
import { Segmented } from '../components/ui/Segmented';
import { usePeriod } from '../context/PeriodContext';
import { useSettings } from '../context/SettingsContext';
import { useScope } from '../context/ScopeContext';
import {
  useBudgets,
  useCategories,
  useGoals,
  useScheduled,
  useTransactions,
} from '../context/DataContext';
import { computeBudgetStatuses } from '../logic/budgets';
import { activeSubscriptions, computePeriodStats } from '../logic/analytics';
import { formatRangeLabel, fromISODate } from '../logic/dates';
import { formatCents, formatPct } from '../logic/money';

export function Dashboard() {
  const txs = useTransactions();
  const categories = useCategories();
  const { scope, setScope } = useScope();
  const { period, range } = usePeriod();
  const { currency, savingsGoal, proEnabled, urssafRate } = useSettings();
  const scheduled = useScheduled();
  const goals = useGoals();

  const stats = useMemo(
    () => computePeriodStats(txs, categories, scope, period, range),
    [txs, categories, scope, period, range],
  );

  const upcoming = useMemo(() => {
    return activeSubscriptions(txs, scope)
      .filter((tx) => tx.nextDueDate)
      .sort((a, b) => (a.nextDueDate! < b.nextDueDate! ? -1 : 1))
      .slice(0, 5);
  }, [txs, scope]);

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  // Les budgets nourrissent le coach : un dépassement est le conseil le plus
  // actionnable qu'on puisse donner.
  const budgets = useBudgets();
  const budgetStatuses = useMemo(
    () =>
      computeBudgetStatuses(
        budgets.filter((b) => scope === 'both' || b.scope === 'both' || b.scope === scope),
        txs,
        categories,
        range,
      ),
    [budgets, txs, categories, range, scope],
  );

  return (
    <div className="flex flex-col gap-4">
      <MigrationBanner />

      {/* Échéances tombées depuis la dernière visite : rien n'est créé sans validation. */}
      <PendingQueue />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {proEnabled && (
          <Segmented
            options={[
              { value: 'both', label: 'Tout' },
              { value: 'perso', label: 'Perso' },
              { value: 'pro', label: 'Pro' },
            ]}
            value={scope}
            onChange={setScope}
            size="sm"
          />
        )}
        <div className="flex-1">
          <PeriodSelector />
        </div>
      </div>

      {/* Cartes clés */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card delay={0}>
          <p className="text-xs text-ink-3">Revenus</p>
          <AnimatedAmount cents={stats.revenues} currency={currency} className="block text-xl font-bold text-pos" />
          <div className="mt-1.5">
            <DeltaPill delta={stats.revenuesDelta} upIsGood />
          </div>
        </Card>
        <Card delay={0.05}>
          <p className="text-xs text-ink-3">Dépenses</p>
          <AnimatedAmount cents={stats.expenses} currency={currency} className="block text-xl font-bold" />
          <div className="mt-1.5">
            <DeltaPill delta={stats.expensesDelta} upIsGood={false} />
          </div>
        </Card>
        <Card delay={0.1}>
          <p className="text-xs text-ink-3">Solde net</p>
          <AnimatedAmount
            cents={stats.net}
            currency={currency}
            className={`block text-xl font-bold ${stats.net >= 0 ? 'text-pos' : 'text-neg'}`}
          />
          <p className="mt-1.5 text-[11px] text-ink-3">{stats.txCount} transactions</p>
        </Card>
        <Card delay={0.15}>
          <p className="flex items-center gap-1 text-xs text-ink-3">
            <PiggyBank size={13} />
            Taux d'épargne
          </p>
          <p className={`amount text-xl font-bold ${
            stats.savingsRate === null
              ? 'text-ink-3'
              : stats.savingsRate >= savingsGoal
                ? 'text-pos'
                : stats.savingsRate >= 0
                  ? 'text-warn'
                  : 'text-neg'
          }`}
          >
            {stats.savingsRate === null ? '—' : formatPct(stats.savingsRate)}
          </p>
          <p className="mt-1.5 text-[11px] text-ink-3">
            objectif : {Math.round(savingsGoal * 100)} %
          </p>
        </Card>
      </div>

      {/* Graphiques */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card delay={0.2}>
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
            <LineChart size={17} className="text-accent-2" />
            Évolution
          </h2>
          {stats.txCount === 0 ? (
            <EmptyState
              icon={LineChart}
              title="Rien à tracer pour l'instant"
              hint="Les courbes revenus / dépenses apparaîtront dès la première transaction."
            />
          ) : (
            <TrendChart series={stats.series} currency={currency} />
          )}
        </Card>
        <Card delay={0.25}>
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
            <ChartPie size={17} className="text-accent" />
            Répartition des dépenses
          </h2>
          <CategoryDonut breakdown={stats.byCategory} currency={currency} />
        </Card>
      </div>

      <ForecastCard />

      <BudgetSection />

      <GoalsCard />

      {/* Synthèse de l'activité indépendante, sur la vue Pro uniquement. */}
      {proEnabled && scope === 'pro' && <ProSummary />}

      {/* Coach */}
      <CoachSection
        stats={stats}
        allTxs={txs}
        categories={categories}
        scope={scope}
        periodLabel={formatRangeLabel(range)}
        currency={currency}
        budgetStatuses={budgetStatuses}
        coachContext={{ scheduled, goals, proEnabled, urssafRate }}
      />

      {/* Prochaines échéances */}
      <Card delay={0.3}>
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
          <CalendarClock size={17} className="text-accent-2" />
          Prochaines échéances
        </h2>
        {upcoming.length === 0 ? (
          <p className="py-3 text-sm text-ink-3">
            Aucun abonnement à venir — tague une transaction comme récurrente pour la voir ici.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {upcoming.map((tx) => (
              <li key={tx.id} className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-surface-2/60">
                <TxVisual tx={tx} category={catById.get(tx.categoryId)} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{tx.label}</p>
                  <p className="text-xs text-ink-3">
                    {fromISODate(tx.nextDueDate!).toLocaleDateString('fr-FR', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    })}
                    {' · '}
                    {tx.scope}
                  </p>
                </div>
                <span className="amount text-sm font-semibold">
                  {formatCents(tx.amount, tx.currency)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
