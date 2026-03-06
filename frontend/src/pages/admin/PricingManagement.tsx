import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AdminLayout } from '../../components/AdminLayout';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { fetchPricing } from '../../api/pricing';

const formatPrice = (value?: number) => {
  if (value == null || Number.isNaN(value)) return '—';
  return `$${Number(value).toFixed(2)}`;
};

export const PricingManagementPage = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['pricing'],
    queryFn: fetchPricing,
  });

  const serviceRows = useMemo(
    () =>
      Object.entries(data?.serviceCreditCost ?? {}).map(([key, value]) => ({
        key,
        credits: Number(value),
      })),
    [data],
  );

  const packageRows = useMemo(
    () =>
      Object.entries(data?.topupPackages ?? {}).map(([key, pkg]) => ({
        key,
        ...pkg,
      })),
    [data],
  );

  return (
    <AdminLayout title="Pricing Management">
      <Card title="Service Pricing" description="Live data from `/pricing` (service credit cost).">
        {isLoading && <p className="text-sm text-slate-600">Loading pricing…</p>}
        {isError && <p className="text-sm text-rose-700">Could not load pricing data.</p>}
        {!isLoading && !isError && serviceRows.length === 0 && <p className="text-sm text-slate-600">No service pricing configured.</p>}
        {!isLoading && !isError && serviceRows.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {serviceRows.map((row) => (
              <Card key={row.key} className="bg-slate-50" title={row.key} description="Credits per order">
                <p className="text-2xl font-bold text-slate-900">{row.credits.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                <div className="mt-3">
                  <Badge variant="neutral">Live</Badge>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>

      <Card title="Top-up Packages" description="Live data from `/pricing` (topup packages)." className="mt-4">
        {!isLoading && !isError && packageRows.length === 0 && <p className="text-sm text-slate-600">No top-up packages configured.</p>}
        {!isLoading && !isError && packageRows.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {packageRows.map((row) => (
              <Card key={row.key} className="bg-slate-50" title={row.key} description={`${row.credits} credits`}>
                <p className="text-2xl font-bold text-slate-900">{formatPrice(row.price)}</p>
                <div className="mt-3">
                  <Badge variant={row.discount > 0 ? 'success' : 'neutral'}>
                    {row.discount > 0 ? `Discount ${row.discount}%` : 'No discount'}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>
    </AdminLayout>
  );
};
