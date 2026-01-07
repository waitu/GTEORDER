import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { Order, OrderStatus, OrderType, PaymentStatus } from '../../api/orders';
import { Table, TableColumn } from '../Table';
import { formatCostText } from '../../lib/pricing';

type OrdersTableProps<T extends Order = Order> = {
  orders: T[];
  onRowClick?: (order: T) => void;
  columns?: TableColumn<T>[];
  hideTracking?: boolean;
  showDesignSubtype?: boolean;
  designSubtypeLabels?: Record<string, string>;
  // Optional controlled selection
  selectedIds?: Set<string>;
  onToggleRow?: (id: string, checked: boolean) => void;
  onToggleAll?: (checked: boolean) => void;
};

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

const formatCurrency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

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

const resolveAssets = (order: Order) => {
  const candidates = [order.resultUrl, order.labelUrl, order.labelImageUrl, ...(order.assetUrls ?? [])].filter(Boolean) as string[];
  const unique = Array.from(new Set(candidates));
  return unique;
};

const isImageUrl = (url: string) => /\.(png|jpe?g|gif|webp)$/i.test(url.split('?')[0]);

type AssetsPreviewPayload<T extends Order = Order> = {
  order: T;
  images: string[];
  others: string[];
};

export const buildDefaultOrderColumns = <T extends Order = Order>(options?: {
  onOrderClick?: (order: T) => void;
  onAssetsPreview?: (payload: AssetsPreviewPayload<T>) => void;
  onImagePreview?: (url: string) => void;
  hideTracking?: boolean;
  showDesignSubtype?: boolean;
  designSubtypeLabels?: Record<string, string>;
}): TableColumn<T>[] => {
  const cols: TableColumn<T>[] = [
    {
      key: 'id',
      header: 'Order ID',
      render: (order) => (
        <button
          type="button"
          className="text-base font-semibold text-slate-900 underline-offset-4 hover:text-slate-600 hover:underline"
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
      render: (order) => (order.trackingCode ? <span className="font-mono text-sm font-semibold text-slate-900">{order.trackingCode}</span> : <span className="text-slate-400">—</span>),
    });
  }

  cols.push(
    {
      key: 'resultUrl',
      header: 'Result',
      render: (order) => {
        const url = order.resultUrl;
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
              <img src={url} alt="Result preview" className="h-full w-full object-cover transition group-hover:scale-105" />
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
      render: (order) => <span className="text-sm font-semibold text-ink">{formatCurrency.format(order.totalCost ?? 0)}</span>,
    },
    {
      key: 'orderStatus',
      header: 'Order Status',
      render: (order) => orderStatusBadge(order.orderStatus),
    },
    {
      key: 'paymentStatus',
      header: 'Payment Status',
      render: (order) => paymentStatusBadge(order.paymentStatus),
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (order) => <span className="text-sm text-slate-700">{formatDate.format(new Date(order.createdAt))}</span>,
    },
    {
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

        if (imageAssets.length > 0) {
          const primary = imageAssets[0];
          const extra = imageAssets.length - 1 + otherAssets.length;
          return (
            <button
              type="button"
              className="group relative inline-flex h-12 w-12 overflow-hidden rounded-lg border border-slate-200 shadow-sm"
              title={assets.join('\n')}
              onClick={(event) => {
                event.stopPropagation();
                options?.onAssetsPreview?.({ order, images: imageAssets, others: otherAssets });
              }}
            >
              <img src={primary} alt="Asset preview" className="h-full w-full object-cover transition group-hover:scale-105" />
              {extra > 0 && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-xs font-semibold text-white">+{extra}</span>
              )}
            </button>
          );
        }

        const primary = assets[0];
        const domain = extractDomain(primary);
        const extra = assets.length - 1;
        const label = `${domain || 'Assets'}${extra > 0 ? ` +${extra}` : ''}`;
        return (
          <button
            type="button"
            className="text-sm font-semibold text-slate-800 underline-offset-4 hover:text-slate-950 hover:underline"
            title={assets.join('\n')}
            onClick={(event) => {
              event.stopPropagation();
              options?.onAssetsPreview?.({ order, images: imageAssets, others: otherAssets });
            }}
          >
            {label}
          </button>
        );
      },
    },
  );

  return cols;
};

const AssetsPreviewModal = ({ open, images, others, onClose, onImageClick }: { open: boolean; images: string[]; others: string[]; onClose: () => void; onImageClick: (url: string) => void }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h4 className="text-lg font-semibold text-ink">Assets</h4>
          <button className="rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-700 hover:border-slate-300" onClick={onClose}>
            Close
          </button>
        </div>
        {images.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Images</p>
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {images.map((url) => (
                <button
                  key={url}
                  type="button"
                  className="group overflow-hidden rounded-lg border border-slate-200 shadow-sm"
                  onClick={() => onImageClick(url)}
                  title={url}
                >
                  <img src={url} alt="Asset" className="h-24 w-full object-cover transition group-hover:scale-105" />
                </button>
              ))}
            </div>
          </div>
        )}

        {others.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Files / Links</p>
            <ul className="mt-2 space-y-2 text-sm">
              {others.map((url) => (
                <li key={url} className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sky-700" title={url}>
                    {url}
                  </span>
                  <div className="flex gap-2 text-[11px] text-slate-500">
                    <a className="rounded border border-slate-200 px-2 py-1 font-semibold hover:border-slate-300" href={url} target="_blank" rel="noreferrer">
                      Open
                    </a>
                    <button
                      type="button"
                      className="rounded border border-slate-200 px-2 py-1 font-semibold hover:border-slate-300"
                      onClick={async () => {
                        try {
                          await navigator?.clipboard?.writeText(url);
                        } catch (error) {
                          /* noop */
                        }
                      }}
                    >
                      Copy
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

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
      onAssetsPreview: ({ images, others }) => setAssetPreview({ open: true, images, others }),
      onImagePreview: (url) => setLightboxSrc(url),
      hideTracking,
      showDesignSubtype,
      designSubtypeLabels,
    });
  }, [columns, onRowClick, hideTracking, showDesignSubtype, designSubtypeLabels]);

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
