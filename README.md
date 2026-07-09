# FLOW — Suivi financier

Web app (PWA) de suivi des dépenses & revenus, perso et pro. **Offline-first** : toutes les données restent sur l'appareil (IndexedDB), aucune clé ni backend nécessaire.

## Fonctionnalités

- **4 écrans** : Dashboard, Perso, Pro, Abonnements (+ Réglages)
- **Scope global** Perso / Pro / Les deux réunis, présent sur tous les écrans et persisté
- **Catégorisation intelligente offline** : taper « Netflix » propose la catégorie Streaming, l'icône et détecte l'abonnement (fréquence mensuelle)
- **Abonnements** = transactions récurrentes, agrégées dans une vue dédiée (coût mensuel/annualisé, prochaines échéances, alertes « dormants »)
- **Analytics** par période (jour → année + personnalisé) : solde net, taux d'épargne, deltas vs période précédente, répartition par catégorie, séries temporelles
- **Coach financier** : conseils heuristiques chiffrés (offline) + analyse IA optionnelle via l'API Anthropic (clé stockée localement dans les réglages)
- **Badges** colorés et **images custom** (style Notion) sur les transactions
- **PWA installable**, dark/light, mobile-first + layout desktop (sidebar)

## Stack

React + Vite + TypeScript (strict) · Tailwind CSS v4 · Framer Motion · lucide-react · Recharts · Dexie.js (IndexedDB) · vite-plugin-pwa

## Démarrer

```bash
npm install
npm run dev       # développement
npm run build     # build de production (tsc + vite)
npm run preview   # sert le build
```

## Architecture

```
src/
  context/     # ScopeContext (Perso/Pro/Les deux), ThemeContext, PeriodContext — persistés
  data/        # Dexie (db.ts), seed (catégories & badges), repository isolé, hooks live
  logic/       # fonctions pures : categorizer, analytics, coach (heuristiques), aiCoach, money, dates
  components/  # ui/ (Card, Modal, Segmented…), layout/, transactions/, charts/, coach/
  pages/       # Dashboard, TransactionsPage (Perso & Pro), Subscriptions, Settings
```

La couche data est isolée derrière `FlowRepository` (`src/data/repository.ts`) : brancher Firebase plus tard = fournir une autre implémentation, sans toucher l'UI.

Toutes les sommes sont stockées **en centimes (entiers)** ; le formatage en euros n'existe qu'à l'affichage (`src/logic/money.ts`).

## Icônes PWA

`node scripts/generate-icons.mjs` régénère `public/pwa-192.png` / `pwa-512.png` (aucune dépendance).
