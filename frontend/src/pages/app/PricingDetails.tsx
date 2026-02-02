import { useEffect, useMemo } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '../../components/DashboardLayout';
import { fetchPricing } from '../../api/pricing';
import { getServiceLabelForKey } from '../../lib/pricing';

type PackageInfo = { price: number; credits: number; discount: number };

const formatPlanName = (key: string) => {
  const cleaned = key.replaceAll('_', ' ').trim();
  if (!cleaned) return key;
  return cleaned.replace(/\b\w/g, (m) => m.toUpperCase());
};

const usd = (value: number) => `$${value.toFixed(2)}`;

const pricePerCredit = (price: number, credits: number) => {
  if (!Number.isFinite(price) || !Number.isFinite(credits) || credits <= 0) return null;
  return price / credits;
};

const computePlanOrder = (packages: Record<string, PackageInfo>) => {
  const preferred = ['basic', 'standard', 'pro', 'premier', 'ultra'];
  const present = new Set(Object.keys(packages));
  const ordered: string[] = [];
  for (const k of preferred) if (present.has(k)) ordered.push(k);

  const extra = Object.entries(packages)
    .filter(([k]) => !preferred.includes(k))
    .sort((a, b) => (a[1].credits ?? 0) - (b[1].credits ?? 0))
    .map(([k]) => k);
  return [...ordered, ...extra];
};

const serviceOrder = (services: Record<string, number>) => {
  const preferred = [
    'scan_label',
    'active_tracking',
    'empty_package',
    'design_2d',
    'design_3d',
    'embroidery_text',
    'embroidery_image',
    'sidebow',
    'poster_canvas',
  ];
  const keys = Object.keys(services);
  const set = new Set(keys);
  const ordered: string[] = [];
  for (const k of preferred) if (set.has(k)) ordered.push(k);
  const rest = keys.filter((k) => !ordered.includes(k)).sort((a, b) => a.localeCompare(b));
  return [...ordered, ...rest];
};

export const PricingDetailsPage = () => {
  const { data, isLoading } = useQuery({ queryKey: ['pricing'], queryFn: fetchPricing });
  const services = data?.serviceCreditCost ?? {};
  const packages = data?.topupPackages ?? {};

  const orderedPlans = useMemo(() => computePlanOrder(packages), [packages]);
  const orderedServices = useMemo(() => serviceOrder(services), [services]);

  const location = useLocation();
  const [searchParams] = useSearchParams();

  const targetId = useMemo(() => {
    const plan = searchParams.get('plan');
    if (plan) return `plan-${plan}`;
    if (location.hash) return location.hash.replace(/^#/, '');
    return null;
  }, [location.hash, searchParams]);

  useEffect(() => {
    if (isLoading) return;
    if (!targetId) return;
    const el = document.getElementById(targetId);
    if (!el) return;
    // Allow layout to settle (data-driven content)
    window.setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  }, [isLoading, targetId]);

  return (
    <DashboardLayout title="Pricing Details">
      <div className="space-y-6">
        <section className="rounded-lg border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Per-package pricing breakdown</h2>
              <p className="text-sm text-slate-600">Shows estimated $ cost per service for each package based on $ per credit.</p>
            </div>
            <Link to="/pricing" className="text-sm font-semibold text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline">
              Back to Pricing
            </Link>
          </div>

          <div className="mt-4">
            {isLoading && <div className="text-sm text-slate-500">Loading…</div>}

            {!isLoading && orderedPlans.length === 0 && (
              <div className="text-sm text-slate-500">No top-up packages configured.</div>
            )}

            {!isLoading && orderedPlans.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {orderedPlans.map((k) => (
                  <Link
                    key={k}
                    to={`/pricing/details?plan=${encodeURIComponent(k)}`}
                    className={
                      targetId === `plan-${k}`
                        ? 'rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white'
                        : 'rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                    }
                  >
                    {formatPlanName(k)}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        {!isLoading && orderedPlans.map((planKey) => {
          const pkg = packages[planKey];
          if (!pkg) return null;
          const ppc = pricePerCredit(pkg.price, pkg.credits);

          return (
            <section key={planKey} id={`plan-${planKey}`} className="scroll-mt-24 rounded-lg border bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{formatPlanName(planKey)}</h3>
                  <div className="mt-1 text-sm text-slate-600">
                    <span className="font-semibold text-slate-900">{pkg.credits.toLocaleString()}</span> credits ·{' '}
                    <span className="font-semibold text-slate-900">{usd(pkg.price)}</span>
                    {ppc != null ? <span className="text-slate-500"> · ≈ {usd(ppc)} / credit</span> : null}
                  </div>
                </div>

                <Link
                  to={`/pricing/details?plan=${encodeURIComponent(planKey)}`}
                  className="text-sm font-semibold text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline"
                >
                  Link to this package
                </Link>
              </div>

              <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                <div className="grid grid-cols-[minmax(0,1fr)_110px_110px] gap-4 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600">
                  <div>Service</div>
                  <div className="text-right">Per use</div>
                  <div className="text-right">100 uses</div>
                </div>

                {orderedServices.length === 0 ? (
                  <div className="px-4 py-4 text-sm text-slate-500">No service pricing configured.</div>
                ) : (
                  orderedServices.map((serviceKey) => {
                    const creditsPerUse = services[serviceKey];
                    const perUse = ppc == null ? null : creditsPerUse * ppc;
                    const per100 = perUse == null ? null : perUse * 100;
                    const usesPerPackage = creditsPerUse > 0 ? Math.floor(pkg.credits / creditsPerUse) : null;

                    return (
                      <div key={serviceKey} className="grid grid-cols-[minmax(0,1fr)_110px_110px] gap-4 border-t border-slate-100 px-4 py-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-900">{getServiceLabelForKey(serviceKey)}</div>
                          <div className="mt-0.5 text-xs text-slate-500">
                            {creditsPerUse} {creditsPerUse === 1 ? 'credit' : 'credits'} / use
                            {usesPerPackage != null ? ` · ≈ ${usesPerPackage.toLocaleString()} / package` : ''}
                          </div>
                        </div>

                        <div className="text-right text-sm text-slate-700">{perUse == null ? '—' : usd(perUse)}</div>
                        <div className="text-right text-sm text-slate-700">{per100 == null ? '—' : usd(per100)}</div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          );
        })}
      </div>
    </DashboardLayout>
  );
};
