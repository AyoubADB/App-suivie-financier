import { BookOpen, Landmark, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { ActivitiesCard } from '../../components/pro/ActivitiesCard';
import { ProSummary } from '../../components/pro/ProSummary';
import { Card } from '../../components/ui/Card';
import { useSettings } from '../../context/SettingsContext';
import { formatCents } from '../../logic/money';

/** Repères réglementaires, écrits pour quelqu'un qui découvre le sujet. */
const GUIDE: Array<{ q: string; a: string }> = [
  {
    q: 'Pourquoi mettre de côté un pourcentage de chaque encaissement ?',
    a: "En micro-entreprise, tu déclares ton chiffre d'affaires et l'URSSAF prélève des cotisations dessus, chaque mois ou chaque trimestre. L'argent encaissé n'est donc pas entièrement à toi. Provisionner dès l'encaissement évite le trou de trésorerie au moment de l'appel de cotisations.",
  },
  {
    q: 'C’est quoi la franchise en base de TVA ?',
    a: "Tant que ton chiffre d'affaires reste sous un seuil, tu ne factures pas de TVA à tes clients et tu n'en récupères pas sur tes achats. Tes factures portent la mention « TVA non applicable, art. 293 B du CGI ». Au-dessus du seuil, tu bascules en TVA : tu la factures, tu la récupères, et tu reverses la différence.",
  },
  {
    q: 'Et le plafond du régime micro ?',
    a: "C'est un autre seuil, plus haut : au-delà, tu sors du régime micro-entreprise et tu passes au régime réel, avec une comptabilité complète. Les deux seuils sont indépendants — on peut être redevable de la TVA tout en restant en micro.",
  },
  {
    q: 'Pourquoi séparer mes activités ?',
    a: "Parce que la moyenne ment. Une activité qui tourne bien peut masquer une autre qui coûte plus qu'elle ne rapporte. En rattachant chaque mouvement à une activité, tu vois la marge réelle de chacune et tu sais laquelle développer ou arrêter.",
  },
  {
    q: 'Que fait l’app, et que ne fait-elle pas ?',
    a: "Elle calcule des estimations à partir de ce que tu saisis et te prévient avant les seuils. Elle ne remplit aucune déclaration, ne connaît pas ta situation exacte et n'a pas valeur de conseil fiscal. Les taux et seuils se règlent à la main, parce qu'ils changent et dépendent de ton activité.",
  },
];

/** Vue professionnelle complète : chiffres, activités, et de quoi comprendre. */
export function ProSection() {
  const { currency, urssafRate, vatThreshold, revenueCeiling } = useSettings();
  const [openGuide, setOpenGuide] = useState<number | null>(0);

  return (
    <div className="flex flex-col gap-4">
      <ProSummary />

      <ActivitiesCard />

      <Card delay={0.15}>
        <h2 className="mb-1 flex items-center gap-2 text-base font-semibold">
          <BookOpen size={17} className="text-accent-2" />
          Comprendre les seuils
        </h2>
        <p className="mb-3 text-xs text-ink-3">
          Tes réglages actuels : {Math.round(urssafRate * 1000) / 10} % de cotisations, franchise de
          TVA à {formatCents(vatThreshold, currency)}, plafond du régime à{' '}
          {formatCents(revenueCeiling, currency)}.
        </p>

        <ul className="flex flex-col divide-y divide-line">
          {GUIDE.map((item, i) => (
            <li key={item.q}>
              <button
                type="button"
                onClick={() => setOpenGuide(openGuide === i ? null : i)}
                aria-expanded={openGuide === i}
                className="flex min-h-[52px] w-full cursor-pointer items-center gap-3 py-3 text-left"
              >
                <span className="min-w-0 flex-1 text-sm font-medium">{item.q}</span>
                <span className="shrink-0 text-ink-3">{openGuide === i ? '−' : '+'}</span>
              </button>
              {openGuide === i && (
                <p className="pb-3 text-sm leading-relaxed text-ink-2">{item.a}</p>
              )}
            </li>
          ))}
        </ul>

        <p className="mt-3 flex items-start gap-2 rounded-2xl bg-surface-2/60 px-3.5 py-3 text-[11px] leading-relaxed text-ink-3">
          <TriangleAlert size={14} className="mt-0.5 shrink-0 text-warn" />
          <span>
            Ces explications sont des repères généraux sur la micro-entreprise française. Ta
            situation peut différer : en cas de doute, l'URSSAF, le service des impôts des
            entreprises ou un comptable trancheront.
          </span>
        </p>
      </Card>

      <Card delay={0.2}>
        <h2 className="mb-2 flex items-center gap-2 text-base font-semibold">
          <Landmark size={17} className="text-accent" />
          Le réflexe qui change tout
        </h2>
        <p className="text-sm leading-relaxed text-ink-2">
          Ouvre un second compte, et vire dessus le montant « à provisionner » affiché plus haut
          après chaque encaissement. Le solde de ton compte courant redevient alors une information
          fiable : ce que tu y vois est vraiment disponible.
        </p>
      </Card>
    </div>
  );
}
