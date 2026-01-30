import React, { useEffect, useState } from 'react';

export type CreateTrackingModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (trackingCode: string) => void;
  isSubmitting?: boolean;
};

export const CreateTrackingModal = ({ open, onClose, onSubmit, isSubmitting }: CreateTrackingModalProps) => {
  const [trackingCode, setTrackingCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTrackingCode('');
    setError(null);
  }, [open]);

  if (!open) return null;

  const submit = () => {
    const code = trackingCode.trim();
    if (!code) {
      setError('Tracking number is required');
      return;
    }
    setError(null);
    onSubmit(code);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-8">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Create order</p>
            <h3 className="text-2xl font-semibold text-ink">USPS Tracking</h3>
            <p className="text-sm text-slate-600">Carrier is fixed to USPS. Paste your tracking number to start processing.</p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Close
          </button>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-semibold text-slate-700">Tracking number</label>
          <input
            type="text"
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
            placeholder="e.g. 9400... or EA123456789US"
            value={trackingCode}
            onChange={(e) => setTrackingCode(e.target.value)}
            disabled={isSubmitting}
            autoFocus
          />
          {error && <p className="mt-2 text-sm text-rose-700">{error}</p>}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm ${
              !trackingCode.trim() || isSubmitting ? 'bg-slate-400' : 'bg-slate-900 hover:bg-slate-800'
            }`}
            onClick={submit}
            disabled={!trackingCode.trim() || isSubmitting}
          >
            {isSubmitting ? 'Starting…' : 'Start'}
          </button>
        </div>
      </div>
    </div>
  );
};
