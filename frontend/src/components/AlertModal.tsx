import { ReactNode } from 'react';

type AlertModalProps = {
  open: boolean;
  title: string;
  description?: string | ReactNode;
  closeLabel?: string;
  onClose: () => void;
};

export const AlertModal = ({ open, title, description, closeLabel = 'OK', onClose }: AlertModalProps) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <button
          type="button"
          aria-label="Close"
          className="absolute right-3 top-3 rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          onClick={onClose}
        >
          ×
        </button>
        <h3 className="text-lg font-semibold text-ink">{title}</h3>
        {description ? <div className="mt-2 whitespace-pre-line text-sm text-slate-700">{description}</div> : null}
        <div className="mt-6 flex justify-end">
          <button className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900" onClick={onClose}>
            {closeLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
