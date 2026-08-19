# PROMPT CLAUDE CODE — Application de gestion financière « FLOW »

> À coller dans Claude Code. C'est un prompt de build complet, structuré en phases.
> Objectif : une web app (PWA) de suivi des dépenses & revenus, ultra stylée, offline-first, avec catégorisation intelligente et un coach financier.

---

## 0. RÔLE & CONTEXTE

Tu es un ingénieur full-stack senior + directeur artistique. Tu construis une application personnelle de gestion financière nommée **FLOW**, pour un utilisateur qui jongle entre vie perso et une activité business multi-casquettes (dev web, montage vidéo, réparation, art LED). L'app doit être **belle, rapide, intuitive**, utilisable au quotidien surtout sur **téléphone** mais aussi impeccable sur **PC**.

Construis l'application **module par module**, en respectant les phases ci-dessous. Après chaque phase, fais un point court (ce qui est fait, ce qui reste) avant de continuer. N'invente pas de features non demandées ; si un choix est ambigu, prends la décision la plus simple et la plus robuste, et signale-la.

---

## 1. STACK TECHNIQUE

- **Front** : React + Vite + TypeScript
- **Styling** : Tailwind CSS + variables CSS pour les design tokens
- **Animations** : Framer Motion
- **Icônes** : lucide-react
- **Charts** : Recharts
- **Stockage (Phase 1)** : IndexedDB via **Dexie.js** — offline-first, aucune dépendance réseau
- **PWA** : `vite-plugin-pwa` — app installable sur mobile + desktop, fonctionne hors-ligne
- **Data layer** : couche d'accès aux données **isolée** (pattern repository) dans `src/data/` pour pouvoir brancher Firebase plus tard SANS réécrire l'UI
- **IA coach (optionnel)** : appel à l'API Anthropic (`api.anthropic.com/v1/messages`, modèle Claude), clé stockée localement par l'utilisateur, jamais en dur

Contraintes : TypeScript strict, code typé partout, composants fonctionnels + hooks, pas de librairie UI lourde (on construit nos composants).

---

## 2. ARCHITECTURE — 4 INTERFACES

L'app a **4 écrans principaux** accessibles via une navigation (bottom-bar sur mobile, sidebar sur desktop) :

1. **Dashboard** — vue globale : totaux, solde net, tendances, graphiques, et le **coach financier** (conseils).
2. **Perso** — dépenses + revenus personnels.
3. **Pro / Business** — dépenses + revenus professionnels.
4. **Abonnements** — vue dédiée de tous les abonnements récurrents, **séparés Perso / Pro**, en lecture/visu.

### Filtre scope global (transverse — important)
Un **sélecteur de scope** est présent sur **TOUS les écrans** (Dashboard, Perso, Pro, Abonnements), pas seulement le Dashboard. Trois valeurs :
- **Perso** — uniquement les données personnelles
- **Pro** — uniquement les données business
- **Les deux réunis** — vue consolidée perso + pro

Ce filtre est un **état global** (contexte React, ex `useScope()`) partagé par toute l'app : changer le scope met à jour instantanément les listes, les calculs, les graphiques et les conseils, quel que soit l'écran. Le choix est persisté (l'app rouvre sur le dernier scope utilisé). Note : les écrans Perso et Pro restent des points d'entrée dédiés, mais le sélecteur permet en plus la vue « Les deux réunis » depuis n'importe où (utile surtout sur Dashboard et Abonnements).

### Logique des abonnements (important)
Un abonnement n'est PAS un écran isolé de données : c'est une **transaction taguée `isRecurring: true`** qui vit normalement dans les pages Perso ou Pro (dépense ou revenu récurrent). L'écran **Abonnements** est une **vue filtrée** qui agrège toutes les transactions récurrentes, groupées par scope (perso/pro) et par fréquence, pour que l'utilisateur les voie d'un coup d'œil : coût mensuel total, prochaine échéance, abonnements « dormants » (pas touchés depuis longtemps). Le filtre scope global s'applique aussi ici (Perso / Pro / Les deux réunis).

---

## 3. MODÈLE DE DONNÉES

```typescript
type Scope = 'perso' | 'pro';
type TxType = 'expense' | 'revenue';
type RecurringFrequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

interface Category {
  id: string;
  label: string;
  scope: Scope | 'both';
  type: TxType | 'both';
  icon: string;          // nom d'icône lucide par défaut
  color: string;         // couleur d'accent de la catégorie
  keywords: string[];    // utilisé par le moteur de catégorisation
}

interface Transaction {
  id: string;
  type: TxType;
  scope: Scope;
  amount: number;              // en centimes pour éviter les flottants
  currency: string;           // 'EUR' par défaut
  label: string;              // ex "Netflix", "Client HOUSELAND", "Loyer"
  categoryId: string;
  date: string;               // ISO
  isRecurring: boolean;
  recurringFrequency?: RecurringFrequency;
  nextDueDate?: string;       // calculé pour les récurrents
  iconOverride?: string;      // icône choisie manuellement
  imageUrl?: string;          // image custom (style Notion) — remplace l'icône si présente
  badges: string[];          // ids de badges
  note?: string;
  createdAt: string;
  updatedAt: string;
}

interface Badge {
  id: string;
  label: string;
  color: string;
  icon?: string;
}
```

Toutes les sommes en **centimes (entiers)** ; formatage en euros à l'affichage uniquement.

---

## 4. MOTEUR DE CATÉGORISATION INTELLIGENT (offline)

Quand l'utilisateur saisit un `label` de transaction, un moteur local propose automatiquement **catégorie + icône**, et détecte les abonnements. 100% offline, instantané, aucune API.

Fonctionnement :
- Une base de catégories par défaut avec `keywords` (ex : catégorie "Streaming" → `["netflix","spotify","disney","prime","deezer","youtube"]`).
- Une base de **marques d'abonnements connues** (Netflix, Spotify, Adobe, Basic Fit, iCloud, ChatGPT, Notion, Figma, etc.) → si match, `isRecurring` proposé à `true` + fréquence `monthly` par défaut.
- Matching par inclusion + normalisation (minuscules, sans accents). Retourne la meilleure catégorie + une **suggestion d'icône**.
- Si aucun match : catégorie "Autre" + l'utilisateur peut choisir l'icône dans un picker lucide, ou uploader une image.
- L'utilisateur peut toujours **override** la suggestion (catégorie, icône, image).

Prévois un fichier `src/logic/categorizer.ts` exportant `suggestCategory(label): { category, icon, isRecurring, frequency? }`, facilement enrichissable.

---

## 5. MOTEUR DE PÉRIODES & CALCULS

Un moteur de calcul par période, réutilisé partout.

Périodes disponibles :
- Prédéfinies : **jour, semaine, mois, trimestre, année**
- **Personnalisée** : sélection de deux dates (from / to)

Pour toute période + scope (**perso / pro / les deux réunis**) :
- Total dépenses, total revenus, **solde net**
- **Taux d'épargne** = (revenus − dépenses) / revenus
- Répartition des dépenses par catégorie (%)
- **Poids des abonnements** = total abonnements / total revenus (%)
- Comparaison avec la période précédente (delta % dépenses & revenus)
- Séries temporelles pour les graphiques (par jour/semaine/mois selon la période)
- Normalisation des récurrents (un abonnement annuel compte au prorata mensuel dans les vues mensuelles)

Fichier `src/logic/analytics.ts` avec fonctions pures et testables.

---

## 6. COACH FINANCIER (conseils)

Le Dashboard affiche des **conseils concrets et chiffrés** pour économiser et optimiser les revenus.

### Mode A — Heuristiques (par défaut, offline)
Génère des insights structurés à partir des ratios calculés, ex :
- « Tes abonnements représentent **18% de tes revenus perso**. 3 d'entre eux n'ont pas bougé depuis 60 jours → économie potentielle de **X €/mois**. »
- « Ta catégorie *Restauration* pèse **32%** de tes dépenses perso ce mois, +14% vs mois dernier. »
- « Ton activité *Pro* dépend à **80%** d'un seul type de revenu → diversifier réduirait le risque. »
- « Taux d'épargne : **12%**. Objectif recommandé : 20%. Réduire *[catégorie n°1]* de 15% t'y amènerait. »

Chaque conseil = un objet `{ severity, title, message, potentialSaving? }` affiché en cartes. Priorise par impact financier.

### Mode B — Coach IA (optionnel, Claude API)
Si l'utilisateur a renseigné une clé API dans les réglages :
- Bouton « Analyse approfondie ». On envoie à l'API un **résumé anonymisé** (chiffres, ratios, top catégories, liste d'abonnements) — jamais de données inutiles.
- Prompt système : coach financier bienveillant et concret, répond en **français**, donne 3 à 5 recommandations actionnables et chiffrées, ton direct sans jargon.
- Affiche la réponse en langage naturel sous les conseils heuristiques.
- Gestion d'erreur propre + `try/catch`, jamais de clé en dur.

L'app doit être **pleinement fonctionnelle sans clé API** (mode A suffit).

---

## 7. FONCTIONNALITÉS PAR ÉCRAN

### Dashboard
- Sélecteur de période (prédéfini + custom) en haut, sticky.
- Sélecteur de scope (Perso / Pro / Les deux réunis) — le même composant global présent sur tous les écrans.
- Cartes clés animées : Revenus, Dépenses, Solde net, Taux d'épargne (avec delta vs période précédente).
- Graphique d'évolution (Recharts, area/line) + donut de répartition par catégorie.
- Section **Coach** (mode A + bouton mode B).
- Section « Prochaines échéances » (abonnements à venir).

### Perso / Pro (même composant, scope différent)
- Liste des transactions filtrable (type, catégorie, badge, recherche).
- Ajout rapide : champ label → catégorisation auto → montant → date. Fluide, pensé mobile (gros boutons, saisie rapide).
- Édition/suppression, swipe sur mobile.
- Chaque transaction affiche icône auto OU image custom + badges.
- Mini-résumé de la période en tête (revenus/dépenses/net du scope).

### Abonnements
- Deux sections : **Perso** / **Pro**.
- Coût mensuel total par section + global.
- Liste des abonnements : logo/image, montant, fréquence, prochaine échéance, coût annualisé.
- Alerte visuelle sur les abonnements « dormants ».
- Tri par montant / échéance.

### Réglages
- Devise, thème, gestion des catégories & badges (CRUD), clé API du coach IA, export/import des données (JSON), reset.

---

## 8. BADGES & IMAGES (style Notion)

- **Badges** : l'utilisateur crée des tags colorés (ex "Urgent", "Récupérable", "AYOVA", "Déductible") et les colle sur les transactions. Filtrables.
- **Images custom** : sur toute transaction ou catégorie, possibilité d'uploader une image qui **remplace l'icône** (cover/thumbnail façon Notion). Stockage en base64 dans IndexedDB en phase 1. Fallback propre sur l'icône si pas d'image.
- Picker d'icônes lucide pour ceux qui préfèrent une icône.

---

## 9. DESIGN SYSTEM

Direction artistique : **dark cinématique + touche streetwear**, épuré, premium, digne de confiance (c'est de la finance) mais avec du caractère.

- **Base** : dark mode par défaut (fond quasi-noir profond), option light.
- **Surfaces** : glassmorphism léger, cartes très arrondies (rounded-2xl/3xl), ombres douces, espacement généreux.
- **Accent** : un gradient signature (à toi de proposer, ex violet→bleu électrique ou orange chaud) utilisé avec parcimonie sur les CTA et data clés.
- **Typo** : sans-serif moderne pour l'UI + **police monospace pour tous les chiffres/montants** (rendu "compteur", tabular-nums).
- **Motion** : Framer Motion — transitions de page fluides, apparition en cascade des cartes, compteurs animés sur les montants, micro-interactions au tap. Jamais gadget, toujours au service de la lisibilité.
- Définis tous les tokens (couleurs, radius, spacing, typo) en variables CSS + config Tailwind.

---

## 10. RESPONSIVE & PWA

- **Mobile-first**, mais layout desktop soigné (sidebar, colonnes larges, plus de data visible).
- Bottom navigation sur mobile / sidebar sur desktop, même logique.
- Zones tactiles ≥ 44px, saisie optimisée mobile.
- **PWA** : manifest, icône, installable, fonctionne hors-ligne (service worker via vite-plugin-pwa).
- Tester les breakpoints clés (≤640px, 768px, ≥1280px).

---

## 11. PHASES DE BUILD

Construis dans cet ordre, avec un point d'étape après chaque phase :

- **Phase 1 — Fondations** : projet Vite+TS, Tailwind, tokens de design, structure de dossiers, routing, layout responsive (nav mobile + desktop), thème dark/light, **et le contexte de scope global (Perso / Pro / Les deux réunis) + son sélecteur transverse, persisté**.
- **Phase 2 — Data layer** : Dexie/IndexedDB, types, repository isolé, seed des catégories & badges par défaut, CRUD transactions.
- **Phase 3 — Saisie & catégorisation** : formulaire d'ajout rapide, moteur `categorizer.ts`, picker d'icônes, upload image, badges.
- **Phase 4 — Écrans Perso & Pro** : listes, filtres, recherche, édition, mini-résumés.
- **Phase 5 — Moteur d'analytics & périodes** : `analytics.ts`, sélecteur de période prédéfini + custom, calculs et séries temporelles.
- **Phase 6 — Dashboard** : cartes clés animées, graphiques Recharts, échéances.
- **Phase 7 — Abonnements** : vue filtrée perso/pro, coûts, échéances, dormants.
- **Phase 8 — Coach financier** : heuristiques (mode A) puis intégration Claude API optionnelle (mode B).
- **Phase 9 — Réglages, PWA & finitions** : réglages, export/import, PWA, polish animations & responsive, états vides soignés.

---

## 12. CRITÈRES D'ACCEPTATION

- L'app tourne **offline** sans aucune clé ni backend.
- Ajouter une transaction « Netflix 12,99€ » propose automatiquement catégorie Streaming + icône + `isRecurring`.
- Le sélecteur de scope (Perso / Pro / Les deux réunis) est présent sur tous les écrans, persisté, et recalcule tout instantanément.
- Le Dashboard recalcule tout instantanément quand on change période ou scope.
- Les abonnements apparaissent dans Perso/Pro ET agrégés dans l'écran Abonnements.
- Le coach donne au moins 3 conseils chiffrés en mode A.
- Impeccable sur mobile ET desktop, installable en PWA.
- Data layer isolé, prêt pour une future migration Firebase sans toucher l'UI.

---

## 13. ÉVOLUTIONS PRÉVUES (à garder en tête, pas à builder maintenant)

- Migration du repository vers **Firebase** (Auth + Firestore + Storage) pour la **sync PC ↔ téléphone**.
- Objectifs d'épargne / budgets par catégorie avec alertes.
- Multi-devises, récurrents automatiques (génération auto à l'échéance).

---

Commence par la **Phase 1**. Confirme la structure de dossiers et la direction artistique (propose le gradient signature et les typos), puis attends validation avant la Phase 2.
