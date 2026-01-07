import { ReactNode, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';

const links = [
  { label: 'Dashboard', to: '/app' },
  { label: 'Active Tracking', to: '/app/active' },
  { label: 'Empty Orders', to: '/app/empty' },
  { label: 'Credit', to: '/app/balance' },
  { label: 'Pricing', to: '/app/pricing' },
  { label: 'Devices', to: '/app/devices' },
  { label: 'Logout', to: '/login' },
];

export const AppLayout = ({ title, children }: { title: string; children: ReactNode }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-ink">{title}</h1>
          <button className="md:hidden rounded-lg border border-slate-200 px-3 py-1 text-sm" onClick={() => setOpen((v) => !v)}>
            Menu
          </button>
        </div>
        <div className="grid gap-6 md:grid-cols-[220px_1fr]">
          <aside className={clsx('rounded-xl border border-slate-200 bg-white shadow-sm', open ? 'block' : 'hidden md:block')}>
            <nav className="flex flex-col divide-y divide-slate-100">
              {links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    clsx('px-4 py-3 text-sm font-semibold hover:bg-slate-50', isActive ? 'text-ink bg-slate-50' : 'text-slate-700')
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>
          </aside>
          <section className="space-y-6">{children}</section>
        </div>
      </div>
      </main>
      <Footer />
    </div>
  );
};
