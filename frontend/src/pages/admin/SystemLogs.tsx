import { useQuery } from '@tanstack/react-query';
import { AdminLayout } from '../../components/AdminLayout';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { EmptyState } from '../../components/EmptyState';
import { fetchAuditLogs, AuditLog } from '../../api/admin';

const toSeverity = (action: string): 'info' | 'warn' | 'error' => {
  const normalized = action.toLowerCase();
  if (normalized.includes('reject') || normalized.includes('fail') || normalized.includes('error')) return 'error';
  if (normalized.includes('disable') || normalized.includes('update') || normalized.includes('adjust')) return 'warn';
  return 'info';
};

const formatTime = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

export const SystemLogsPage = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'audits'],
    queryFn: fetchAuditLogs,
  });

  const logs = (data ?? []) as AuditLog[];

  return (
    <AdminLayout title="System Logs & Audits">
      <Card title="Live view" description="Real admin audit stream from `/admin/audits`.">
        {isLoading ? (
          <p className="text-sm text-slate-600">Loading logs…</p>
        ) : isError ? (
          <p className="text-sm text-rose-700">Could not load logs.</p>
        ) : logs.length === 0 ? (
          <EmptyState title="No log entries" description="No audit log entries found." />
        ) : (
          <div className="space-y-3">
            {logs.map((log) => {
              const severity = toSeverity(log.action);
              return (
                <div key={log.id ?? `${log.action}-${log.createdAt}`} className="flex items-start justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">{formatTime(log.createdAt)}</p>
                    <p className="text-sm font-semibold text-ink">{log.action}</p>
                    {log.targetId && <p className="text-xs text-slate-600">Target: {log.targetId}</p>}
                  </div>
                  <Badge variant={severity === 'error' ? 'danger' : severity === 'warn' ? 'warning' : 'info'}>{severity}</Badge>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </AdminLayout>
  );
};
