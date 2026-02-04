import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { Order, OrderStatus, OrderType, PaymentStatus } from '../../api/orders';
import { Table, TableColumn } from '../Table';
import { formatCostText } from '../../lib/pricing';

const typeLabels: Record<OrderType, string> = {
  active_tracking: 'Active tracking',
  empty_package: 'Empty package',
  design: 'Design',
  other: 'Other',
};

const typeClasses: Record<OrderType, string> = {
  active_tracking: 'bg-sky-100 text-sky-800',
  empty_package: 'bg-amber-100 text-amber-800',
  design: 'bg-emerald-100 text-emerald-800',
  other: 'bg-slate-100 text-slate-800',
};

const orderStatusClasses: Record<OrderStatus, string> = {
  pending: 'bg-slate-100 text-slate-800',
  processing: 'bg-indigo-100 text-indigo-800',
  completed: 'bg-emerald-100 text-emerald-800',
  error: 'bg-rose-100 text-rose-800',
  failed: 'bg-rose-100 text-rose-800',
};

const paymentStatusClasses: Record<PaymentStatus, string> = {
  unpaid: 'bg-rose-100 text-rose-800',
  paid: 'bg-emerald-100 text-emerald-800',
};

export const orderTypeBadge = (orderType: OrderType, extraTitle?: string) => (
  <span title={extraTitle} className={clsx('inline-flex h-6 items-center rounded-full px-2 text-[11px] font-semibold capitalize', typeClasses[orderType])}>
    {typeLabels[orderType]}
  </span>
);

export const orderStatusBadge = (orderStatus: OrderStatus) => (
  <span className={clsx('inline-flex h-6 items-center gap-1 rounded-full px-2 text-[11px] font-semibold capitalize', orderStatusClasses[orderStatus])}>
    {orderStatus === 'processing' && (
      <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" strokeOpacity="0.2" />
        <path d="M21 12a9 9 0 0 0-9-9" />
      </svg>
    )}
    {orderStatus}
  </span>
);

export const paymentStatusBadge = (paymentStatus: PaymentStatus) => (
  <span className={clsx('inline-flex h-6 items-center rounded-full px-2 text-[11px] font-semibold capitalize', paymentStatusClasses[paymentStatus])}>
    {paymentStatus}
  </span>
);

const formatDate = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const extractDomain = (url?: string | null) => {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch (error) {
    return url.replace(/^https?:\/\//, '').split('/')[0] ?? url;
  }
};


const resolvePrimaryUrl = (order: Order, source: 'label' | 'result') => {
  const candidates = source === 'result'
    ? [order.resultUrl, order.labelUrl, order.labelImageUrl]
    : [order.labelUrl, order.labelImageUrl, order.resultUrl];
  return (candidates.filter(Boolean)[0] as string | undefined) ?? null;
};

const resolveAssets = (order: Order) => {
  const candidates = [order.resultUrl, order.labelUrl, order.labelImageUrl, ...(order.assetUrls ?? [])].filter(Boolean) as string[];
  return Array.from(new Set(candidates));
};

const isImageUrl = (url: string) => /\.(png|jpe?g|gif|webp)$/i.test(url.split('?')[0]);

const AssetsPreviewModal = ({
  open,
  images,
  others,
  onClose,
  onImageClick,
}: {
  open: boolean;
  images: string[];
  others: string[];
  onClose: () => void;
  onImageClick: (url: string) => void;
}) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-ink">Assets</h3>
          <button className="rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-700" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((url) => (
            <button
              key={url}
              type="button"
              className="group overflow-hidden rounded-lg border border-slate-100 shadow-sm"
              onClick={() => onImageClick(url)}
            >
              <img src={url} alt="Asset" className="h-32 w-full object-cover transition group-hover:scale-[1.02]" />
            </button>
          ))}
        </div>
        {others.length > 0 && (
          <div className="mt-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Other files</div>
            <ul className="mt-2 space-y-2 text-sm">
              {others.map((url) => (
                <li key={url}>
                  <a href={url} target="_blank" rel="noreferrer" className="break-all text-sky-700 hover:underline">
                    {url}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

type OrdersTableProps<T extends Order = Order> = {
  orders: T[];
  onRowClick?: (order: T) => void;
  columns?: TableColumn<T>[];
  hideTracking?: boolean;
  showDesignSubtype?: boolean;
  designSubtypeLabels?: Record<string, string>;
  primaryUrlSource?: 'label' | 'result';
  labelHeader?: string;
  showAssets?: boolean;
  // Optional controlled selection
  selectedIds?: Set<string>;
  onToggleRow?: (id: string, checked: boolean) => void;
  onToggleAll?: (checked: boolean) => void;
};

export function buildDefaultOrderColumns<T extends Order = Order>(options?: {
  onOrderClick?: (order: T) => void;
  onImagePreview?: (url: string) => void;
  onAssetsPreview?: (payload: { order: T; images: string[]; others: string[] }) => void;
  hideTracking?: boolean;
  showDesignSubtype?: boolean;
  designSubtypeLabels?: Record<string, string>;
  primaryUrlSource?: 'label' | 'result';
  labelHeader?: string;
  showAssets?: boolean;
}): TableColumn<T>[] {
  const primaryUrlSource = options?.primaryUrlSource ?? 'label';
  const labelHeader = options?.labelHeader ?? (primaryUrlSource === 'result' ? 'Result' : 'Label');
  const showAssets = options?.showAssets ?? false;
  const cols: TableColumn<T>[] = [
    {
      key: 'id',
      header: 'Order ID',
      render: (order) => (
        <button
          type="button"
          className="w-36 break-words text-left text-sm font-semibold text-slate-900 line-clamp-2 underline-offset-4 hover:text-slate-600 hover:underline"
          onClick={(event) => {
            if (options?.onOrderClick) {
              event.stopPropagation();
              options.onOrderClick(order);
            }
          }}
        >
          {order.id}
        </button>
      ),
    },
    {
      key: 'orderType',
      header: 'Type',
      render: (order) => {
        // Determine cost text for common types
        const key = order.orderType === 'active_tracking' ? 'scan_label' : order.orderType;
        const costText = formatCostText(key) ?? 'Credits will be deducted when admin starts processing.';
        return orderTypeBadge(order.orderType, costText);
      },
    },
  ];

  if (options?.showDesignSubtype) {
    cols.push({
      key: 'designSubtype',
      header: 'Design Type',
      render: (order) => {
        const label = (order.designSubtype && options.designSubtypeLabels?.[order.designSubtype]) || order.designSubtype || '—';
        // show tooltip with estimated credit cost when available
        const costText = (() => {
          const subtypeKey = order.designSubtype ?? null;
          // map some legacy values to pricing keys
          if (!subtypeKey) return undefined;
          return formatCostText(subtypeKey) ?? undefined;
        })();
        return (
          <span title={costText} className="text-sm text-slate-700">
            {label}
          </span>
        );
      },
    });
  }

  if (!options?.hideTracking) {
    cols.push({
      key: 'trackingCode',
      header: 'Tracking Code',
      render: (order) => (order.trackingCode ? <span className="font-mono text-base font-semibold text-slate-900">{order.trackingCode}</span> : <span className="text-slate-400">—</span>),
    });
  }

  cols.push(
    {
      key: 'labelUrl',
      header: labelHeader,
      render: (order) => {
        const url = resolvePrimaryUrl(order, primaryUrlSource);
        if (!url) return <span className="text-xs text-slate-400">—</span>;
        if (isImageUrl(url)) {
          return (
            <button
              type="button"
              className="group relative inline-flex h-12 w-12 overflow-hidden rounded-lg border border-slate-200 shadow-sm"
              title="Open order details"
              onClick={(event) => {
                event.stopPropagation();
                if (options?.onOrderClick) {
                  options.onOrderClick(order);
                } else {
                  options?.onImagePreview?.(url);
                }
              }}
            >
              <img src={url} alt="Label preview" className="h-full w-full object-cover transition group-hover:scale-105" />
            </button>
          );
        }
        const domain = extractDomain(url);
        return (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="text-sm font-medium text-sky-700 underline-offset-4 hover:text-sky-900 hover:underline"
            title={url}
          >
            {domain || 'Open'}
          </a>
        );
      },
    },
    {
      key: 'totalCost',
      header: 'Total Cost',
      render: (order) => <span className="text-sm font-semibold text-ink">{order.totalCost != null ? `${Number(order.totalCost).toLocaleString(undefined, { maximumFractionDigits: 2 })} cr` : '—'}</span>,
    },
    {
      key: 'orderStatus',
      header: 'Order Status',
      render: (order) => orderStatusBadge(order.orderStatus),
    },
  );

  if (showAssets) {
    cols.push({
      key: 'assets',
      header: 'Assets',
      render: (order) => {
        const assets = resolveAssets(order);
        if (assets.length === 0) return <span className="text-xs text-slate-400">—</span>;
        const imageAssets = assets.filter((a) => isImageUrl(a));
        const otherAssets = assets.filter((a) => !isImageUrl(a));

        if (assets.length === 1 && imageAssets.length === 1) {
          const primary = imageAssets[0];
          return (
            <button
              type="button"
              className="group relative inline-flex h-12 w-12 overflow-hidden rounded-lg border border-slate-200 shadow-sm"
              title={primary}
              onClick={(event) => {
                event.stopPropagation();
                options?.onImagePreview?.(primary);
              }}
            >
              <img src={primary} alt="Asset preview" className="h-full w-full object-cover transition group-hover:scale-105" />
            </button>
          );
        }

        return (
          <div className="flex flex-wrap items-center gap-2">
            {imageAssets.slice(0, 2).map((img) => (
              <button
                key={img}
                type="button"
                className="group relative inline-flex h-10 w-10 overflow-hidden rounded-md border border-slate-200"
                title={img}
                onClick={(event) => {
                  event.stopPropagation();
                  options?.onImagePreview?.(img);
                }}
              >
                <img src={img} alt="Asset preview" className="h-full w-full object-cover transition group-hover:scale-105" />
              </button>
            ))}
            {otherAssets.length > 0 && (
              <button
                type="button"
                className="rounded-full border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700"
                title={otherAssets.join(', ')}
                onClick={(event) => {
                  event.stopPropagation();
                  options?.onAssetsPreview?.({ order, images: imageAssets, others: otherAssets });
                }}
              >
                +{otherAssets.length} file{otherAssets.length === 1 ? '' : 's'}
              </button>
            )}
          </div>
        );
      },
    });
  }

  return cols;
}

const Lightbox = ({ src, onClose }: { src: string | null; onClose: () => void }) => {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    setScale(1);
  }, [src]);

  useEffect(() => {
    if (!src) return undefined;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
      if (event.key === '+' || event.key === '=') {
        setScale((prev) => Math.min(prev + 0.25, 4));
      }
      if (event.key === '-' || event.key === '_') {
        setScale((prev) => Math.max(prev - 0.25, 0.5));
      }
      if (event.key === '0') {
        setScale(1);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, src]);

  if (!src) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4" onClick={onClose}>
      <div className="relative" onClick={(event) => event.stopPropagation()}>
        <img src={src} alt="Preview" className="max-h-[90vh] max-w-[90vw] object-contain" style={{ transform: `scale(${scale})` }} />
        <div className="absolute right-2 top-2 flex gap-2">
          <button
            type="button"
            className="rounded bg-white/90 px-3 py-1 text-xs font-semibold text-slate-800 shadow"
            onClick={() => setScale((prev) => Math.max(prev - 0.25, 0.5))}
          >
            –
          </button>
          <button
            type="button"
            className="rounded bg-white/90 px-3 py-1 text-xs font-semibold text-slate-800 shadow"
            onClick={() => setScale(1)}
          >
            100%
          </button>
          <button
            type="button"
            className="rounded bg-white/90 px-3 py-1 text-xs font-semibold text-slate-800 shadow"
            onClick={() => setScale((prev) => Math.min(prev + 0.25, 4))}
          >
            +
          </button>
          <button
            type="button"
            className="rounded bg-white/90 px-3 py-1 text-xs font-semibold text-slate-800 shadow"
            onClick={onClose}
          >
            Esc
          </button>
        </div>
      </div>
    </div>
  );
};

export const OrdersTable = <T extends Order = Order>({
  orders,
  onRowClick,
  columns,
  hideTracking,
  showDesignSubtype,
  designSubtypeLabels,
  primaryUrlSource,
  labelHeader,
  showAssets,
  selectedIds: selectedIdsProp,
  onToggleRow: onToggleRowProp,
  onToggleAll: onToggleAllProp,
}: OrdersTableProps<T>) => {
  const [assetPreview, setAssetPreview] = useState<{ open: boolean; images: string[]; others: string[] }>({ open: false, images: [], others: [] });
  const [internalSelectedIds, setInternalSelectedIds] = useState<Set<string>>(new Set());
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const resolvedColumns = useMemo(() => {
    if (columns) {
      return columns;
    }
    return buildDefaultOrderColumns<T>({
      onOrderClick: onRowClick,
      onImagePreview: (url) => setLightboxSrc(url),
      onAssetsPreview: ({ images, others }) => setAssetPreview({ open: true, images, others }),
      hideTracking,
      showDesignSubtype,
      designSubtypeLabels,
      primaryUrlSource,
      labelHeader,
      showAssets,
    });
  }, [columns, onRowClick, hideTracking, showDesignSubtype, designSubtypeLabels, primaryUrlSource, labelHeader, showAssets]);

  const isControlled = selectedIdsProp !== undefined;
  const selectedIds = isControlled ? selectedIdsProp! : internalSelectedIds;

  const toggleRow = (id: string, checked: boolean) => {
    if (isControlled) {
      onToggleRowProp?.(id, checked);
      return;
    }
    setInternalSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    if (isControlled) {
      onToggleAllProp?.(checked);
      return;
    }
    if (checked) setInternalSelectedIds(new Set(orders.map((o) => o.id)));
    else setInternalSelectedIds(new Set());
  };

  return (
    <>
      <Table
        data={orders}
        onRowClick={onRowClick}
        emptyMessage="No orders found"
        columns={resolvedColumns}
        selectable
        selectedIds={selectedIds}
        onToggleRow={toggleRow}
        onToggleAll={toggleAll}
      />
      <AssetsPreviewModal
        open={assetPreview.open}
        images={assetPreview.images}
        others={assetPreview.others}
        onClose={() => setAssetPreview({ open: false, images: [], others: [] })}
        onImageClick={(url) => setLightboxSrc(url)}
      />
      <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </>
  );
};
