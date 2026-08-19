import { motion } from 'framer-motion';
import { CloudOff, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const PERKS = [
  { icon: ShieldCheck, text: 'Tes données sont liées à ton compte Google, à toi seul.' },
  { icon: TrendingUp, text: 'Synchronisation instantanée entre ton téléphone et ton PC.' },
  { icon: Sparkles, text: 'Catégorisation automatique et coach financier intégrés.' },
];

export function Login() {
  const { signInGoogle, continueOffline, error } = useAuth();

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="glass w-full max-w-md rounded-3xl p-7 shadow-2xl"
      >
        <div className="flex items-center gap-3">
          <img src="/favicon.svg" alt="" className="h-11 w-11 rounded-2xl" />
          <div>
            <h1 className="text-gradient text-3xl font-extrabold tracking-tight">FLOW</h1>
            <p className="text-xs text-ink-3">Suivi financier perso &amp; pro</p>
          </div>
        </div>

        <ul className="mt-7 flex flex-col gap-3">
          {PERKS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-3 text-sm text-ink-2">
              <Icon size={17} className="mt-0.5 shrink-0 text-accent-2" />
              {text}
            </li>
          ))}
        </ul>

        <button
          onClick={signInGoogle}
          className="mt-7 flex min-h-[52px] w-full cursor-pointer items-center justify-center gap-3 rounded-2xl bg-white px-5 font-semibold text-[#1f1f1f] transition-transform active:scale-[0.98]"
        >
          <GoogleMark />
          Continuer avec Google
        </button>

        {error && (
          <p role="alert" className="mt-3 rounded-2xl bg-neg/10 px-4 py-2.5 text-xs text-neg">
            {error}
          </p>
        )}

        <button
          onClick={continueOffline}
          className="mt-3 flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 rounded-2xl text-sm text-ink-3 transition-colors hover:text-ink-2"
        >
          <CloudOff size={15} />
          Utiliser hors-ligne sur cet appareil
        </button>

        <p className="mt-5 text-center text-[11px] leading-relaxed text-ink-3">
          En mode hors-ligne, les données restent dans le navigateur et ne sont pas synchronisées.
        </p>
      </motion.div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="19" height="19" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </svg>
  );
}
