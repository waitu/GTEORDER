import React, { useState, useEffect } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (adminNote: string, refund: boolean) => void;
  defaultNote?: string;
};

export const BulkFailModal: React.FC<Props> = ({ open, onClose, onConfirm, defaultNote }) => {
  const [note, setNote] = useState(defaultNote ?? '');
  const [refund, setRefund] = useState(false);

  useEffect(() => {
    if (open) {
      setNote(defaultNote ?? '');
      setRefund(false);
    }
  }, [open, defaultNote]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h4 className="text-lg font-semibold text-ink">Mark selected orders as failed</h4>
          <button className="rounded-full border border-slate-200 px-3 py-1 text-sm" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-semibold text-slate-700">Failure reason (required)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="mt-2 w-full rounded-lg border border-slate-200 p-3 text-sm"
          />
        </div>

        <div className="mt-4 flex items-center gap-2">
          <input id="refund" type="checkbox" checked={refund} onChange={(e) => setRefund(e.target.checked)} />
          <label htmlFor="refund" className="text-sm text-slate-700">Issue refund to user(s)</label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button className="rounded-lg border border-slate-200 px-4 py-2 text-sm" onClick={onClose}>
            Cancel
          </button>
          <button
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${note.trim() ? 'bg-slate-900 hover:bg-slate-800' : 'bg-slate-300 cursor-not-allowed'}`}
            disabled={!note.trim()}
            onClick={() => onConfirm(note.trim(), refund)}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkFailModal;
