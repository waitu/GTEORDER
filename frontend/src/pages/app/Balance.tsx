import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '../../components/DashboardLayout';
import { fetchBalance } from '../../api/dashboard';
import { fetchMyCreditHistory, UserCreditHistoryItem } from '../../api/creditTopups';

const pad2 = (n: number) => String(n).padStart(2, '0');

const formatTime = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
};

const displayStatus = (status: string) => {
  const s = String(status || '').toLowerCase();
  if (s === 'approved' || s === 'confirmed') return 'Confirmed';
  if (s === 'rejected') return 'Rejected';
  return 'Pending';
};

const statusClass = (status: string) => {
  const s = String(status || '').toLowerCase();
  if (s === 'approved' || s === 'confirmed') return 'bg-emerald-100 text-emerald-800';
  if (s === 'rejected') return 'bg-rose-100 text-rose-800';
  return 'bg-slate-200 text-slate-700';
};

export const BalancePage = () => {
  const { data, isLoading, isError } = useQuery({ queryKey: ['balance'], queryFn: fetchBalance });
  const balanceValue = data?.balance;

  const historyQuery = useQuery({
    queryKey: ['credits', 'history'],
    queryFn: fetchMyCreditHistory,
    refetchOnWindowFocus: false,
  });

  const rows = useMemo(() => {
    const items = (historyQuery.data ?? []) as UserCreditHistoryItem[];
    return [...items].sort((a, b) => {
      const ta = new Date(a.createdAt || 0).getTime();
      const tb = new Date(b.createdAt || 0).getTime();
      return tb - ta;
    });
  }, [historyQuery.data]);

  return (
    <DashboardLayout title="Credit">
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 shadow-xl shadow-slate-300/30 text-white">
          {isLoading && <p className="text-sm text-slate-200">Loading credit balance…</p>}
          {isError && <p className="text-sm text-rose-200">Could not load credit balance.</p>}
          {!isLoading && !isError && (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-200">Credit balance</p>
              <p className="text-5xl font-bold">{balanceValue != null ? `${Number(balanceValue).toLocaleString(undefined, { maximumFractionDigits: 2 })} cr` : '—'}</p>
              <p className="text-sm text-slate-200">Credits will be added after admin confirmation (usually within 1–24h).</p>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-ink">Credit history</h3>
            {historyQuery.isFetching && <span className="text-xs text-slate-500">Refreshing…</span>}
          </div>

          {historyQuery.isLoading && <p className="mt-3 text-sm text-slate-600">Loading…</p>}
          {historyQuery.isError && <p className="mt-3 text-sm text-rose-700">Could not load credit history.</p>}

          {!historyQuery.isLoading && !historyQuery.isError && (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3 pr-4">PingPong TXID</th>
                    <th className="py-3 pr-4">Paid (USD)</th>
                    <th className="py-3 pr-4">Credits</th>
                    <th className="py-3 pr-4">Created at</th>
                    <th className="py-3 pr-4">Confirmed at</th>
                    <th className="py-3 pr-0">Admin note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((t) => (
                    <tr key={t.id}>
                      <td className="py-3 pr-4">
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClass(t.status)}`}>{displayStatus(t.status)}</span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="block max-w-[260px] truncate font-mono text-xs" title={t.pingpongTxId ?? ''}>
                          {t.pingpongTxId ?? '—'}
                        </span>
                      </td>
                      <td className="py-3 pr-4 font-semibold">{t.amountUsd != null ? `$${Number(t.amountUsd).toFixed(2)}` : '—'}</td>
                      {(() => {
                        const status = String(t.status || '').toLowerCase();
                        const isConfirmed = status === 'approved' || status === 'confirmed';
                        const isPending = status === 'pending';
                        const creditsText = t.credits != null ? Number(t.credits).toLocaleString() : '—';

                        if (isConfirmed) {
                          return <td className="py-3 pr-4 font-semibold">{creditsText}</td>;
                        }

                        if (isPending && t.credits != null) {
                          return (
                            <td
                              className="py-3 pr-4 text-slate-600"
                              title="Expected credits for this package. Credits will be added after admin confirmation."
                            >
                              {creditsText}
                            </td>
                          );
                        }

                        return <td className="py-3 pr-4">—</td>;
                      })()}
                      <td className="py-3 pr-4">{formatTime(t.createdAt)}</td>
                      <td className="py-3 pr-4">{formatTime(t.confirmedAt)}</td>
                      <td className="py-3 pr-0 text-slate-700">{t.adminNote ? t.adminNote : '—'}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-sm text-slate-600">No credit history yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};
