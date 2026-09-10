import { useMemo } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { BudgetSection } from '../components/budgets/BudgetSection';
import { CoachSection } from '../components/coach/CoachSection';
import { GoalsCard } from '../components/goals/GoalsCard';
import { PeriodSelector } from '../components/PeriodSelector';
import { SectionSwitcher } from '../components/layout/SectionSwitcher';
import { Segmented } from '../components/ui/Segmented';
import {
  useBudgets,
  useCategories,
  useGoals,
  useScheduled,
  useTransactions,
} from '../context/DataContext';
import { usePeriod } from '../context/PeriodContext';
import { useScope } from '../context/ScopeContext';
import { useSettings } from '../context/SettingsContext';
import { computePeriodStats } from '../logic/analytics';
import { computeBudgetStatuses } from '../logic/budgets';
import { formatRangeLabel } from '../logic/dates';
import { BreakdownSection } from './sections/BreakdownSection';
import { FlowSection } from './sections/FlowSection';
import { ForecastSection } from './sections/ForecastSection';
import { ProSection } from './sections/ProSection';
import { SubscriptionsSection } from './sections/SubscriptionsSection';
import { VatSection } from './sections/VatSection';
import { findSection } from './sections/registry';

/**
 * Page d'une section détaillée de la vue d'ensemble.
 * L'en-tête est commun — sélecteur de section, portée, période — pour qu'on
 * puisse passer d'une vue à l'autre sans perdre le contexte de lecture.
 */
export function SectionView() {
  const { slug } = useParams();
  const { proEnabled } = useSettings();
  const { scope, setScope } = useScope();
  const section = findSection(slug);

  if (!section || (section.proOnly && !proEnabled)) return <Navigate to="/" replace />;

  return (
    <div className="flex flex-col gap-4">
      <SectionSwitcher current={section} />

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

      <Body slug={section.slug} />
    </div>
  );
}

function Body({ slug }: { slug: string }) {
  switch (slug) {
    case 'depenses':
      return <FlowSection type="expense" />;
    case 'revenus':
      return <FlowSection type="revenue" />;
    case 'repartition':
      return <BreakdownSection />;
    case 'previsionnel':
      return <ForecastSection />;
    case 'budgets':
      return <BudgetSection />;
    case 'objectifs':
      return <GoalsCard />;
    case 'abonnements':
      return <SubscriptionsSection />;
    case 'coach':
      return <CoachBody />;
    case 'pro':
      return <ProSection />;
    case 'tva':
      return <VatSection />;
    default:
      return <Navigate to="/" replace />;
  }
}

/** Le coach a besoin des mêmes agrégats que le tableau de bord. */
function CoachBody() {
  const txs = useTransactions();
  const categories = useCategories();
  const budgets = useBudgets();
  const scheduled = useScheduled();
  const goals = useGoals();
  const { scope } = useScope();
  const { period, range } = usePeriod();
  const { currency, proEnabled, urssafRate } = useSettings();

  const stats = useMemo(
    () => computePeriodStats(txs, categories, scope, period, range),
    [txs, categories, scope, period, range],
  );
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
  );
}
