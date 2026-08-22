import {
  deleteUser,
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { auth, googleProvider, isFirebaseConfigured } from '../lib/firebase';

export type AuthMode = 'cloud' | 'local';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  mode: AuthMode;
  configured: boolean;
  needsLogin: boolean;
  error: string | null;
  signInGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Supprime le compte Firebase après effacement des données (RGPD). */
  deleteAccount: () => Promise<void>;
  continueOffline: () => void;
}

const LOCAL_KEY = 'flow.localMode';

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [localMode, setLocalMode] = useState(() => localStorage.getItem(LOCAL_KEY) === '1');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        setLocalMode(false);
        localStorage.removeItem(LOCAL_KEY);
      }
    });
  }, []);

  async function signInGoogle() {
    if (!auth) return;
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      const known: Record<string, string> = {
        'auth/popup-closed-by-user': 'Connexion annulée.',
        'auth/cancelled-popup-request': 'Connexion annulée.',
        'auth/popup-blocked':
          'Le navigateur a bloqué la fenêtre de connexion — autorise les pop-ups pour ce site.',
        'auth/unauthorized-domain':
          "Ce domaine n'est pas autorisé : ajoute-le dans Firebase → Authentication → Paramètres → Domaines autorisés.",
        'auth/operation-not-allowed':
          'La connexion Google n\'est pas activée dans Firebase → Authentication → Méthode de connexion.',
        'auth/invalid-api-key': 'Clé API invalide : vérifie VITE_FIREBASE_API_KEY dans ton .env.',
        'auth/network-request-failed': 'Réseau indisponible. Vérifie ta connexion.',
      };
      // Le code brut est affiché quand il n'est pas répertorié : sans lui,
      // impossible de diagnostiquer une erreur de configuration.
      setError(known[code] ?? `Connexion impossible (${code || 'erreur inconnue'}).`);
      console.error('[FLOW] Échec de connexion Google', code, e);
    }
  }

  async function signOut() {
    if (auth) await fbSignOut(auth);
    setLocalMode(false);
    localStorage.removeItem(LOCAL_KEY);
  }

  async function deleteAccount() {
    if (auth?.currentUser) await deleteUser(auth.currentUser);
  }

  function continueOffline() {
    setLocalMode(true);
    localStorage.setItem(LOCAL_KEY, '1');
  }

  const mode: AuthMode = user && isFirebaseConfigured ? 'cloud' : 'local';

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        mode,
        configured: isFirebaseConfigured,
        needsLogin: isFirebaseConfigured && !user && !localMode,
        error,
        signInGoogle,
        signOut,
        deleteAccount,
        continueOffline,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé sous <AuthProvider>');
  return ctx;
}
