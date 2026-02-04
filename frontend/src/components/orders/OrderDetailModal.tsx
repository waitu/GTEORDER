import { useEffect, useState } from 'react';
import { Order } from '../../api/orders';

export type OrderDetailModalProps = {
  open: boolean;
  order?: Order | null;
  isLoading?: boolean;
  onClose: () => void;
};

const detailRow = (label: string, value?: string | number | null) => (
  <div className="flex flex-col">
    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
    <span className="text-sm text-ink">{value ?? '—'}</span>
  </div>
);

const designSubtypeLabels: Record<string, string> = {
  design_2d: '2D Illustration',
  design_3d: '3D Illustration',
  emb_text: 'Embroidery – Text',
  emb_image: 'Embroidery – Image',
  emb_family: 'Embroidery – Family Photo',
  emb_pet: 'Embroidery – Pet Portrait',
  poster: 'Poster',
  canvas_print: 'Canvas Print',
  sidebow: 'Sidebow',
  other_design: 'Other',
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

const resolvePrimaryResultUrl = (order?: Order | null) => {
  if (!order) return null;
  const candidates = order.orderType === 'design'
    ? [order.resultUrl, order.labelUrl, order.labelImageUrl, ...(order.assetUrls ?? [])]
    : [order.labelUrl, order.labelImageUrl, order.resultUrl, ...(order.assetUrls ?? [])];
  return (candidates.filter(Boolean)[0] as string | undefined) ?? null;
};

export const OrderDetailModal = ({ open, order, onClose, isLoading }: OrderDetailModalProps) => {
  if (!open) return null;
  const assets = buildAssets(order);
  const primaryResultUrl = resolvePrimaryResultUrl(order);
  const previewUrls = assets.filter((url) => isImageUrl(url));
  const isDesign = order?.orderType === 'design';
  const designLabel = order?.designSubtype ? designSubtypeLabels[order.designSubtype] ?? order.designSubtype : null;
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    setZoom(1);
  }, [lightboxSrc]);

  useEffect(() => {
    if (!lightboxSrc) return undefined;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLightboxSrc(null);
      }
      if (event.key === '+' || event.key === '=') setZoom((prev) => Math.min(prev + 0.25, 4));
      if (event.key === '-' || event.key === '_') setZoom((prev) => Math.max(prev - 0.25, 0.5));
      if (event.key === '0') setZoom(1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightboxSrc]);
  const copyToClipboard = (text: string) => {
    try {
      void navigator?.clipboard?.writeText(text);
    } catch (error) {
      // noop fallback
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 py-6">
      <div className="w-full max-w-5xl max-h-[calc(100vh-3rem)] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">{isDesign ? 'Design order' : 'Order detail'}</p>
              {isDesign && order?.designSubtype && (
                <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800">{designLabel}</span>
              )}
            </div>
            <h3 className="truncate text-xl font-semibold text-ink" title={order?.id ?? 'Order'}>
              {order?.id ?? 'Order'}
            </h3>
          </div>
          <button className="rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-700 hover:border-slate-300" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {detailRow('Order type', order?.orderType)}
          {detailRow('Design subtype', designLabel)}
          {!isDesign && detailRow('Tracking code', order?.trackingCode)}
          {detailRow('Order status', order?.orderStatus)}
          {detailRow('Payment status', order?.paymentStatus)}
           {detailRow('Total cost', order ? `${Number(order.totalCost).toLocaleString(undefined, { maximumFractionDigits: 2 })} cr` : undefined)}
          {detailRow('Created at', order ? new Date(order.createdAt).toLocaleString() : undefined)}
          {detailRow('Updated at', order ? new Date(order.updatedAt).toLocaleString() : undefined)}
          {detailRow('User email', order?.user?.email ?? undefined)}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Result</p>
            {primaryResultUrl ? (
              isImageUrl(primaryResultUrl) ? (
                <div className="mt-3 flex flex-col gap-3">
                  <button
                    type="button"
                    className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                    onClick={() => setLightboxSrc(primaryResultUrl)}
                    title="Open preview"
                  >
                    <img src={primaryResultUrl} alt="Result" className="h-64 w-full object-cover transition group-hover:scale-[1.02]" />
                  </button>
                  <div className="flex flex-col gap-2 text-sm">
                    <span className="break-all text-slate-700" title={primaryResultUrl}>
                      {primaryResultUrl}
                    </span>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <a className="rounded border border-slate-200 px-2 py-1 font-semibold hover:border-slate-300" href={primaryResultUrl} target="_blank" rel="noreferrer">
                        Open original
                      </a>
                      <a className="rounded border border-slate-200 px-2 py-1 font-semibold hover:border-slate-300" href={primaryResultUrl} download>
                        Download
                      </a>
                      <button type="button" className="rounded border border-slate-200 px-2 py-1 font-semibold hover:border-slate-300" onClick={() => setLightboxSrc(primaryResultUrl)}>
                        Zoom
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <a
                  href={primaryResultUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex max-w-full items-center gap-2 text-sm font-medium text-sky-700 underline-offset-4 hover:text-sky-900 hover:underline"
                  title={primaryResultUrl}
                >
                  <span className="break-all">{primaryResultUrl}</span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-600">{extractDomain(primaryResultUrl)}</span>
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
                        <button
                          type="button"
                          className="rounded border border-slate-200 px-2 py-1 font-semibold hover:border-slate-300"
                          onClick={(event) => {
                            event.preventDefault();
                            copyToClipboard(url);
                          }}
                        >
                          Copy URL
                        </button>
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
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Image previews</p>
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

        {isLoading && <p className="mt-4 text-xs text-slate-500">Loading additional details…</p>}
      </div>
    </div>
  );
};
