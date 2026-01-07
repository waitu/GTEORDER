import { DashboardLayout } from '../../components/DashboardLayout';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchPricing } from '../../api/pricing';
import { Link } from 'react-router-dom';

export const PricingPage = () => {
  const { data, isLoading } = useQuery({ queryKey: ['pricing'], queryFn: fetchPricing });
  const packages = data?.topupPackages ?? {};

  // choose featured package: prefer key 'ultra', otherwise package with highest credits
  const featuredKey = useMemo(() => {
    if (!packages) return null;
    if (packages['ultra']) return 'ultra';
    const entries = Object.entries(packages);
    if (entries.length === 0) return null;
    entries.sort((a, b) => (b[1].credits ?? 0) - (a[1].credits ?? 0));
    return entries[0][0];
  }, [packages]);

  const otherEntries = useMemo(() => Object.entries(packages).filter(([k]) => k !== featuredKey), [packages, featuredKey]);

  return (
    <DashboardLayout title="Pricing">
      <div className="space-y-6">
        <header className="rounded-lg border bg-gradient-to-r from-slate-900 to-sky-900 p-6 text-white shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Credits for your team</h1>
              <p className="mt-1 text-sm text-slate-200">Buy credits or contact us for custom enterprise packages. Start with a package and upgrade anytime.</p>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/register" className="rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-slate-900">Get started — Sign up</Link>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          <div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {isLoading && <div className="text-sm text-slate-500">Loading packages…</div>}
              {!isLoading && Object.keys(packages).length === 0 && <div className="text-sm text-slate-500">No packages configured.</div>}

              {/* Featured package displayed larger if present */}
              {featuredKey && packages[featuredKey] && (
                <div className="md:col-span-1 lg:col-span-2 rounded-2xl border p-6 bg-white shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-slate-500">{featuredKey}</div>
                      <div className="mt-2 text-3xl font-bold">{packages[featuredKey].credits} credits</div>
                      <div className="text-sm text-slate-600 mt-1">One-time purchase</div>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-extrabold">${packages[featuredKey].price.toFixed(2)}</div>
                      <div className="text-sm text-slate-500">Discount: {(packages[featuredKey].discount * 100).toFixed(0)}%</div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-col gap-3">
                    <ul className="list-inside list-disc text-sm text-slate-700">
                      <li>Immediate credit allocation to your account</li>
                      <li>Use credits for label scanning, tracking, and designs</li>
                      <li>Upgrade or contact sales for enterprise tiers</li>
                    </ul>
                    <div className="mt-4 flex gap-3">
                      <Link to="/register" className="rounded-md bg-sky-700 px-4 py-2 text-white font-semibold">Buy {packages[featuredKey].credits} credits</Link>
                      <a className="rounded-md border px-4 py-2 text-sm text-slate-700" href="mailto:sales@example.com">Contact sales</a>
                    </div>
                  </div>
                </div>
              )}

              {/* Render remaining packages */}
              {otherEntries.map(([key, p]) => (
                <div key={key} className="rounded-lg border p-5 bg-white shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-slate-500">{key}</div>
                      <div className="mt-2 text-2xl font-semibold">{p.credits} credits</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold">${p.price.toFixed(2)}</div>
                      <div className="text-sm text-slate-500">one-time</div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="text-sm text-slate-600">Discount: {(p.discount * 100).toFixed(0)}%</div>
                    <div className="mt-4">
                      <Link to="/register" className="w-full inline-block rounded bg-slate-900 text-white py-2 text-center">Buy</Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar: Custom card and link to details */}
          <aside className="space-y-6">
            <div className="rounded-lg border p-5 bg-white shadow-sm">
              <h3 className="text-lg font-semibold">Need a custom plan?</h3>
              <p className="mt-2 text-sm text-slate-600">If you need a tailored package or enterprise pricing, our team can help.</p>
              <div className="mt-4 flex flex-col gap-2">
                <a href="mailto:sales@example.com" className="rounded-md bg-ink px-4 py-2 text-white text-center">Contact sales</a>
                <Link to="/pricing/details" className="text-sm text-sky-600 underline text-center">See detailed pricing</Link>
              </div>
            </div>

            <div className="rounded-lg border p-5 bg-white shadow-sm">
              <h4 className="text-sm font-semibold">Questions?</h4>
              <p className="mt-2 text-xs text-slate-600">Email <a className="text-sky-600 underline" href="mailto:support@sclabel.io">support@sclabel.io</a> or start with a free account.</p>
            </div>
          </aside>
        </div>
      </div>
    </DashboardLayout>
  );
};
