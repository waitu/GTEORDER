import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminLayout } from '../../components/AdminLayout';
import { Table } from '../../components/Table';
import { ConfirmModal } from '../../components/ConfirmModal';
import { RejectModal } from '../../components/RejectModal';
import { EmptyState } from '../../components/EmptyState';
import {
  approveRegistrationRequest,
  fetchRegistrationRequests,
  rejectRegistrationRequest,
  RegistrationRequest,
} from '../../api/admin';

export const AdminRequestsPage = () => {
  const [approveId, setApproveId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [toast, setToast] = useState<string>('');
  const queryClient = useQueryClient();

  const { data: rows, isLoading, isError } = useQuery({
    queryKey: ['admin', 'registration-requests'],
    queryFn: fetchRegistrationRequests,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveRegistrationRequest(id),
    onSuccess: () => {
      setToast('Request approved');
      queryClient.invalidateQueries({ queryKey: ['admin', 'registration-requests'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'overview'] });
    },
    onSettled: () => setApproveId(null),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectRegistrationRequest(id, reason),
    onSuccess: () => {
      setToast('Request rejected');
      queryClient.invalidateQueries({ queryKey: ['admin', 'registration-requests'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'overview'] });
    },
    onSettled: () => setRejectId(null),
  });

  const approve = (id: string) => setApproveId(id);
  const reject = (id: string) => setRejectId(id);

  const confirmApprove = () => {
    if (!approveId) return;
    approveMutation.mutate(approveId);
  };

  const confirmReject = (reason: string) => {
    if (!rejectId) return;
    rejectMutation.mutate({ id: rejectId, reason });
  };

  const pendingRows = useMemo(
    () => (rows ?? []).filter((row) => !row.status || row.status === 'pending'),
    [rows],
  );

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(''), 2000);
    return () => clearTimeout(id);
  }, [toast]);

  return (
    <AdminLayout title="Registration Requests">
      {toast && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800">
          {toast}
        </div>
      )}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        {isLoading && <p className="text-sm text-slate-600">Loading requests…</p>}
        {isError && <p className="text-sm text-red-700">Could not load requests.</p>}
        {!isLoading && !isError && (
          <>
            {pendingRows.length === 0 ? (
              <EmptyState
                title="No pending requests"
                description="New registration requests will appear here for review."
              />
            ) : (
              <Table
                columns={[
                  { key: 'email', header: 'Email' },
                  { key: 'createdAt', header: 'Requested', render: (row: RegistrationRequest) => row.createdAt ?? '—' },
                  { key: 'status', header: 'Status', render: (row: RegistrationRequest) => <span className="capitalize">{row.status ?? 'pending'}</span> },
                  {
                    key: 'actions',
                    header: 'Actions',
                    render: (row: RegistrationRequest) => (
                      <div className="flex gap-2 text-sm">
                        <button
                          className="rounded-lg border border-slate-200 px-3 py-1 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                          onClick={() => approve(row.id)}
                          disabled={row.status !== 'pending' || approveMutation.isPending || rejectMutation.isPending}
                        >
                          {approveMutation.isPending && approveId === row.id ? 'Approving…' : 'Approve'}
                        </button>
                        <button
                          className="rounded-lg border border-red-200 px-3 py-1 font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                          onClick={() => reject(row.id)}
                          disabled={row.status !== 'pending' || approveMutation.isPending || rejectMutation.isPending}
                        >
                          {rejectMutation.isPending && rejectId === row.id ? 'Rejecting…' : 'Reject'}
                        </button>
                      </div>
                    ),
                  },
                ]}
                data={pendingRows}
                emptyMessage="No pending requests"
              />
            )}
          </>
        )}
      </div>

      <ConfirmModal
        open={!!approveId}
        title="Approve this request?"
        description="User will be activated."
        confirmLabel="Approve"
        onCancel={() => setApproveId(null)}
        onConfirm={confirmApprove}
      />

      <RejectModal open={!!rejectId} onCancel={() => setRejectId(null)} onSubmit={confirmReject} />
    </AdminLayout>
  );
};
