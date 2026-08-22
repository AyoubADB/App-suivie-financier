import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { firestore } from '../lib/firebase';
import type { UserSettings } from '../types';
import { useAuth } from './AuthContext';

const DEFAULTS: UserSettings = {
  currency: 'EUR',
  theme: 'dark',
  savingsGoal: 0.2,
  monthStartDay: 1,
  defaultScope: 'perso',
  privacyMode: false,
  usage: 'perso',
  proEnabled: false,
  onboarded: false,
};

/** Cache local : évite un flash de thème au chargement et sert de source en mode hors-ligne. */
const CACHE_KEY = 'flow.settings';

interface SettingsContextValue extends UserSettings {
  update: (patch: Partial<UserSettings>) => void;
  /** true quand les préférences suivent le compte plutôt que l'appareil. */
  synced: boolean;
  /**
   * Message d'erreur si la dernière écriture a été refusée par le serveur.
   * Sans lui, un refus des règles Firestore se traduit par un réglage qui
   * revient en arrière sans la moindre explication.
   */
  error: string | null;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

function readCache(): UserSettings {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<UserSettings>) };
  } catch {
    // cache corrompu — on repart sur les défauts
  }
  // Reprise des anciennes clés séparées (versions précédentes de l'app).
  const legacyCurrency = localStorage.getItem('flow.currency');
  const legacyTheme = localStorage.getItem('flow.theme');
  return {
    ...DEFAULTS,
    ...(legacyCurrency ? { currency: legacyCurrency } : {}),
    ...(legacyTheme === 'light' || legacyTheme === 'dark' ? { theme: legacyTheme } : {}),
  };
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { user, mode } = useAuth();
  const uid = mode === 'cloud' ? (user?.uid ?? null) : null;
  const [settings, setSettings] = useState<UserSettings>(readCache);
  const [error, setError] = useState<string | null>(null);

  // Abonnement au document de préférences du compte connecté.
  useEffect(() => {
    if (!firestore || !uid) return;
    const ref = doc(firestore, 'users', uid, 'meta', 'settings');
    return onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        // Premier login : on pousse les préférences locales dans le compte.
        void setDoc(ref, readCache());
        return;
      }
      setSettings({ ...DEFAULTS, ...(snap.data() as Partial<UserSettings>) });
    });
  }, [uid]);

  useEffect(() => {
    localStorage.setItem(CACHE_KEY, JSON.stringify(settings));
    document.documentElement.dataset.theme = settings.theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', settings.theme === 'dark' ? '#0b0b0f' : '#f4f4f1');
  }, [settings]);

  const value = useMemo<SettingsContextValue>(
    () => ({
      ...settings,
      synced: uid !== null,
      error,
      update: (patch) => {
        setError(null);
        setSettings((s) => {
          const next = { ...s, ...patch };
          if (firestore && uid) {
            setDoc(doc(firestore, 'users', uid, 'meta', 'settings'), next).catch((e) => {
              const code = (e as { code?: string }).code ?? '';
              setError(
                code === 'permission-denied'
                  ? "Réglage refusé par le serveur. Déploie les règles à jour : firebase deploy --only firestore:rules"
                  : `Enregistrement impossible (${code || 'erreur inconnue'}).`,
              );
              console.error('[FLOW] Écriture des préférences refusée', code, e);
            });
          }
          return next;
        });
      },
    }),
    [settings, uid, error],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings doit être utilisé sous <SettingsProvider>');
  return ctx;
}
