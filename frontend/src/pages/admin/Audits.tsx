import { useQuery } from '@tanstack/react-query';
import { AdminLayout } from '../../components/AdminLayout';
import { Table } from '../../components/Table';
import { fetchAuditLogs, AuditLog } from '../../api/admin';

export const AdminAuditsPage = () => {
  const { data: logs, isLoading, isError } = useQuery({ queryKey: ['admin', 'audits'], queryFn: fetchAuditLogs });

  return (
    <AdminLayout title="Audit Logs">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        {isLoading && <p className="text-sm text-slate-600">Loading audit logs…</p>}
        {isError && <p className="text-sm text-red-700">Could not load audit logs.</p>}
        {!isLoading && !isError && (
          <Table
            columns={[
              { key: 'action', header: 'Action', render: (row: AuditLog) => <span className="capitalize">{row.action}</span> },
              { key: 'targetId', header: 'Target', render: (row: AuditLog) => row.targetId ?? '—' },
              { key: 'createdAt', header: 'Time' },
            ]}
            data={logs ?? []}
            emptyMessage="No audit logs"
          />
        )}
      </div>
    </AdminLayout>
  );
};
