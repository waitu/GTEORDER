import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminLayout } from '../../components/AdminLayout';
import { Table } from '../../components/Table';
import {
  AdminUser,
  fetchAdminUsers,
  fetchAdminUser,
  fetchUserCreditHistory,
  adjustAdminUserCredit,
  updateUserRole,
  updateUserStatus,
} from '../../api/admin';

export const AdminUsersPage = () => {
  const queryClient = useQueryClient();
  const { data: users, isLoading, isError } = useQuery({ queryKey: ['admin', 'users'], queryFn: fetchAdminUsers });
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminUser | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustDirection, setAdjustDirection] = useState<'credit' | 'debit'>('credit');
  const [adjustAmount, setAdjustAmount] = useState<number>(0.0);
  const [adjustReason, setAdjustReason] = useState<string>('admin_adjust');
  const [adjustNote, setAdjustNote] = useState<string>('');

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'pending' | 'active' | 'disabled' }) => updateUserStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: 'user' | 'admin' }) => updateUserRole(id, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });

  const loadDetail = async (userId: string) => {
    setSelectedUserId(userId);
    const res = await fetchAdminUser(userId);
    setDetail(res);
  };

  const openAdjustModal = (dir: 'credit' | 'debit') => {
    setAdjustDirection(dir);
    setAdjustAmount(0.0);
    setAdjustReason('admin_adjust');
    setAdjustNote('');
    setAdjustModalOpen(true);
  };

  const loadDetailWithHistory = async (userId: string) => {
    setSelectedUserId(userId);
    const res = await fetchAdminUser(userId);
    setDetail(res);
    try {
      const hist = await fetchUserCreditHistory(userId);
      setHistory(hist);
    } catch (err) {
      setHistory([]);
    }
  };

  const filtered = useMemo(() => users ?? [], [users]);

  return (
    <AdminLayout title="User Management">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        {isLoading && <p className="text-sm text-slate-600">Loading users…</p>}
        {isError && <p className="text-sm text-red-700">Could not load users.</p>}
        {!isLoading && !isError && (
          <Table
            columns={[
              { key: 'email', header: 'Email' },
              { key: 'role', header: 'Role', render: (row: AdminUser) => <span className="capitalize">{row.role ?? 'user'}</span> },
              { key: 'status', header: 'Status', render: (row: AdminUser) => <span className="capitalize">{row.status ?? '—'}</span> },
              { key: 'createdAt', header: 'Created At' },
              {
                key: 'actions',
                header: 'Actions',
                render: (row: AdminUser) => (
                  <div className="flex flex-wrap gap-2 text-sm">
                    <button
                      className="rounded-lg border border-slate-200 px-3 py-1 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      onClick={(e) => {
                        e.stopPropagation();
                        statusMutation.mutate({ id: row.id, status: 'active' });
                      }}
                      disabled={statusMutation.isPending}
                    >
                      Activate
                    </button>
                    <button
                      className="rounded-lg border border-slate-200 px-3 py-1 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      onClick={(e) => {
                        e.stopPropagation();
                        statusMutation.mutate({ id: row.id, status: 'disabled' });
                      }}
                      disabled={statusMutation.isPending}
                    >
                      Disable
                    </button>
                    <select
                      className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
                      value={row.role ?? 'user'}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => roleMutation.mutate({ id: row.id, role: e.target.value as 'user' | 'admin' })}
                      disabled={roleMutation.isPending}
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                ),
              },
            ]}
            data={filtered}
            emptyMessage="No users"
            onRowClick={(row: AdminUser) => loadDetailWithHistory(row.id)}
          />
        )}
      </div>

      {selectedUserId && detail && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/50 px-4" onClick={() => setSelectedUserId(null)}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-ink">User Detail</h3>
              <button className="text-sm text-slate-500 hover:text-ink" onClick={() => setSelectedUserId(null)}>
                Close
              </button>
            </div>
            <div className="mt-4 space-y-2 text-sm text-slate-700">
              <div className="flex justify-between"><span className="font-semibold">Email</span><span>{detail.email}</span></div>
              <div className="flex justify-between"><span className="font-semibold">Credit Balance</span><span className="font-mono">${(detail.creditBalance ?? 0).toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="font-semibold">Role</span><span className="capitalize">{detail.role}</span></div>
              <div className="flex justify-between"><span className="font-semibold">Status</span><span className="capitalize">{detail.status}</span></div>
              <div className="flex justify-between"><span className="font-semibold">Created</span><span>{detail.createdAt}</span></div>
              <div className="mt-3 flex gap-2">
                <button
                  className="rounded-lg bg-emerald-600 px-3 py-1 text-white text-sm font-semibold"
                  onClick={() => openAdjustModal('credit')}
                >
                  Add Credit
                </button>
                <button
                  className="rounded-lg bg-rose-600 px-3 py-1 text-white text-sm font-semibold"
                  onClick={() => openAdjustModal('debit')}
                >
                  Deduct Credit
                </button>
              </div>
              {detail.lastLoginAt && (
                <div className="flex justify-between"><span className="font-semibold">Last login</span><span>{detail.lastLoginAt}</span></div>
              )}
              <div className="mt-4">
                <h4 className="text-sm font-semibold">Recent credit history</h4>
                {history.length === 0 ? (
                  <p className="text-sm text-slate-500 mt-2">No recent transactions</p>
                ) : (
                  <div className="mt-2 text-sm text-slate-700 space-y-2 max-h-48 overflow-auto">
                    {history.map((tx) => (
                      <div key={tx.id} className="flex justify-between border-b border-slate-100 py-2">
                        <div>
                          <div className="text-sm font-medium">{tx.reason ?? tx.direction}</div>
                          <div className="text-xs text-slate-500">{new Date(tx.createdAt).toLocaleString()}</div>
                        </div>
                        <div className={`font-mono ${tx.direction === 'debit' ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {tx.direction === 'debit' ? '-' : '+'}${Math.abs(tx.amount).toFixed(2)}
                          <div className="text-xs text-slate-500">Bal: ${tx.balanceAfter.toFixed(2)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Adjust modal */}
      {adjustModalOpen && detail && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold">{adjustDirection === 'credit' ? 'Add Credit' : 'Deduct Credit'}</h3>
            <div className="mt-4 space-y-3">
              <label className="block text-sm">Amount</label>
              <input type="number" step="0.01" min="0.01" value={adjustAmount} onChange={(e) => setAdjustAmount(Number(e.target.value))} className="w-full rounded-lg border px-3 py-2" />
              <label className="block text-sm">Reason</label>
              <select className="w-full rounded-lg border px-3 py-2" value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)}>
                <option value="admin_adjust">Admin adjustment</option>
                <option value="promo">Promotional credit</option>
                <option value="refund">Refund</option>
                <option value="correction">Correction</option>
              </select>
              <label className="block text-sm">Note (optional)</label>
              <textarea className="w-full rounded-lg border px-3 py-2" value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} />
              <div className="flex justify-end gap-3">
                <button className="rounded-lg border px-4 py-2" onClick={() => setAdjustModalOpen(false)}>Cancel</button>
                <button
                  className="rounded-lg bg-ink px-4 py-2 text-white"
                  onClick={async () => {
                    try {
                      await adjustAdminUserCredit(detail.id, { amount: adjustAmount, direction: adjustDirection, reason: adjustReason, note: adjustNote });
                      // refresh
                      const refreshed = await fetchAdminUser(detail.id);
                      setDetail(refreshed);
                      const hist = await fetchUserCreditHistory(detail.id);
                      setHistory(hist);
                      setAdjustModalOpen(false);
                      // simple toast
                      alert('Credit balance updated');
                    } catch (err: any) {
                      alert(err?.message ?? 'Adjustment failed');
                    }
                  }}
                >
                  Submit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};
