import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  type AppCheck,
} from 'firebase/app-check';
import { browserLocalPersistence, getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(config.apiKey && config.projectId && config.appId);

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let firestoreInstance: Firestore | null = null;
let appCheckInstance: AppCheck | null = null;

if (isFirebaseConfigured) {
  app = initializeApp(config);

  // App Check : atteste que la requête vient bien de cette application.
  // Sans clé reCAPTCHA configurée, on démarre sans — l'app reste utilisable
  // en développement et l'attestation devient obligatoire une fois la clé
  // renseignée et l'enforcement activé dans la console.
  const siteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY;
  if (siteKey) {
    const debugToken = import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN;
    if (debugToken) {
      (globalThis as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string }).FIREBASE_APPCHECK_DEBUG_TOKEN =
        debugToken;
    }
    try {
      appCheckInstance = initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(siteKey),
        isTokenAutoRefreshEnabled: true,
      });
    } catch {
      // Clé invalide ou domaine non autorisé : on ne bloque pas le démarrage.
    }
  }

  authInstance = getAuth(app);
  // La session survit à la fermeture de l'onglet, mais reste liée à cet appareil.
  void authInstance.setPersistence(browserLocalPersistence);

  // Cache local persistant : l'app connectée fonctionne hors-ligne et
  // resynchronise à la reconnexion. Réduit aussi fortement les lectures
  // facturées, donc l'exposition aux quotas.
  //
  // La base visée est `(default)` sauf si VITE_FIREBASE_DATABASE_ID nomme
  // une base Firestore nommée — cas d'un projet créé avec un ID explicite.
  const databaseId = import.meta.env.VITE_FIREBASE_DATABASE_ID?.trim();
  firestoreInstance = initializeFirestore(
    app,
    { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) },
    databaseId || undefined,
  );
}

export const auth = authInstance;
export const firestore = firestoreInstance;
export const appCheck = appCheckInstance;
export const googleProvider = new GoogleAuthProvider();

// Force le choix du compte : évite qu'un appareil partagé reconnecte
// silencieusement la dernière session Google utilisée.
googleProvider.setCustomParameters({ prompt: 'select_account' });
