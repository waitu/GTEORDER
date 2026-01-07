import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '../../components/DashboardLayout';
import { Card } from '../../components/Card';
import { fetchAccountProfile } from '../../api/account';
import { useAuth } from '../../context/AuthProvider';

export const AccountPage = () => {
  const { user } = useAuth();
  const email = user?.email ?? '—';
  const { data: profile, isLoading, isError } = useQuery({ queryKey: ['account', 'profile'], queryFn: fetchAccountProfile });

  return (
    <DashboardLayout title="Account">
      {isLoading && <p className="text-sm text-slate-600">Loading profile…</p>}
      {isError && <p className="text-sm text-red-700">Could not load profile. Please try again.</p>}
      {!isLoading && !isError && profile && (
      <>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Account Information" description="Primary identity is your email.">
          <dl className="grid grid-cols-2 gap-3 text-sm text-slate-700">
            <Info label="Email" value={email} strong />
            <Info label="Status" value={profile.status ?? '—'} />
            <Info label="Role" value={profile.role ?? '—'} />
            <Info label="Created" value={formatDate(profile.createdAt)} />
            <Info label="Full name" value={profile.fullName ?? '—'} />
            <Info label="Phone" value={profile.phone ?? '—'} />
          </dl>
        </Card>

        <Card title="Security" description="Read-only security details." actions={<a className="text-sm font-semibold text-sky-700" href="/devices">Manage devices</a>}>
          <dl className="grid grid-cols-2 gap-3 text-sm text-slate-700">
            <Info label="Last login" value={formatDateTime(profile.lastLoginAt ?? undefined)} />
            <Info label="Last login IP" value={profile.lastLoginIp ?? '—'} />
            <Info label="Trusted devices" value={`${profile.trustedDevices ?? 0}`} />
            <Info label="Device management" value="Devices page" />
          </dl>
        </Card>
      </div>

      <Card title="Preferences" description="UI only for now.">
        <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-sm">
          <div>
            <p className="font-semibold text-ink">Email notifications</p>
            <p className="text-xs text-slate-600">Toggle placeholder (no-op)</p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500" disabled />
            <span className="text-xs text-slate-500">Disabled</span>
          </label>
        </div>
      </Card>

      <Card title="Activity Summary" description="Read-only usage stats.">
        <div className="grid gap-4 sm:grid-cols-3 text-sm">
          <Stat label="Total trackings" value={profile.totals?.trackings?.toLocaleString?.() ?? '—'} />
          <Stat label="Total empty orders" value={profile.totals?.emptyOrders?.toLocaleString?.() ?? '—'} />
          <Stat label="Credit balance" value={formatCurrency(profile.totals?.balance)} />
        </div>
      </Card>
      </>
      )}
    </DashboardLayout>
  );
};

const Info = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => (
  <div className="flex flex-col gap-1">
    <span className="text-xs uppercase tracking-wide text-slate-500">{label}</span>
    <span className={strong ? 'font-semibold text-ink' : 'text-slate-800'}>{value}</span>
  </div>
);

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-2 text-2xl font-bold text-ink">{value}</p>
  </div>
);

const formatDate = (iso?: string) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString();
};

const formatDateTime = (iso?: string) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
};

const formatCurrency = (n?: number) => (n != null ? n.toLocaleString(undefined, { style: 'currency', currency: 'USD' }) : '—');
