import { motion } from 'framer-motion';
import {
  Briefcase,
  LayoutDashboard,
  RefreshCcw,
  Settings,
  User,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ScopeSelector } from '../ScopeSelector';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/perso', label: 'Perso', icon: User },
  { to: '/pro', label: 'Pro', icon: Briefcase },
  { to: '/abonnements', label: 'Abonnements', icon: RefreshCcw },
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

/** Sidebar desktop + bottom-bar mobile, header sticky avec le scope global. */
export function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();

  return (
    <div className="min-h-dvh md:flex">
      {/* Sidebar — desktop */}
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
        <p className="mt-auto text-[11px] leading-relaxed text-ink-3">
          100 % offline · tes données restent sur cet appareil.
        </p>
      </aside>

      {/* Contenu */}
      <div className="min-w-0 flex-1 md:pl-60">
        <header className="sticky top-0 z-30 border-b border-line bg-page/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="md:hidden">
              <Logo />
            </div>
            <div className="hidden text-sm font-medium text-ink-2 md:block">
              {NAV_ITEMS.find((n) => n.to === location.pathname)?.label ?? ''}
            </div>
            <ScopeSelector />
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

      {/* Bottom nav — mobile */}
      <nav className="glass fixed inset-x-3 bottom-3 z-40 flex items-center justify-around rounded-3xl px-2 py-2 shadow-2xl md:hidden">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            aria-label={label}
            className={({ isActive }) =>
              `flex min-h-[48px] min-w-[48px] flex-col items-center justify-center gap-0.5 rounded-2xl px-2 transition-colors ${
                isActive ? 'text-accent-2' : 'text-ink-3'
              }`
            }
          >
            <Icon size={21} />
            <span className="text-[9px] font-medium">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
