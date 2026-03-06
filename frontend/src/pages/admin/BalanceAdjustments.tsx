import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminLayout } from '../../components/AdminLayout';
import { Card } from '../../components/Card';
import { Table } from '../../components/Table';
import { Badge } from '../../components/Badge';
import { EmptyState } from '../../components/EmptyState';
import {
  adjustAdminUserCredit,
  fetchAdminUsers,
  fetchRecentCreditTransactions,
  AdminCreditTransaction,
} from '../../api/admin';

const formatTime = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const formatAmount = (amount: number) => {
  const sign = amount >= 0 ? '+' : '-';
  return `${sign}$${Math.abs(amount).toFixed(2)}`;
};

export const BalanceAdjustmentsPage = () => {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState('');
  const [direction, setDirection] = useState<'credit' | 'debit'>('credit');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('admin_adjust');
  const [note, setNote] = useState('');

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: fetchAdminUsers,
  });

  const {
    data: transactions,
    isLoading: txLoading,
    isError: txError,
  } = useQuery({
    queryKey: ['admin', 'credit-adjustments', 'recent'],
    queryFn: () => fetchRecentCreditTransactions(100),
  });

  const mutation = useMutation({
    mutationFn: () => {
      const parsed = Number(amount);
      if (!userId || !Number.isFinite(parsed) || parsed <= 0) {
        throw new Error('Please select user and enter a valid amount > 0');
      }
      return adjustAdminUserCredit(userId, {
        amount: parsed,
        direction,
        reason,
        note,
      });
    },
    onSuccess: async () => {
      setAmount('');
      setNote('');
      await queryClient.invalidateQueries({ queryKey: ['admin', 'credit-adjustments', 'recent'] });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });

  const rows = useMemo(() => transactions ?? [], [transactions]);

  return (
    <AdminLayout title="Credit Adjustments">
      <Card title="New adjustment" description="Apply real credit/debit to a user balance.">
        <div className="grid gap-3 md:grid-cols-5">
          <select
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            disabled={usersLoading}
          >
            <option value="">Select user</option>
            {(users ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.email}
              </option>
            ))}
          </select>

          <select
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={direction}
            onChange={(e) => setDirection(e.target.value as 'credit' | 'debit')}
          >
            <option value="credit">Credit (+)</option>
            <option value="debit">Debit (-)</option>
          </select>

          <input
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Amount (e.g. 10)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
          />

          <input
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />

          <button
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Applying…' : 'Apply'}
          </button>
        </div>

        <textarea
          className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          placeholder="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        {mutation.isError && <p className="mt-2 text-sm text-rose-700">{(mutation.error as Error).message}</p>}
        {mutation.isSuccess && <p className="mt-2 text-sm text-emerald-700">Adjustment applied successfully.</p>}
      </Card>

      <Card title="Recent adjustments" description="Live transaction history from balance ledger.">
        {txLoading ? (
          <p className="text-sm text-slate-600">Loading recent adjustments…</p>
        ) : txError ? (
          <p className="text-sm text-rose-700">Could not load recent adjustments.</p>
        ) : rows.length === 0 ? (
          <EmptyState title="No adjustments" description="No credit transactions found yet." />
        ) : (
          <Table
            columns={[
              { key: 'id', header: 'ID', render: (row: AdminCreditTransaction) => <span className="font-mono text-xs">{row.id}</span> },
              { key: 'user', header: 'User', render: (row: AdminCreditTransaction) => <span>{row.user?.email ?? row.user?.id ?? '—'}</span> },
              {
                key: 'amount',
                header: 'Amount',
                render: (row: AdminCreditTransaction) => (
                  <span className={row.amount >= 0 ? 'font-semibold text-emerald-600' : 'font-semibold text-rose-600'}>
                    {formatAmount(row.amount)}
                  </span>
                ),
              },
              { key: 'reason', header: 'Reason', render: (row: AdminCreditTransaction) => <span>{row.reason ?? '—'}</span> },
              {
                key: 'direction',
                header: 'Type',
                render: (row: AdminCreditTransaction) => (
                  <Badge variant={row.direction === 'credit' ? 'success' : 'warning'}>{row.direction}</Badge>
                ),
              },
              { key: 'balanceAfter', header: 'Balance After', render: (row: AdminCreditTransaction) => <span>${row.balanceAfter.toFixed(2)}</span> },
              { key: 'createdAt', header: 'Created', render: (row: AdminCreditTransaction) => <span>{formatTime(row.createdAt)}</span> },
            ]}
            data={rows}
          />
        )}
      </Card>
    </AdminLayout>
  );
};
