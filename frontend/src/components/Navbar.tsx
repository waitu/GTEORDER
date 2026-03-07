import { useMemo, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthProvider';
import { UserMenu } from './UserMenu';
import { fetchBalance } from '../api/dashboard';

export type NavItem = {
  label: string;
  href?: string;
  children?: { label: string; href: string }[];
};

const marketingNavItems: NavItem[] = [
  { label: 'About Us', href: '#about' },
  { label: 'Pricing', href: '#pricing' },
  {
    label: 'Our Services',
    children: [
      { label: 'Label Scanning', href: '#services' },
      { label: 'Batch Processing', href: '#services' },
      { label: 'Analytics', href: '#services' },
    ],
  },
  { label: 'Blogs', href: '#blogs' },
  { label: 'Contact', href: '#contact' },
];

const appNavItems = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Active tracking', to: '/trackings' },
  { label: 'Empty package', to: '/empty-orders' },
  { label: 'Design', to: '/design' },
  { label: 'Pricing', to: '/pricing' },
];

const adminNavItems = [
  { label: 'Dashboard', to: '/admin' },
  // { label: 'Design Orders', to: '/admin/orders?view=design' },
  { label: 'Orders', to: '/admin/orders' },
  { label: 'Tracking Sync', to: '/admin/byeastside' },
  { label: 'Top-ups', to: '/admin/credit-topups' },
  { label: 'Requests', to: '/admin/requests' },
  { label: 'Audits', to: '/admin/audits' },
];

export const Navbar = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(false);

  const dropdownItems = useMemo(() => marketingNavItems.find((item) => item.children)?.children ?? [], []);
  const onAdminRoute = location.pathname.startsWith('/admin');
  const authenticatedNavItems = onAdminRoute ? adminNavItems : appNavItems;
  const balanceQuery = useQuery({
    queryKey: ['balance'],
    queryFn: fetchBalance,
    enabled: isAuthenticated,
  });
  const balance = balanceQuery.data?.balance;
  const formattedBalance = typeof balance === 'number'
    ? Number(balance).toLocaleString(undefined, { maximumFractionDigits: 2 })
    : null;

  return (
    <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Link to={isAuthenticated ? (onAdminRoute ? '/admin' : '/dashboard') : '/'} className="inline-flex items-center">
            <img src="/logo.png" alt="SCLabel" className="h-14 w-auto" />
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-700">
            {!isAuthenticated &&
              marketingNavItems.map((item) => (
                <div key={item.label} className="relative">
                  {item.children ? (
                    <button
                      className="flex items-center gap-1 hover:text-slate-900"
                      onMouseEnter={() => setOpenDropdown(true)}
                      onMouseLeave={() => setOpenDropdown(false)}
                    >
                      {item.label}
                      <span className="text-xs">▼</span>
                    </button>
                  ) : (
                    <a href={item.href} className="hover:text-slate-900">
                      {item.label}
                    </a>
                  )}
                  {item.children && openDropdown && (
                    <div
                      onMouseEnter={() => setOpenDropdown(true)}
                      onMouseLeave={() => setOpenDropdown(false)}
                      className="absolute mt-2 w-44 rounded-lg border border-slate-100 bg-white shadow-lg shadow-slate-200/60"
                    >
                      {dropdownItems.map((child) => (
                        <a
                          key={child.label}
                          href={child.href}
                          className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        >
                          {child.label}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}

            {isAuthenticated &&
              authenticatedNavItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `rounded-full px-3 py-2 transition hover:text-slate-900 ${
                      isActive ? 'bg-slate-100 text-ink' : 'text-slate-700'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {!isAuthenticated && (
            <Link
              to="/login"
              className="hidden md:inline-flex items-center justify-center rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Login
            </Link>
          )}
          {isAuthenticated && (
            <Link
              to="/balance"
              className="hidden sm:inline-flex items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
            >
              Balance:&nbsp;
              {formattedBalance ? (
                <span className="inline-flex items-center gap-1 font-bold">
                  <span>{formattedBalance}</span>
                  <span
                    aria-hidden="true"
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-200 text-[10px] text-emerald-900"
                    title="Credits"
                  >
                    ◉
                  </span>
                </span>
              ) : (
                '—'
              )}
            </Link>
          )}

          {isAuthenticated && <UserMenu email={user?.email} role={user?.role} onLogout={logout} />}

          <button
            className="inline-flex items-center justify-center rounded-full border border-slate-200 p-2 md:hidden"
            aria-label="Toggle menu"
            onClick={() => setOpen((prev) => !prev)}
          >
            <span className="text-xl">☰</span>
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-slate-100 bg-white">
          <div className="px-4 py-3 space-y-3 text-sm">
            {!isAuthenticated &&
              marketingNavItems.map((item) => (
                <div key={item.label}>
                  {item.children ? (
                    <details className="group">
                      <summary className="flex cursor-pointer items-center justify-between py-1 font-semibold text-slate-800">
                        {item.label}
                        <span className="text-xs">▼</span>
                      </summary>
                      <div className="space-y-2 pl-3 pt-2">
                        {dropdownItems.map((child) => (
                          <a key={child.label} href={child.href} className="block text-slate-600">
                            {child.label}
                          </a>
                        ))}
                      </div>
                    </details>
                  ) : (
                    <a href={item.href} className="block py-1 font-semibold text-slate-800">
                      {item.label}
                    </a>
                  )}
                </div>
              ))}

            {isAuthenticated &&
              authenticatedNavItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `block rounded-lg px-4 py-2 font-semibold ${isActive ? 'bg-slate-100 text-ink' : 'text-slate-800 hover:bg-slate-50'}`
                  }
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </NavLink>
              ))}

            {isAuthenticated && (
              <Link
                to="/balance"
                className="block rounded-lg bg-emerald-50 px-4 py-2 font-semibold text-emerald-800"
                onClick={() => setOpen(false)}
              >
                Balance:{' '}
                {formattedBalance ? (
                  <span className="inline-flex items-center gap-1">
                    <span>{formattedBalance}</span>
                    <span
                      aria-hidden="true"
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-200 text-[10px] text-emerald-900"
                      title="Credits"
                    >
                      ◉
                    </span>
                  </span>
                ) : (
                  '—'
                )}
              </Link>
            )}

            {!isAuthenticated ? (
              <Link
                to="/login"
                className="inline-flex w-full items-center justify-center rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Login
              </Link>
            ) : null}
          </div>
        </div>
      )}
    </header>
  );
};
