import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '../../components/DashboardLayout';
import { fetchActivity, fetchSummary } from '../../api/dashboard';

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

const startOfDay = (d: Date) => {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
};

export const AnalyticsPage = () => {
  const { data: summary, isLoading: summaryLoading, isError: summaryError } = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: fetchSummary,
  });

  const { data: activity } = useQuery({
    queryKey: ['dashboard', 'activity'],
    queryFn: fetchActivity,
  });

  const { labels, values } = useMemo(() => {
    const now = new Date();
    const days = 7;
    const buckets = new Map<number, number>();
    for (let i = days - 1; i >= 0; i--) {
      const d = startOfDay(new Date(now.getTime() - i * 24 * 60 * 60 * 1000));
      buckets.set(d.getTime(), 0);
    }

    (activity ?? []).forEach((a) => {
      const dt = a?.updatedAt ? new Date(a.updatedAt) : null;
      if (!dt || Number.isNaN(dt.getTime())) return;
      const key = startOfDay(dt).getTime();
      if (!buckets.has(key)) return;
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    });

    const keys = Array.from(buckets.keys()).sort((a, b) => a - b);
    const values = keys.map((k) => buckets.get(k) ?? 0);
    const labels = keys.map((k) => new Date(k).toLocaleDateString(undefined, { weekday: 'short' }));
    return { labels, values };
  }, [activity]);

  const linePath = sparklinePath(values);
  const bars = barHeights(values);

  return (
    <DashboardLayout title="Analytics">
      <div className="grid gap-4 md:grid-cols-3">
        {summaryLoading && <MetricCard label="In-progress trackings" value="Loading…" />}
        {summaryError && <MetricCard label="In-progress trackings" value="—" />}
        {!summaryLoading && !summaryError && (
          <>
            <MetricCard label="In-progress trackings" value={(summary?.activeTrackings ?? 0).toLocaleString()} />
            <MetricCard label="In-progress empty orders" value={(summary?.emptyOrders ?? 0).toLocaleString()} />
            <MetricCard label="Credit balance" value={summary?.balance != null ? `${Number(summary?.balance ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} cr` : '—'} />
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-600">Activity trend</p>
              <p className="text-xs text-slate-500">Last 7 days</p>
            </div>
          </div>
          <svg viewBox="0 0 280 80" className="h-24 w-full" role="img" aria-label="Users growth sparkline">
            <path d={linePath} fill="none" stroke="#0ea5e9" strokeWidth={3} strokeLinecap="round" />
            {values.map((v, i) => {
              const max = Math.max(...values);
              const min = Math.min(...values);
              const span = max === min ? 1 : max - min;
              const x = values.length > 1 ? (i * 280) / (values.length - 1) : 0;
              const y = 80 - ((v - min) / span) * 80;
              return <circle key={i} cx={x} cy={y} r={3} fill="#0ea5e9" />;
            })}
          </svg>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-600">Activity by day</p>
              <p className="text-xs text-slate-500">Events in dashboard feed</p>
            </div>
          </div>
          <div className="flex items-end gap-3 h-36">
            {bars.map((h, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1 text-xs text-slate-600">
                <div
                  className="w-full rounded-md bg-sky-500/80"
                  style={{ height: `${h}px`, minHeight: '8px' }}
                  aria-label={`${labels[i]}: ${values[i]} events`}
                />
                <span>{labels[i]}</span>
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
