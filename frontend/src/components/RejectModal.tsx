import { useState, useEffect } from 'react';

type RejectModalProps = {
  open: boolean;
  title?: string;
  onCancel: () => void;
  onSubmit: (reason: string) => void;
};

export const RejectModal = ({ open, title = 'Reject request', onCancel, onSubmit }: RejectModalProps) => {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-semibold text-ink">{title}</h3>
        <p className="mt-2 text-sm text-slate-600">Provide a short reason for rejection.</p>
        <textarea
          className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason"
        />
        <div className="mt-6 flex justify-end gap-3 text-sm font-semibold">
          <button className="rounded-lg border border-slate-200 px-4 py-2 text-slate-700 hover:bg-slate-50" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-60"
            disabled={!reason.trim()}
            onClick={() => onSubmit(reason.trim())}
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
};
