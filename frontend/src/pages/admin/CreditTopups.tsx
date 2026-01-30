import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminLayout } from '../../components/AdminLayout';
import { ConfirmModal } from '../../components/ConfirmModal';
import { RejectModal } from '../../components/RejectModal';
import { fetchAdminCreditTopups, approveCreditTopup, rejectCreditTopup, AdminCreditTopup, CreditTopupStatus } from '../../api/admin';
import { fetchTopupBillBlob } from '../../api/creditTopups';

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
  const [billModal, setBillModal] = useState<{ open: boolean; url?: string; title?: string }>({ open: false });
  const [billLoading, setBillLoading] = useState(false);
  const [billError, setBillError] = useState<string | null>(null);

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ['admin', 'credit-topups', status],
    queryFn: () => fetchAdminCreditTopups(status),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveCreditTopup(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'credit-topups'], exact: false });
      await queryClient.invalidateQueries({ queryKey: ['balance'], exact: false });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (params: { id: string; adminNote: string }) => rejectCreditTopup(params.id, params.adminNote),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'credit-topups'], exact: false });
    },
  });

  const rows = useMemo(() => data ?? [], [data]);

  const openBill = async (topup: AdminCreditTopup) => {
    setBillError(null);
    setBillLoading(true);
    try {
      const blob = await fetchTopupBillBlob(topup.billImageUrl);
      const url = URL.createObjectURL(blob);
      setBillModal({ open: true, url, title: `Bill • ${topup.user?.email ?? topup.user.id}` });
    } catch (err: any) {
      setBillError(err?.message || 'Could not load bill image');
    } finally {
      setBillLoading(false);
    }
  };

  const closeBill = () => {
    if (billModal.url) URL.revokeObjectURL(billModal.url);
    setBillModal({ open: false });
  };

  return (
    <AdminLayout title="Top-up Requests">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-slate-600">Manual PingPong top-ups (no auto credit). Approve will add credits immediately.</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</label>
            <select
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value as CreditTopupStatus)}
            >
              <option value="pending">pending</option>
              <option value="approved">approved</option>
              <option value="rejected">rejected</option>
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
                  <th className="py-3 pr-4">Amount</th>
                  <th className="py-3 pr-4">Method</th>
                  <th className="py-3 pr-4">Transfer note</th>
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
                    <td className="py-3 pr-4 font-semibold">${Number(t.amount).toFixed(2)}</td>
                    <td className="py-3 pr-4">{t.paymentMethod}</td>
                    <td className="py-3 pr-4 font-mono text-xs">{t.transferNote}</td>
                    <td className="py-3 pr-4"><StatusBadge status={t.status} /></td>
                    <td className="py-3 pr-4">{formatTime(t.createdAt)}</td>
                    <td className="py-3 pr-4">{formatTime(t.reviewedAt)}</td>
                    <td className="py-3 pr-4 text-slate-700">{t.adminNote ?? '—'}</td>
                    <td className="py-3 pr-0">
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="rounded-lg border border-slate-200 px-3 py-1 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60"
                          onClick={() => void openBill(t)}
                          disabled={billLoading}
                        >
                          View bill
                        </button>
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
                    <td colSpan={9} className="py-6 text-center text-sm text-slate-600">
                      No requests.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {billError && <p className="mt-3 text-sm text-rose-700">{billError}</p>}
        {isFetching && !isLoading && <p className="mt-3 text-xs text-slate-500">Refreshing…</p>}
      </div>

      <ConfirmModal
        open={confirm.open}
        title="Approve top-up?"
        description="Credits will be added immediately after approval. This cannot be undone."
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

      {billModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-4 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-ink">{billModal.title ?? 'Bill'}</h3>
              <button className="rounded-lg border border-slate-200 px-3 py-1 text-sm font-semibold" onClick={closeBill}>
                Close
              </button>
            </div>
            <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
              {billModal.url ? (
                <img src={billModal.url} alt="bill" className="mx-auto max-h-[70vh] w-auto rounded-lg" />
              ) : (
                <p className="text-sm text-slate-600">No image.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};
