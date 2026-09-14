import { CalendarClock, ChartPie, LineChart, PiggyBank } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BudgetSection } from '../components/budgets/BudgetSection';
import { ForecastCard } from '../components/forecast/ForecastCard';
import { GoalsCard } from '../components/goals/GoalsCard';
import { MigrationBanner } from '../components/MigrationBanner';
import { PeriodSelector } from '../components/PeriodSelector';
import { ActivityFilter, ALL_ACTIVITIES } from '../components/pro/ActivityFilter';
import { ProSummary } from '../components/pro/ProSummary';
import { CustomiseOverview } from '../components/overview/CustomiseOverview';
import { ReserveCard } from '../components/overview/ReserveCard';
import { SubscriptionsCard } from '../components/overview/SubscriptionsCard';
import { visibleBlocks } from '../components/overview/blocks';
import { PendingQueue } from '../components/scheduled/PendingQueue';
import { SectionSwitcher } from '../components/layout/SectionSwitcher';
import { CategoryDonut } from '../components/charts/CategoryDonut';
import { TrendChart } from '../components/charts/TrendChart';
import { CoachSection } from '../components/coach/CoachSection';
import { TxVisual } from '../components/transactions/TxVisual';
import { AnimatedAmount } from '../components/ui/AnimatedAmount';
import { Card } from '../components/ui/Card';
import { DeltaPill } from '../components/ui/DeltaPill';
import { DetailLink } from '../components/ui/DetailLink';
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
import { OVERVIEW } from './sections/registry';

export function Dashboard() {
  const allTxs = useTransactions();
  const categories = useCategories();
  const { scope, setScope } = useScope();
  const { period, range } = usePeriod();
  const { currency, savingsGoal, proEnabled, urssafRate, hiddenBlocks } = useSettings();
  const scheduled = useScheduled();
  const goals = useGoals();
  /** Isole une casquette : la moyenne de deux activités ne décrit ni l'une ni l'autre. */
  const [activityFilter, setActivityFilter] = useState(ALL_ACTIVITIES);

  const show = visibleBlocks(hiddenBlocks, proEnabled);

  const txs = useMemo(
    () =>
      scope === 'pro' && activityFilter !== ALL_ACTIVITIES
        ? allTxs.filter((tx) => tx.activityId === activityFilter)
        : allTxs,
    [allTxs, scope, activityFilter],
  );

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

      {/* Chaque bloc du tableau de bord a sa page détaillée : la liste
          déroulante y mène sans avoir à chercher. */}
      <div className="md:hidden">
        <SectionSwitcher current={OVERVIEW} />
      </div>

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
        <CustomiseOverview />
      </div>

      {proEnabled && scope === 'pro' && (
        <ActivityFilter value={activityFilter} onChange={setActivityFilter} />
      )}

      {/* Cartes clés — chacune ouvre sa vue détaillée */}
      {show.has('cles') && (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KeyCard to="/vue/revenus" delay={0}>
          <p className="text-xs text-ink-3">Revenus</p>
          <AnimatedAmount
            cents={stats.revenues}
            currency={currency}
            className="block text-xl font-bold text-pos"
          />
          <div className="mt-1.5">
            <DeltaPill delta={stats.revenuesDelta} upIsGood />
          </div>
        </KeyCard>

        <KeyCard to="/vue/depenses" delay={0.05}>
          <p className="text-xs text-ink-3">Dépenses</p>
          <AnimatedAmount
            cents={stats.expenses}
            currency={currency}
            className="block text-xl font-bold"
          />
          <div className="mt-1.5">
            <DeltaPill delta={stats.expensesDelta} upIsGood={false} />
          </div>
        </KeyCard>

        <KeyCard to="/vue/previsionnel" delay={0.1}>
          <p className="text-xs text-ink-3">Solde net</p>
          <AnimatedAmount
            cents={stats.net}
            currency={currency}
            className={`block text-xl font-bold ${stats.net >= 0 ? 'text-pos' : 'text-neg'}`}
          />
          <p className="mt-1.5 text-[11px] text-ink-3">{stats.txCount} transactions</p>
        </KeyCard>

        <KeyCard to="/vue/objectifs" delay={0.15}>
          <p className="flex items-center gap-1 text-xs text-ink-3">
            <PiggyBank size={13} />
            Taux d'épargne
          </p>
          <p
            className={`amount text-xl font-bold ${
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
        </KeyCard>
      </div>
      )}

      {show.has('reserve') && <ReserveCard net={stats.net} detailTo="/vue/previsionnel" />}

      {/* Graphiques */}
      {(show.has('evolution') || show.has('repartition')) && (
      <div className="grid gap-4 lg:grid-cols-2">
        {show.has('evolution') && (
        <Card delay={0.2}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <LineChart size={17} className="text-accent-2" />
              Évolution
            </h2>
            <DetailLink to="/vue/depenses" />
          </div>
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
        )}
        {show.has('repartition') && (
        <Card delay={0.25}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <ChartPie size={17} className="text-accent" />
              Répartition des dépenses
            </h2>
            <DetailLink to="/vue/repartition" />
          </div>
          <CategoryDonut breakdown={stats.byCategory} currency={currency} />
        </Card>
        )}
      </div>
      )}

      {show.has('previsionnel') && <ForecastCard detailTo="/vue/previsionnel" />}

      {show.has('budgets') && <BudgetSection detailTo="/vue/budgets" />}

      {show.has('objectifs') && <GoalsCard detailTo="/vue/objectifs" />}

      {show.has('abonnements') && <SubscriptionsCard detailTo="/vue/abonnements" />}

      {/* Synthèse de l'activité indépendante, sur la vue Pro uniquement. */}
      {show.has('pro') && scope === 'pro' && (
        <>
          <ProSummary />
          <div className="flex justify-end">
            <DetailLink to="/vue/pro" label="Tout le module pro" />
          </div>
        </>
      )}

      {/* Coach */}
      {show.has('coach') && (
      <CoachSection
        stats={stats}
        allTxs={txs}
        categories={categories}
        scope={scope}
        periodLabel={formatRangeLabel(range)}
        currency={currency}
        budgetStatuses={budgetStatuses}
        coachContext={{ scheduled, goals, proEnabled, urssafRate }}
        detailTo="/vue/coach"
        collapsible
      />
      )}

      {/* Prochaines échéances */}
      {show.has('echeances') && (
      <Card delay={0.3}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <CalendarClock size={17} className="text-accent-2" />
            Prochaines échéances
          </h2>
          <DetailLink to="/vue/abonnements" />
        </div>
        {upcoming.length === 0 ? (
          <p className="py-3 text-sm text-ink-3">
            Aucun abonnement à venir — tague une transaction comme récurrente pour la voir ici.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {upcoming.map((tx) => (
              <li
                key={tx.id}
                className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-surface-2/60"
              >
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
      )}
    </div>
  );
}

/** Carte-chiffre du haut : entièrement cliquable vers sa vue détaillée. */
function KeyCard({
  to,
  delay,
  children,
}: {
  to: string;
  delay: number;
  children: React.ReactNode;
}) {
  return (
    <Card delay={delay} className="p-0 sm:p-0">
      <Link to={to} className="block cursor-pointer p-4 transition-colors hover:bg-surface-2/40 sm:p-5">
        {children}
      </Link>
    </Card>
  );
}
