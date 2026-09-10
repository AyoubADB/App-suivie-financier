import { Bell, BellRing, Check, Share, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useBudgets, useCategories, useScheduled, useTransactions } from '../../context/DataContext';
import { usePeriod } from '../../context/PeriodContext';
import { useSettings } from '../../context/SettingsContext';
import { computeBudgetStatuses } from '../../logic/budgets';
import {
  buildNotifications,
  isIos,
  isStandalone,
  notificationPermission,
  requestNotificationPermission,
  runDailyNotifications,
  showNotification,
} from '../../logic/notifications';
import { Card } from '../ui/Card';

/**
 * Rappels quotidiens.
 * Le texte explique franchement ce qui marche et ce qui ne marche pas selon
 * l'appareil : une notification qui n'arrive jamais sans explication est pire
 * que pas de notification du tout.
 */
export function NotificationsCard() {
  const transactions = useTransactions();
  const scheduled = useScheduled();
  const budgets = useBudgets();
  const categories = useCategories();
  const { range } = usePeriod();
  const { currency } = useSettings();

  const [permission, setPermission] = useState(notificationPermission());
  const [message, setMessage] = useState('');

  const statuses = computeBudgetStatuses(budgets, transactions, categories, range);
  const pending = buildNotifications({ transactions, scheduled, budgets: statuses, currency });

  const iosBlocked = isIos() && !isStandalone();

  useEffect(() => setPermission(notificationPermission()), []);

  async function enable() {
    const result = await requestNotificationPermission();
    setPermission(result);
    setMessage(
      result === 'granted'
        ? 'Rappels activés. Tu recevras au plus une notification par jour.'
        : result === 'denied'
          ? 'Refusé. Tu peux revenir dessus dans les réglages de notifications de ton navigateur.'
          : '',
    );
    if (result === 'granted') {
      await runDailyNotifications(
        { transactions, scheduled, budgets: statuses, currency },
        { force: true },
      );
    }
  }

  return (
    <Card>
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
        <Bell size={17} className="text-accent" />
        Rappels
      </h2>

      {permission === 'unsupported' ? (
        <p className="text-sm text-ink-2">
          Ce navigateur ne gère pas les notifications. Tout le reste de l'app fonctionne
          normalement.
        </p>
      ) : (
        <>
          <p className="mb-3 text-sm leading-relaxed text-ink-2">
            Une notification par jour au maximum, et seulement quand il y a quelque chose à faire :
            une échéance à confirmer, un budget dépassé, une trésorerie qui plonge, un abonnement
            oublié.
          </p>

          {iosBlocked && (
            <p className="mb-3 flex items-start gap-2 rounded-2xl bg-warn/10 px-3.5 py-3 text-xs leading-relaxed text-warn">
              <Share size={15} className="mt-0.5 shrink-0" />
              <span>
                Sur iPhone, les notifications exigent que l'app soit installée sur l'écran
                d'accueil. Dans Safari : bouton Partager, puis « Sur l'écran d'accueil ». Ouvre
                ensuite FLOW depuis l'icône et reviens ici.
              </span>
            </p>
          )}

          {permission === 'granted' ? (
            <p className="mb-3 flex items-center gap-2 text-sm font-medium text-pos">
              <Check size={16} />
              Rappels activés
            </p>
          ) : (
            <button
              type="button"
              onClick={() => void enable()}
              disabled={permission === 'denied'}
              className="bg-gradient-flow mb-3 flex min-h-[48px] cursor-pointer items-center gap-2 rounded-2xl px-5 text-sm font-semibold text-white disabled:opacity-50"
            >
              <BellRing size={17} />
              Activer les rappels
            </button>
          )}

          {permission === 'denied' && (
            <p className="mb-3 flex items-start gap-2 text-xs text-neg">
              <TriangleAlert size={14} className="mt-0.5 shrink-0" />
              Les notifications sont bloquées pour ce site. Autorise-les dans les réglages de ton
              navigateur, puis recharge la page.
            </p>
          )}

          {permission === 'granted' && (
            <div className="mb-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  void showNotification({
                    tag: 'test',
                    title: 'FLOW',
                    body: 'Les rappels fonctionnent sur cet appareil.',
                  })
                }
                className="glass flex min-h-[44px] cursor-pointer items-center gap-2 rounded-2xl px-4 text-sm font-medium"
              >
                Envoyer un test
              </button>
              <button
                type="button"
                onClick={async () => {
                  const sent = await runDailyNotifications(
                    { transactions, scheduled, budgets: statuses, currency },
                    { force: true },
                  );
                  setMessage(
                    sent
                      ? `Envoyé : ${sent.title}`
                      : "Rien à signaler aujourd'hui, c'est bon signe.",
                  );
                }}
                className="glass flex min-h-[44px] cursor-pointer items-center gap-2 rounded-2xl px-4 text-sm font-medium"
              >
                Vérifier maintenant
              </button>
            </div>
          )}

          {message && <p className="mb-3 text-sm text-ink-2">{message}</p>}

          <div className="rounded-2xl border border-line bg-surface-2/50 p-3.5">
            <p className="mb-2 text-xs font-medium text-ink-2">
              {pending.length === 0
                ? 'Rien à signaler en ce moment'
                : `${pending.length} sujet${pending.length > 1 ? 's' : ''} en attente`}
            </p>
            {pending.length > 0 && (
              <ul className="flex flex-col gap-1.5">
                {pending.map((n) => (
                  <li key={n.tag} className="text-xs">
                    <span className="font-medium">{n.title}</span>
                    <span className="block whitespace-pre-line text-ink-3">{n.body}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-ink-3">
            Les rappels partent de ton appareil, sans serveur : ils apparaissent à l'ouverture de
            l'app, ou pendant qu'elle est ouverte. Aucune donnée ne transite par un service de
            notification.
          </p>
        </>
      )}
    </Card>
  );
}
