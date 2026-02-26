import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '../../components/AdminLayout';
import {
  fetchAdminOverview,
  approveRegistrationRequest,
  rejectRegistrationRequest,
  AdminOverview,
  runByeastsideSync,
  ByeastsideSyncResult,
} from '../../api/admin';

const formatRelativeTime = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.max(0, Math.floor(diffMs / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
};

const actionLabels: Record<string, string> = {
  login_success: 'User logged in',
  login_fail: 'User login failed',
  user_created: 'User created',
  user_status_change: 'User status changed',
  request_approved: 'Registration approved',
  request_rejected: 'Registration rejected',
  order_updated: 'Order updated',
};

export const AdminDashboardPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({ queryKey: ['admin', 'overview'], queryFn: fetchAdminOverview });
  const [syncResult, setSyncResult] = useState<ByeastsideSyncResult | null>(null);

  const counts = data?.counts;

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveRegistrationRequest(id),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<AdminOverview | undefined>(['admin', 'overview'], (current) => {
        if (!current) return current;
        return {
          ...current,
          counts: {
            ...current.counts,
            registrationPending: Math.max(0, (current.counts.registrationPending ?? 0) - 1),
          },
          recentRequests: current.recentRequests.filter((req) => req.id !== id),
        };
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectRegistrationRequest(id, reason),
    onSuccess: (_data, variables) => {
      queryClient.setQueryData<AdminOverview | undefined>(['admin', 'overview'], (current) => {
        if (!current) return current;
        return {
          ...current,
          counts: {
            ...current.counts,
            registrationPending: Math.max(0, (current.counts.registrationPending ?? 0) - 1),
          },
          recentRequests: current.recentRequests.filter((req) => req.id !== variables.id),
        };
      });
    },
  });

  const syncMutation = useMutation({
    mutationFn: (limit: number) => runByeastsideSync({ limit }),
    onSuccess: (data) => {
      setSyncResult(data);
    },
  });

  const recentUsers = data?.recentUsers ?? [];
  const recentRequests = (data?.recentRequests ?? [])
    .map((r) => ({
      ...r,
      status: (r as any).status ?? (r as any).state ?? 'pending',
    }))
    .filter((r) => r.status === 'pending');
  const recentAudits = data?.recentAdminAudits ?? [];

  const totalUsers = counts?.totalUsers ?? 0;
  const activeUsers = counts?.activeUsers ?? 0;
  const pendingUsers = counts?.pendingUsers ?? 0;
  const disabledUsers = Math.max(0, totalUsers - activeUsers - pendingUsers);

  const loginSuccess = counts?.loginSuccess24h ?? 0;
  const loginFail = counts?.loginFail24h ?? 0;
  const loginTotal = loginSuccess + loginFail;
  const loginSuccessPercent = loginTotal > 0 ? Math.round((loginSuccess / loginTotal) * 100) : 0;

  const userSegments = [
    { label: 'Active', value: activeUsers, color: 'bg-emerald-500' },
    { label: 'Pending', value: pendingUsers, color: 'bg-amber-500' },
    { label: 'Disabled', value: disabledUsers, color: 'bg-rose-500' },
  ];
  const userSegmentMax = Math.max(...userSegments.map((item) => item.value), 1);

  const pendingRequestsButton = () => navigate('/admin/requests');
  const pendingUsersButton = () => navigate('/admin/users');

  const statCards = [
    { label: 'Total users', value: counts?.totalUsers, hint: 'All accounts', onClick: () => navigate('/admin/users') },
    { label: 'Active users', value: counts?.activeUsers, hint: 'Operational accounts', onClick: () => navigate('/admin/users?status=active') },
    { label: 'Pending users', value: counts?.pendingUsers, hint: 'Need review', onClick: pendingUsersButton },
    { label: 'Pending requests', value: counts?.registrationPending, hint: 'Awaiting approval', onClick: pendingRequestsButton },
    { label: 'Login success (24h)', value: counts?.loginSuccess24h, hint: 'Healthy traffic', onClick: () => navigate('/admin/audits') },
    { label: 'Login failures (24h)', value: counts?.loginFail24h, hint: 'Investigate quickly', onClick: () => navigate('/admin/audits') },
  ];

  const renderStatCard = (card: { label: string; value?: number; hint: string; onClick: () => void }) => (
    <button
      key={card.label}
      type="button"
      onClick={card.onClick}
      className="rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.label}</p>
      <p className="mt-2 text-3xl font-bold text-ink">{card.value ?? 0}</p>
      <p className="mt-2 text-xs text-slate-500">{card.hint}</p>
    </button>
  );

  return (
    <AdminLayout title="Admin Dashboard">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 to-slate-700 p-6 text-white shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-200">Operations Overview</p>
            <h2 className="mt-2 text-2xl font-bold">Admin Control Center</h2>
            <p className="mt-1 text-sm text-slate-200">Focus on approvals, account health, and critical sync operations.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
              onClick={pendingRequestsButton}
            >
              Review requests
            </button>
            <button
              type="button"
              className="rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/20"
              onClick={() => navigate('/admin/orders?paymentStatus=unpaid')}
            >
              Unpaid orders
            </button>
            <button
              type="button"
              className="rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/20"
              onClick={() => navigate('/admin/byeastside')}
            >
              Sync center
            </button>
          </div>
        </div>
      </div>

      {isLoading && <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Loading overview…</div>}
      {isError && <div className="rounded-xl border border-red-100 bg-red-50 p-5 text-sm text-red-700">Could not load overview.</div>}

      {!isLoading && !isError && counts && (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {statCards.map(renderStatCard)}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-semibold text-ink">User Composition</h3>
                <span className="text-xs text-slate-500">Current snapshot</span>
              </div>
              <div className="space-y-3">
                {userSegments.map((segment) => (
                  <div key={segment.label}>
                    <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-600">
                      <span>{segment.label}</span>
                      <span>{segment.value}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div
                        className={`h-2 rounded-full ${segment.color}`}
                        style={{ width: `${Math.max(8, Math.round((segment.value / userSegmentMax) * 100))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-semibold text-ink">Login Health (24h)</h3>
                <button className="text-xs font-semibold text-sky-700 hover:text-sky-900" onClick={() => navigate('/admin/audits')}>
                  Open audit logs
                </button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg bg-slate-50 p-4 text-center">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Success rate</p>
                  <p className="mt-2 text-3xl font-bold text-emerald-600">{loginSuccessPercent}%</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
                  <div className="flex justify-between"><span>Success</span><span className="font-semibold">{loginSuccess}</span></div>
                  <div className="mt-2 flex justify-between"><span>Failure</span><span className="font-semibold text-rose-600">{loginFail}</span></div>
                  <div className="mt-2 flex justify-between"><span>Total</span><span className="font-semibold">{loginTotal}</span></div>
                </div>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-2 bg-emerald-500" style={{ width: `${loginSuccessPercent}%` }} />
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-amber-100 bg-amber-50 p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-semibold text-ink">Pending approvals</h3>
                <button className="text-xs font-semibold text-sky-700 hover:text-sky-900" onClick={pendingRequestsButton}>
                  View all
                </button>
              </div>
              <div className="space-y-3">
                {recentRequests.slice(0, 5).map((request) => (
                  <div key={request.id} className="rounded-lg border border-amber-100 bg-white px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-ink">{request.email ?? '—'}</p>
                        <p className="text-xs text-slate-500">Requested {formatRelativeTime(request.createdAt)}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          className="rounded-lg border border-emerald-200 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                          onClick={() => approveMutation.mutate(request.id)}
                          disabled={approveMutation.isPending || rejectMutation.isPending}
                        >
                          Approve
                        </button>
                        <button
                          className="rounded-lg border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                          onClick={() => rejectMutation.mutate({ id: request.id, reason: 'Rejected from dashboard' })}
                          disabled={approveMutation.isPending || rejectMutation.isPending}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {recentRequests.length === 0 && <p className="text-sm text-slate-600">No pending requests.</p>}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-ink">Byeastside quick sync</h3>
                  <p className="text-xs text-slate-500">Run manual sync for urgent updates.</p>
                </div>
                <button
                  type="button"
                  className="text-xs font-semibold text-sky-700 hover:text-sky-900"
                  onClick={() => navigate('/admin/byeastside')}
                >
                  Manage
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {[10, 20, 50].map((limit) => (
                  <button
                    key={limit}
                    type="button"
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    onClick={() => syncMutation.mutate(limit)}
                    disabled={syncMutation.isPending}
                  >
                    Sync {limit}
                  </button>
                ))}
                {syncMutation.isPending && <span className="text-sm text-slate-600">Syncing…</span>}
              </div>
              {syncResult && (
                <div className="mt-3 grid gap-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700 sm:grid-cols-2">
                  <div><span className="font-semibold text-ink">PDFs:</span> {syncResult.pdfsProcessed}</div>
                  <div><span className="font-semibold text-ink">Labels:</span> {syncResult.labelsScanned}</div>
                  <div><span className="font-semibold text-ink">Updated:</span> {syncResult.ordersUpdated}</div>
                  <div><span className="font-semibold text-ink">Skipped unpaid:</span> {syncResult.ordersSkippedUnpaid}</div>
                </div>
              )}
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-semibold text-ink">Recent users</h3>
                <button className="text-xs font-semibold text-sky-700 hover:text-sky-900" onClick={() => navigate('/admin/users')}>
                  Manage users
                </button>
              </div>
              <div className="space-y-2">
                {recentUsers.slice(0, 6).map((user) => (
                  <div key={user.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold text-ink">{user.email ?? '—'}</p>
                      <p className="text-xs text-slate-500">Created {formatRelativeTime(user.createdAt)}</p>
                    </div>
                    <span className="text-xs text-slate-500">Login {formatRelativeTime(user.lastLoginAt)}</span>
                  </div>
                ))}
                {recentUsers.length === 0 && <p className="text-sm text-slate-600">No users yet.</p>}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-semibold text-ink">Recent admin activity</h3>
                <button className="text-xs font-semibold text-sky-700 hover:text-sky-900" onClick={() => navigate('/admin/audits')}>
                  View audits
                </button>
              </div>
              <div className="space-y-2">
                {recentAudits.slice(0, 6).map((audit: any) => (
                  <div key={audit.id} className="rounded-lg border border-slate-100 px-3 py-2">
                    <p className="text-sm font-semibold text-ink">{actionLabels[audit.action] ?? audit.action}</p>
                    <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                      <span>{audit.targetId ? `Target ${audit.targetId}` : 'System event'}</span>
                      <span>{formatRelativeTime(audit.createdAt)}</span>
                    </div>
                  </div>
                ))}
                {recentAudits.length === 0 && <p className="text-sm text-slate-600">No admin activity.</p>}
              </div>
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  );
};
