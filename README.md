# FLOW — Suivi financier

Web app (PWA) de suivi des dépenses & revenus, perso et pro. Fonctionne **hors-ligne** par défaut, et se synchronise entre tes appareils si tu te connectes avec Google.

## Fonctionnalités

- **Application installable** sur l'écran d'accueil iPhone et Android : plein écran, hors ligne, icône, raccourcis « Ajouter » et « Scanner »
- **Pensée pour le téléphone** : barre de navigation au pouce, feuilles glissantes, zones sûres sous l'encoche, pas de zoom intempestif à la saisie
- **Vue d'ensemble + 10 vues détaillées** accessibles par une liste déroulante : dépenses, revenus, répartition, solde prévisionnel, budgets, objectifs, abonnements, coach, activité pro, TVA
- **Scan de facture** : photo, image ou PDF lus sur l'appareil, montant, date, enseigne et TVA extraits automatiquement
- **Rappels quotidiens** : échéance à confirmer, budget dépassé, trésorerie qui plonge, abonnement dormant
- **Connexion Google** (Firebase Auth) : chaque compte a son propre stockage isolé dans Firestore
- **Recherche globale** (`⌘K` / `Ctrl+K`) sur tout l'historique + recherche locale par onglet
- **Sélecteur de période compact** avec navigation ← → (mois précédent, etc.) : jour, semaine, mois, trimestre, année, personnalisé
- **Catégorisation intelligente offline** : taper « Netflix » propose la catégorie Streaming, l'icône et détecte l'abonnement
- **Abonnements** = transactions récurrentes, agrégées avec coût mensuel/annualisé, prochaines échéances, alertes « dormants »
- **Analytics** : solde net, taux d'épargne, deltas vs période précédente, répartition par catégorie, séries temporelles
- **Coach financier** : analyse rédigée sur l'appareil, sans clé ni connexion, complétée de conseils chiffrés ; analyse par modèle de langue en option via une clé API Anthropic
- **TVA** : séparation HT / TVA à la saisie, synthèse collectée / déductible / à reverser, et explication des seuils
- **Badges** colorés et **images custom** (style Notion) sur les transactions
- **Module professionnel optionnel** : éteint, l'app est purement perso ; allumé, il ouvre les pages Perso / Pro et les **activités** (une casquette = une activité, suivie séparément ou combinée)
- **Échéances récurrentes** (salaire, loyer) : rien n'est créé en douce, l'app propose l'écriture le jour venu et tu ajustes le montant réel
- **Solde prévisionnel 30 jours** avec date de passage au rouge
- **Budgets** par catégorie avec **report d'enveloppe** (le reste du mois gonfle le plafond suivant)
- **Objectifs d'épargne** : montant cible, échéance, effort mensuel calculé
- **Tableau de bord pro** : provision de cotisations, seuils TVA / plafond de régime, rentabilité par activité
- **Import de relevés CSV et OFX / QFX** : colonnes détectées puis corrigeables pour un CSV, lecture directe pour un OFX dont le FITID garantit l'absence de doublon
- **Règles de catégorisation** : « si le libellé contient X, alors catégorie Y, badge Z, renommer en W », appliquées à la saisie, à l'import et rétroactivement à l'historique
- **Transactions ventilées** : un même paiement réparti sur plusieurs catégories, le reliquat restant sur la catégorie principale
- **PWA installable**, dark/light, mobile-first + layout desktop

## Stack

React + Vite + TypeScript (strict) · Tailwind CSS v4 · Framer Motion · lucide-react · Recharts · Dexie.js (IndexedDB) · Firebase (Auth + Firestore) · vite-plugin-pwa · Tesseract.js (OCR local) · pdf.js

## Reconnaissance de tickets, en local

Le scan de facture n'appelle aucun service : le moteur de reconnaissance
(WebAssembly) et le modèle de langue française sont servis par l'app
elle-même depuis `public/ocr`, recopiés de `node_modules` par
`npm run sync:ocr` (lancé automatiquement avant `dev` et `build`). Ces
fichiers sont volumineux et régénérables : ils ne sont pas versionnés.

Le texte reconnu est ensuite analysé par `src/logic/receipt.ts`, un jeu de
règles écrites pour les tickets français — mots-clés de total, pièges à
éviter (`TOTAL HT`, `TOTAL TVA`), formats de date, taux de TVA, enseignes
courantes. Aucune image ne quitte l'appareil, et tout fonctionne hors ligne
après le premier chargement du moteur.

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
| **Hébergement mutualisé** (InfinityFree, OVH, Hostinger…) | Possible : l'app est un site statique. Voir la section ci-dessous — il faut HTTPS, le `.htaccess` fourni, et autoriser le domaine dans Firebase. |
| MySQL / phpMyAdmin | Inadapté ici : il faudrait écrire et héberger une API backend en plus. Firestore te donne la base **et** l'authentification **et** la synchronisation temps réel sans serveur à maintenir. |

### Déployer sur un hébergement mutualisé (InfinityFree, OVH…)

L'app est un site statique : aucun PHP, aucune base MySQL. La base de données
et la connexion Google restent chez Firebase quel que soit l'hébergeur.

```bash
npm run build      # produit dist/ — environ 25 Mo, 40 fichiers
```

Ensuite, par FTP (FileZilla) ou le gestionnaire de fichiers de l'hébergeur :

1. Copier **le contenu** de `dist/` dans `htdocs`, pas le dossier `dist`
   lui-même. À l'arrivée, `index.html` doit se trouver directement dans
   `htdocs`, à côté des dossiers `assets/` et `ocr/`.
2. Vérifier que `.htaccess` est bien monté. Beaucoup de clients FTP masquent
   les fichiers commençant par un point : il faut activer l'affichage des
   fichiers cachés.
3. Activer le certificat SSL dans le panneau de l'hébergeur, puis ouvrir le
   site en `https://`.
4. Dans la console Firebase → Authentication → Settings → **Domaines
   autorisés**, ajouter le domaine du site. Sans cela, la connexion Google
   renvoie `auth/unauthorized-domain`.

Trois points qui font échouer un déploiement sur ce type d'hébergement :

- **L'app doit être à la racine du domaine.** Les fichiers sont référencés en
  chemins absolus (`/assets/...`). Dans un sous-dossier, il faut construire
  avec une base : `npm run build -- --base=/mon-sous-dossier/`.
- **HTTPS n'est pas optionnel.** Sans lui, pas d'installation sur l'écran
  d'accueil, pas de mode hors ligne, pas de notifications, pas d'appareil
  photo : le navigateur refuse ces fonctions sur une origine non sécurisée.
- **Le `.htaccess` fourni est indispensable.** Il redirige vers HTTPS, renvoie
  les adresses internes (`/vue/depenses`, `/reglages`) vers `index.html` —
  sans quoi tout rechargement de page donne une erreur 404 — et déclare les
  types `.wasm` et `.gz` dont dépend la lecture des tickets.

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

1. **Firebase Storage** pour les images custom (elles sont en base64 dans le document, ce qui pèse sur la limite de 1 Mo par document).
2. **Import QIF** et rapprochement bancaire (pointer les mouvements déjà passés en banque).
2. **Notifications planifiées** hors de l'app : impossible sans serveur de push. Aujourd'hui les rappels partent à l'ouverture de l'app ; un envoi à heure fixe demanderait Firebase Cloud Messaging et une Cloud Function.
3. **Comptes multiples** (courant, livret, espèces) et **patrimoine net** consolidé.
4. **Conditions multiples par règle** (aujourd'hui une règle teste un seul champ ; chaîner « libellé ET montant » demanderait un groupe de conditions).
5. **Code-splitting** : le bundle dépasse 1,6 Mo, charger Recharts et Firestore en `import()` dynamique améliorerait le premier affichage.
6. **Tests** sur `analytics.ts`, `categorizer.ts`, `csv.ts`, `ofx.ts` et `rules.ts` (fonctions pures, faciles à couvrir avec Vitest).
7. **Multi-devises** avec taux de change, et export PDF du bilan mensuel.
8. **Notifications push** pour les échéances et les dépassements de budget.
