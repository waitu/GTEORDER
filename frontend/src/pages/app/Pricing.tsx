import { DashboardLayout } from '../../components/DashboardLayout';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchPricing } from '../../api/pricing';
import { Link } from 'react-router-dom';

const formatPlanName = (key: string) => {
  const cleaned = key.replaceAll('_', ' ').trim();
  if (!cleaned) return key;
  return cleaned.replace(/\b\w/g, (m) => m.toUpperCase());
};

const discountLabel = (discount: number | undefined) => {
  const pct = Math.round(((discount ?? 0) * 100 + Number.EPSILON) * 100) / 100;
  if (!Number.isFinite(pct) || pct <= 0) return 'One-time purchase';
  return `One-time purchase · Save ${pct}%`;
};

const usd = (value: number) => `$${value.toFixed(2)}`;

const pricePerCredit = (price: number, credits: number) => {
  if (!Number.isFinite(price) || !Number.isFinite(credits) || credits <= 0) return null;
  return price / credits;
};

const savingsPctVs = (plan: { price: number; credits: number }, baseline: { price: number; credits: number }) => {
  const planPpc = pricePerCredit(plan.price, plan.credits);
  const basePpc = pricePerCredit(baseline.price, baseline.credits);
  if (planPpc == null || basePpc == null) return null;
  if (basePpc <= 0) return null;
  const pct = (1 - planPpc / basePpc) * 100;
  if (!Number.isFinite(pct)) return null;
  return pct;
};

const Bullet = ({ children }: { children: string }) => (
  <li className="flex gap-2">
    <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-slate-300" aria-hidden />
    <span className="leading-6 text-slate-700">{children}</span>
  </li>
);

const PricingCard = ({
  planKey,
  credits,
  price,
  discount,
  featured,
  muted,
  badgeText,
  valueHint,
  bullets,
}: {
  planKey: string;
  credits: number;
  price: number;
  discount: number;
  featured?: boolean;
  muted?: boolean;
  badgeText?: string;
  valueHint?: string;
  bullets: [string, string, string];
}) => {
  const ppc = pricePerCredit(price, credits);

  return (
    <div
      className={
        featured
          ? 'relative h-full rounded-2xl border border-sky-200 bg-white p-6 shadow-sm ring-1 ring-sky-100 lg:scale-[1.03]'
          : muted
            ? 'h-full rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-sm'
            : 'h-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm'
      }
    >
      <div>
        {badgeText && (
          <div className="inline-flex items-center rounded-full bg-sky-600 px-3 py-1 text-[11px] font-semibold text-white">
            {badgeText}
          </div>
        )}

        <div className={badgeText ? 'mt-3 text-sm font-semibold text-slate-600' : 'text-sm font-semibold text-slate-600'}>
          {formatPlanName(planKey)}
        </div>

        <div className="mt-4 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{credits.toLocaleString()} credits</div>

        <div className="mt-3 text-4xl font-bold tracking-tight text-ink sm:text-5xl">${price.toFixed(2)}</div>

        <div className="mt-2 space-y-1 text-sm text-slate-600">
          <div>{discountLabel(discount)}</div>
          <div className="text-slate-500">
            {ppc != null ? `≈ ${usd(ppc)} / credit` : ''}
            {ppc != null && valueHint ? ' · ' : ''}
            {valueHint ?? ''}
          </div>
        </div>

        <ul className="mt-5 space-y-2 text-sm">
          <Bullet>{bullets[0]}</Bullet>
          <Bullet>{bullets[1]}</Bullet>
          <Bullet>{bullets[2]}</Bullet>
        </ul>
      </div>

      <div className="mt-6">
        <Link
          to="/register"
          className={
            featured
              ? 'block w-full rounded-xl bg-sky-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm hover:bg-sky-500'
              : 'block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-800 hover:border-slate-300 hover:bg-slate-50'
          }
        >
          Buy credits
        </Link>
      </div>
    </div>
  );
};

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

  // stable ordering for layout + comparison (avoid Object.entries ordering surprises)
  const entriesByCreditsAsc = useMemo(() => {
    return Object.entries(packages)
      .filter(([, p]) => Number.isFinite(p.credits) && Number.isFinite(p.price))
      .sort((a, b) => (a[1].credits ?? 0) - (b[1].credits ?? 0));
  }, [packages]);

  const basicKey = useMemo(() => {
    if (packages['basic']) return 'basic';
    const first = entriesByCreditsAsc.find(([k]) => k !== featuredKey);
    return first?.[0] ?? null;
  }, [entriesByCreditsAsc, featuredKey, packages]);

  const premierKey = useMemo(() => {
    if (packages['premier']) return 'premier';
    const last = [...entriesByCreditsAsc].reverse().find(([k]) => k !== featuredKey && k !== basicKey);
    return last?.[0] ?? null;
  }, [basicKey, entriesByCreditsAsc, featuredKey, packages]);

  const visibleKeys = useMemo(() => {
    const keys = [basicKey, featuredKey, premierKey].filter((k): k is string => Boolean(k));
    return Array.from(new Set(keys));
  }, [basicKey, featuredKey, premierKey]);

  const extraEntries = useMemo(() => {
    return entriesByCreditsAsc.filter(([k]) => !visibleKeys.includes(k));
  }, [entriesByCreditsAsc, visibleKeys]);

  const featuredValueHint = useMemo(() => {
    if (!featuredKey) return undefined;
    const featured = packages[featuredKey];
    if (!featured) return undefined;

    const baselineKey = packages['standard'] ? 'standard' : basicKey;
    if (!baselineKey) return 'Best for teams scanning daily';
    const baseline = packages[baselineKey];
    if (!baseline) return 'Best for teams scanning daily';

    const pct = savingsPctVs(
      { price: featured.price, credits: featured.credits },
      { price: baseline.price, credits: baseline.credits },
    );
    const rounded = pct == null ? null : Math.round(pct);
    if (rounded == null || rounded < 3) return 'Best for teams scanning daily';
    return `Save ~${rounded}% vs ${formatPlanName(baselineKey)}`;
  }, [basicKey, featuredKey, packages]);

  const basicValueHint = useMemo(() => {
    if (!basicKey || !featuredKey) return 'Good for a quick test';
    const basic = packages[basicKey];
    const featured = packages[featuredKey];
    if (!basic || !featured) return 'Good for a quick test';
    const pct = savingsPctVs(
      { price: featured.price, credits: featured.credits },
      { price: basic.price, credits: basic.credits },
    );
    const rounded = pct == null ? null : Math.round(pct);
    if (rounded == null || rounded < 3) return 'Good for a quick test';
    return `Higher cost per credit · Ultra saves ~${rounded}%`;
  }, [basicKey, featuredKey, packages]);

  return (
    <DashboardLayout title="Pricing">
      <div className="w-full">
        <header className="pt-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Simple, transparent credit pricing.</h1>
              <p className="mt-2 text-sm text-slate-600">Buy credits in minutes. Use them across scans, tracking, and designs.</p>
            </div>
            <Link to="/pricing/details" className="text-sm font-semibold text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline">
              Pricing details
            </Link>
          </div>
        </header>

        <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_280px]">
          <div>
            {isLoading && <div className="text-sm text-slate-500">Loading packages…</div>}
            {!isLoading && Object.keys(packages).length === 0 && <div className="text-sm text-slate-500">No packages configured.</div>}

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-stretch">
              {basicKey && packages[basicKey] && (
                <div className="lg:col-start-1">
                  <PricingCard
                    planKey={basicKey}
                    credits={packages[basicKey].credits}
                    price={packages[basicKey].price}
                    discount={packages[basicKey].discount}
                    muted
                    valueHint={basicValueHint}
                    bullets={['Good for a quick test', 'Includes all features', 'Upgrade anytime']}
                  />
                </div>
              )}

              {featuredKey && packages[featuredKey] && (
                <div className="lg:col-start-2">
                  <PricingCard
                    planKey={featuredKey}
                    credits={packages[featuredKey].credits}
                    price={packages[featuredKey].price}
                    discount={packages[featuredKey].discount}
                    featured
                    badgeText="Best value"
                    valueHint={featuredValueHint}
                    bullets={['Best value per credit', 'Built for daily scanning', 'Instant credit allocation']}
                  />
                </div>
              )}

              {premierKey && packages[premierKey] && (
                <div className="lg:col-start-3">
                  <PricingCard
                    planKey={premierKey}
                    credits={packages[premierKey].credits}
                    price={packages[premierKey].price}
                    discount={packages[premierKey].discount}
                    bullets={['Best for high-volume usage', 'Includes all features', 'Upgrade anytime']}
                  />
                </div>
              )}
            </div>

            {extraEntries.length > 0 && (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">More packages</div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {extraEntries.map(([key, p]) => {
                    const ppc = pricePerCredit(p.price, p.credits);
                    return (
                      <div key={key} className="flex items-baseline justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                        <div>
                          <div className="text-sm font-semibold text-slate-800">{formatPlanName(key)}</div>
                          <div className="text-xs text-slate-600">{p.credits.toLocaleString()} credits</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-slate-900">{usd(p.price)}</div>
                          <div className="text-xs text-slate-600">{ppc != null ? `≈ ${usd(ppc)} / credit` : ''}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <aside className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Help</div>
              <h3 className="mt-2 text-sm font-semibold text-slate-900">Need help choosing?</h3>
              <p className="mt-1 text-sm text-slate-600">Use credits across scans, tracking, and designs. Upgrade anytime.</p>
              <p className="mt-3 text-sm text-slate-600">
                Questions? Email{' '}
                <a className="font-semibold text-slate-700 underline-offset-4 hover:underline" href="mailto:support@sclabel.io">
                  support@sclabel.io
                </a>
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Support</div>
              <p className="mt-2 text-sm text-slate-600">
                Email{' '}
                <a className="font-semibold text-slate-700 underline-offset-4 hover:underline" href="mailto:support@sclabel.io">
                  support@sclabel.io
                </a>
              </p>
            </div>
          </aside>
        </div>
      </div>
    </DashboardLayout>
  );
};
