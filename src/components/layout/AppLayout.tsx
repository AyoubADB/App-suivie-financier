import { motion } from 'framer-motion';
import {
  ArrowLeftRight,
  Briefcase,
  Cloud,
  CloudOff,
  LayoutDashboard,
  Search,
  Settings,
  User,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { useDailyNotifications } from '../../hooks/useDailyNotifications';
import { AccountMenu } from '../AccountMenu';
import { GlobalSearch } from '../GlobalSearch';

/**
 * Le module Pro éteint, l'app n'a qu'un seul univers : une entrée
 * « Mouvements » suffit. Activé, Perso et Pro deviennent deux vraies pages,
 * et « Vue d'ensemble » réunit les deux.
 */
function navItems(proEnabled: boolean) {
  return proEnabled
    ? [
        { to: '/', label: "Vue d'ensemble", short: 'Vue', icon: LayoutDashboard },
        { to: '/perso', label: 'Perso', short: 'Perso', icon: User },
        { to: '/pro', label: 'Pro', short: 'Pro', icon: Briefcase },
        { to: '/reglages', label: 'Réglages', short: 'Réglages', icon: Settings },
      ]
    : [
        { to: '/', label: "Vue d'ensemble", short: 'Vue', icon: LayoutDashboard },
        { to: '/mouvements', label: 'Mouvements', short: 'Mouvements', icon: ArrowLeftRight },
        { to: '/reglages', label: 'Réglages', short: 'Réglages', icon: Settings },
      ];
}

function Logo() {
  return (
    <NavLink to="/" className="flex items-center gap-2.5">
      <img src="/favicon.svg" alt="" className="h-8 w-8 rounded-xl" />
      <span className="text-gradient text-xl font-extrabold tracking-tight">FLOW</span>
    </NavLink>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { mode } = useAuth();
  const { proEnabled } = useSettings();
  const NAV_ITEMS = navItems(proEnabled);

  // Rappel du jour, au moment où l'app s'ouvre.
  useDailyNotifications();
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="min-h-dvh md:flex">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col gap-8 border-r border-line bg-surface/60 p-6 backdrop-blur-xl md:flex">
        <Logo />
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-gradient-flow text-white shadow-lg shadow-accent/20'
                    : 'text-ink-2 hover:bg-surface-2 hover:text-ink'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <p className="mt-auto flex items-center gap-2 text-[11px] leading-relaxed text-ink-3">
          {mode === 'cloud' ? (
            <>
              <Cloud size={13} className="shrink-0" />
              Synchronisé sur ton compte.
            </>
          ) : (
            <>
              <CloudOff size={13} className="shrink-0" />
              Mode local — données sur cet appareil.
            </>
          )}
        </p>
      </aside>

      <div className="min-w-0 flex-1 md:pl-60">
        <header className="header-safe sticky top-0 z-30 border-b border-line bg-page/80 pb-3 backdrop-blur-xl md:pt-3">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
            <div className="md:hidden">
              <Logo />
            </div>
            <div className="hidden text-sm font-medium text-ink-2 md:block">
              {NAV_ITEMS.find((n) => n.to === location.pathname)?.label ?? ''}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setSearchOpen(true)}
                aria-label="Recherche globale"
                className="glass flex min-h-[40px] cursor-pointer items-center gap-2 rounded-2xl px-3 text-sm text-ink-3 transition-colors hover:text-ink"
              >
                <Search size={16} />
                <span className="hidden sm:inline">Rechercher</span>
                <kbd className="ml-1 hidden rounded-md border border-line px-1.5 py-0.5 text-[10px] md:inline">
                  ⌘K
                </kbd>
              </button>

              <AccountMenu />
            </div>
          </div>
        </header>

        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="mx-auto max-w-5xl px-4 pt-5 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] sm:px-6 md:pb-10"
        >
          {children}
        </motion.main>
      </div>

      <nav
        aria-label="Navigation principale"
        className="glass bottom-safe fixed inset-x-3 z-40 flex items-center justify-around rounded-3xl px-1.5 py-2 shadow-2xl md:hidden"
      >
        {NAV_ITEMS.map(({ to, label, short, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            aria-label={label}
            className={({ isActive }) =>
              `flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 transition-colors ${
                isActive ? 'text-accent-2' : 'text-ink-3'
              }`
            }
          >
            <Icon size={21} />
            <span className="w-full truncate text-center text-[10px] font-medium">{short}</span>
          </NavLink>
        ))}
      </nav>

      <GlobalSearch
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onPick={(tx) => navigate(`/mouvements?tx=${tx.id}`)}
      />
    </div>
  );
}
