import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';

export const AuthLayout = ({ title, children }: { title: string; children: ReactNode }) => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-white text-slate-900 flex flex-col">
      <Navbar />
      <main className="mx-auto flex max-w-6xl flex-1 flex-col items-center px-4 py-16">
        <div className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-8 shadow-card">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-sky-600">sclabel.io</p>
              <h1 className="text-2xl font-bold text-ink">{title}</h1>
            </div>
            <Link to="/" className="text-sm font-semibold text-slate-600 hover:text-ink">
              ← Back
            </Link>
          </div>
          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
};
