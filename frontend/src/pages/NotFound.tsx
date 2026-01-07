import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';

export const NotFoundPage = () => (
  <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
    <Navbar />
    <main className="flex-1 flex items-center justify-center px-4 py-16">
      <div className="max-w-xl space-y-4 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-sky-600">404</p>
        <h1 className="text-3xl font-bold text-ink">Page not found</h1>
        <p className="text-sm text-slate-600">The page you are looking for does not exist or may have moved.</p>
        <div className="flex flex-wrap justify-center gap-3 text-sm">
          <Link to="/" className="rounded-lg bg-ink px-4 py-2 font-semibold text-white shadow-sm hover:bg-slate-900">Go home</Link>
          <Link to="/dashboard" className="rounded-lg border border-slate-200 px-4 py-2 font-semibold text-slate-800 hover:bg-slate-50">Dashboard</Link>
        </div>
      </div>
    </main>
    <Footer />
  </div>
);
