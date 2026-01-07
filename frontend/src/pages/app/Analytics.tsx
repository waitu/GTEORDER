import { DashboardLayout } from '../../components/DashboardLayout';

const formatCurrency = (n: number) => n.toLocaleString(undefined, { style: 'currency', currency: 'USD' });

const metrics = {
  totalUsers: 1240,
  activeUsers: 980,
  totalTrackings: 8420,
  totalEmptyOrders: 320,
  totalRevenue: 18450.75,
};

const usersGrowth = [120, 180, 260, 340, 420, 520, 640, 780, 900, 980, 1100, 1240];
const ordersByDay = [32, 28, 40, 36, 44, 51, 48];
const ordersLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const sparklinePath = (values: number[], width = 280, height = 80) => {
  if (!values.length) return '';
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max === min ? 1 : max - min;
  const step = values.length > 1 ? width / (values.length - 1) : width;
  return values
    .map((v, i) => {
      const x = i * step;
      const y = height - ((v - min) / span) * height;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
};

const barHeights = (values: number[], height = 120) => {
  const max = Math.max(...values, 1);
  return values.map((v) => Math.max(2, (v / max) * height));
};

export const AnalyticsPage = () => {
  const linePath = sparklinePath(usersGrowth);
  const bars = barHeights(ordersByDay);

  return (
    <DashboardLayout title="Analytics">
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Total users" value={metrics.totalUsers.toLocaleString()} />
        <MetricCard label="Active users" value={metrics.activeUsers.toLocaleString()} />
        <MetricCard label="Total trackings" value={metrics.totalTrackings.toLocaleString()} />
        <MetricCard label="Empty orders" value={metrics.totalEmptyOrders.toLocaleString()} />
        <MetricCard label="Total revenue" value={formatCurrency(metrics.totalRevenue)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-600">Users growth</p>
              <p className="text-xs text-slate-500">Mock data</p>
            </div>
          </div>
          <svg viewBox="0 0 280 80" className="h-24 w-full" role="img" aria-label="Users growth sparkline">
            <path d={linePath} fill="none" stroke="#0ea5e9" strokeWidth={3} strokeLinecap="round" />
            {usersGrowth.map((v, i) => {
              const max = Math.max(...usersGrowth);
              const min = Math.min(...usersGrowth);
              const span = max === min ? 1 : max - min;
              const x = usersGrowth.length > 1 ? (i * 280) / (usersGrowth.length - 1) : 0;
              const y = 80 - ((v - min) / span) * 80;
              return <circle key={i} cx={x} cy={y} r={3} fill="#0ea5e9" />;
            })}
          </svg>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-600">Orders by day</p>
              <p className="text-xs text-slate-500">Trackings + empty orders (mock)</p>
            </div>
          </div>
          <div className="flex items-end gap-3 h-36">
            {bars.map((h, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1 text-xs text-slate-600">
                <div
                  className="w-full rounded-md bg-sky-500/80"
                  style={{ height: `${h}px`, minHeight: '8px' }}
                  aria-label={`${ordersLabels[i]}: ${ordersByDay[i]} orders`}
                />
                <span>{ordersLabels[i]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

const MetricCard = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <p className="text-sm font-semibold text-slate-600">{label}</p>
    <p className="mt-2 text-3xl font-bold text-ink">{value}</p>
  </div>
);
