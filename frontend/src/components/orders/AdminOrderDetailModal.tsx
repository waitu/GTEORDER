import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Order, OrderStatus, PaymentStatus } from '../../api/orders';
import { orderStatusBadge, paymentStatusBadge } from './OrdersTable';
import { AlertModal } from '../AlertModal';
import { ConfirmModal } from '../ConfirmModal';

export type AdminOrderDetailModalProps = {
  open: boolean;
  order?: Order | null;
  isLoading?: boolean;
  onClose: () => void;
  onUpdateStatus: (status: OrderStatus) => void;
  onUpdatePayment: (status: PaymentStatus) => void;
  onSaveResultUrl: (resultUrl: string) => void;
  onSaveNotes: (notes: string) => void;
  onComplete?: (orderId: string, resultUrl: string) => Promise<void> | void;
  onFail?: (orderId: string, adminNote: string) => Promise<void> | void;
  onStart?: (orderId: string) => void;
  isStarting?: boolean;
  isSavingStatus?: boolean;
  isSavingPayment?: boolean;
  isSavingResult?: boolean;
  isSavingNotes?: boolean;
};

const isImageUrl = (url: string) => /\.(png|jpe?g|gif|webp|svg)$/i.test(url.split('?')[0]);

const extractDomain = (url?: string | null) => {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch (error) {
    return url.replace(/^https?:\/\//, '').split('/')[0] ?? url;
  }
};

const buildAssets = (order?: Order | null) => {
  if (!order) return [] as string[];
  const assets = [order.resultUrl, order.labelUrl, order.labelImageUrl, ...(order.assetUrls ?? [])].filter(Boolean) as string[];
  return Array.from(new Set(assets));
};

export const AdminOrderDetailModal = ({
  open,
  order,
  isLoading,
  onClose,
  onUpdateStatus,
  onUpdatePayment,
  onSaveResultUrl,
  onSaveNotes,
  onComplete,
  onFail,
  onStart,
  isStarting,
  isSavingStatus,
  isSavingPayment,
  isSavingResult,
  isSavingNotes,
}: AdminOrderDetailModalProps) => {
  const assets = useMemo(() => buildAssets(order), [order]);
  const previewUrls = useMemo(() => assets.filter((url) => isImageUrl(url)), [assets]);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [notesDraft, setNotesDraft] = useState(order?.adminNote ?? order?.internalNotes ?? '');
  const [resultDraft, setResultDraft] = useState(order?.resultUrl ?? '');
  const [alertState, setAlertState] = useState<{ title: string; description?: ReactNode } | null>(null);
  const [pendingAction, setPendingAction] = useState<
    | null
    | { type: 'complete'; orderId: string; resultUrl: string }
    | { type: 'fail'; orderId: string; adminNote: string }
  >(null);

  useEffect(() => {
    setNotesDraft(order?.adminNote ?? order?.internalNotes ?? '');
    setResultDraft(order?.resultUrl ?? '');
  }, [order?.adminNote, order?.internalNotes, order?.resultUrl]);

  useEffect(() => {
    if (!open) {
      setAlertState(null);
      setPendingAction(null);
      return;
    }
    // When switching orders while the modal is open, clear any stale confirmations.
    setAlertState(null);
    setPendingAction(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, order?.id]);

  useEffect(() => {
    setZoom(1);
  }, [lightboxSrc]);

  useEffect(() => {
    if (!lightboxSrc) return undefined;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLightboxSrc(null);
      if (event.key === '+' || event.key === '=') setZoom((prev) => Math.min(prev + 0.25, 4));
      if (event.key === '-' || event.key === '_') setZoom((prev) => Math.max(prev - 0.25, 0.5));
      if (event.key === '0') setZoom(1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightboxSrc]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 py-6">
      <div className="w-full max-w-5xl max-h-[calc(100vh-3rem)] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Admin order detail</p>
            <h3 className="truncate text-xl font-semibold text-ink" title={order?.id ?? 'Order'}>
              {order?.id ?? 'Order'}
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-700">
              {order?.user?.email && <span className="font-semibold">{order.user.email}</span>}
              {order?.user?.id && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{order.user.id}</span>}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              className="rounded-md bg-ink px-3 py-1 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-60"
              onClick={() => {
                if (!order) return;
                if (typeof onStart === 'function') onStart(order.id);
              }}
              disabled={order?.orderStatus !== 'pending' || isStarting}
            >
              {isStarting ? 'Starting…' : 'Start processing'}
            </button>
            <button className="rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-700 hover:border-slate-300" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
            </div>
            <div className="mt-2 flex flex-wrap gap-3">
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Order Status
                <select
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm capitalize focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  value={order?.orderStatus ?? 'pending'}
                  onChange={(event) => onUpdateStatus(event.target.value as OrderStatus)}
                  disabled={isSavingStatus}
                >
                  {['pending', 'processing', 'completed', 'error'].map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Payment Status
                <select
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm capitalize focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  value={order?.paymentStatus ?? 'unpaid'}
                  onChange={(event) => onUpdatePayment(event.target.value as PaymentStatus)}
                  disabled={isSavingPayment}
                >
                  {['unpaid', 'paid'].map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {order && orderStatusBadge(order.orderStatus)}
              {order && paymentStatusBadge(order.paymentStatus)}
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Set result URL</p>
            <div className="mt-3 flex flex-col gap-3">
              <input
                type="url"
                id="admin-result-url"
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                value={resultDraft}
                onChange={(event) => setResultDraft(event.target.value)}
                placeholder="https://…"
                disabled={isSavingResult}
              />
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Provide a direct link to the final file or gallery.</span>
                {isSavingResult && <span>Saving…</span>}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 hover:border-slate-300 disabled:opacity-60"
                  onClick={() => setResultDraft(order?.resultUrl ?? '')}
                  disabled={isSavingResult}
                >
                  Reset
                </button>
                <button
                  type="button"
                  className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
                  onClick={() => onSaveResultUrl(resultDraft)}
                  disabled={isSavingResult}
                >
                  Save result
                </button>
                <button
                  type="button"
                  className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-60"
                  onClick={() => {
                    if (!order) return;
                    if (!resultDraft || resultDraft.trim() === '') {
                      setAlertState({
                        title: 'Missing result URL',
                        description: 'Please provide a result URL before marking this order as completed.',
                      });
                      return;
                    }
                    setPendingAction({ type: 'complete', orderId: order.id, resultUrl: resultDraft.trim() });
                  }}
                  disabled={isSavingResult || isSavingStatus || order?.orderStatus !== 'processing'}
                >
                  Mark Completed
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Result</p>
            {order?.resultUrl ? (
              isImageUrl(order.resultUrl) ? (
                <div className="mt-3 flex flex-col gap-3">
                  <button
                    type="button"
                    className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                    onClick={() => setLightboxSrc(order.resultUrl!)}
                    title="Open preview"
                  >
                    <img src={order.resultUrl} alt="Result" className="h-64 w-full object-cover transition group-hover:scale-[1.02]" />
                  </button>
                  <div className="flex flex-col gap-2 text-sm">
                    <span className="break-all text-slate-700" title={order.resultUrl}>
                      {order.resultUrl}
                    </span>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <a className="rounded border border-slate-200 px-2 py-1 font-semibold hover:border-slate-300" href={order.resultUrl} target="_blank" rel="noreferrer">
                        Open original
                      </a>
                      <button type="button" className="rounded border border-slate-200 px-2 py-1 font-semibold hover:border-slate-300" onClick={() => setLightboxSrc(order.resultUrl!)}>
                        Zoom
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <a
                  href={order.resultUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex max-w-full items-center gap-2 text-sm font-medium text-sky-700 underline-offset-4 hover:text-sky-900 hover:underline"
                  title={order.resultUrl}
                >
                  <span className="break-all">{order.resultUrl}</span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-600">{extractDomain(order.resultUrl)}</span>
                </a>
              )
            ) : (
              <p className="mt-2 text-slate-500">No result URL.</p>
            )}
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assets</p>
            {assets.length === 0 ? (
              <p className="mt-2 text-slate-500">No assets available.</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {assets.map((url) => (
                  <li key={url} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-400" aria-hidden />
                    <div className="flex flex-1 flex-col gap-1">
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="break-all text-sky-700 underline-offset-4 hover:text-sky-900 hover:underline"
                      >
                        {url}
                      </a>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        <span>{extractDomain(url)}</span>
                        {isImageUrl(url) && (
                          <button
                            type="button"
                            className="rounded border border-slate-200 px-2 py-1 font-semibold hover:border-slate-300"
                            onClick={(event) => {
                              event.preventDefault();
                              setLightboxSrc(url);
                            }}
                          >
                            Preview
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {previewUrls.length > 0 && (
          <div className="mt-6 rounded-xl border border-slate-100 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Image gallery</p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
              {previewUrls.map((url) => (
                <button
                  key={url}
                  type="button"
                  className="group block overflow-hidden rounded-lg border border-slate-100 shadow-sm"
                  onClick={() => setLightboxSrc(url)}
                >
                  <img src={url} alt="Asset preview" className="h-32 w-full object-cover transition duration-200 group-hover:scale-[1.02]" />
                  <div className="flex items-center justify-between bg-white px-3 py-2 text-xs text-slate-600">
                    <span className="truncate" title={url}>
                      {extractDomain(url)}
                    </span>
                    <span className="text-[10px] uppercase tracking-wide text-slate-400">Zoom</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Admin note</p>
            {isSavingNotes && <span className="text-xs text-slate-500">Saving…</span>}
          </div>
          <textarea
            className="mt-2 min-h-[96px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
            value={notesDraft}
            onChange={(event) => setNotesDraft(event.target.value)}
            placeholder="Add internal-only notes for this order"
          />
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
              disabled={isSavingNotes}
              onClick={() => onSaveNotes(notesDraft)}
            >
              Save notes
            </button>
            <button
              type="button"
              className="ml-2 rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-500 disabled:opacity-60"
              onClick={() => {
                if (!order) return;
                if (!notesDraft || notesDraft.trim() === '') {
                  setAlertState({
                    title: 'Missing admin note',
                    description: 'Please add an admin note before marking this order as failed.',
                  });
                  return;
                }
                setPendingAction({ type: 'fail', orderId: order.id, adminNote: notesDraft.trim() });
              }}
              disabled={isSavingNotes || isSavingStatus || order?.orderStatus !== 'processing'}
            >
              Mark Failed
            </button>
          </div>
        </div>

        <AlertModal
          open={!!alertState}
          title={alertState?.title ?? ''}
          description={alertState?.description}
          onClose={() => setAlertState(null)}
        />

        <ConfirmModal
          open={pendingAction?.type === 'complete'}
          title="Mark this order as completed?"
          description="This will save the result URL and set the status to completed."
          confirmLabel="Mark completed"
          onCancel={() => setPendingAction(null)}
          onConfirm={() => {
            if (!pendingAction || pendingAction.type !== 'complete') return;
            const action = pendingAction;
            setPendingAction(null);
            try {
              if (typeof onComplete === 'function') onComplete(action.orderId, action.resultUrl);
            } catch {
              // parent handles errors/toasts
            }
          }}
        />

        <ConfirmModal
          open={pendingAction?.type === 'fail'}
          title="Mark this order as failed?"
          description="This will save the admin note and set the status to failed."
          confirmLabel="Mark failed"
          onCancel={() => setPendingAction(null)}
          onConfirm={() => {
            if (!pendingAction || pendingAction.type !== 'fail') return;
            const action = pendingAction;
            setPendingAction(null);
            try {
              if (typeof onFail === 'function') onFail(action.orderId, action.adminNote);
            } catch {
              // parent handles errors/toasts
            }
          }}
        />

        {lightboxSrc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4" onClick={() => setLightboxSrc(null)}>
            <div className="relative" onClick={(event) => event.stopPropagation()}>
              <img src={lightboxSrc} alt="Full preview" className="max-h-[90vh] max-w-[90vw] object-contain" style={{ transform: `scale(${zoom})` }} />
              <div className="absolute right-2 top-2 flex gap-2">
                <button
                  type="button"
                  className="rounded bg-white/90 px-3 py-1 text-xs font-semibold text-slate-800 shadow"
                  onClick={() => setZoom((prev) => Math.max(prev - 0.25, 0.5))}
                >
                  –
                </button>
                <button
                  type="button"
                  className="rounded bg-white/90 px-3 py-1 text-xs font-semibold text-slate-800 shadow"
                  onClick={() => setZoom(1)}
                >
                  100%
                </button>
                <button
                  type="button"
                  className="rounded bg-white/90 px-3 py-1 text-xs font-semibold text-slate-800 shadow"
                  onClick={() => setZoom((prev) => Math.min(prev + 0.25, 4))}
                >
                  +
                </button>
                <button
                  type="button"
                  className="rounded bg-white/90 px-3 py-1 text-xs font-semibold text-slate-800 shadow"
                  onClick={() => setLightboxSrc(null)}
                >
                  Esc
                </button>
              </div>
            </div>
          </div>
        )}

        {isLoading && <p className="mt-4 text-xs text-slate-500">Loading order details…</p>}
      </div>
    </div>
  );
};
