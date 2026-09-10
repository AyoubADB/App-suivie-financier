import type { BudgetStatus, ScheduledEntry, Transaction } from '../types';
import { dormantSubscriptions, monthlyEquivalent } from './analytics';
import { firstNegativeDay, forecastBalance } from './forecast';
import { formatCents } from './money';
import { pendingOccurrences } from './scheduled';

/**
 * Rappels quotidiens.
 *
 * Sans serveur, une notification ne peut partir que depuis l'appareil, quand
 * l'app tourne. Sur Android et sur ordinateur, elle apparaît dès l'ouverture
 * ou à l'heure choisie si l'app est restée ouverte. Sur iPhone, il faut avoir
 * installé l'app sur l'écran d'accueil (iOS 16.4 ou plus), et la notification
 * se déclenche à l'ouverture — c'est une limite d'iOS, pas de l'app.
 */

const LAST_RUN_KEY = 'flow.notify.lastRun';

export interface NotifiableState {
  transactions: Transaction[];
  scheduled: ScheduledEntry[];
  budgets: BudgetStatus[];
  currency: string;
}

export interface FlowNotification {
  tag: string;
  title: string;
  body: string;
}

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  return notificationsSupported() ? Notification.permission : 'unsupported';
}

/**
 * iOS n'autorise les notifications web que dans une app installée.
 * Le savoir permet d'expliquer pourquoi le bouton ne fait rien plutôt que
 * de laisser l'utilisateur croire à un bug.
 */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const iosStandalone = (window.navigator as { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia('(display-mode: standalone)').matches;
}

export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return 'denied';
  return Notification.requestPermission();
}

/** Ce qui mérite de déranger l'utilisateur aujourd'hui, par ordre d'urgence. */
export function buildNotifications(state: NotifiableState): FlowNotification[] {
  const { transactions, scheduled, budgets, currency } = state;
  const out: FlowNotification[] = [];
  const money = (c: number) => formatCents(c, currency);

  const pending = pendingOccurrences(scheduled);
  if (pending.length > 0) {
    out.push({
      tag: 'echeances',
      title: `${pending.length} échéance${pending.length > 1 ? 's' : ''} à confirmer`,
      body: pending
        .slice(0, 3)
        .map((o) => `${o.entry.label} · ${money(o.entry.amount)}`)
        .join('\n'),
    });
  }

  const negative = firstNegativeDay(forecastBalance(transactions, scheduled, 'both', 30));
  if (negative) {
    out.push({
      tag: 'tresorerie',
      title: 'Trésorerie sous zéro en vue',
      body: `La projection passe dans le rouge le ${new Date(negative.dateISO).toLocaleDateString(
        'fr-FR',
        { day: 'numeric', month: 'long' },
      )}.`,
    });
  }

  const over = budgets.filter((b) => b.level === 'over');
  if (over.length > 0) {
    out.push({
      tag: 'budgets',
      title: `${over.length} budget${over.length > 1 ? 's dépassés' : ' dépassé'}`,
      body: over
        .slice(0, 3)
        .map((b) => `${b.categoryLabel} : ${money(b.spent)} / ${money(b.effective)}`)
        .join('\n'),
    });
  }

  const dormant = dormantSubscriptions(transactions, 'both');
  if (dormant.length > 0) {
    const monthly = dormant.reduce((acc, tx) => acc + monthlyEquivalent(tx), 0);
    out.push({
      tag: 'abonnements',
      title: `${dormant.length} abonnement${dormant.length > 1 ? 's dormants' : ' dormant'}`,
      body: `${money(monthly)} par mois pour des services que tu n'utilises plus.`,
    });
  }

  return out;
}

/** A-t-on déjà notifié aujourd'hui ? */
function alreadyRanToday(): boolean {
  try {
    return localStorage.getItem(LAST_RUN_KEY) === new Date().toDateString();
  } catch {
    return false;
  }
}

function markRan(): void {
  try {
    localStorage.setItem(LAST_RUN_KEY, new Date().toDateString());
  } catch {
    // Stockage indisponible : au pire on notifie deux fois.
  }
}

/**
 * Envoie au plus une notification par jour, la plus urgente.
 * Deux notifications d'affilée pour la même app, c'est déjà trop : on garde
 * la première de la liste, qui est aussi la plus importante.
 */
export async function runDailyNotifications(
  state: NotifiableState,
  options: { force?: boolean } = {},
): Promise<FlowNotification | null> {
  if (!notificationsSupported() || Notification.permission !== 'granted') return null;
  if (!options.force && alreadyRanToday()) return null;

  const candidates = buildNotifications(state);
  if (candidates.length === 0) {
    if (!options.force) markRan();
    return null;
  }

  const chosen = candidates[0];
  await showNotification(chosen);
  markRan();
  return chosen;
}

/** Passe par le service worker quand il est là : requis sur mobile. */
export async function showNotification(notification: FlowNotification): Promise<void> {
  const payload: NotificationOptions = {
    body: notification.body,
    tag: notification.tag,
    icon: '/pwa-192.png',
    badge: '/pwa-192.png',
  };

  try {
    const registration = await navigator.serviceWorker?.ready;
    if (registration) {
      await registration.showNotification(notification.title, payload);
      return;
    }
  } catch {
    // Pas de service worker : on tente la notification directe.
  }
  new Notification(notification.title, payload);
}
