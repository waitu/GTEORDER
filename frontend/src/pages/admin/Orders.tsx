import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { AdminLayout } from '../../components/AdminLayout';
import { OrdersFilterBar } from '../../components/orders/OrdersFilterBar';
import { OrdersTable, orderTypeBadge } from '../../components/orders/OrdersTable';
import { AdminOrderDetailModal } from '../../components/orders/AdminOrderDetailModal';
import { ConfirmModal } from '../../components/ConfirmModal';
import { getServiceCostByKey, formatCostText } from '../../lib/pricing';
import { EmptyState } from '../../components/EmptyState';
import { ImportLabelsModal, ImportRow } from '../../components/orders/ImportLabelsModal';
import { TableColumn } from '../../components/Table';
import {
  AdminOrder,
  AdminOrdersResponse,
  fetchAdminOrderDetail,
  fetchAdminOrders,
  updateAdminOrderStatus,
  updateAdminPaymentStatus,
  updateAdminResultUrl,
  updateAdminNote,
  startAdminOrder,
  bulkStartOrders,
  bulkFailOrders,
  bulkArchiveOrders,
} from '../../api/admin';
import BulkFailModal from '../../components/admin/BulkFailModal';
import { OrderStatus, OrdersQueryParams, PaymentStatus } from '../../api/orders';

const ORDER_TYPE_FILTERS = ['active_tracking', 'empty_package', 'design'] as const;
const ORDER_STATUS_FILTERS = ['pending', 'processing', 'completed', 'error'] as const;
const PAYMENT_STATUS_FILTERS = ['unpaid', 'paid'] as const;
const DEFAULT_LIMIT = 20;
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

const detailQueryKey = (id: string) => ['admin', 'orders', 'detail', id] as const;

export const AdminOrdersPage = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [toast, setToast] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
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
      limit: coerceNumber(searchParams.get('limit'), DEFAULT_LIMIT),
    };
    if (view === 'design') {
      return { ...base, orderType: 'design' };
    }
    const { designSubtype, ...rest } = base;
    const normalized = base.orderType === 'design' ? { ...rest, orderType: undefined } : rest;
    return normalized;
  }, [searchParams]);

  const ordersQueryKey = ['admin', 'orders', view, queryState] as const;

  const { data, isLoading, isError, isFetching } = useQuery<AdminOrdersResponse>({
    queryKey: ordersQueryKey,
    queryFn: () => fetchAdminOrders(queryState),
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

  const handleImportSubmit = (importRows: ImportRow[]) => {
    setToast(`Import staged for ${importRows.length} row(s) (frontend only)`);
    setImportOpen(false);
  };

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
    mutationFn: ({ orderId, orderStatus }: { orderId: string; orderStatus: OrderStatus }) => updateAdminOrderStatus(orderId, orderStatus),
    onSuccess: (order) => {
      patchOrderCaches(order);
      setToast('Order status updated');
    },
    onError: () => setToast('Failed to update order status'),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ordersQueryKey });
    },
  });

  const paymentMutation = useMutation({
    mutationFn: ({ orderId, paymentStatus }: { orderId: string; paymentStatus: PaymentStatus }) =>
      updateAdminPaymentStatus(orderId, paymentStatus),
    onSuccess: (order) => {
      patchOrderCaches(order);
      setToast('Payment status updated');
    },
    onError: () => setToast('Failed to update payment status'),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ordersQueryKey });
    },
  });

  const resultUploadMutation = useMutation({
    mutationFn: ({ orderId, resultUrl }: { orderId: string; resultUrl: string }) => updateAdminResultUrl(orderId, resultUrl),
    onSuccess: (order) => {
      patchOrderCaches(order);
      setToast('Result updated');
    },
    onError: () => setToast('Failed to update result'),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ordersQueryKey });
    },
  });

  const notesMutation = useMutation({
    mutationFn: ({ orderId, notes }: { orderId: string; notes: string }) => updateAdminNote(orderId, notes),
    onSuccess: (order) => {
      patchOrderCaches(order);
      setToast('Notes saved');
    },
    onError: () => setToast('Failed to save notes'),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ordersQueryKey });
    },
  });

  // Composite actions used by the modal: ensure result/note saved before status change
  const completeOrder = async (orderId: string, resultUrl: string) => {
    try {
      await resultUploadMutation.mutateAsync({ orderId, resultUrl });
      await statusMutation.mutateAsync({ orderId, orderStatus: 'completed' });
      setToast('Order completed');
    } catch (err) {
      setToast('Failed to complete order');
    }
  };

  const failOrder = async (orderId: string, adminNote: string) => {
    try {
      await notesMutation.mutateAsync({ orderId, notes: adminNote });
      await statusMutation.mutateAsync({ orderId, orderStatus: 'failed' });
      setToast('Order marked failed');
    } catch (err) {
      setToast('Failed to mark failed');
    }
  };

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(''), 2000);
    return () => clearTimeout(id);
  }, [toast]);

  const statusUpdatingId = statusMutation.variables?.orderId;
  const paymentUpdatingId = paymentMutation.variables?.orderId;
  const currency = useMemo(() => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }), []);

  const adminColumns: TableColumn<AdminOrder>[] = useMemo(() => {
    const cols: TableColumn<AdminOrder>[] = [
      {
        key: 'id',
        header: 'Order ID',
        render: (order) => (
          <button
            type="button"
            className="text-sm font-semibold text-slate-900 underline-offset-4 hover:text-slate-600 hover:underline"
            onClick={(event) => {
              event.stopPropagation();
              setDetailId(order.id);
            }}
          >
            {order.id}
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
        render: (order) => (order.orderType === 'design' ? <span className="text-xs text-slate-400">—</span> : <span className="font-mono text-sm text-slate-900">{order.trackingCode ?? '—'}</span>),
      },
      {
        key: 'totalCost',
        header: 'Total',
        render: (order) => <span className="text-sm font-semibold text-ink">{currency.format(order.totalCost ?? 0)}</span>,
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
        key: 'createdAt',
        header: 'Created',
        render: (order) => <span className="text-sm text-slate-700">{new Date(order.createdAt).toLocaleDateString()}</span>,
      },
      {
        key: 'actions',
        header: 'Actions',
        render: (order) => (
          <button
            className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            onClick={(event) => {
              event.stopPropagation();
              setDetailId(order.id);
            }}
          >
            View
          </button>
        ),
      },
    ];

    if (view === 'design') {
      return cols.filter((col) => col.key !== 'trackingCode');
    }
    return cols;
  }, [currency, paymentMutation.isPending, paymentUpdatingId, setDetailId, statusMutation.isPending, statusUpdatingId, view]);

  const filteredOrders = useMemo(() => {
    if (!data?.data) return [] as AdminOrder[];
    return view === 'design' ? data.data.filter((o) => o.orderType === 'design') : data.data.filter((o) => o.orderType !== 'design');
  }, [data?.data, view]);

  // Selection state for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showFailModal, setShowFailModal] = useState(false);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [bulkConfirmPayload, setBulkConfirmPayload] = useState<{
    total: number;
    perUser: { userId: string | null; email?: string | null; total: number; balance: number }[];
    items: { id: string; label: string; cost: number; userId: string | null; userEmail?: string | null }[];
  } | null>(null);
  const [showSingleConfirm, setShowSingleConfirm] = useState(false);
  const [singleConfirmPayload, setSingleConfirmPayload] = useState<null | { orderId: string; cost: number; balance: number; email?: string | null }>(null);
  const [archiveConfirm, setArchiveConfirm] = useState<null | { ids: string[] }>(null);

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
  const canBulkFail = selectedOrders.length > 0 && selectedOrders.every((o) => o.orderStatus === 'processing');
  const canBulkArchive = selectedOrders.length > 0 && selectedOrders.every((o) => o.orderStatus === 'completed' || o.orderStatus === 'failed');

  // Bulk action mutations
  const bulkStartMutation = useMutation({
    mutationFn: (ids: string[]) => bulkStartOrders(ids),
    onSuccess: () => {
      setToast('Started processing for selected orders');
      clearSelection();
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ordersQueryKey }),
  });

  const bulkFailMutation = useMutation({
    mutationFn: (payload: { ids: string[]; note: string; refund: boolean }) => bulkFailOrders(payload.ids, payload.note, payload.refund),
    onSuccess: () => {
      setToast('Marked selected orders as failed');
      clearSelection();
      setShowFailModal(false);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ordersQueryKey }),
  });

  const bulkArchiveMutation = useMutation({
    mutationFn: (ids: string[]) => bulkArchiveOrders(ids),
    onSuccess: () => {
      setToast('Archived selected orders');
      clearSelection();
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ordersQueryKey }),
  });

  const startMutation = useMutation({
    mutationFn: (id: string) => startAdminOrder(id),
    onSuccess: (order) => {
      patchOrderCaches(order);
      setToast('Started processing');
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
      if (o.orderType === 'active_tracking') cost = getServiceCostByKey('scan_label') ?? 0;
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
    setShowBulkConfirm(true);
  };

  const onBulkFailClick = () => {
    if (selectedList.length === 0) return setToast('No orders selected');
    if (!canBulkFail) return setToast('Can only mark failed orders that are in processing');
    setShowFailModal(true);
  };

  const submitBulkFail = (adminNote: string, refund: boolean) => {
    bulkFailMutation.mutate({ ids: selectedList, note: adminNote, refund }, { onError: (err) => setToast(`Failed to mark failed: ${(err as Error).message}`) });
  };

  const bulkArchive = () => {
    if (selectedList.length === 0) return setToast('No orders selected');
    if (!canBulkArchive) return setToast('Can only archive orders that are completed or failed');
    setArchiveConfirm({ ids: selectedList });
  };

  const totalCount = filteredOrders.length;
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
      {toast && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800">
          {toast}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {[{ key: 'standard', label: 'Orders', value: 'standard' as OrdersView }, { key: 'design', label: 'Design Orders', value: 'design' as OrdersView }].map((tab) => {
            const isActive = view === tab.value;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => switchView(tab.value)}
                className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-left text-sm font-semibold shadow-sm transition ${isActive ? 'border-slate-900 bg-slate-900 text-white shadow' : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300'}`}
              >
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          onClick={() => setImportOpen(true)}
        >
          Import Labels
        </button>
      </div>

      <OrdersFilterBar
        values={queryState}
        disabled={isFetching}
        onChange={handleFiltersChange}
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

      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm font-semibold">{selectedIds.size} orders selected</span>
        <button
          className="rounded-lg border border-slate-200 px-3 py-1 text-sm"
          onClick={bulkStart}
          disabled={!canBulkStart || bulkStartMutation.isLoading}
        >
          Start processing
        </button>
        <button
          className="rounded-lg border border-slate-200 px-3 py-1 text-sm"
          onClick={onBulkFailClick}
          disabled={!canBulkFail || bulkFailMutation.isLoading}
        >
          Mark failed
        </button>
        <button
          className="rounded-lg border border-slate-200 px-3 py-1 text-sm"
          onClick={bulkArchive}
          disabled={!canBulkArchive || bulkArchiveMutation.isLoading}
        >
          Archive
        </button>
        <button className="ml-2 text-sm text-slate-500" onClick={() => setSelectedIds(new Set())}>
          Clear
        </button>
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
            <div className="flex items-center gap-2">
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

      <ImportLabelsModal open={importOpen} onClose={() => setImportOpen(false)} onSubmit={handleImportSubmit} />

      <BulkFailModal open={showFailModal} onClose={() => setShowFailModal(false)} onConfirm={submitBulkFail} />

      <AdminOrderDetailModal
        open={!!detailId}
        order={selectedOrder}
        onClose={() => setDetailId(null)}
        isLoading={detailQuery.isFetching}
        onUpdateStatus={(status) => {
          if (!detailId) return;
          statusMutation.mutate({ orderId: detailId, orderStatus: status });
        }}
        onUpdatePayment={(status) => {
          if (!detailId) return;
          paymentMutation.mutate({ orderId: detailId, paymentStatus: status });
        }}
        onSaveResultUrl={(resultUrl) => {
          if (!detailId) return;
          resultUploadMutation.mutate({ orderId: detailId, resultUrl });
        }}
        onSaveNotes={(notes) => {
          if (!detailId) return;
          notesMutation.mutate({ orderId: detailId, notes });
        }}
        onComplete={(orderId, resultUrl) => completeOrder(orderId, resultUrl)}
        onFail={(orderId, adminNote) => failOrder(orderId, adminNote)}
        onStart={(orderId) => {
          const order = selectedOrder ?? data?.data.find((o) => o.id === orderId);
          if (!order) return setToast('Order not found');
          // compute cost
          let cost = 0;
          if (order.orderType === 'active_tracking') cost = getServiceCostByKey('scan_label') ?? 0;
          else if (order.orderType === 'empty_package') cost = getServiceCostByKey('empty_package') ?? 0;
          else if (order.orderType === 'design') cost = getServiceCostByKey(order.designSubtype ?? 'design') ?? 0;
          const balance = Number(((order.user as any)?.creditBalance ?? 0));
          setSingleConfirmPayload({ orderId, cost, balance, email: order.user?.email ?? null });
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
            ? `This will deduct ${bulkConfirmPayload.total} credits across ${bulkConfirmPayload.perUser.length} user(s).` +
              '\n\n' +
              bulkConfirmPayload.perUser
                .map((u) => `${u.email ?? 'Unknown user'}: ${u.total} credits (balance: ${u.balance})`)
                .join('\n')
            : 'Start processing selected orders.'
        }
        confirmLabel="Start processing"
        confirmDisabled={
          !!bulkConfirmPayload && bulkConfirmPayload.perUser.some((u) => Number(u.balance ?? 0) < Number(u.total ?? 0))
        }
        onCancel={() => {
          setShowBulkConfirm(false);
          setBulkConfirmPayload(null);
        }}
        onConfirm={() => {
          setShowBulkConfirm(false);
          const ids = selectedList;
          bulkStartMutation.mutate(ids, {
            onError: (err) => setToast(`Failed to start orders: ${(err as Error).message}`),
            onSuccess: () => {
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
            ? `This will deduct ${singleConfirmPayload.cost} credits from ${singleConfirmPayload.email ?? 'the user'} (balance: ${singleConfirmPayload.balance}).`
            : 'Start processing this order?'
        }
        confirmLabel="Start processing"
        confirmDisabled={!!singleConfirmPayload && Number(singleConfirmPayload.balance ?? 0) < Number(singleConfirmPayload.cost ?? 0)}
        onCancel={() => {
          setShowSingleConfirm(false);
          setSingleConfirmPayload(null);
        }}
        onConfirm={() => {
          if (!singleConfirmPayload) return;
          setShowSingleConfirm(false);
          startMutation.mutate(singleConfirmPayload.orderId as string, {
            onError: (err) => setToast(`Failed to start: ${(err as Error).message}`),
            onSuccess: () => setSingleConfirmPayload(null),
          });
        }}
      />

      <ConfirmModal
        open={!!archiveConfirm}
        title={archiveConfirm ? `Archive ${archiveConfirm.ids.length} order(s)?` : 'Archive orders?'}
        description="This hides them from the main list."
        confirmLabel="Archive"
        onCancel={() => setArchiveConfirm(null)}
        onConfirm={() => {
          if (!archiveConfirm) return;
          const ids = archiveConfirm.ids;
          setArchiveConfirm(null);
          bulkArchiveMutation.mutate(ids, { onError: (err) => setToast(`Failed to archive: ${(err as Error).message}`) });
        }}
      />
    </AdminLayout>
  );
};
