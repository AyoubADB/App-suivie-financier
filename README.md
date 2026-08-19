# FLOW — Suivi financier

Web app (PWA) de suivi des dépenses & revenus, perso et pro. Fonctionne **hors-ligne** par défaut, et se synchronise entre tes appareils si tu te connectes avec Google.

## Fonctionnalités

- **3 écrans** : Dashboard, Mouvements (Perso + Pro + Abonnements réunis), Réglages
- **Onglets** `Tout / Perso / Pro / Abonnements` — une seule barre, plus de double navigation
- **Connexion Google** (Firebase Auth) : chaque compte a son propre stockage isolé dans Firestore
- **Recherche globale** (`⌘K` / `Ctrl+K`) sur tout l'historique + recherche locale par onglet
- **Sélecteur de période compact** avec navigation ← → (mois précédent, etc.) : jour, semaine, mois, trimestre, année, personnalisé
- **Catégorisation intelligente offline** : taper « Netflix » propose la catégorie Streaming, l'icône et détecte l'abonnement
- **Abonnements** = transactions récurrentes, agrégées avec coût mensuel/annualisé, prochaines échéances, alertes « dormants »
- **Analytics** : solde net, taux d'épargne, deltas vs période précédente, répartition par catégorie, séries temporelles
- **Coach financier** : conseils heuristiques chiffrés (offline) + analyse IA optionnelle via l'API Anthropic
- **Badges** colorés et **images custom** (style Notion) sur les transactions
- **PWA installable**, dark/light, mobile-first + layout desktop

## Stack

React + Vite + TypeScript (strict) · Tailwind CSS v4 · Framer Motion · lucide-react · Recharts · Dexie.js (IndexedDB) · Firebase (Auth + Firestore) · vite-plugin-pwa

## Démarrer

```bash
npm install
npm run dev       # développement
npm run build     # build de production (tsc + vite)
npm run preview   # sert le build
```

Sans configuration Firebase, l'app démarre directement en **mode local** (IndexedDB). Tout fonctionne, mais rien n'est synchronisé.

---

# Tutoriel — brancher Firebase (connexion Google + base de données)

Compte à peu près **15 minutes**. Tout est gratuit dans le plan Spark de Firebase.

## Étape 1 — Créer l'application Web dans Firebase

Ton projet Firebase existe déjà (`app-finance-58aa2`).

1. Va sur [console.firebase.google.com](https://console.firebase.google.com) et ouvre ton projet.
2. Clique sur l'icône **⚙️ → Paramètres du projet**.
3. Descends jusqu'à **« Vos applications »**.
4. Clique sur l'icône **`</>`** (Web) et donne un surnom, par exemple `flow-web`. Ne coche pas Firebase Hosting pour l'instant.
5. Firebase affiche un bloc `const firebaseConfig = { … }`. **Garde cette page ouverte**, on en a besoin à l'étape 3.

> ⚠️ Le fichier `*-firebase-adminsdk-*.json` que tu as téléchargé est une **clé de service account**. Elle donne un accès **total** à ton projet et ne sert que côté serveur. Elle ne doit jamais aller dans le code de l'app ni dans Git — le `.gitignore` la bloque déjà. **Va la révoquer** : Console Google Cloud → IAM & Admin → Comptes de service → ta clé → Supprimer, puis régénères-en une seulement si un jour tu en as besoin côté serveur.

## Étape 2 — Activer la connexion Google

1. Dans le menu de gauche : **Créer → Authentication → Commencer**.
2. Onglet **Sign-in method** → clique sur **Google** → bascule **Activer**.
3. Renseigne l'e-mail d'assistance, puis **Enregistrer**.

Toujours dans Authentication, onglet **Settings → Domaines autorisés** : `localhost` y est déjà. Tu ajouteras le domaine de ton site déployé à l'étape 6.

## Étape 3 — Renseigner les clés dans l'app

À la racine du projet, crée un fichier nommé **`.env`** (copie `.env.example`) et recopie les valeurs du bloc `firebaseConfig` de l'étape 1 :

```bash
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=app-finance-58aa2.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=app-finance-58aa2
VITE_FIREBASE_STORAGE_BUCKET=app-finance-58aa2.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

Ces clés-là sont **publiques** : elles partent forcément dans le navigateur, c'est normal et sans danger. Ce qui protège réellement tes données, ce sont les règles de l'étape 5.

Relance `npm run dev` — l'écran de connexion Google apparaît maintenant au démarrage.

## Étape 4 — Créer la base de données

1. Menu de gauche : **Créer → Firestore Database → Créer une base de données**.
2. Choisis un emplacement proche (`eur3` ou `europe-west1`).
3. Démarre en **mode production** (on met les bonnes règles juste après).

Tu n'as **aucune table à créer** : l'app crée automatiquement tes catégories et badges par défaut à ta première connexion, sous `users/{ton-identifiant}/`.

## Étape 5 — Verrouiller l'accès (important)

C'est cette étape qui empêche quiconque de lire tes données.

1. Firestore Database → onglet **Règles**.
2. Remplace tout par le contenu du fichier [`firestore.rules`](./firestore.rules) de ce dépôt :

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

3. **Publier**.

Traduction : un utilisateur connecté ne peut lire et écrire que dans **son propre dossier**. Tout le reste est refusé. Même quelqu'un qui récupère tes clés publiques ne peut rien faire sans être connecté avec ton compte Google.

## Étape 6 — Déployer gratuitement

```bash
npm install -g firebase-tools
firebase login
firebase init hosting     # dossier public : dist   |   SPA : oui   |   pas de build auto GitHub
npm run build
firebase deploy
```

Tu obtiens une URL du type `https://app-finance-58aa2.web.app`, en HTTPS, gratuite et illimitée en pratique pour un usage perso.

**Dernière étape obligatoire** : retourne dans **Authentication → Settings → Domaines autorisés** et ajoute ce domaine, sinon la connexion Google sera refusée en ligne.

Ensuite, ouvre l'URL sur ton téléphone → menu du navigateur → **« Ajouter à l'écran d'accueil »**. L'app s'installe comme une vraie application.

### Alternatives d'hébergement

| Solution | Verdict |
|---|---|
| **Firebase Hosting** | Recommandé — déjà dans ton projet, HTTPS, CDN, zéro config |
| Vercel / Netlify | Très bien aussi ; pense à déclarer les variables `VITE_FIREBASE_*` dans leur interface |
| **Vieux PC à la maison** | Possible mais déconseillé : il faut une IP fixe ou un DynDNS, ouvrir des ports sur ta box, gérer soi-même le certificat HTTPS et les mises à jour de sécurité, et laisser la machine allumée 24/7 (électricité + bruit). Pour une app qui contient tes finances, l'hébergement managé est plus sûr et plus simple. |
| MySQL / phpMyAdmin | Inadapté ici : il faudrait écrire et héberger une API backend en plus. Firestore te donne la base **et** l'authentification **et** la synchronisation temps réel sans serveur à maintenir. |

## Comment les données sont isolées

```
users/
  {uid-de-ton-compte-google}/
    transactions/{id}
    categories/{id}
    badges/{id}
```

Chaque compte Google possède son propre sous-arbre. Le code ne peut techniquement pas écrire ailleurs (`src/data/firestoreRepository.ts`), et les règles Firestore le refuseraient de toute façon.

En mode local (bouton « Utiliser hors-ligne »), tout reste dans IndexedDB sur l'appareil et ne part nulle part.

---

## Architecture

```
src/
  lib/         # firebase.ts — init conditionnelle (l'app marche sans config)
  context/     # AuthContext (Google), DataContext (local ⇄ cloud), Scope, Period, Theme
  data/        # repository.ts (interface + Dexie), firestoreRepository.ts, db.ts, seed.ts
  logic/       # fonctions pures : categorizer, analytics, coach, aiCoach, money, dates
  components/  # ui/, layout/, transactions/, charts/, coach/, GlobalSearch, PeriodSelector
  pages/       # Dashboard, Movements (Perso+Pro+Abonnements), Settings, Login
```

`DataContext` choisit l'implémentation de `FlowRepository` selon l'état de connexion : Firestore si connecté, Dexie sinon. **L'UI ne connaît que l'interface** — elle est identique dans les deux modes.

Toutes les sommes sont stockées **en centimes (entiers)** ; le formatage n'existe qu'à l'affichage (`src/logic/money.ts`).

## Icônes PWA

`node scripts/generate-icons.mjs` régénère `public/pwa-192.png` / `pwa-512.png`.

## Pistes d'amélioration

1. **Migration des données locales vers le cloud** à la première connexion (aujourd'hui les deux stockages sont indépendants) — proposer « importer mes données locales dans mon compte ».
2. **Génération automatique des récurrents** : créer la transaction à l'échéance au lieu d'un simple rappel.
3. **Budgets par catégorie** avec alerte au dépassement, et objectifs d'épargne mensuels.
4. **Firebase Storage** pour les images custom (elles sont en base64 dans le document, ce qui pèse sur la limite de 1 Mo par document).
5. **Import de relevés bancaires** (CSV / OFX) avec rapprochement automatique via le moteur de catégorisation existant.
6. **Code-splitting** : le bundle dépasse 1,4 Mo, charger Recharts et Firestore en `import()` dynamique améliorerait le premier affichage.
7. **Tests** sur `analytics.ts` et `categorizer.ts` (fonctions pures, faciles à couvrir avec Vitest).
8. **Multi-devises** avec taux de change, et export PDF du bilan mensuel.
