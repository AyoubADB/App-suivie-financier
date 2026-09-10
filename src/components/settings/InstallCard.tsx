import { Check, Download, Share, SquarePlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { isIos, isStandalone } from '../../logic/notifications';
import { Card } from '../ui/Card';

/** Évènement Chrome/Edge, absent des types DOM standard. */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Installation sur l'écran d'accueil.
 * Android propose une invite native ; iOS impose un passage par le menu
 * Partager, qu'aucune API ne peut déclencher — d'où les instructions.
 */
export function InstallCard() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone());
  const ios = isIos();

  useEffect(() => {
    function onPrompt(e: Event) {
      e.preventDefault();
      setPrompt(e as InstallPromptEvent);
    }
    function onInstalled() {
      setInstalled(true);
      setPrompt(null);
    }
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed) {
    return (
      <Card>
        <h2 className="mb-2 flex items-center gap-2 text-base font-semibold">
          <Check size={17} className="text-pos" />
          App installée
        </h2>
        <p className="text-sm leading-relaxed text-ink-2">
          FLOW tourne depuis ton écran d'accueil, en plein écran et hors ligne. Les rappels sont
          disponibles dans cette configuration.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
        <Download size={17} className="text-accent" />
        Installer sur l'écran d'accueil
      </h2>

      <p className="mb-3 text-sm leading-relaxed text-ink-2">
        Installée, l'app s'ouvre en plein écran comme une application native, garde tes données hors
        ligne et peut envoyer des rappels.
      </p>

      {prompt ? (
        <button
          type="button"
          onClick={async () => {
            await prompt.prompt();
            const { outcome } = await prompt.userChoice;
            if (outcome === 'accepted') setInstalled(true);
            setPrompt(null);
          }}
          className="bg-gradient-flow flex min-h-[48px] cursor-pointer items-center gap-2 rounded-2xl px-5 text-sm font-semibold text-white"
        >
          <Download size={17} />
          Installer maintenant
        </button>
      ) : ios ? (
        <ol className="flex list-none flex-col gap-2.5 text-sm text-ink-2">
          <Step icon={Share}>
            Dans Safari, touche le bouton <strong>Partager</strong>, en bas de l'écran.
          </Step>
          <Step icon={SquarePlus}>
            Fais défiler et choisis <strong>Sur l'écran d'accueil</strong>.
          </Step>
          <Step icon={Check}>
            Ouvre FLOW depuis la nouvelle icône : c'est là que les rappels deviennent possibles.
          </Step>
        </ol>
      ) : (
        <p className="text-sm text-ink-2">
          Ouvre le menu de ton navigateur et cherche « Installer l'application » ou « Ajouter à
          l'écran d'accueil ».
        </p>
      )}
    </Card>
  );
}

function Step({ icon: Icon, children }: { icon: typeof Share; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <Icon size={16} className="mt-0.5 shrink-0 text-accent-2" />
      <span className="leading-relaxed">{children}</span>
    </li>
  );
}
