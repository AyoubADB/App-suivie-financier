import { CircleAlert, Percent, TriangleAlert } from 'lucide-react';
import { useMemo } from 'react';
import { Card } from '../../components/ui/Card';
import { useTransactions } from '../../context/DataContext';
import { usePeriod } from '../../context/PeriodContext';
import { useSettings } from '../../context/SettingsContext';
import { formatRangeLabel } from '../../logic/dates';
import { formatCents } from '../../logic/money';
import { thresholdStatus, yearRevenue } from '../../logic/pro';
import { vatSummary } from '../../logic/vat';

/**
 * Synthèse de TVA.
 * Volontairement bavarde : la TVA est le sujet où une erreur coûte cher et
 * où l'app ne peut pas décider à la place de l'utilisateur.
 */
export function VatSection() {
  const txs = useTransactions();
  const { range } = usePeriod();
  const { currency, privacyMode, vatThreshold } = useSettings();

  const summary = useMemo(() => vatSummary(txs, range), [txs, range]);
  const year = new Date().getFullYear();
  const franchise = thresholdStatus(yearRevenue(txs, year), vatThreshold);
  const hide = (cents: number) => (privacyMode ? '•••' : formatCents(cents, currency));

  return (
    <div className="flex flex-col gap-4">
      <Card delay={0}>
        <h2 className="mb-1 flex items-center gap-2 text-base font-semibold">
          <Percent size={17} className="text-accent" />
          TVA · {formatRangeLabel(range)}
        </h2>
        <p className="mb-3 text-xs text-ink-3">
          Calculée uniquement sur les mouvements dont tu as isolé la TVA à la saisie.
        </p>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-surface-2/60 p-3.5">
            <p className="text-xs text-ink-3">TVA collectée</p>
            <p className="amount mt-1 text-xl font-bold">{hide(summary.collected)}</p>
            <p className="mt-1 text-[11px] text-ink-3">Facturée à tes clients</p>
          </div>
          <div className="rounded-2xl bg-surface-2/60 p-3.5">
            <p className="text-xs text-ink-3">TVA déductible</p>
            <p className="amount mt-1 text-xl font-bold">{hide(summary.deductible)}</p>
            <p className="mt-1 text-[11px] text-ink-3">Payée sur tes achats</p>
          </div>
          <div
            className={`rounded-2xl p-3.5 ${summary.due >= 0 ? 'bg-warn/10' : 'bg-pos/10'}`}
          >
            <p className={`text-xs ${summary.due >= 0 ? 'text-warn' : 'text-pos'}`}>
              {summary.due >= 0 ? 'À reverser' : 'Crédit de TVA'}
            </p>
            <p
              className={`amount mt-1 text-xl font-bold ${
                summary.due >= 0 ? 'text-warn' : 'text-pos'
              }`}
            >
              {hide(Math.abs(summary.due))}
            </p>
            <p className="mt-1 text-[11px] text-ink-3">Collectée − déductible</p>
          </div>
        </div>

        {summary.undocumented > 0 && (
          <p className="mt-3 flex items-start gap-2 rounded-2xl bg-surface-2/60 px-3.5 py-3 text-xs text-ink-2">
            <CircleAlert size={15} className="mt-0.5 shrink-0 text-warn" />
            <span>
              {summary.undocumented} mouvement{summary.undocumented > 1 ? 's' : ''} pro sur la
              période {summary.undocumented > 1 ? 'n’ont' : 'n’a'} pas de TVA renseignée. Le total
              ci-dessus est donc incomplet — ouvre-les et active « Séparer la TVA » pour les
              intégrer.
            </span>
          </p>
        )}
      </Card>

      <Card delay={0.05}>
        <h2 className="mb-3 text-base font-semibold">Es-tu concerné par la TVA ?</h2>
        <div className="flex flex-col gap-3 text-sm leading-relaxed text-ink-2">
          <p>
            En micro-entreprise, tu démarres en <strong>franchise en base</strong> : tu ne factures
            pas de TVA, tu ne la récupères pas non plus, et tes factures portent la mention « TVA
            non applicable, art. 293 B du CGI ».
          </p>
          <p>
            Cette franchise s'arrête quand ton chiffre d'affaires dépasse le seuil. À partir de là,
            tu factures la TVA à tes clients, tu récupères celle de tes achats, et tu reverses la
            différence.
          </p>

          <div className="rounded-2xl border border-line bg-surface-2/50 p-3.5">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <span className="flex items-center gap-1.5 text-sm font-medium">
                {franchise.level !== 'ok' && <TriangleAlert size={14} className="text-warn" />}
                Ton chiffre d'affaires {year}
              </span>
              <span className="amount text-xs font-semibold">
                {hide(franchise.revenue)}
                <span className="text-ink-3"> / {hide(franchise.threshold)}</span>
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className={`h-full rounded-full transition-[width] duration-500 ${
                  franchise.level === 'over'
                    ? 'bg-neg'
                    : franchise.level === 'warn'
                      ? 'bg-warn'
                      : 'bg-accent'
                }`}
                style={{ width: `${Math.min(100, franchise.ratio * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-ink-3">
              {franchise.level === 'over'
                ? `Seuil dépassé de ${formatCents(-franchise.remaining, currency)}. La TVA devient facturable — vérifie ta situation auprès de ton comptable ou du service des impôts.`
                : `Il te reste ${formatCents(franchise.remaining, currency)} avant le seuil de franchise.`}
            </p>
          </div>

          <p className="text-xs text-ink-3">
            Le seuil se règle dans Réglages → Cotisations &amp; seuils : il dépend de ton activité
            (prestations de services ou vente de marchandises) et change avec la loi de finances.
            Ces chiffres sont indicatifs et ne remplacent pas ta déclaration.
          </p>
        </div>
      </Card>

      <Card delay={0.1}>
        <h2 className="mb-3 text-base font-semibold">Comment isoler la TVA</h2>
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm leading-relaxed text-ink-2">
          <li>
            Saisis le montant <strong>TTC</strong>, celui qui quitte réellement ton compte.
          </li>
          <li>
            Active <strong>Séparer la TVA</strong> dans le formulaire et choisis le taux : 20 % pour
            la plupart des prestations, 10 % pour la restauration et certains travaux, 5,5 % pour
            l'alimentaire.
          </li>
          <li>
            L'app calcule le hors-taxes et la TVA. Si la facture affiche un centime d'écart
            d'arrondi, corrige le montant de TVA à la main.
          </li>
        </ol>
        <p className="mt-3 text-[11px] text-ink-3">
          Le TTC reste le montant de référence partout ailleurs dans l'app — soldes, budgets,
          prévisionnel — parce que c'est lui qui bouge sur le compte en banque.
        </p>
      </Card>
    </div>
  );
}
