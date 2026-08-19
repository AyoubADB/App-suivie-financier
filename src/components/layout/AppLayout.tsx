import { motion } from 'framer-motion';
import {
  ArrowLeftRight,
  CloudOff,
  LayoutDashboard,
  LogOut,
  Search,
  Settings,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { GlobalSearch } from '../GlobalSearch';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/mouvements', label: 'Mouvements', icon: ArrowLeftRight },
  { to: '/reglages', label: 'Réglages', icon: Settings },
];

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
  const { user, mode, signOut } = useAuth();
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

        <div className="mt-auto flex flex-col gap-2">
          {user ? (
            <div className="flex items-center gap-2.5 rounded-2xl bg-surface-2/60 p-2.5">
              {user.photoURL ? (
                <img src={user.photoURL} alt="" className="h-8 w-8 shrink-0 rounded-full" />
              ) : (
                <div className="bg-gradient-flow flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white">
                  {(user.displayName ?? user.email ?? '?').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{user.displayName ?? 'Mon compte'}</p>
                <p className="truncate text-[10px] text-ink-3">Synchronisé</p>
              </div>
              <button
                onClick={signOut}
                aria-label="Se déconnecter"
                className="shrink-0 cursor-pointer text-ink-3 transition-colors hover:text-neg"
              >
                <LogOut size={15} />
              </button>
            </div>
          ) : (
            <p className="flex items-center gap-2 text-[11px] leading-relaxed text-ink-3">
              <CloudOff size={13} className="shrink-0" />
              Mode local — données sur cet appareil uniquement.
            </p>
          )}
        </div>
      </aside>

      <div className="min-w-0 flex-1 md:pl-60">
        <header className="sticky top-0 z-30 border-b border-line bg-page/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
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

              {mode === 'cloud' && user?.photoURL && (
                <img
                  src={user.photoURL}
                  alt={user.displayName ?? 'Compte'}
                  className="h-9 w-9 rounded-full md:hidden"
                />
              )}
            </div>
          </div>
        </header>

        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="mx-auto max-w-5xl px-4 pb-28 pt-5 sm:px-6 md:pb-10"
        >
          {children}
        </motion.main>
      </div>

      <nav className="glass fixed inset-x-3 bottom-3 z-40 flex items-center justify-around rounded-3xl px-2 py-2 shadow-2xl md:hidden">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            aria-label={label}
            className={({ isActive }) =>
              `flex min-h-[48px] min-w-[48px] flex-col items-center justify-center gap-0.5 rounded-2xl px-3 transition-colors ${
                isActive ? 'text-accent-2' : 'text-ink-3'
              }`
            }
          >
            <Icon size={21} />
            <span className="text-[9px] font-medium">{label}</span>
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
