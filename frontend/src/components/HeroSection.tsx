import { Link } from 'react-router-dom';

export const HeroSection = () => {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-blue-50 via-white to-emerald-50/70">
      <div className="absolute inset-x-0 top-0 h-64 bg-gradient-to-r from-blue-200/40 via-transparent to-emerald-200/40 blur-3xl" aria-hidden="true" />
      <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 py-16 lg:grid-cols-2 lg:py-24">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-100 to-emerald-100 px-3 py-1 text-xs font-semibold text-blue-700">
            USPS focused · Fast & accurate
          </div>
          <h1 className="font-display text-4xl leading-tight text-slate-900 sm:text-5xl">
            Scan smarter with a blue & green flow.
          </h1>
          <p className="max-w-xl text-lg text-slate-600">
            Automate USPS label validation, payouts, and monitoring in minutes. Real-time accuracy with enterprise-grade security.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              to="/register"
              className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/40 transition hover:shadow-xl hover:from-blue-700 hover:to-emerald-700"
            >
              Get Started
            </Link>
            <a href="#services" className="text-sm font-semibold text-slate-800 hover:text-emerald-600">
              Explore services →
            </a>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -right-8 -top-8 h-48 w-48 rounded-full bg-sky-100 blur-3xl" aria-hidden="true" />
          <div className="relative rounded-2xl border border-slate-100 bg-white/90 p-6 shadow-2xl shadow-emerald-200/40 backdrop-blur">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">Daily scans</span>
              <span className="text-xs text-emerald-600">Live</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-center">
              <div className="rounded-xl bg-gradient-to-br from-sky-500/10 to-sky-500/5 px-4 py-5">
                <p className="text-3xl font-bold text-slate-900">12.4k</p>
                <p className="text-xs text-slate-500">Processed</p>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 px-4 py-5">
                <p className="text-3xl font-bold text-slate-900">99.9%</p>
                <p className="text-xs text-slate-500">Accuracy</p>
              </div>
            </div>
            <div className="mt-6 rounded-xl border border-dashed border-emerald-200 bg-emerald-50/60 px-4 py-6 text-center">
              <p className="text-sm font-semibold text-slate-800">Scan USPS Labels</p>
              <p className="mt-1 text-xs text-slate-500">Upload, validate, and trigger payouts automatically.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
