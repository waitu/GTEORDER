import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';

export const UnauthorizedPage = () => (
  <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
    <Navbar />
    <main className="flex-1 flex items-center justify-center px-4 py-16">
      <div className="max-w-xl space-y-4 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-amber-600">Unauthorized</p>
        <h1 className="text-3xl font-bold text-ink">You don’t have access</h1>
        <p className="text-sm text-slate-600">Please contact an administrator if you believe this is a mistake.</p>
        <div className="flex flex-wrap justify-center gap-3 text-sm">
          <Link to="/dashboard" className="rounded-lg bg-ink px-4 py-2 font-semibold text-white shadow-sm hover:bg-slate-900">Back to dashboard</Link>
          <Link to="/login" className="rounded-lg border border-slate-200 px-4 py-2 font-semibold text-slate-800 hover:bg-slate-50">Login</Link>
        </div>
      </div>
    </main>
    <Footer />
  </div>
);
