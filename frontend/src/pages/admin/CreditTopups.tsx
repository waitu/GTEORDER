import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminLayout } from '../../components/AdminLayout';
import { ConfirmModal } from '../../components/ConfirmModal';
import { RejectModal } from '../../components/RejectModal';
import { AlertModal } from '../../components/AlertModal';
import { fetchAdminCreditTopups, approveCreditTopup, rejectCreditTopup, AdminCreditTopup, CreditTopupStatus } from '../../api/admin';

const formatTime = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const StatusBadge = ({ status }: { status: CreditTopupStatus }) => {
  const cls =
    status === 'approved'
      ? 'bg-emerald-100 text-emerald-800'
      : status === 'rejected'
        ? 'bg-rose-100 text-rose-800'
        : 'bg-amber-100 text-amber-800';
  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${cls}`}>{status}</span>;
};

export const AdminCreditTopupsPage = () => {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<CreditTopupStatus>('pending');
  const [confirm, setConfirm] = useState<{ open: boolean; topup?: AdminCreditTopup }>({ open: false });
  const [reject, setReject] = useState<{ open: boolean; topup?: AdminCreditTopup }>({ open: false });
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [alert, setAlert] = useState<{ open: boolean; title: string; message: string } | null>(null);

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ['admin', 'credit-topups', status, q, page, limit],
    queryFn: () => fetchAdminCreditTopups({ status, q, page, limit }),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveCreditTopup(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'credit-topups'], exact: false });
      await queryClient.invalidateQueries({ queryKey: ['balance'], exact: false });
      setAlert({ open: true, title: 'Approved', message: 'Top-up approved and credits were added.' });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Approve failed';
      setAlert({ open: true, title: 'Approve failed', message: Array.isArray(msg) ? msg.join(', ') : String(msg) });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (params: { id: string; adminNote: string }) => rejectCreditTopup(params.id, params.adminNote),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'credit-topups'], exact: false });
      setAlert({ open: true, title: 'Rejected', message: 'Top-up request was rejected.' });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Reject failed';
      setAlert({ open: true, title: 'Reject failed', message: Array.isArray(msg) ? msg.join(', ') : String(msg) });
    },
  });

  const rows = useMemo(() => data?.data ?? [], [data]);
  const meta = data?.meta;
  const totalPages = Math.max(1, Math.ceil((meta?.total ?? 0) / (meta?.limit ?? limit)));

  const formatUsd = (n?: number | null) => {
    if (n == null) return '—';
    return `$${Number(n).toFixed(2)}`;
  };

  const formatCredits = (n?: number | null) => {
    if (n == null) return '—';
    return `${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })} cr`;
  };

  return (
    <AdminLayout title="Top-up Requests">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-slate-600">PingPong top-ups (TXID-based). Approve will add credits immediately.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="w-72 max-w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Search email / TXID / transfer note"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</label>
            <select
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as CreditTopupStatus);
                setPage(1);
              }}
            >
              <option value="pending">pending</option>
              <option value="approved">approved</option>
              <option value="rejected">rejected</option>
            </select>

            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Page size</label>
            <select
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {isLoading && <p className="mt-4 text-sm text-slate-600">Loading…</p>}
        {isError && <p className="mt-4 text-sm text-rose-700">Could not load top-up requests.</p>}

        {!isLoading && !isError && (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-3 pr-4">User</th>
                  <th className="py-3 pr-4">Paid (USD)</th>
                  <th className="py-3 pr-4">Credits</th>
                  <th className="py-3 pr-4">Package</th>
                  <th className="py-3 pr-4">Method</th>
                  <th className="py-3 pr-4">TXID</th>
                  <th className="py-3 pr-4">User note</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3 pr-4">Created</th>
                  <th className="py-3 pr-4">Reviewed</th>
                  <th className="py-3 pr-4">Admin note</th>
                  <th className="py-3 pr-0">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((t) => (
                  <tr key={t.id} className="align-top">
                    <td className="py-3 pr-4">
                      <div className="font-semibold text-ink">{t.user?.email ?? '—'}</div>
                      <div className="text-xs text-slate-500">{t.user?.id}</div>
                    </td>
                    <td className="py-3 pr-4 font-semibold">{formatUsd(t.amountUsd ?? t.amount)}</td>
                    <td className="py-3 pr-4 font-semibold">{formatCredits(t.credits ?? t.creditAmount)}</td>
                    <td className="py-3 pr-4">{t.packageKey ?? '—'}</td>
                    <td className="py-3 pr-4">{t.paymentMethod}</td>
                    <td className="py-3 pr-4">
                      <span
                        className="block max-w-[220px] truncate font-mono text-xs"
                        title={t.pingpongTxId ?? t.transferNote ?? ''}
                      >
                        {t.pingpongTxId ?? t.transferNote ?? '—'}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-slate-700">{t.note ?? '—'}</td>
                    <td className="py-3 pr-4"><StatusBadge status={t.status} /></td>
                    <td className="py-3 pr-4">{formatTime(t.createdAt)}</td>
                    <td className="py-3 pr-4">{formatTime(t.reviewedAt)}</td>
                    <td className="py-3 pr-4 text-slate-700">{t.adminNote ?? '—'}</td>
                    <td className="py-3 pr-0">
                      <div className="flex flex-wrap gap-2">
                        {t.status === 'pending' && (
                          <>
                            <button
                              className="rounded-lg bg-emerald-600 px-3 py-1 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                              onClick={() => setConfirm({ open: true, topup: t })}
                              disabled={approveMutation.isPending || rejectMutation.isPending}
                            >
                              Approve
                            </button>
                            <button
                              className="rounded-lg bg-rose-600 px-3 py-1 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                              onClick={() => setReject({ open: true, topup: t })}
                              disabled={approveMutation.isPending || rejectMutation.isPending}
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={12} className="py-6 text-center text-sm text-slate-600">
                      No requests.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
              <div className="text-slate-600">
                Total: <span className="font-semibold text-ink">{meta?.total ?? 0}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-lg border border-slate-200 px-3 py-1 font-semibold text-slate-700 disabled:opacity-60"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  Prev
                </button>
                <div className="text-slate-700">
                  Page <span className="font-semibold">{page}</span> / <span className="font-semibold">{totalPages}</span>
                </div>
                <button
                  className="rounded-lg border border-slate-200 px-3 py-1 font-semibold text-slate-700 disabled:opacity-60"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}

        {isFetching && !isLoading && <p className="mt-3 text-xs text-slate-500">Refreshing…</p>}
      </div>

      <ConfirmModal
        open={confirm.open}
        title="Approve top-up?"
        description={
          confirm.topup
            ? `User: ${confirm.topup.user?.email ?? '—'}\nPaid: ${formatUsd(confirm.topup.amountUsd ?? confirm.topup.amount)}\nCredits: ${formatCredits(confirm.topup.credits ?? confirm.topup.creditAmount)}\nTXID: ${confirm.topup.pingpongTxId ?? confirm.topup.transferNote ?? '—'}\n\nCredits will be added immediately after approval. This cannot be undone.`
            : 'Credits will be added immediately after approval. This cannot be undone.'
        }
        confirmLabel={approveMutation.isPending ? 'Approving…' : 'Approve'}
        onCancel={() => setConfirm({ open: false })}
        onConfirm={() => {
          const id = confirm.topup?.id;
          if (!id) return;
          approveMutation.mutate(id, {
            onSuccess: () => setConfirm({ open: false }),
          });
        }}
        confirmDisabled={approveMutation.isPending || !confirm.topup?.id}
      />

      <RejectModal
        open={reject.open}
        title="Reject top-up"
        onCancel={() => setReject({ open: false })}
        onSubmit={(reason) => {
          const id = reject.topup?.id;
          if (!id) return;
          rejectMutation.mutate(
            { id, adminNote: reason },
            {
              onSuccess: () => setReject({ open: false }),
            },
          );
        }}
      />

      <AlertModal
        open={!!alert?.open}
        title={alert?.title ?? 'Notice'}
        description={alert?.message ?? ''}
        onClose={() => setAlert(null)}
      />
    </AdminLayout>
  );
};
