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
      setError(
        code === 'auth/popup-closed-by-user'
          ? 'Connexion annulée.'
          : code === 'auth/unauthorized-domain'
            ? "Ce domaine n'est pas autorisé dans Firebase (Authentication → Settings → Authorized domains)."
            : 'Connexion impossible. Vérifie ta configuration Firebase.',
      );
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
