import { AdminLayout } from '../../components/AdminLayout';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { EmptyState } from '../../components/EmptyState';

const mockLogs = [
  { id: 1, severity: 'info', message: 'User login success', timestamp: '2025-12-17 10:12:01' },
  { id: 2, severity: 'warn', message: 'OTP retries nearing threshold', timestamp: '2025-12-17 10:08:44' },
  { id: 3, severity: 'error', message: 'Billing webhook timeout', timestamp: '2025-12-17 09:58:10' },
];

export const SystemLogsPage = () => (
  <AdminLayout title="System Logs & Audits">
    <Card title="Live view" description="Placeholder view combining system logs and audit signals. Swap with real log stream later.">
      {mockLogs.length === 0 ? (
        <EmptyState title="No log entries" description="Logs will appear here once connected to a source." />
      ) : (
        <div className="space-y-3">
          {mockLogs.map((log) => (
            <div key={log.id} className="flex items-start justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">{log.timestamp}</p>
                <p className="text-sm font-semibold text-ink">{log.message}</p>
              </div>
              <Badge variant={log.severity === 'error' ? 'danger' : log.severity === 'warn' ? 'warning' : 'info'}>{log.severity}</Badge>
            </div>
          ))}
        </div>
      )}
    </Card>
  </AdminLayout>
);

const badgeColor = (severity: string) => {
  switch (severity) {
    case 'error':
      return '#ef4444';
    case 'warn':
      return '#f59e0b';
    default:
      return '#0ea5e9';
  }
};
