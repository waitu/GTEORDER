import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../components/DashboardLayout';
import { Table } from '../../components/Table';
import { fetchActivity, fetchSummary } from '../../api/dashboard';

export const DashboardPage = () => {
  const navigate = useNavigate();
  const { data: summary, isLoading: summaryLoading, isError: summaryError } = useQuery({
    queryKey: ['summary'],
    queryFn: fetchSummary,
  });

  const { data: activity, isLoading: activityLoading, isError: activityError } = useQuery({
    queryKey: ['dashboard', 'activity'],
    queryFn: fetchActivity,
  });

  return (
    <DashboardLayout title="Dashboard">
      <div className="grid gap-4 sm:grid-cols-3">
        {summaryLoading && <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm text-sm text-slate-600">Loading summary…</div>}
        {summaryError && <div className="rounded-xl border border-red-100 bg-red-50 p-5 text-sm text-red-700">Could not load summary.</div>}
        {!summaryLoading && !summaryError && (
          <>
            <button
              type="button"
              className="rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm hover:border-slate-300"
              onClick={() => navigate('/orders?orderType=active_tracking')}
            >
              <p className="text-sm font-semibold text-slate-600">Active Trackings</p>
              <p className="mt-2 text-2xl font-bold text-ink">{summary?.activeTrackings ?? '—'}</p>
            </button>
            <button
              type="button"
              className="rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm hover:border-slate-300"
              onClick={() => navigate('/orders?orderType=empty_package')}
            >
              <p className="text-sm font-semibold text-slate-600">Empty Package</p>
              <p className="mt-2 text-2xl font-bold text-ink">{summary?.emptyOrders ?? '—'}</p>
            </button>
            <button
              type="button"
              className="rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm hover:border-slate-300"
              onClick={() => navigate('/balance')}
            >
              <p className="text-sm font-semibold text-slate-600">Credit Balance</p>
              <p className="mt-2 text-2xl font-bold text-ink">{summary?.balance != null ? `${Number(summary.balance).toLocaleString(undefined, { maximumFractionDigits: 2 })} cr` : '—'}</p>
            </button>
          </>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">Recent activity</h2>
        </div>
        {activityLoading && <p className="text-sm text-slate-600">Loading activity…</p>}
        {activityError && <p className="text-sm text-red-700">Could not load activity.</p>}
        {!activityLoading && !activityError && (
          <Table
            columns={[
              {
                key: 'orderType',
                header: 'Type',
                render: (row: any) => (row.orderType ? String(row.orderType).replaceAll('_', ' ') : '—'),
              },
              { key: 'ref', header: 'Reference' },
              { key: 'status', header: 'Status', render: (row: any) => row.status ?? '—' },
              { key: 'amount', header: 'Credits', render: (row: any) => (row.amount != null ? `${Number(row.amount).toLocaleString(undefined, { maximumFractionDigits: 2 })} cr` : '—') },
              { key: 'updatedAt', header: 'Updated', render: (row: any) => (row.updatedAt ? new Date(row.updatedAt).toLocaleString() : '—') },
            ]}
            data={(activity ?? []).slice(0, 10)}
            emptyMessage="No recent activity"
          />
        )}
      </div>
    </DashboardLayout>
  );
};
