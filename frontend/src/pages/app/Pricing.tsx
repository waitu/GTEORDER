import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '../../components/DashboardLayout';
import { Badge } from '../../components/Badge';
import { fetchPricing } from '../../api/pricing';
import { PingPongTxIdModal } from '../../components/PingPongTxIdModal';

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

const savingsPct = (planPpc: number | null, baselinePpc: number | null) => {
  if (planPpc == null || baselinePpc == null || baselinePpc <= 0) return null;
  const pct = (1 - planPpc / baselinePpc) * 100;
  if (!Number.isFinite(pct) || pct <= 0) return null;
  return Math.round(pct);
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

const discountLabel = (discount: number | undefined) => {
  const pct = Math.round(((discount ?? 0) * 100 + Number.EPSILON) * 100) / 100;
  if (!Number.isFinite(pct) || pct <= 0) return 'One-time purchase';
  return `One-time purchase · Save ${pct}%`;
};

const resolveServiceKey = (services: Record<string, number>, candidates: string[]) => {
  for (const key of candidates) {
    if (key in services) return key;
  }
  return null;
};

const ServiceCostRow = ({
  label,
  creditsPerUse,
  planPpc,
  baselinePpc,
  baselineName,
  packageCredits,
  bundleUses,
  bundleUnit,
  subtleDivider,
  compact,
}: {
  label: string;
  creditsPerUse: number;
  planPpc: number | null;
  baselinePpc: number | null;
  baselineName: string;
  packageCredits?: number;
  bundleUses?: number;
  bundleUnit?: string;
  subtleDivider?: boolean;
  compact?: boolean;
}) => {
  const perUse = planPpc == null ? null : creditsPerUse * planPpc;
  const save = savingsPct(planPpc, baselinePpc);
  const creditsLabel = creditsPerUse === 1 ? 'credit' : 'credits';

  const usesPerPackage =
    packageCredits != null && Number.isFinite(packageCredits) && Number.isFinite(creditsPerUse) && creditsPerUse > 0
      ? Math.floor(packageCredits / creditsPerUse)
      : null;

  const bundleText =
    bundleUses != null && bundleUses > 0
      ? `${bundleUses.toLocaleString()} ${bundleUnit ?? 'uses'} → ${perUse == null ? '—' : usd(perUse * bundleUses)}`
      : null;

  const metaText = (() => {
    const bits: string[] = [];
    if (usesPerPackage != null) bits.push(`≈ ${usesPerPackage.toLocaleString()} / package`);
    if (perUse != null) bits.push(`${usd(perUse)} / use`);
    if (bundleText == null) bits.push(`${creditsPerUse} ${creditsLabel} / use`);
    return bits.join(' · ');
  })();

  return (
    <div className={subtleDivider ? 'border-t border-slate-100 pt-2' : ''}>
      {compact ? (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 py-2">
          <div className="min-w-0 text-sm font-medium text-slate-900">{label}</div>
          <div className="text-right text-sm text-slate-700">
            {bundleText ?? (perUse == null ? '—' : `${creditsPerUse} ${creditsLabel} → ${usd(perUse)} per use`)}
          </div>

          <div className="min-w-0 text-xs text-slate-500">{metaText || <span className="text-transparent">.</span>}</div>
          <div className="text-right text-xs">
            {save != null ? (
              <span className="text-emerald-600">Save {save}% vs {baselineName}</span>
            ) : (
              <span className="text-transparent">.</span>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 py-2">
          <div className="min-w-0">
            <div className="text-sm font-medium text-slate-900">{label}</div>
            <div className="mt-0.5 text-xs text-slate-500">
              {usesPerPackage != null ? `≈ ${usesPerPackage.toLocaleString()} / package` : ''}
              {usesPerPackage != null ? ' · ' : ''}
              {`${creditsPerUse} ${creditsLabel} / use`}
            </div>
          </div>

          <div className="text-right">
            <div className="text-sm text-slate-700">
              {bundleText ?? (perUse == null ? '—' : `${creditsPerUse} ${creditsLabel} → ${usd(perUse)} per use`)}
            </div>
            <div className="mt-0.5 text-xs text-transparent">.</div>
            {save != null ? <div className="mt-0.5 text-xs text-emerald-600">Save {save}% vs {baselineName}</div> : <div className="mt-0.5 text-xs text-transparent">.</div>}
          </div>
        </div>
      )}
    </div>
  );
};

const PricingCard = ({
  planKey,
  pkg,
  services,
  baselineKey,
  baselinePkg,
  badge,
  featured,
  onBuyCredits,
}: {
  planKey: string;
  pkg: PackageInfo;
  services: Record<string, number>;
  baselineKey: string | null;
  baselinePkg: PackageInfo | null;
  badge?: { text: string; variant: 'info' | 'success' | 'neutral' };
  featured?: boolean;
  onBuyCredits: (packageKey: string) => void;
}) => {
  const planPpc = pricePerCredit(pkg.price, pkg.credits);
  const basePpc = baselinePkg ? pricePerCredit(baselinePkg.price, baselinePkg.credits) : null;
  const baselineName = baselineKey ? formatPlanName(baselineKey) : 'Basic';

  const scanKey = resolveServiceKey(services, ['scan_label', 'active_tracking']);
  const emptyKey = resolveServiceKey(services, ['empty_package']);
  const detailsHref = `/pricing/details?plan=${encodeURIComponent(planKey)}`;

  return (
    <div className={featured ? 'h-full rounded-2xl border border-sky-200 bg-white p-6 shadow-sm ring-1 ring-sky-100' : 'h-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm'}>
      {/* 1) Plan Summary (unchanged) */}
      <div>
        {badge && (
          <div className="inline-flex">
            <Badge variant={badge.variant}>{badge.text}</Badge>
          </div>
        )}

        <div className={badge ? 'mt-3 text-sm font-semibold text-slate-600' : 'text-sm font-semibold text-slate-600'}>
          {formatPlanName(planKey)}
        </div>

        <div className="mt-4 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{pkg.credits.toLocaleString()} credits</div>
        <div className="mt-3 text-4xl font-bold tracking-tight text-ink sm:text-5xl">{usd(pkg.price)}</div>
        <div className="mt-2 space-y-1 text-sm text-slate-600">
          <div>{discountLabel(pkg.discount)}</div>
          <div className="text-slate-500">{planPpc != null ? `≈ ${usd(planPpc)} / credit` : ''}</div>
        </div>
      </div>

      {/* 2) Most used services */}
      <div className="mt-5 border-t border-slate-100 pt-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Most used services</div>

        <div className="mt-2">
          {scanKey && Number.isFinite(services[scanKey]) ? (
            <ServiceCostRow
              label="Scan Label"
              creditsPerUse={services[scanKey]}
              planPpc={planPpc}
              baselinePpc={basePpc}
              baselineName={baselineName}
              packageCredits={pkg.credits}
              bundleUses={100}
              bundleUnit="scans"
              compact
            />
          ) : (
            <div className="py-2 text-sm text-slate-500">Scan Label → —</div>
          )}

          {emptyKey && Number.isFinite(services[emptyKey]) ? (
            <ServiceCostRow
              label="Empty Package"
              creditsPerUse={services[emptyKey]}
              planPpc={planPpc}
              baselinePpc={basePpc}
              baselineName={baselineName}
              packageCredits={pkg.credits}
              bundleUses={100}
              bundleUnit="empties"
              subtleDivider
              compact
            />
          ) : (
            <div className="border-t border-slate-100 py-2 text-sm text-slate-500">Empty → —</div>
          )}
        </div>
      </div>

      {/* 3) Expand for more services */}
      <div className="mt-3">
        <Link
          to={detailsHref}
          className="text-sm font-semibold text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline"
        >
          Show all service costs
        </Link>
      </div>

      {/* CTA (unchanged) */}
      <div className="mt-6">
        <button
          type="button"
          onClick={() => onBuyCredits(planKey)}
          className={
            featured
              ? 'block w-full rounded-xl bg-sky-600 px-4 py-3 text-center text-sm font-semibold shadow-sm transition hover:bg-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 border border-slate-200'
              : 'block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-900 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2'
          }
        >
          Buy credits
        </button>
      </div>
    </div>
  );
};

export const PricingPage = () => {
  const { data, isLoading } = useQuery({ queryKey: ['pricing'], queryFn: fetchPricing });
  const packages = data?.topupPackages ?? {};
  const services = data?.serviceCreditCost ?? {};

  const [purchase, setPurchase] = useState<{ open: boolean; packageKey: string | null }>({ open: false, packageKey: null });

  const orderedKeys = useMemo(() => computePlanOrder(packages), [packages]);
  const baselineKey = useMemo(() => (packages['basic'] ? 'basic' : orderedKeys[0] ?? null), [orderedKeys, packages]);
  const baselinePkg = baselineKey ? packages[baselineKey] ?? null : null;

  const featuredKey = useMemo(() => {
    if (packages['pro']) return 'pro';
    if (packages['ultra']) return 'ultra';
    return null;
  }, [packages]);

  return (
    <DashboardLayout title="Pricing">
      <div className="w-full">
        <header className="pt-2">
          <div className="flex flex-col gap-3">
            <div className="max-w-2xl">
              <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Simple, transparent credit pricing.</h1>
              <p className="mt-2 text-sm text-slate-600">Compare Scan Label and Empty costs instantly, then open full package breakdowns when you need them.</p>
            </div>
          </div>
        </header>

        {/* Wider container for Pricing cards only (keeps dashboard vibe, uses screen better) */}
        <div className="mt-6 -mx-4 sm:-mx-6 lg:-mx-8">
          <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
            {isLoading && <div className="text-sm text-slate-500">Loading packages…</div>}
            {!isLoading && Object.keys(packages).length === 0 && <div className="text-sm text-slate-500">No packages configured.</div>}

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-[repeat(4,minmax(300px,1fr))]">
              {orderedKeys.map((k) => {
                const pkg = packages[k];
                if (!pkg) return null;
                const badge =
                  k === 'pro'
                    ? { text: 'Most Popular', variant: 'info' as const }
                    : k === 'ultra'
                      ? { text: 'Best Value', variant: 'success' as const }
                      : undefined;

                return (
                  <PricingCard
                    key={k}
                    planKey={k}
                    pkg={pkg}
                    services={services}
                    baselineKey={baselineKey}
                    baselinePkg={baselinePkg}
                    badge={badge}
                    featured={featuredKey === k}
                    onBuyCredits={(packageKey) => setPurchase({ open: true, packageKey })}
                  />
                );
              })}
            </div>

            <div className="mt-6 flex justify-center sm:justify-end">
              <Link to="/pricing/details" className="text-sm font-semibold text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline">
                Pricing details
              </Link>
            </div>
          </div>
        </div>
      </div>

      <PingPongTxIdModal
        open={purchase.open}
        packageKey={purchase.packageKey}
        packageInfo={purchase.packageKey ? (packages[purchase.packageKey] ?? null) : null}
        onClose={() => setPurchase({ open: false, packageKey: null })}
      />
    </DashboardLayout>
  );
};

