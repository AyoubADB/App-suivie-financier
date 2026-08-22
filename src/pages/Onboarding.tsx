import { motion } from 'framer-motion';
import { ArrowRight, Briefcase, Check, Layers, User } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import type { AppUsage } from '../types';

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'MAD'];

const USAGES: Array<{
  value: AppUsage;
  icon: typeof User;
  title: string;
  desc: string;
}> = [
  {
    value: 'perso',
    icon: User,
    title: 'Mes finances personnelles',
    desc: 'Salaire, courses, loyer, abonnements. L’essentiel, sans complication.',
  },
  {
    value: 'both',
    icon: Layers,
    title: 'Les deux, séparément',
    desc: 'Vie perso d’un côté, activité indépendante de l’autre, avec une vue qui réunit tout.',
  },
  {
    value: 'pro',
    icon: Briefcase,
    title: 'Surtout mon activité pro',
    desc: 'Freelance, auto-entrepreneur, plusieurs casquettes à suivre séparément.',
  },
];

/**
 * Questionnaire de première connexion. Trois questions maximum : au-delà,
 * on perd les gens avant qu'ils aient vu l'application.
 */
export function Onboarding() {
  const { user } = useAuth();
  const { update } = useSettings();
  const [step, setStep] = useState(0);
  const [usage, setUsage] = useState<AppUsage>('perso');
  const [currency, setCurrency] = useState('EUR');
  const [monthStartDay, setMonthStartDay] = useState(1);

  const firstName = user?.displayName?.split(' ')[0];

  function finish() {
    update({
      usage,
      currency,
      monthStartDay,
      proEnabled: usage !== 'perso',
      defaultScope: usage === 'pro' ? 'pro' : usage === 'both' ? 'both' : 'perso',
      onboarded: true,
    });
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="glass w-full max-w-lg rounded-3xl p-7 shadow-2xl"
      >
        {/* Progression */}
        <div className="mb-6 flex items-center gap-1.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= step ? 'bg-gradient-flow' : 'bg-surface-2'
              }`}
            />
          ))}
        </div>

        {step === 0 && (
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              {firstName ? `Bienvenue ${firstName}` : 'Bienvenue'}
            </h1>
            <p className="mt-2 text-sm text-ink-2">
              Une question pour adapter l’application à ton usage. Tu pourras tout changer plus tard
              dans les réglages.
            </p>

            <p className="mt-6 text-sm font-semibold">Tu vas surtout t’en servir pour…</p>
            <div className="mt-3 flex flex-col gap-2">
              {USAGES.map(({ value, icon: Icon, title, desc }) => {
                const active = usage === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setUsage(value)}
                    aria-pressed={active}
                    className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 text-left transition-colors ${
                      active
                        ? 'border-accent bg-accent/8'
                        : 'border-line bg-surface-2/50 hover:border-line-strong'
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                        active ? 'bg-gradient-flow text-white' : 'bg-surface-2 text-ink-3'
                      }`}
                    >
                      <Icon size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{title}</span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-ink-3">{desc}</span>
                    </span>
                    {active && <Check size={16} className="mt-1 shrink-0 text-accent-2" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Ta devise</h1>
            <p className="mt-2 text-sm text-ink-2">
              Elle s’applique à tous tes montants. Modifiable à tout moment.
            </p>
            <div className="mt-6 grid grid-cols-3 gap-2">
              {CURRENCIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCurrency(c)}
                  aria-pressed={currency === c}
                  className={`amount min-h-[52px] cursor-pointer rounded-2xl border text-sm font-semibold transition-colors ${
                    currency === c
                      ? 'border-accent bg-gradient-flow text-white'
                      : 'border-line bg-surface-2/50 text-ink-2 hover:text-ink'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Ton mois budgétaire</h1>
            <p className="mt-2 text-sm text-ink-2">
              Si tu es payé le 25, ton mois financier ne commence pas le 1er. Cale les périodes sur
              ta date de paie.
            </p>
            <label className="mt-6 block">
              <span className="flex items-center justify-between text-sm text-ink-2">
                Le mois commence le
                <span className="amount text-lg font-bold text-ink">{monthStartDay}</span>
              </span>
              <input
                type="range"
                min={1}
                max={28}
                value={monthStartDay}
                onChange={(e) => setMonthStartDay(Number(e.target.value))}
                className="mt-3 w-full accent-[var(--accent)]"
              />
            </label>
            <p className="mt-4 rounded-2xl bg-surface-2 px-4 py-3 text-xs text-ink-3">
              Laisse sur 1 si tu préfères le mois calendaire classique.
            </p>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-7 flex items-center gap-2">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="min-h-[48px] cursor-pointer rounded-2xl px-4 text-sm text-ink-3 hover:text-ink"
            >
              Retour
            </button>
          )}
          <button
            type="button"
            onClick={() => (step < 2 ? setStep((s) => s + 1) : finish())}
            className="bg-gradient-flow flex min-h-[48px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl font-semibold text-white transition-transform active:scale-[0.99]"
          >
            {step < 2 ? 'Continuer' : 'Commencer'}
            <ArrowRight size={17} />
          </button>
        </div>

        {step === 0 && (
          <button
            type="button"
            onClick={finish}
            className="mt-3 w-full cursor-pointer text-center text-xs text-ink-3 hover:text-ink-2"
          >
            Passer, je réglerai plus tard
          </button>
        )}
      </motion.div>
    </div>
  );
}
