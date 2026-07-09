import type { Badge, Category } from '../types';

/**
 * Catégories par défaut. Les couleurs viennent d'une palette catégorielle
 * validée (CVD + contraste) pour les surfaces sombre et claire de l'app ;
 * elles sont réutilisées en boucle contrôlée : le donut ne montre que les
 * 7 premières catégories + « Autres ».
 */
export const CATEGORY_COLORS = [
  '#3987e5', // bleu
  '#199e70', // aqua
  '#c98500', // jaune
  '#008300', // vert
  '#9085e9', // violet
  '#e66767', // rouge
  '#d55181', // magenta
  '#d95926', // orange
] as const;

const c = (i: number) => CATEGORY_COLORS[i % CATEGORY_COLORS.length];

export const DEFAULT_CATEGORIES: Category[] = [
  // ------------------------------------------------- Perso — dépenses
  {
    id: 'cat-logement',
    label: 'Logement',
    scope: 'perso',
    type: 'expense',
    icon: 'House',
    color: c(0),
    keywords: ['loyer', 'edf', 'engie', 'electricite', 'eau', 'gaz', 'assurance habitation', 'veolia', 'totalenergies'],
  },
  {
    id: 'cat-courses',
    label: 'Courses',
    scope: 'perso',
    type: 'expense',
    icon: 'ShoppingCart',
    color: c(1),
    keywords: ['carrefour', 'leclerc', 'lidl', 'auchan', 'intermarche', 'monoprix', 'aldi', 'casino', 'courses', 'supermarche', 'picard'],
  },
  {
    id: 'cat-restauration',
    label: 'Restauration',
    scope: 'perso',
    type: 'expense',
    icon: 'UtensilsCrossed',
    color: c(2),
    keywords: ['resto', 'restaurant', 'mcdo', 'mcdonalds', 'burger', 'kebab', 'tacos', 'uber eats', 'deliveroo', 'just eat', 'sushi', 'pizza', 'kfc', 'boulangerie'],
  },
  {
    id: 'cat-transport',
    label: 'Transport',
    scope: 'perso',
    type: 'expense',
    icon: 'CarFront',
    color: c(3),
    keywords: ['essence', 'total', 'station', 'sncf', 'ratp', 'navigo', 'uber', 'bolt', 'blablacar', 'autoroute', 'peage', 'parking', 'metro', 'bus', 'train'],
  },
  {
    id: 'cat-streaming',
    label: 'Streaming',
    scope: 'perso',
    type: 'expense',
    icon: 'Clapperboard',
    color: c(4),
    keywords: ['netflix', 'spotify', 'disney', 'prime video', 'amazon prime', 'deezer', 'youtube premium', 'canal', 'crunchyroll', 'apple music', 'apple tv', 'twitch', 'paramount'],
  },
  {
    id: 'cat-telecom',
    label: 'Téléphone & Internet',
    scope: 'perso',
    type: 'expense',
    icon: 'Wifi',
    color: c(5),
    keywords: ['free', 'orange', 'sfr', 'bouygues', 'sosh', 'red by sfr', 'forfait', 'fibre', 'internet', 'mobile'],
  },
  {
    id: 'cat-sante',
    label: 'Santé',
    scope: 'perso',
    type: 'expense',
    icon: 'HeartPulse',
    color: c(6),
    keywords: ['pharmacie', 'medecin', 'docteur', 'mutuelle', 'doctolib', 'dentiste', 'opticien', 'hopital', 'kine'],
  },
  {
    id: 'cat-sport',
    label: 'Sport & Forme',
    scope: 'perso',
    type: 'expense',
    icon: 'Dumbbell',
    color: c(7),
    keywords: ['basic fit', 'basic-fit', 'fitness park', 'salle de sport', 'decathlon', 'gym', 'neoness', 'onair', 'crossfit'],
  },
  {
    id: 'cat-shopping',
    label: 'Shopping',
    scope: 'perso',
    type: 'expense',
    icon: 'ShoppingBag',
    color: c(0),
    keywords: ['zara', 'zalando', 'amazon', 'vinted', 'nike', 'adidas', 'shein', 'hm', 'h&m', 'fnac', 'darty', 'boulanger', 'vetement'],
  },
  {
    id: 'cat-loisirs',
    label: 'Loisirs',
    scope: 'perso',
    type: 'expense',
    icon: 'Gamepad2',
    color: c(1),
    keywords: ['cinema', 'ugc', 'pathe', 'steam', 'playstation', 'psn', 'xbox', 'nintendo', 'concert', 'jeux', 'bowling', 'billard', 'escape game'],
  },
  {
    id: 'cat-cloud-perso',
    label: 'Cloud & Apps',
    scope: 'perso',
    type: 'expense',
    icon: 'Cloud',
    color: c(2),
    keywords: ['icloud', 'google one', 'dropbox', 'google storage', 'onedrive', 'nordvpn', 'proton', 'revolut premium', '1password', 'dashlane'],
  },
  // ------------------------------------------------- Perso — revenus
  {
    id: 'cat-salaire',
    label: 'Salaire',
    scope: 'perso',
    type: 'revenue',
    icon: 'Wallet',
    color: c(3),
    keywords: ['salaire', 'paie', 'paye', 'virement employeur'],
  },
  {
    id: 'cat-aides',
    label: 'Aides & Alloc',
    scope: 'perso',
    type: 'revenue',
    icon: 'HandCoins',
    color: c(4),
    keywords: ['caf', 'apl', 'allocation', 'prime activite', 'pole emploi', 'france travail'],
  },
  {
    id: 'cat-remboursement',
    label: 'Remboursements',
    scope: 'perso',
    type: 'revenue',
    icon: 'RotateCcw',
    color: c(5),
    keywords: ['cpam', 'ameli', 'remboursement', 'secu', 'mutuelle remboursement', 'cashback'],
  },
  {
    id: 'cat-revente',
    label: 'Revente',
    scope: 'perso',
    type: 'revenue',
    icon: 'Tags',
    color: c(6),
    keywords: ['vinted vente', 'leboncoin', 'ebay', 'revente', 'vente occasion'],
  },
  // ------------------------------------------------- Pro — dépenses
  {
    id: 'cat-saas',
    label: 'Logiciels & SaaS',
    scope: 'pro',
    type: 'expense',
    icon: 'AppWindow',
    color: c(0),
    keywords: ['adobe', 'figma', 'notion', 'chatgpt', 'openai', 'claude', 'anthropic', 'midjourney', 'github', 'copilot', 'vercel', 'canva', 'envato', 'elementor', 'jetbrains', 'davinci', 'premiere', 'after effects', 'capcut', 'suno', 'runway'],
  },
  {
    id: 'cat-hebergement',
    label: 'Hébergement & Domaines',
    scope: 'pro',
    type: 'expense',
    icon: 'Server',
    color: c(1),
    keywords: ['ovh', 'hostinger', 'o2switch', 'ionos', 'gandi', 'namecheap', 'cloudflare', 'domaine', 'hosting', 'vps', 'aws', 'google cloud'],
  },
  {
    id: 'cat-materiel',
    label: 'Matériel & Composants',
    scope: 'pro',
    type: 'expense',
    icon: 'Wrench',
    color: c(2),
    keywords: ['aliexpress', 'composant', 'led', 'neon', 'arduino', 'raspberry', 'ecran', 'ssd', 'cable', 'imprimante 3d', 'fer a souder', 'alim', 'mouser', 'farnell', 'amazon business'],
  },
  {
    id: 'cat-marketing',
    label: 'Marketing & Pub',
    scope: 'pro',
    type: 'expense',
    icon: 'Megaphone',
    color: c(3),
    keywords: ['meta ads', 'facebook ads', 'google ads', 'tiktok ads', 'pub', 'sponsoring', 'flyers'],
  },
  {
    id: 'cat-deplacement-pro',
    label: 'Déplacements pro',
    scope: 'pro',
    type: 'expense',
    icon: 'Route',
    color: c(4),
    keywords: ['deplacement client', 'km', 'mission', 'hotel pro'],
  },
  {
    id: 'cat-frais-bancaires',
    label: 'Frais & Cotisations',
    scope: 'pro',
    type: 'expense',
    icon: 'Landmark',
    color: c(5),
    keywords: ['urssaf', 'stripe fees', 'paypal fees', 'frais bancaire', 'shine', 'qonto', 'cotisation', 'cfe', 'comptable'],
  },
  // ------------------------------------------------- Pro — revenus
  {
    id: 'cat-dev-web',
    label: 'Dev web',
    scope: 'pro',
    type: 'revenue',
    icon: 'Code',
    color: c(6),
    keywords: ['site web', 'site internet', 'dev web', 'wordpress', 'application', 'maintenance site', 'refonte'],
  },
  {
    id: 'cat-montage',
    label: 'Montage vidéo',
    scope: 'pro',
    type: 'revenue',
    icon: 'Film',
    color: c(7),
    keywords: ['montage', 'video', 'reels', 'short', 'derush', 'etalonnage'],
  },
  {
    id: 'cat-reparation',
    label: 'Réparation',
    scope: 'pro',
    type: 'revenue',
    icon: 'Hammer',
    color: c(0),
    keywords: ['reparation', 'repar', 'depannage', 'ecran casse', 'diagnostic'],
  },
  {
    id: 'cat-art-led',
    label: 'Art LED',
    scope: 'pro',
    type: 'revenue',
    icon: 'Lightbulb',
    color: c(1),
    keywords: ['led art', 'neon led', 'enseigne', 'tableau led', 'installation led'],
  },
  {
    id: 'cat-client',
    label: 'Client (divers)',
    scope: 'pro',
    type: 'revenue',
    icon: 'Briefcase',
    color: c(2),
    keywords: ['client', 'facture', 'devis', 'acompte', 'prestation'],
  },
  // ------------------------------------------------- Fallback
  {
    id: 'cat-autre',
    label: 'Autre',
    scope: 'both',
    type: 'both',
    icon: 'CircleDashed',
    color: '#82828e',
    keywords: [],
  },
];

export const DEFAULT_BADGES: Badge[] = [
  { id: 'badge-urgent', label: 'Urgent', color: '#e66767', icon: 'Flame' },
  { id: 'badge-recuperable', label: 'Récupérable', color: '#199e70', icon: 'Undo2' },
  { id: 'badge-deductible', label: 'Déductible', color: '#3987e5', icon: 'ReceiptText' },
  { id: 'badge-ayova', label: 'AYOVA', color: '#9085e9', icon: 'Sparkles' },
];
