import { Check, Loader2, RefreshCcw, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { Card } from '../ui/Card';

/**
 * Version installée, et mise à jour forcée.
 *
 * Une app ajoutée à l'écran d'accueil garde sa version tant que le service
 * worker n'a pas repris la main, ce qui peut prendre plusieurs ouvertures.
 * Rien ne l'indique à l'écran : on croit alors tester la dernière version et
 * on cherche un bug déjà corrigé. Afficher la date du build coupe court.
 */
export function VersionCard() {
  const [state, setState] = useState<'idle' | 'checking' | 'ajour' | 'erreur'>('idle');

  async function check() {
    setState('checking');
    try {
      const registration = await navigator.serviceWorker?.getRegistration();
      if (!registration) {
        // Sans service worker, un rechargement suffit à reprendre la dernière version.
        window.location.reload();
        return;
      }
      await registration.update();
      if (registration.waiting || registration.installing) {
        // Une nouvelle version est prête : on la prend tout de suite.
        registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
        window.location.reload();
        return;
      }
      setState('ajour');
    } catch {
      setState('erreur');
    }
  }

  return (
    <Card>
      <h2 className="mb-2 flex items-center gap-2 text-base font-semibold">
        <RefreshCcw size={17} className="text-accent" />
        Version installée
      </h2>

      <p className="amount mb-3 text-sm text-ink-2">{__BUILD_ID__}</p>

      <button
        type="button"
        onClick={() => void check()}
        disabled={state === 'checking'}
        className="glass flex min-h-[44px] cursor-pointer items-center gap-2 rounded-2xl px-4 text-sm font-medium disabled:opacity-60"
      >
        {state === 'checking' ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <RefreshCcw size={16} />
        )}
        {state === 'checking' ? 'Recherche…' : 'Rechercher une mise à jour'}
      </button>

      {state === 'ajour' && (
        <p className="mt-3 flex items-center gap-2 text-sm text-pos">
          <Check size={15} />
          C'est déjà la dernière version publiée.
        </p>
      )}
      {state === 'erreur' && (
        <p className="mt-3 flex items-start gap-2 text-sm text-warn">
          <TriangleAlert size={15} className="mt-0.5 shrink-0" />
          Vérification impossible. Ferme complètement l'app puis rouvre-la.
        </p>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-ink-3">
        Compare cette date à celle de ton dernier déploiement. Si elle est plus
        ancienne, l'appareil sert encore une version en cache : ce bouton la remplace.
      </p>
    </Card>
  );
}
