import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';
import { ThemeToggle } from './ThemeToggle';
import { LanguageToggle } from './LanguageToggle';
import { NotificationBell } from './NotificationBell';
// header_logo from /public — direct URL, no import needed

const navItems = [
  { to: '/', label: 'home.title' },
  { to: '/quiz', label: 'home.start' },
  { to: '/rankings', label: 'rankings.title' },
  { to: '/friends', label: 'friends.title' },
  { to: '/settings?tab=my-profile', label: 'nav.myProfile' },
  { to: '/settings', label: 'settings.title' },
];

export function AppShell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top navigation bar */}
      <header className="border-b border-[var(--color-border)] bg-[var(--color-background)] px-4 py-2">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Mobile hamburger */}
            <button
              className="sm:hidden rounded-md p-2 min-h-[44px] min-w-[44px] hover:bg-[var(--color-muted)]"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label={t('app.toggleNav')}
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {sidebarOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
            <NavLink to="/" className="flex items-center text-[var(--color-foreground)]">
              <img src="/header_logo.png" alt="Geotano" className="h-12 w-auto" />
            </NavLink>
          </div>

          <div className="flex items-center gap-4">
            {/* Desktop LanguageToggle */}
            <div className="hidden sm:block">
              <LanguageToggle />
            </div>
            {user && (
              <span className="hidden text-sm text-[var(--color-muted-foreground)] sm:block">
                {user.displayName ?? user.username}
              </span>
            )}
            {user && <NotificationBell />}
            <button
              onClick={handleLogout}
              className="rounded-md px-3 py-1.5 min-h-[44px] text-sm font-medium text-[var(--color-destructive)] hover:bg-[var(--color-muted)]"
            >
              {t('auth.logout')}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1">
        {/* Sidebar — desktop always visible, mobile toggle */}
        <aside
          className={`
            flex w-56 shrink-0 flex-col border-r border-[var(--color-border)]
            ${sidebarOpen ? 'block' : 'hidden'} sm:flex
            bg-[var(--color-background)]
          `}
        >
          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-4">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `rounded-md px-3 py-2 min-h-[44px] flex items-center text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                      : 'text-[var(--color-foreground)] hover:bg-[var(--color-muted)]'
                  }`
                }
              >
                {t(item.label)}
              </NavLink>
            ))}
          </nav>

          {/* Settings area at bottom of sidebar */}
          <div className="border-t border-[var(--color-border)] p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
              {t('settings.title')}
            </p>
            <ThemeToggle />
          </div>
        </aside>

        {/* Main content — flex-col so children can fill height (e.g. ChatPage) */}
        <main className="flex-1 overflow-auto p-4 sm:p-6 flex flex-col min-h-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
