import { ReactNode } from 'react';
import { Navbar } from './Navbar';
import { Footer } from './Footer';

export const AdminLayout = ({ title, children }: { title: string; children: ReactNode }) => {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">Admin</p>
              <h1 className="text-2xl font-bold text-ink">{title}</h1>
            </div>
          </div>
          <section className="space-y-6">{children}</section>
        </div>
      </main>
      <Footer />
    </div>
  );
};
