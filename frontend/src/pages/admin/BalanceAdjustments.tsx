import { AdminLayout } from '../../components/AdminLayout';
import { Card } from '../../components/Card';
import { Table } from '../../components/Table';
import { Badge } from '../../components/Badge';
import { EmptyState } from '../../components/EmptyState';

const mockAdjustments = [
  { id: 'BA-1001', user: 'jane@example.com', amount: '+$120.00', reason: 'Promotional credit', status: 'Scheduled' },
  { id: 'BA-1002', user: 'ops@customer.io', amount: '-$45.00', reason: 'Refund', status: 'Pending review' },
];

export const BalanceAdjustmentsPage = () => (
  <AdminLayout title="Credit Adjustments">
    <Card className="border-amber-100 bg-amber-50 text-sm text-amber-800" description="Placeholder only. No mutations are performed. Integrate with billing service when available.">
      <p className="text-sm">Operational notice: this view is static and safe to explore.</p>
    </Card>

    <Card
      title="Recent adjustments (mock)"
      description="Preview of how manual credits/debits could appear."
      actions={<button className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white">New adjustment</button>}
    >
      {mockAdjustments.length === 0 ? (
        <EmptyState title="No adjustments" description="When you add adjustments they will appear here." />
      ) : (
        <Table
          columns={[
            { key: 'id', header: 'ID', render: (row) => <span className="font-semibold text-ink">{row.id}</span> },
            { key: 'user', header: 'User', render: (row) => <span className="text-slate-700">{row.user}</span> },
            { key: 'amount', header: 'Amount', render: (row) => <span className="font-semibold text-emerald-600">{row.amount}</span> },
            { key: 'reason', header: 'Reason', render: (row) => <span className="text-slate-600">{row.reason}</span> },
            {
              key: 'status',
              header: 'Status',
              render: (row) => <Badge variant={row.status.includes('Pending') ? 'warning' : 'neutral'}>{row.status}</Badge>,
            },
            {
              key: 'actions',
              header: 'Actions',
              render: () => (
                <div className="space-x-2 text-xs">
                  <button className="rounded-md border border-slate-200 px-3 py-1 font-semibold text-slate-700">Review</button>
                  <button className="rounded-md bg-slate-900 px-3 py-1 font-semibold text-white">Simulate</button>
                </div>
              ),
            },
          ]}
          data={mockAdjustments}
        />
      )}
    </Card>
  </AdminLayout>
);
