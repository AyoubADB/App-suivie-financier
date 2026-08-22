import { AnimatePresence, motion } from 'framer-motion';
import {
  Cloud,
  CloudOff,
  Download,
  Eye,
  EyeOff,
  LogOut,
  Moon,
  Settings as SettingsIcon,
  Sun,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRepo } from '../context/DataContext';
import { useSettings } from '../context/SettingsContext';

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'MAD'];

/** Avatar cliquable ouvrant les réglages rapides du compte. */
export function AccountMenu() {
  const { user, mode, configured, signOut, signInGoogle } = useAuth();
  const { currency, theme, privacyMode, synced, update } = useSettings();
  const repo = useRepo();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function exportData() {
    const payload = await repo.exportAll();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flow-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  }

  const initial = (user?.displayName ?? user?.email ?? '?').charAt(0).toUpperCase();

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Mon compte"
        className="flex h-10 w-10 cursor-pointer items-center justify-center overflow-hidden rounded-full ring-1 ring-line transition-transform active:scale-95"
      >
        {/* L'initiale s'affiche tout de suite ; la photo Google la recouvre
            une fois chargée, ce qui évite un trou visuel à la connexion. */}
        <span className="bg-gradient-flow relative flex h-full w-full items-center justify-center text-sm font-bold text-white">
          {user ? initial : <CloudOff size={16} />}
          {user?.photoURL && (
            <img
              src={user.photoURL}
              alt=""
              loading="eager"
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="glass absolute right-0 top-full z-50 mt-2 w-72 origin-top-right overflow-hidden rounded-2xl shadow-2xl"
          >
            {/* Identité */}
            <div className="flex items-center gap-3 border-b border-line p-4">
              <span className="bg-gradient-flow relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold text-white">
                {user ? initial : <CloudOff size={16} />}
                {user?.photoURL && (
                  <img
                    src={user.photoURL}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {user?.displayName ?? (mode === 'cloud' ? 'Mon compte' : 'Mode local')}
                </p>
                <p className="truncate text-xs text-ink-3">
                  {user?.email ?? 'Données sur cet appareil'}
                </p>
              </div>
            </div>

            {/* Réglages rapides */}
            <div className="flex flex-col gap-1 p-2">
              <p className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-ink-3">
                Réglages rapides
              </p>

              <MenuRow
                icon={theme === 'dark' ? Moon : Sun}
                label="Thème"
                action={
                  <button
                    onClick={() => update({ theme: theme === 'dark' ? 'light' : 'dark' })}
                    className="cursor-pointer rounded-lg bg-surface-2 px-2.5 py-1 text-xs font-medium transition-colors hover:text-accent-2"
                  >
                    {theme === 'dark' ? 'Sombre' : 'Clair'}
                  </button>
                }
              />

              <MenuRow
                icon={privacyMode ? EyeOff : Eye}
                label="Masquer les montants"
                action={
                  <button
                    role="switch"
                    aria-checked={privacyMode}
                    onClick={() => update({ privacyMode: !privacyMode })}
                    className={`relative h-5 w-9 cursor-pointer rounded-full transition-colors ${
                      privacyMode ? 'bg-gradient-flow' : 'bg-surface-2'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                        privacyMode ? 'translate-x-4.5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                }
              />

              <MenuRow
                icon={synced ? Cloud : CloudOff}
                label="Devise"
                action={
                  <select
                    value={currency}
                    onChange={(e) => update({ currency: e.target.value })}
                    aria-label="Devise"
                    className="cursor-pointer rounded-lg bg-surface-2 px-2 py-1 text-xs font-medium"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                }
              />
            </div>

            {/* Actions */}
            <div className="flex flex-col border-t border-line p-2">
              <MenuButton
                icon={Download}
                label="Exporter mes données"
                onClick={() => void exportData()}
              />
              <MenuButton
                icon={SettingsIcon}
                label="Tous les réglages"
                onClick={() => {
                  navigate('/reglages');
                  setOpen(false);
                }}
              />
              {mode === 'cloud' ? (
                <MenuButton icon={LogOut} label="Se déconnecter" danger onClick={() => void signOut()} />
              ) : configured ? (
                <MenuButton
                  icon={Cloud}
                  label="Se connecter avec Google"
                  onClick={() => void signInGoogle()}
                />
              ) : null}
            </div>

            <p className="border-t border-line px-4 py-2 text-[10px] text-ink-3">
              {synced
                ? 'Catégories, badges et préférences synchronisés sur ton compte.'
                : 'Mode local : rien ne quitte cet appareil.'}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuRow({
  icon: Icon,
  label,
  action,
}: {
  icon: typeof Cloud;
  label: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl px-2 py-1.5">
      <Icon size={15} className="shrink-0 text-ink-3" />
      <span className="flex-1 text-sm">{label}</span>
      {action}
    </div>
  );
}

function MenuButton({
  icon: Icon,
  label,
  onClick,
  danger = false,
}: {
  icon: typeof Cloud;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={`flex min-h-[40px] cursor-pointer items-center gap-2.5 rounded-xl px-2 text-sm transition-colors hover:bg-surface-2 ${
        danger ? 'text-neg' : 'text-ink-2 hover:text-ink'
      }`}
    >
      <Icon size={15} className="shrink-0" />
      {label}
    </button>
  );
}
