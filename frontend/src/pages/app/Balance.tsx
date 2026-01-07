import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '../../components/DashboardLayout';
import { fetchBalance } from '../../api/dashboard';

export const BalancePage = () => {
  const { data, isLoading, isError } = useQuery({ queryKey: ['balance'], queryFn: fetchBalance });
  const balanceValue = data?.balance;

  return (
    <DashboardLayout title="Credit">
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 shadow-xl shadow-slate-300/30 text-white">
          {isLoading && <p className="text-sm text-slate-200">Loading credit balance…</p>}
          {isError && <p className="text-sm text-rose-200">Could not load credit balance.</p>}
          {!isLoading && !isError && (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-200">Credit balance</p>
              <p className="text-5xl font-bold">{balanceValue != null ? balanceValue.toLocaleString(undefined, { style: 'currency', currency: 'USD' }) : '—'}</p>
              <p className="text-sm text-slate-200">Your credits are available for label purchases. Payments coming soon.</p>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-ink">Transactions</h3>
          <p className="mt-2 text-sm text-slate-600">History will appear here once payments are connected.</p>
        </div>
      </div>
    </DashboardLayout>
  );
};
