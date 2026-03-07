import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { AdminLayout } from '../../components/AdminLayout';
import { OrdersFilterBar } from '../../components/orders/OrdersFilterBar';
import { OrdersTable, orderTypeBadge } from '../../components/orders/OrdersTable';
import { AdminOrderDetailModal } from '../../components/orders/AdminOrderDetailModal';
import { ConfirmModal } from '../../components/ConfirmModal';
import { getServiceCostByKey, formatCostText } from '../../lib/pricing';
import { EmptyState } from '../../components/EmptyState';
import { TableColumn } from '../../components/Table';
import {
  AdminOrder,
  AdminOrdersResponse,
  AdminOrdersSummary,
  fetchAdminOrderDetail,
  fetchAdminOrders,
  fetchAdminOrdersSummary,
  updateAdminOrderStatus,
  updateAdminPaymentStatus,
  updateAdminResultUrl,
  updateAdminNote,
  startAdminOrder,
  bulkStartOrders,
  deleteAdminOrder,
} from '../../api/admin';
import { OrderStatus, OrdersQueryParams, PaymentStatus } from '../../api/orders';
import { useToast } from '../../context/ToastProvider';

const ORDER_TYPE_FILTERS = ['active_tracking', 'empty_package', 'design'] as const;
const ORDER_STATUS_FILTERS = ['pending', 'processing', 'completed', 'failed'] as const;
const PAYMENT_STATUS_FILTERS = ['unpaid', 'paid'] as const;
const DEFAULT_LIMIT = 50;
const PAGE_SIZE_OPTIONS = [50, 500, 1000, 2000] as const;
const PAGE_SIZE_STORAGE_KEY = 'orders.pageSize.admin';
const EXPORT_PAGE_SIZE = 200;
const FILTERABLE_KEYS: (keyof OrdersQueryParams)[] = ['orderType', 'orderStatus', 'paymentStatus', 'search', 'from', 'to', 'limit', 'designSubtype'];

const DESIGN_SUBTYPE_OPTIONS = [
  { label: '2D Design', value: 'design_2d' },
  { label: '3D Design', value: 'design_3d' },
  { label: 'Embroidery – Text', value: 'emb_text' },
  { label: 'Embroidery – Image', value: 'emb_image' },
  { label: 'Embroidery – Family Photo', value: 'emb_family' },
  { label: 'Embroidery – Pet Portrait', value: 'emb_pet' },
  { label: 'Sidebow', value: 'sidebow' },
  { label: 'Poster / Canvas', value: 'poster' },
  { label: 'Other', value: 'other_design' },
];

const DESIGN_SUBTYPE_LABELS = DESIGN_SUBTYPE_OPTIONS.reduce<Record<string, string>>((acc, opt) => {
  acc[opt.value] = opt.label;
  return acc;
}, {});

type OrdersView = 'standard' | 'design';

const coerceEnum = <T extends string>(value: string | null, allowed: readonly T[]): T | undefined => {
  if (!value) return undefined;
  return allowed.includes(value as T) ? (value as T) : undefined;
};

const coerceNumber = (value: string | null, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const getStoredPageSize = () => {
  if (typeof window === 'undefined') return DEFAULT_LIMIT;
  const stored = Number(window.localStorage.getItem(PAGE_SIZE_STORAGE_KEY));
  return PAGE_SIZE_OPTIONS.includes(stored as (typeof PAGE_SIZE_OPTIONS)[number]) ? stored : DEFAULT_LIMIT;
};

const detailQueryKey = (id: string) => ['admin', 'orders', 'detail', id] as const;

const copyText = async (value: string) => {
  if (!value.trim()) return;
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch (error) {
    // no-op if clipboard is unavailable
    return false;
  }
};

const normalizeTrackingCode = (value: unknown) =>
  String(value ?? '')
    .trim()
    .replace(/\s+/g, '');

const buildTrackingSummaryFromOrders = (orders: AdminOrder[]) => {
  const codes = Array.from(
    new Set(
      orders
        .map((order) => normalizeTrackingCode(order.trackingCode))
        .filter((code) => code.length > 0),
    ),
  );

  const total = codes.length;
  const firstTail = total > 0 ? codes[0].slice(-2) : '(không có)';
  const lastTail = total > 0 ? codes[total - 1].slice(-2) : '(không có)';
  return { total, firstTail, lastTail };
};

const formatToHoChiMinhTime = (value?: string) => {
  if (!value) return '(không có)';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';

  return `${getPart('hour')}:${getPart('minute')}:${getPart('second')} - ${getPart('day')}/${getPart('month')}/${getPart('year')} (GMT+7)`;
};

const formatUploadInfoText = (upload?: {
  id?: number;
  name?: string;
  status?: string;
  publicUrl?: string;
  createdAt?: string;
}, orders: AdminOrder[] = []) => {
  if (!upload) return '';

  const summary = buildTrackingSummaryFromOrders(orders);
  const lines = [
    'Đã upload PDF lên BYEASTSIDE thành công.',
    `Tổng barcode: ${summary.total}`,
    `2 số cuối đầu tiên: ${summary.firstTail}`,
    `2 số cuối cuối cùng: ${summary.lastTail}`,
    `Public URL: ${upload.publicUrl ?? '(không có)'}`,
    `Created At: ${formatToHoChiMinhTime(upload.createdAt)}`,
  ];

  if (upload.id != null) lines.push(`BYEASTSIDE ID: ${upload.id}`);
  if (upload.name) lines.push(`File Name: ${upload.name}`);
  if (upload.status) lines.push(`Upload Status: ${upload.status}`);
  return lines.join('\n');
};

export const AdminOrdersPage = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();
  const setToast = useCallback(
    (message: string) => {
      const isError = /failed|thất bại|error|could not|không thể/i.test(message);
      showToast({ message, type: isError ? 'error' : 'success' });
    },
    [showToast],
  );
  const [detailId, setDetailId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFrom, setExportFrom] = useState('');
  const [exportTo, setExportTo] = useState('');
  const [exportStatus, setExportStatus] = useState<OrderStatus | 'all'>('all');
  const [exportError, setExportError] = useState<string | null>(null);
  const initialLimit = useMemo(() => getStoredPageSize(), []);
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [pendingPaymentChange, setPendingPaymentChange] = useState<{ orderId: string; paymentStatus: PaymentStatus } | null>(null);
  const view: OrdersView = searchParams.get('view') === 'design' ? 'design' : 'standard';

  const queryState: OrdersQueryParams = useMemo(() => {
    const base: OrdersQueryParams = {
      orderType: coerceEnum(searchParams.get('orderType'), ORDER_TYPE_FILTERS),
      orderStatus: coerceEnum(searchParams.get('orderStatus'), ORDER_STATUS_FILTERS),
      paymentStatus: coerceEnum(searchParams.get('paymentStatus'), PAYMENT_STATUS_FILTERS),
      search: searchParams.get('search') ?? undefined,
      from: searchParams.get('from') ?? undefined,
      to: searchParams.get('to') ?? undefined,
      designSubtype: searchParams.get('designSubtype') ?? undefined,
      page: coerceNumber(searchParams.get('page'), 1),
      limit: coerceNumber(searchParams.get('limit'), initialLimit),
    };
    if (view === 'design') {
      return { ...base, orderType: 'design' };
    }
    const { designSubtype, ...rest } = base;
    const normalized = base.orderType === 'design' ? { ...rest, orderType: undefined } : rest;
    return normalized;
  }, [initialLimit, searchParams]);

  useEffect(() => {
    const limit = queryState.limit;
    if (!PAGE_SIZE_OPTIONS.includes((limit ?? DEFAULT_LIMIT) as (typeof PAGE_SIZE_OPTIONS)[number])) return;
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(limit ?? DEFAULT_LIMIT));
  }, [queryState.limit]);

  const ordersQueryKey = ['admin', 'orders', view, queryState] as const;

  const { data, isLoading, isError, isFetching } = useQuery<AdminOrdersResponse>({
    queryKey: ordersQueryKey,
    queryFn: () => fetchAdminOrders(queryState, view),
  });

  const summaryQuery = useQuery<AdminOrdersSummary>({
    queryKey: ['admin', 'orders', 'summary', view],
    queryFn: () => fetchAdminOrdersSummary(view === 'design' ? { orderType: 'design' } : {}, view),
  });

  const hasActiveFilters = useMemo(() => {
    return FILTERABLE_KEYS.some((key) => {
      if (key === 'limit') {
        return (queryState.limit ?? DEFAULT_LIMIT) !== DEFAULT_LIMIT;
      }
      if (view === 'design' && key === 'orderType') return false;
      const value = queryState[key];
      if (typeof value === 'string') {
        return value.trim().length > 0;
      }
      return Boolean(value);
    });
  }, [queryState, view]);

  const detailQuery = useQuery<AdminOrder>({
    queryKey: detailId ? detailQueryKey(detailId) : ['admin', 'orders', 'detail', 'idle'],
    queryFn: () => (detailId ? fetchAdminOrderDetail(detailId) : Promise.reject()),
    enabled: !!detailId,
  });


  const selectedOrder: AdminOrder | null = detailQuery.data ?? data?.data.find((order) => order.id === detailId) ?? null;

  const updateSearchParams = (patch: Partial<OrdersQueryParams>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        next.delete(key);
      } else {
        next.set(key, String(value));
      }
    });
    setSearchParams(next, { replace: true });
  };

  const handleFiltersChange = (patch: Partial<OrdersQueryParams>) => {
    const cleanedPatch = view === 'design' ? patch : { ...patch, designSubtype: undefined };
    const applied = view === 'design' ? { ...cleanedPatch, orderType: 'design' } : cleanedPatch;
    updateSearchParams({ ...applied, page: 1 } as Partial<OrdersQueryParams>);
  };

  const handlePageChange = (nextPage: number) => {
    updateSearchParams({ page: Math.max(1, nextPage) } as Partial<OrdersQueryParams>);
  };

  const applyFilter = (patch: Partial<OrdersQueryParams>) => {
    handleFiltersChange({ ...patch, page: 1 });
  };

  const handleResetFilters = () => {
    const next = new URLSearchParams();
    next.set('limit', String(DEFAULT_LIMIT));
    next.set('view', view);
    if (view === 'design') next.set('orderType', 'design');
    setSearchParams(next, { replace: true });
  };

  const patchOrderCaches = (order: AdminOrder) => {
    queryClient.setQueryData<AdminOrdersResponse>(ordersQueryKey, (current) => {
      if (!current) return current;
      return {
        ...current,
        data: current.data.map((existing) => (existing.id === order.id ? { ...existing, ...order } : existing)),
      };
    });
    queryClient.setQueryData<AdminOrder>(detailQueryKey(order.id), (current) => (current ? { ...current, ...order } : current));
  };

  const statusMutation = useMutation({
    mutationFn: ({ orderId, orderStatus }: { orderId: string; orderStatus: OrderStatus; silentToast?: boolean }) =>
      updateAdminOrderStatus(orderId, orderStatus),
    onSuccess: (order, variables) => {
      patchOrderCaches(order);
      if (!variables?.silentToast) setToast('Order status updated');
    },
    onError: (_error, variables) => {
      if (!variables?.silentToast) setToast('Failed to update order status');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ordersQueryKey });
    },
  });

  const paymentMutation = useMutation({
    mutationFn: ({ orderId, paymentStatus }: { orderId: string; paymentStatus: PaymentStatus; silentToast?: boolean }) =>
      updateAdminPaymentStatus(orderId, paymentStatus),
    onSuccess: (order, variables) => {
      patchOrderCaches(order);
      if (!variables?.silentToast) setToast('Payment status updated');
    },
    onError: (_error, variables) => {
      if (!variables?.silentToast) setToast('Failed to update payment status');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ordersQueryKey });
    },
  });

  const resultUploadMutation = useMutation({
    mutationFn: ({ orderId, resultUrl }: { orderId: string; resultUrl: string; silentToast?: boolean }) =>
      updateAdminResultUrl(orderId, resultUrl),
    onSuccess: (order, variables) => {
      patchOrderCaches(order);
      if (!variables?.silentToast) setToast('Result updated');
    },
    onError: (_error, variables) => {
      if (!variables?.silentToast) setToast('Failed to update result');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ordersQueryKey });
    },
  });

  const notesMutation = useMutation({
    mutationFn: ({ orderId, notes }: { orderId: string; notes: string; silentToast?: boolean }) =>
      updateAdminNote(orderId, notes),
    onSuccess: (order, variables) => {
      patchOrderCaches(order);
      if (!variables?.silentToast) setToast('Notes saved');
    },
    onError: (_error, variables) => {
      if (!variables?.silentToast) setToast('Failed to save notes');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ordersQueryKey });
    },
  });

  // Composite actions used by the modal: ensure result/note saved before status change
  const completeOrder = async (orderId: string, resultUrl: string) => {
    try {
      await resultUploadMutation.mutateAsync({ orderId, resultUrl, silentToast: true });
      await statusMutation.mutateAsync({ orderId, orderStatus: 'completed', silentToast: true });
    } catch (err) {
      throw err;
    }
  };

  const failOrder = async (orderId: string, adminNote: string) => {
    try {
      await notesMutation.mutateAsync({ orderId, notes: adminNote, silentToast: true });
      await statusMutation.mutateAsync({ orderId, orderStatus: 'failed', silentToast: true });
    } catch (err) {
      throw err;
    }
  };

  const statusUpdatingId = statusMutation.variables?.orderId;
  const paymentUpdatingId = paymentMutation.variables?.orderId;

  const adminColumns: TableColumn<AdminOrder>[] = useMemo(() => {
    const cols: TableColumn<AdminOrder>[] = [
      {
        key: 'id',
        header: 'Order ID',
        render: (order) => (
          <button
            type="button"
            className="w-24 truncate text-left text-sm font-semibold text-slate-900 underline-offset-4 hover:text-slate-600 hover:underline"
            title={order.id}
            onClick={async (event) => {
              event.stopPropagation();
              const copied = await copyText(order.id);
              if (copied) setToast(`Copied Order ID: ${order.id}`);
              else setToast('Could not copy Order ID.');
            }}
          >
            {order.id.slice(0, 8)}
          </button>
        ),
      },
      {
        key: 'userEmail',
        header: 'User Email',
        render: (order) => <span className="text-sm text-slate-800">{order.user?.email ?? '—'}</span>,
      },
      {
        key: 'orderType',
        header: 'Order Type',
        render: (order) => (
          <div className="flex flex-col leading-tight">
            <div>{orderTypeBadge(order.orderType)}</div>
            {order.orderType === 'design' && order.designSubtype && (
              <span className="text-[11px] text-slate-600">{DESIGN_SUBTYPE_LABELS[order.designSubtype] ?? order.designSubtype}</span>
            )}
          </div>
        ),
      },
      {
        key: 'trackingCode',
        header: 'Tracking',
        render: (order) =>
          order.orderType === 'design' ? (
            <span className="text-xs text-slate-400">—</span>
          ) : order.trackingCode ? (
            <div className="group relative inline-flex items-center">
              <button
                type="button"
                className={`font-mono text-sm underline-offset-4 hover:text-slate-600 hover:underline ${order.isDuplicateTracking ? 'rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-900' : 'text-slate-900'}`}
                title={order.isDuplicateTracking ? 'Duplicate tracking detected' : 'Click to copy tracking'}
                onClick={async (event) => {
                  event.stopPropagation();
                  const copied = await copyText(order.trackingCode ?? '');
                  if (copied) setToast(`Copied Tracking Code: ${order.trackingCode}`);
                  else setToast('Could not copy Tracking Code.');
                }}
              >
                {order.trackingCode}
              </button>
              {order.isDuplicateTracking && (
                <span className="pointer-events-none absolute -top-5 right-0 z-10 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100">
                  Duplicate
                </span>
              )}
            </div>
          ) : (
            <span className="text-xs text-slate-400">—</span>
          ),
      },
      {
        key: 'totalCost',
        header: 'TOTAL (credit)',
        render: (order) => <span className="text-sm font-semibold text-ink">{order.totalCost != null ? Number(order.totalCost).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}</span>,
      },
      {
        key: 'orderStatus',
        header: 'Order Status',
        render: (order) => (
          <select
            className="w-32 rounded-lg border border-slate-200 px-3 py-2 text-sm capitalize"
            value={order.orderStatus}
            disabled={statusMutation.isPending && statusUpdatingId === order.id}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => {
              const nextStatus = event.target.value as OrderStatus;
              statusMutation.mutate({ orderId: order.id, orderStatus: nextStatus });
            }}
          >
            {ORDER_STATUS_FILTERS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        ),
      },
      {
        key: 'paymentStatus',
        header: 'Payment',
        render: (order) => (
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${order.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
              {order.paymentStatus}
            </span>
            <button
              className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              onClick={(event) => {
                event.stopPropagation();
                const nextStatus: PaymentStatus = order.paymentStatus === 'paid' ? 'unpaid' : 'paid';
                setPendingPaymentChange({ orderId: order.id, paymentStatus: nextStatus });
              }}
              disabled={paymentMutation.isPending && paymentUpdatingId === order.id}
            >
              {paymentMutation.isPending && paymentUpdatingId === order.id ? 'Saving…' : 'Change'}
            </button>
          </div>
        ),
      },
      {
        key: 'eventSummaries',
        header: 'Event Summaries',
        render: (order) => {
          const summary = (order.adminNote ?? order.internalNotes ?? '').trim();
          return summary ? (
            <span className="line-clamp-2 max-w-[280px] text-xs text-slate-700" title={summary}>
              {summary}
            </span>
          ) : (
            <span className="text-xs text-slate-400">—</span>
          );
        },
      },
      {
        key: 'createdAt',
        header: 'Created',
        render: (order) => <span className="text-sm text-slate-700">{new Date(order.createdAt).toLocaleDateString()}</span>,
      },
      {
        key: 'actions',
        header: 'Actions',
        render: (order) => (
          <div className="flex items-center gap-2">
            <button
              className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              onClick={(event) => {
                event.stopPropagation();
                setDetailId(order.id);
              }}
            >
              View
            </button>
            <button
              className="rounded-lg border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
              onClick={(event) => {
                event.stopPropagation();
                setDeleteConfirmOrder(order);
              }}
            >
              Delete
            </button>
          </div>
        ),
      },
    ];

    if (view === 'design') {
      return cols.filter((col) => col.key !== 'trackingCode');
    }
    return cols;
  }, [paymentMutation.isPending, paymentUpdatingId, setDetailId, statusMutation.isPending, statusUpdatingId, view]);

  const filteredOrders = useMemo(() => {
    if (!data?.data) return [] as AdminOrder[];
    return data.data;
  }, [data?.data]);

  const summary = useMemo(() => {
    const orders = filteredOrders;
    const pending = orders.filter((o) => o.orderStatus === 'pending').length;
    const processing = orders.filter((o) => o.orderStatus === 'processing').length;
    const paid = orders.filter((o) => o.paymentStatus === 'paid').length;
    const unpaid = orders.filter((o) => o.paymentStatus === 'unpaid').length;
    const errorCount = orders.filter((o) => o.orderStatus === 'failed').length;
    const total = data?.meta.total ?? orders.length;
    const localSummary = { total, pending, processing, paid, unpaid, errorCount };
    return summaryQuery.data ?? localSummary;
  }, [filteredOrders, view, data?.meta.total, summaryQuery.data]);

  const exportScope = useMemo<Pick<OrdersQueryParams, 'orderType' | 'designSubtype'>>(() => {
    if (view === 'design') {
      return {
        orderType: 'design',
        designSubtype: queryState.designSubtype,
      };
    }
    return {
      orderType: queryState.orderType,
      designSubtype: undefined,
    };
  }, [queryState.designSubtype, queryState.orderType, view]);

  const fetchAllAdminOrdersForExport = useCallback(async (params: OrdersQueryParams) => {
    let page = 1;
    let total = Number.POSITIVE_INFINITY;
    const collected: AdminOrder[] = [];

    while (collected.length < total) {
      const response = await fetchAdminOrders({ ...params, page, limit: EXPORT_PAGE_SIZE }, view);
      const chunk = response.data ?? [];
      total = response.meta?.total ?? chunk.length;
      collected.push(...chunk);

      if (chunk.length === 0 || chunk.length < EXPORT_PAGE_SIZE) {
        break;
      }

      page += 1;
    }

    return collected;
  }, [view]);

  const triggerAdminCsvDownload = useCallback((rows: AdminOrder[], fileSuffix: string) => {
    const headers = ['Order ID', 'User Email', 'Order Type', 'Tracking Number', 'Order Status', 'Payment Status', 'Event Summaries', 'Created At'];
    const body = rows.map((order) => [
      order.id,
      order.user?.email ?? '',
      order.orderType,
      order.trackingCode ?? '',
      order.orderStatus,
      order.paymentStatus,
      (order.adminNote ?? order.internalNotes ?? '').trim(),
      new Date(order.createdAt).toISOString(),
    ]);
    const escape = (value: string) => {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };
    const csv = [headers, ...body]
      .map((row) => row.map((cell) => escape(String(cell ?? ''))).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `admin_orders_${fileSuffix}_${stamp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const runExport = useCallback(async (mode: 'all' | 'date' | 'status') => {
    setExportError(null);

    if (mode === 'date') {
      if (!exportFrom || !exportTo) {
        setExportError('Please select both From and To dates.');
        return;
      }
      if (new Date(exportFrom) > new Date(exportTo)) {
        setExportError('From date must be before To date.');
        return;
      }
    }

    if (mode === 'status' && exportStatus === 'all') {
      setExportError('Please select a status to export.');
      return;
    }

    setIsExporting(true);
    try {
      const params: OrdersQueryParams = {
        ...exportScope,
      };

      if (mode === 'date') {
        params.from = exportFrom;
        params.to = exportTo;
      }

      if (mode === 'status' && exportStatus !== 'all') {
        params.orderStatus = exportStatus;
      }

      const exportedOrders = await fetchAllAdminOrdersForExport(params);
      if (exportedOrders.length === 0) {
        setExportError('No orders found for selected export options.');
        return;
      }

      const fileSuffix =
        mode === 'all'
          ? view === 'design'
            ? 'design_all'
            : 'all'
          : mode === 'date'
            ? `date_${exportFrom}_to_${exportTo}`
            : `status_${exportStatus}`;

      triggerAdminCsvDownload(exportedOrders, fileSuffix);
      setExportOpen(false);
    } finally {
      setIsExporting(false);
    }
  }, [exportFrom, exportScope, exportStatus, exportTo, fetchAllAdminOrdersForExport, triggerAdminCsvDownload, view]);

  // Selection state for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [bulkStartWithUpload, setBulkStartWithUpload] = useState(false);
  const [bulkConfirmPayload, setBulkConfirmPayload] = useState<{
    total: number;
    perUser: { userId: string | null; email?: string | null; total: number; balance: number }[];
    items: { id: string; label: string; cost: number; userId: string | null; userEmail?: string | null }[];
  } | null>(null);
  const [showSingleConfirm, setShowSingleConfirm] = useState(false);
  const [singleStartWithUpload, setSingleStartWithUpload] = useState(false);
  const [singleConfirmPayload, setSingleConfirmPayload] = useState<null | { orderId: string; cost: number; balance: number; email?: string | null }>(null);
  const [deleteConfirmOrder, setDeleteConfirmOrder] = useState<AdminOrder | null>(null);

  const handleToggleRow = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleToggleAll = (checked: boolean) => {
    if (checked) setSelectedIds(new Set(filteredOrders.map((o) => o.id)));
    else setSelectedIds(new Set());
  };

  const clearSelection = () => setSelectedIds(new Set());

  const selectedList = Array.from(selectedIds);

  // derive selected orders
  const selectedOrders = filteredOrders.filter((o) => selectedIds.has(o.id));

  const canBulkStart = selectedOrders.length > 0 && selectedOrders.every((o) => o.orderStatus === 'pending');

  // Bulk action mutations
  const bulkStartMutation = useMutation({
    mutationFn: (payload: { ids: string[]; uploadTrackingPdf: boolean }) =>
      bulkStartOrders(payload.ids, { uploadTrackingPdf: payload.uploadTrackingPdf }),
    onSuccess: (result, variables) => {
      const startedOrders = result?.orders ?? [];
      startedOrders.forEach((order) => patchOrderCaches(order));

      if (result?.upload) {
        setToast(formatUploadInfoText(result.upload, startedOrders));
      } else if (result?.uploadError) {
        setToast(`Upload BYEASTSIDE thất bại: ${result.uploadError}`);
      } else if (variables?.uploadTrackingPdf) {
        setToast(
          `Đã start processing ${startedOrders.length} order(s).\n` +
            'Upload option đã bật nhưng backend chưa trả upload info. Hãy kiểm tra backend đã deploy bản mới chưa.',
        );
      } else {
        setToast('Started processing for selected orders');
      }

      clearSelection();
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ordersQueryKey }),
  });

  const deleteOrderMutation = useMutation({
    mutationFn: (id: string) => deleteAdminOrder(id),
    onSuccess: (_res, id) => {
      if (detailId === id) setDetailId(null);
      setToast('Order deleted');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ordersQueryKey }),
  });

  const startMutation = useMutation({
    mutationFn: (payload: { id: string; uploadTrackingPdf: boolean }) =>
      startAdminOrder(payload.id, { uploadTrackingPdf: payload.uploadTrackingPdf }),
    onSuccess: (result, variables) => {
      if (result?.order) {
        patchOrderCaches(result.order);
      }

      if (result?.upload) {
        setToast(formatUploadInfoText(result.upload, result.order ? [result.order] : []));
      } else if (result?.uploadError) {
        setToast(`Upload BYEASTSIDE thất bại: ${result.uploadError}`);
      } else if (variables?.uploadTrackingPdf) {
        setToast('Đã start processing. Upload option đã bật nhưng backend chưa trả upload info.');
      } else {
        setToast('Started processing');
      }
    },
    onError: () => setToast('Failed to start order'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ordersQueryKey }),
  });

  const bulkStart = () => {
    if (selectedList.length === 0) return setToast('No orders selected');
    if (!canBulkStart) return setToast('Can only start orders that are pending');

    // build estimate payload
    const items = selectedOrders.map((o) => {
      let cost = 0;
      if (o.paymentStatus === 'paid') {
        cost = 0;
      } else if (o.orderType === 'active_tracking') cost = getServiceCostByKey('scan_label') ?? 0;
      else if (o.orderType === 'empty_package') cost = getServiceCostByKey('empty_package') ?? 0;
      else if (o.orderType === 'design') cost = getServiceCostByKey(o.designSubtype ?? 'design') ?? 0;
      const label = formatCostText(o.designSubtype ?? (o.orderType === 'active_tracking' ? 'scan_label' : o.orderType)) ?? 'Service';
      return { id: o.id, label, cost, userId: o.user?.id ?? null, userEmail: o.user?.email ?? undefined };
    });

    const perUserMap: Record<string, { total: number; balance: number; email?: string | null }> = {};
    items.forEach((it) => {
      const uid = it.userId ?? '__anon__';
      if (!perUserMap[uid]) {
        const user = selectedOrders.find((o) => (o.user?.id ?? null) === it.userId)?.user;
        const balance = Number((user as any)?.creditBalance ?? 0);
        perUserMap[uid] = { total: 0, balance: Number.isFinite(balance) ? balance : 0, email: user?.email ?? null };
      }
      perUserMap[uid].total += it.cost;
    });

    const perUser = Object.entries(perUserMap).map(([uid, v]) => ({ userId: uid === '__anon__' ? null : uid, email: v.email, total: v.total, balance: v.balance }));
    const total = items.reduce((s, it) => s + it.cost, 0);

    setBulkConfirmPayload({ total, perUser, items });
    setBulkStartWithUpload(false);
    setShowBulkConfirm(true);
  };

  const totalCount = data?.meta.total ?? 0;
  const totalPages = data ? Math.max(1, Math.ceil(totalCount / (data.meta.limit ?? queryState.limit ?? DEFAULT_LIMIT))) : 1;
  const currentPage = data?.meta.page ?? queryState.page ?? 1;

  const switchView = (nextView: OrdersView) => {
    if (nextView === view) return;
    const next = new URLSearchParams(searchParams);
    next.set('view', nextView);
    next.set('page', '1');
    if (nextView === 'design') {
      next.set('orderType', 'design');
    } else {
      if (next.get('orderType') === 'design') next.delete('orderType');
      next.delete('designSubtype');
    }
    setSearchParams(next, { replace: true });
  };

  return (
    <AdminLayout title="Orders Management">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {[{
          label: 'Total orders',
          value: summary.total,
          containerClass: 'border border-slate-100 bg-slate-50 hover:border-slate-200',
          labelClass: 'text-slate-600',
          valueClass: 'text-xl text-ink',
          onClick: () => applyFilter({ orderStatus: undefined, paymentStatus: undefined }),
        }, {
          label: 'Pending',
          value: summary.pending,
          containerClass: 'border border-slate-100 bg-slate-50 hover:border-slate-200',
          labelClass: 'text-slate-600',
          valueClass: 'text-xl text-ink',
          onClick: () => applyFilter({ orderStatus: 'pending', paymentStatus: undefined }),
        }, {
          label: 'Processing',
          value: summary.processing,
          containerClass: 'border border-indigo-100 bg-indigo-50 hover:border-indigo-200',
          labelClass: 'text-indigo-700',
          valueClass: 'text-xl text-indigo-900',
          onClick: () => applyFilter({ orderStatus: 'processing', paymentStatus: undefined }),
        }, {
          label: 'Paid',
          value: summary.paid,
          containerClass: 'border border-emerald-100 bg-emerald-50 hover:border-emerald-200',
          labelClass: 'text-emerald-700',
          valueClass: 'text-xl text-emerald-900',
          onClick: () => applyFilter({ orderStatus: undefined, paymentStatus: 'paid' }),
        }, {
          label: 'Payment failed / unpaid',
          value: summary.unpaid,
          containerClass: 'border border-amber-100 bg-amber-50 hover:border-amber-200',
          labelClass: 'text-amber-700',
          valueClass: 'text-xl text-amber-900',
          onClick: () => applyFilter({ orderStatus: undefined, paymentStatus: 'unpaid' }),
        }, {
          label: 'Error orders',
          value: summary.errorCount,
          containerClass: 'border border-rose-100 bg-rose-50 hover:border-rose-200',
          labelClass: 'text-rose-700',
          valueClass: 'text-xl text-rose-900',
          onClick: () => applyFilter({ orderStatus: 'failed', paymentStatus: undefined }),
        }].map((card) => (
          <button
            key={card.label}
            type="button"
            className={`rounded-lg px-4 py-3 text-left shadow-sm transition hover:-translate-y-0.5 ${card.containerClass}`}
            onClick={card.onClick}
          >
            <p className={`text-xs font-semibold uppercase tracking-wide ${card.labelClass}`}>{card.label}</p>
            <p className={`${card.valueClass}`}>{card.value ?? '—'}</p>
          </button>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {[{ key: 'standard', label: 'Orders', value: 'standard' as OrdersView }, { key: 'design', label: 'Design Orders', value: 'design' as OrdersView }].map((tab) => {
          const isActive = view === tab.value;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => switchView(tab.value)}
              className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold shadow-sm transition ${isActive ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-800 hover:border-slate-300'}`}
            >
              {tab.label}
            </button>
          );
        })}

        <button
          type="button"
          className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold shadow-sm ${
            isExporting ? 'border-slate-200 text-slate-400' : 'border-slate-200 text-slate-800 hover:border-slate-300'
          }`}
          onClick={() => {
            if (isExporting) return;
            setExportError(null);
            setExportFrom(queryState.from ?? '');
            setExportTo(queryState.to ?? '');
            setExportStatus(queryState.orderStatus ?? 'all');
            setExportOpen(true);
          }}
          disabled={isExporting}
        >
          {isExporting ? 'Exporting…' : 'Export orders'}
        </button>

        <button
          type="button"
          className={`ml-auto inline-flex h-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:border-slate-300 ${
            isFilterVisible ? 'w-9' : 'w-8'
          }`}
          onClick={() => setIsFilterVisible((prev) => !prev)}
          aria-label={isFilterVisible ? 'Hide filters' : 'Show filters'}
          title={isFilterVisible ? 'Hide filters' : 'Show filters'}
        >
          {isFilterVisible ? (
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
              <path
                d="M5 7h14l-5.5 6v4l-3 1v-5L5 7Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
              <path
                d="M4 6h16M7 12h10M10 18h4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          )}
        </button>
      </div>

      {isFilterVisible && (
        <div className="mt-3">
          <OrdersFilterBar
            values={queryState}
            disabled={isFetching}
            onChange={handleFiltersChange}
            showPageSize={false}
            searchPlaceholder={view === 'design' ? 'Search design orders' : 'Search order ID, tracking code, or user email'}
            showReset={hasActiveFilters}
            onReset={handleResetFilters}
            hideOrderType={view === 'design'}
            orderTypeDisabled={view === 'design'}
            orderTypeOptions={
              view === 'design'
                ? [{ label: 'Design orders', value: 'design' }]
                : [
                    { label: 'All order types', value: '' },
                    { label: 'Active tracking', value: 'active_tracking' },
                    { label: 'Empty package', value: 'empty_package' },
                    { label: 'Other', value: 'other' },
                  ]
            }
            designSubtypeOptions={view === 'design' ? [{ label: 'All design subtypes', value: '' }, ...DESIGN_SUBTYPE_OPTIONS] : undefined}
          />
        </div>
      )}

      <div className="mb-3 mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
        <span className="text-sm font-semibold text-slate-700">{selectedIds.size} orders selected</span>
        <div className="flex items-center gap-2">
        <button
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold shadow-sm ${
            canBulkStart && !bulkStartMutation.isLoading
              ? 'bg-slate-900 text-white hover:bg-slate-800'
              : 'bg-slate-200 text-slate-500'
          }`}
          onClick={bulkStart}
          disabled={!canBulkStart || bulkStartMutation.isLoading}
        >
          {bulkStartMutation.isLoading ? 'Starting…' : `Start Processing${selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}`}
        </button>
        <button className="text-sm text-slate-500 hover:text-slate-700" onClick={() => setSelectedIds(new Set())}>
          Clear selection
        </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        {isLoading && <p className="text-sm text-slate-600">Loading orders…</p>}
        {isFetching && !isLoading && <p className="text-sm text-slate-500">Refreshing results…</p>}
        {isError && !isLoading && <p className="text-sm text-red-700">Could not load orders.</p>}

        {!isLoading && !isError && data && filteredOrders.length > 0 && (
          <OrdersTable<AdminOrder>
              orders={filteredOrders}
              columns={adminColumns}
              onRowClick={(order) => setDetailId(order.id)}
              hideTracking={view === 'design'}
              showDesignSubtype={view === 'design'}
              designSubtypeLabels={DESIGN_SUBTYPE_LABELS}
              selectedIds={selectedIds}
              onToggleRow={handleToggleRow}
              onToggleAll={handleToggleAll}
            />
        )}

        {!isLoading && !isError && data && filteredOrders.length === 0 && (
          <EmptyState
            title={hasActiveFilters ? 'No orders match these filters' : 'No orders available yet'}
            description={hasActiveFilters ? 'Try widening your filters or resetting the date range.' : 'Once orders start flowing in, they will appear here.'}
          />
        )}

        {!isLoading && !isError && data && data.data.length > 0 && (
          <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 text-sm text-slate-700 md:flex-row md:items-center md:justify-between">
            <span>
              Page {currentPage} of {totalPages} · {totalCount} orders total
            </span>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Page size
                <select
                  className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  value={queryState.limit ?? DEFAULT_LIMIT}
                  disabled={isFetching}
                  onChange={(event) => handleFiltersChange({ limit: Number(event.target.value) })}
                >
                  {PAGE_SIZE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}/p
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-50"
                disabled={currentPage <= 1 || isFetching}
                onClick={() => handlePageChange(currentPage - 1)}
              >
                Previous
              </button>
              <button
                className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-50"
                disabled={currentPage >= totalPages || isFetching}
                onClick={() => handlePageChange(currentPage + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {exportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-ink">Export admin orders</h3>
            <p className="mt-1 text-sm text-slate-600">Choose export options. Data is exported from all pages for admin scope.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                From
                <input
                  type="date"
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                  value={exportFrom}
                  onChange={(event) => setExportFrom(event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                To
                <input
                  type="date"
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                  value={exportTo}
                  onChange={(event) => setExportTo(event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Status
                <select
                  className="rounded-md border border-slate-200 px-3 py-2 text-sm capitalize"
                  value={exportStatus}
                  onChange={(event) => setExportStatus(event.target.value as OrderStatus | 'all')}
                >
                  <option value="all">All statuses</option>
                  {ORDER_STATUS_FILTERS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {exportError && <p className="mt-3 text-sm text-rose-700">{exportError}</p>}
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => setExportOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 disabled:bg-slate-400"
                onClick={() => void runExport('all')}
                disabled={isExporting}
              >
                Export all
              </button>
              <button
                type="button"
                className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 disabled:bg-slate-400"
                onClick={() => void runExport('date')}
                disabled={isExporting}
              >
                Export by date
              </button>
              <button
                type="button"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:bg-slate-400"
                onClick={() => void runExport('status')}
                disabled={isExporting}
              >
                Export by status
              </button>
            </div>
          </div>
        </div>
      )}

      <AdminOrderDetailModal
        open={!!detailId}
        order={selectedOrder}
        onClose={() => setDetailId(null)}
        isLoading={detailQuery.isFetching}
        onUpdateStatus={async (status) => {
          if (!detailId) throw new Error('Order not found');
          await statusMutation.mutateAsync({ orderId: detailId, orderStatus: status, silentToast: true });
        }}
        onUpdatePayment={async (status) => {
          if (!detailId) throw new Error('Order not found');
          await paymentMutation.mutateAsync({ orderId: detailId, paymentStatus: status, silentToast: true });
        }}
        onSaveResultUrl={async (resultUrl) => {
          if (!detailId) throw new Error('Order not found');
          await resultUploadMutation.mutateAsync({ orderId: detailId, resultUrl, silentToast: true });
        }}
        onSaveNotes={async (notes) => {
          if (!detailId) throw new Error('Order not found');
          await notesMutation.mutateAsync({ orderId: detailId, notes, silentToast: true });
        }}
        onComplete={(orderId, resultUrl) => completeOrder(orderId, resultUrl)}
        onFail={(orderId, adminNote) => failOrder(orderId, adminNote)}
        onStart={(orderId) => {
          const order = selectedOrder ?? data?.data.find((o) => o.id === orderId);
          if (!order) return setToast('Order not found');
          // compute cost
          let cost = 0;
          if (order.paymentStatus === 'paid') {
            cost = 0;
          } else if (order.orderType === 'active_tracking') cost = getServiceCostByKey('scan_label') ?? 0;
          else if (order.orderType === 'empty_package') cost = getServiceCostByKey('empty_package') ?? 0;
          else if (order.orderType === 'design') cost = getServiceCostByKey(order.designSubtype ?? 'design') ?? 0;
          const balance = Number(((order.user as any)?.creditBalance ?? 0));
          setSingleConfirmPayload({ orderId, cost, balance, email: order.user?.email ?? null });
          setSingleStartWithUpload(false);
          setShowSingleConfirm(true);
        }}
        isStarting={startMutation.isLoading}
        isSavingStatus={statusMutation.isPending && !!detailId}
        isSavingPayment={paymentMutation.isPending && !!detailId}
        isSavingResult={resultUploadMutation.isPending && !!detailId}
        isSavingNotes={notesMutation.isPending && !!detailId}
      />

      <ConfirmModal
        open={!!pendingPaymentChange}
        title={`Change payment status to ${pendingPaymentChange?.paymentStatus ?? ''}?`}
        description="This action will immediately update reporting for this order."
        confirmLabel="Confirm"
        onCancel={() => setPendingPaymentChange(null)}
        onConfirm={() => {
          if (!pendingPaymentChange) return;
          paymentMutation.mutate(pendingPaymentChange);
          setPendingPaymentChange(null);
        }}
      />

      <ConfirmModal
        open={showBulkConfirm}
        title={bulkConfirmPayload ? `Start processing ${bulkConfirmPayload.items.length} order(s)?` : 'Start processing orders?'}
        description={
          bulkConfirmPayload
            ? (() => {
                const chargeUsers = bulkConfirmPayload.perUser.filter((u) => Number(u.total ?? 0) > 0);
                if (Number(bulkConfirmPayload.total ?? 0) <= 0 || chargeUsers.length === 0) {
                  return 'Start processing selected orders.';
                }
                return (
                  `This will deduct ${bulkConfirmPayload.total} credits across ${chargeUsers.length} user(s).` +
                  '\n\n' +
                  chargeUsers.map((u) => `${u.email ?? 'Unknown user'}: ${u.total} credits (balance: ${u.balance})`).join('\n')
                );
              })()
            : 'Start processing selected orders.'
        }
        confirmLabel="Start processing"
        confirmDisabled={
          !!bulkConfirmPayload && bulkConfirmPayload.perUser.some((u) => Number(u.total ?? 0) > 0 && Number(u.balance ?? 0) < Number(u.total ?? 0))
        }
        onCancel={() => {
          setShowBulkConfirm(false);
          setBulkStartWithUpload(false);
          setBulkConfirmPayload(null);
        }}
        extraContent={
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              checked={bulkStartWithUpload}
              onChange={(event) => setBulkStartWithUpload(event.target.checked)}
            />
            Start + upload tracking PDF to BYEASTSIDE
          </label>
        }
        onConfirm={() => {
          setShowBulkConfirm(false);
          const ids = selectedList;
          bulkStartMutation.mutate({ ids, uploadTrackingPdf: bulkStartWithUpload }, {
            onError: (err) => setToast(`Failed to start orders: ${(err as Error).message}`),
            onSuccess: () => {
              setBulkStartWithUpload(false);
              setBulkConfirmPayload(null);
            },
          });
        }}
      />
      <ConfirmModal
        open={showSingleConfirm}
        title={singleConfirmPayload ? `Start processing order ${singleConfirmPayload.orderId}?` : 'Start processing order?'}
        description={
          singleConfirmPayload
            ? Number(singleConfirmPayload.cost ?? 0) > 0
              ? `This will deduct ${singleConfirmPayload.cost} credits from ${singleConfirmPayload.email ?? 'the user'} (balance: ${singleConfirmPayload.balance}).`
              : 'Start processing this order.'
            : 'Start processing this order?'
        }
        confirmLabel="Start processing"
        confirmDisabled={
          !!singleConfirmPayload && Number(singleConfirmPayload.cost ?? 0) > 0 && Number(singleConfirmPayload.balance ?? 0) < Number(singleConfirmPayload.cost ?? 0)
        }
        onCancel={() => {
          setShowSingleConfirm(false);
          setSingleStartWithUpload(false);
          setSingleConfirmPayload(null);
        }}
        extraContent={
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              checked={singleStartWithUpload}
              onChange={(event) => setSingleStartWithUpload(event.target.checked)}
            />
            Start + upload tracking PDF to BYEASTSIDE
          </label>
        }
        onConfirm={() => {
          if (!singleConfirmPayload) return;
          setShowSingleConfirm(false);
          startMutation.mutate({ id: singleConfirmPayload.orderId as string, uploadTrackingPdf: singleStartWithUpload }, {
            onError: (err) => setToast(`Failed to start: ${(err as Error).message}`),
            onSuccess: () => {
              setSingleStartWithUpload(false);
              setSingleConfirmPayload(null);
            },
          });
        }}
      />

      <ConfirmModal
        open={!!deleteConfirmOrder}
        title={deleteConfirmOrder ? `Delete order ${deleteConfirmOrder.id.slice(0, 8)}?` : 'Delete order?'}
        description="This action is permanent and cannot be undone."
        confirmLabel={deleteOrderMutation.isPending ? 'Deleting…' : 'Delete'}
        confirmDisabled={deleteOrderMutation.isPending}
        onCancel={() => {
          if (deleteOrderMutation.isPending) return;
          setDeleteConfirmOrder(null);
        }}
        onConfirm={() => {
          if (!deleteConfirmOrder) return;
          const targetId = deleteConfirmOrder.id;
          deleteOrderMutation.mutate(targetId, {
            onError: (err) => setToast(`Failed to delete: ${(err as Error).message}`),
            onSuccess: () => setDeleteConfirmOrder(null),
          });
        }}
      />
    </AdminLayout>
  );
};
