import { DashboardLayout } from '../../components/DashboardLayout';
import { useQuery } from '@tanstack/react-query';
import { fetchPricing } from '../../api/pricing';

export const PricingDetailsPage = () => {
  const { data, isLoading } = useQuery({ queryKey: ['pricing'], queryFn: fetchPricing });
  const services = data?.serviceCreditCost ?? {};
  const packages = data?.topupPackages ?? {};

  return (
    <DashboardLayout title="Pricing Details">
      <div className="space-y-6">
        <section className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Service credit costs</h2>
          <p className="text-sm text-slate-600">Server-driven list of credit costs consumed by each service.</p>
          <div className="mt-4">
            {isLoading && <div className="text-sm text-slate-500">Loading…</div>}
            {!isLoading && Object.keys(services).length === 0 && <div className="text-sm text-slate-500">No service pricing configured.</div>}
            {!isLoading && Object.entries(services).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between border-b py-3">
                <div className="text-sm text-slate-700">{k}</div>
                <div className="text-sm font-semibold">{v.toFixed ? v.toFixed(2) : String(v)}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Top-up packages</h2>
          <p className="text-sm text-slate-600">Available credit packages with pricing and discounts.</p>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            {!isLoading && Object.keys(packages).length === 0 && <div className="text-sm text-slate-500">No top-up packages configured.</div>}
            {!isLoading && Object.entries(packages).map(([k, p]) => (
              <div key={k} className="rounded-lg border p-4 bg-white">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-slate-700">{k}</div>
                  <div className="text-sm font-semibold">${p.price.toFixed(2)}</div>
                </div>
                <div className="mt-2 text-2xl font-semibold">{p.credits} credits</div>
                <div className="mt-1 text-sm text-slate-600">Discount: {(p.discount * 100).toFixed(0)}%</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
};
