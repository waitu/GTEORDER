import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '../../components/AdminLayout';
import { Table } from '../../components/Table';
import { fetchAdminOverview, approveRegistrationRequest, rejectRegistrationRequest, RegistrationRequest, AdminOverview } from '../../api/admin';

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

  const recentUsers = data?.recentUsers ?? [];
  const recentRequests = (data?.recentRequests ?? []).map((r) => ({
    ...r,
    status: (r as any).status ?? (r as any).state ?? 'pending',
  }));
  const recentAudits = data?.recentAdminAudits ?? [];

  const renderStatCard = (
    label: string,
    value: number | undefined,
    hint?: string,
    highlight?: boolean,
    onClick?: () => void,
  ) => (
    <button
      type="button"
      onClick={onClick}
      className={`group flex h-full flex-col rounded-xl border p-5 text-left shadow-sm transition ${
        highlight
          ? 'border-amber-200 bg-amber-50/70 hover:border-amber-300'
          : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <div className="flex items-center justify-between text-sm font-semibold text-slate-600">
        <span>{label}</span>
        {highlight && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">Action</span>}
      </div>
      <p className="mt-3 text-3xl font-bold text-ink">{value ?? '—'}</p>
      {hint && <p className="mt-2 text-xs font-semibold text-slate-500">{hint}</p>}
    </button>
  );

  const pendingRequestsButton = () => navigate('/admin/requests');
  const pendingUsersButton = () => navigate('/admin/users');

  return (
    <AdminLayout title="Admin Dashboard">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading && <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm text-sm text-slate-600">Loading overview…</div>}
        {isError && <div className="rounded-xl border border-red-100 bg-red-50 p-5 text-sm text-red-700">Could not load overview.</div>}
        {!isLoading && !isError && counts && (
          <>
            {renderStatCard('Total users', counts.totalUsers, 'All time', false)}
            {renderStatCard('Active users', counts.activeUsers, 'Signed in recently', false)}
            {renderStatCard('Pending users', counts.pendingUsers, 'Needs review', counts.pendingUsers > 0, pendingUsersButton)}
            {renderStatCard('Pending requests', counts.registrationPending, 'Needs review', counts.registrationPending > 0, pendingRequestsButton)}
            {renderStatCard('Login success (24h)', counts.loginSuccess24h, 'Last 24 hours', false)}
            {renderStatCard('Login failures (24h)', counts.loginFail24h, 'Investigate failures', counts.loginFail24h > 0, () => navigate('/admin/audits'))}
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink">Quick actions</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <button
              type="button"
              className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 hover:border-slate-300 hover:bg-white"
              onClick={pendingRequestsButton}
            >
              Review pending registrations
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 hover:border-slate-300 hover:bg-white"
              onClick={() => navigate('/admin/orders?paymentStatus=unpaid')}
            >
              View unpaid orders
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 hover:border-slate-300 hover:bg-white"
              onClick={() => navigate('/admin/audits')}
            >
              View recent login failures
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-amber-100 bg-amber-50 p-5 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink">Registration requests</h2>
            <button className="text-sm font-semibold text-sky-700 hover:text-sky-900" onClick={pendingRequestsButton}>
              See all
            </button>
          </div>
          {isLoading && <p className="text-sm text-slate-600">Loading requests…</p>}
          {isError && <p className="text-sm text-red-700">Could not load requests.</p>}
          {!isLoading && !isError && (
            <Table
              columns={[
                { key: 'email', header: 'Email', render: (row: RegistrationRequest) => row.email ?? '—' },
                { key: 'createdAt', header: 'Requested', render: (row: RegistrationRequest) => formatRelativeTime(row.createdAt) },
                {
                  key: 'actions',
                  header: 'Actions',
                  render: (row: RegistrationRequest) => (
                    <div className="flex gap-2 text-sm">
                      <button
                        className="rounded-lg border border-emerald-200 px-3 py-1 font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                        onClick={() => approveMutation.mutate(row.id)}
                        disabled={approveMutation.isPending || rejectMutation.isPending || row.status !== 'pending'}
                      >
                        {approveMutation.isPending ? 'Approving…' : 'Approve'}
                      </button>
                      <button
                        className="rounded-lg border border-rose-200 px-3 py-1 font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                        onClick={() => rejectMutation.mutate({ id: row.id, reason: 'Rejected from dashboard' })}
                        disabled={approveMutation.isPending || rejectMutation.isPending || row.status !== 'pending'}
                      >
                        {rejectMutation.isPending ? 'Rejecting…' : 'Reject'}
                      </button>
                    </div>
                  ),
                },
              ]}
              data={recentRequests}
              emptyMessage="No registration requests"
            />
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink">Recent users</h2>
            <button className="text-sm font-semibold text-sky-700 hover:text-sky-900" onClick={() => navigate('/admin/users')}>
              Manage users
            </button>
          </div>
          {isLoading && <p className="text-sm text-slate-600">Loading users…</p>}
          {isError && <p className="text-sm text-red-700">Could not load users.</p>}
          {!isLoading && !isError && (
            <Table
              columns={[
                {
                  key: 'email',
                  header: 'Email',
                  render: (row: any) => (
                    <button
                      className="font-semibold text-sky-700 hover:text-sky-900"
                      onClick={() => navigate('/admin/users')}
                    >
                      {row.email ?? '—'}
                    </button>
                  ),
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (row: any) => (
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                        row.status === 'pending'
                          ? 'bg-amber-100 text-amber-800'
                          : row.status === 'disabled'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {row.status ?? 'pending'}
                    </span>
                  ),
                },
                { key: 'createdAt', header: 'Created', render: (row: any) => formatRelativeTime(row.createdAt) },
                { key: 'lastLoginAt', header: 'Last login', render: (row: any) => formatRelativeTime(row.lastLoginAt) },
              ]}
              data={recentUsers}
              emptyMessage="No users"
            />
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink">Recent admin activity</h2>
            <button className="text-sm font-semibold text-sky-700 hover:text-sky-900" onClick={() => navigate('/admin/audits')}>
              View audits
            </button>
          </div>
          {isLoading && <p className="text-sm text-slate-600">Loading admin activity…</p>}
          {isError && <p className="text-sm text-red-700">Could not load admin activity.</p>}
          {!isLoading && !isError && (
            <Table
              columns={[
                {
                  key: 'action',
                  header: 'Action',
                  render: (row: any) => actionLabels[row.action] ?? row.action,
                },
                {
                  key: 'targetId',
                  header: 'Target',
                  render: (row: any) =>
                    row.targetId ? (
                      <button className="text-sky-700 hover:text-sky-900" onClick={() => navigate('/admin/users')}>
                        {row.targetId}
                      </button>
                    ) : (
                      '—'
                    ),
                },
                { key: 'createdAt', header: 'When', render: (row: any) => formatRelativeTime(row.createdAt) },
              ]}
              data={recentAudits}
              emptyMessage="No admin activity"
            />
          )}
        </div>
      </div>
    </AdminLayout>
  );
};
