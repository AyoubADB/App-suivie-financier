import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info, Loader2, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { askAiCoach, buildCoachSummary } from '../../logic/aiCoach';
import { generateInsights, type CoachContext } from '../../logic/coach';
import { formatCents } from '../../logic/money';
import type {
  BudgetStatus,
  Category,
  Insight,
  PeriodStats,
  ScopeFilter,
  Transaction,
} from '../../types';
import { Card } from '../ui/Card';

interface CoachSectionProps {
  stats: PeriodStats;
  allTxs: Transaction[];
  categories: Category[];
  scope: ScopeFilter;
  periodLabel: string;
  currency: string;
  /** État des budgets de la période — alimente un conseil supplémentaire. */
  budgetStatuses?: BudgetStatus[];
  /** Échéances, objectifs et réglages pro — débloquent trois conseils de plus. */
  coachContext?: CoachContext;
}

const SEVERITY_STYLE: Record<Insight['severity'], { icon: typeof Info; className: string }> = {
  good: { icon: CheckCircle2, className: 'text-pos' },
  info: { icon: Info, className: 'text-accent-2' },
  warn: { icon: AlertTriangle, className: 'text-warn' },
};

export function CoachSection({
  stats,
  allTxs,
  categories,
  scope,
  periodLabel,
  currency,
  budgetStatuses = [],
  coachContext = {},
}: CoachSectionProps) {
  const insights = generateInsights(
    stats,
    allTxs,
    categories,
    scope,
    currency,
    budgetStatuses,
    coachContext,
  );
  const apiKey = localStorage.getItem('flow.apiKey') ?? '';

  const [aiText, setAiText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  async function runAiAnalysis() {
    setAiLoading(true);
    setAiError('');
    try {
      const summary = buildCoachSummary(
        stats,
        allTxs,
        categories,
        scope,
        periodLabel,
        currency,
        insights,
      );
      setAiText(await askAiCoach(summary, apiKey));
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Erreur inconnue.');
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Sparkles size={17} className="text-accent" />
          Coach financier
        </h2>
        {apiKey && (
          <button
            onClick={() => void runAiAnalysis()}
            disabled={aiLoading}
            className="bg-gradient-flow flex min-h-[38px] cursor-pointer items-center gap-2 rounded-full px-4 text-xs font-semibold text-white transition-transform active:scale-95 disabled:opacity-60"
          >
            {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Analyse approfondie
          </button>
        )}
      </div>

      {insights.length === 0 ? (
        <p className="py-4 text-sm text-ink-3">
          Ajoute quelques transactions pour recevoir des conseils chiffrés.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {insights.map((insight, i) => {
            const { icon: Icon, className } = SEVERITY_STYLE[insight.severity];
            return (
              <motion.li
                key={insight.title}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                className="flex gap-3 rounded-2xl bg-surface-2/60 p-3.5"
              >
                <Icon size={18} className={`mt-0.5 shrink-0 ${className}`} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-snug">{insight.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-2">{insight.message}</p>
                  {insight.potentialSaving != null && insight.potentialSaving > 0 && (
                    <p className="amount mt-1 text-xs font-semibold text-pos">
                      Économie potentielle : {formatCents(insight.potentialSaving, currency)}/mois
                    </p>
                  )}
                </div>
              </motion.li>
            );
          })}
        </ul>
      )}

      {aiError && <p className="mt-3 text-sm text-neg">{aiError}</p>}
      {aiText && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 rounded-2xl border border-accent/25 bg-accent/8 p-4"
        >
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-accent">
            <Sparkles size={13} />
            Analyse IA
          </p>
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-ink-2">{aiText}</div>
        </motion.div>
      )}

      {!apiKey && (
        <p className="mt-3 text-[11px] text-ink-3">
          Astuce : ajoute une clé API Anthropic dans les réglages pour débloquer l'analyse IA
          approfondie. L'app reste 100 % fonctionnelle sans.
        </p>
      )}
    </Card>
  );
}
