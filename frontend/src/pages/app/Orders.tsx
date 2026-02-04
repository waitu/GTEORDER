import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '../../components/DashboardLayout';
import { OrdersFilterBar } from '../../components/orders/OrdersFilterBar';
import { OrdersTable, buildDefaultOrderColumns } from '../../components/orders/OrdersTable';
import { EmptyState } from '../../components/EmptyState';
import { fetchOrder, fetchOrders, Order, OrderStatus, OrderType, OrdersQueryParams, OrdersResponse, PaymentStatus, payOrders } from '../../api/orders';
import { OrderDetailModal } from '../../components/orders/OrderDetailModal';
import { ImportLabelsModal } from '../../components/orders/ImportLabelsModal';
import CreateDesignModal from '../../components/orders/CreateDesignModal';
import { ConfirmModal } from '../../components/ConfirmModal';
import { AlertModal } from '../../components/AlertModal';

const ORDER_TYPES: OrderType[] = ['active_tracking', 'empty_package', 'design', 'other'];
const STANDARD_ORDER_TYPES: Array<Extract<OrderType, 'active_tracking' | 'empty_package'>> = ['active_tracking', 'empty_package'];
const ORDER_STATUSES: OrderStatus[] = ['pending', 'processing', 'completed', 'error', 'failed'];
const PAYMENT_STATUSES: PaymentStatus[] = ['unpaid', 'paid'];
const DEFAULT_LIMIT = 20;
const FILTERABLE_KEYS: (keyof OrdersQueryParams)[] = ['orderType', 'orderStatus', 'paymentStatus', 'search', 'from', 'to', 'limit', 'designSubtype'];
const DESIGN_SUBTYPE_OPTIONS = [
  { label: 'Illustration', value: '__label_illustration__' },
  { label: '2D Illustration', value: 'design_2d' },
  { label: '3D Illustration', value: 'design_3d' },
  { label: '—', value: '__divider__' },
  { label: 'Embroidery', value: '__label_embroidery__' },
  { label: 'Embroidery – Text', value: 'emb_text' },
  { label: 'Embroidery – Image', value: 'emb_image' },
  { label: 'Embroidery – Family Photo', value: 'emb_family' },
  { label: 'Embroidery – Pet Portrait', value: 'emb_pet' },
  { label: '—', value: '__divider2__' },
  { label: 'Print & Misc', value: '__label_print__' },
  { label: 'Poster', value: 'poster' },
  { label: 'Canvas Print', value: 'canvas_print' },
  { label: 'Sidebow', value: 'sidebow' },
  { label: 'Other', value: 'other_design' },
];
const DESIGN_SUBTYPE_LABELS = DESIGN_SUBTYPE_OPTIONS.filter((opt) => !opt.value.startsWith('__')).reduce<Record<string, string>>((acc, opt) => {
  acc[opt.value] = opt.label;
  return acc;
}, {});
type OrdersView = 'standard' | 'design';

type StandardOrdersMode = 'active_tracking' | 'empty_package';

const coerceEnum = <T extends string>(value: string | null, allowed: readonly T[]): T | undefined => {
  if (!value) return undefined;
  return allowed.includes(value as T) ? (value as T) : undefined;
};

const coerceNumber = (value: string | null, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const OrdersPageBase = ({ view }: { view: OrdersView }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isCreateDesignOpen, setIsCreateDesignOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [payMessage, setPayMessage] = useState<string | null>(null);
  const [payConfirmOpen, setPayConfirmOpen] = useState(false);
  const [pendingPayIds, setPendingPayIds] = useState<string[]>([]);
  const [payResultOpen, setPayResultOpen] = useState(false);
  const [payResult, setPayResult] = useState<{ paidOrderIds: string[]; unpaidOrderIds: string[] } | null>(null);

  const queryState: OrdersQueryParams = useMemo(() => {
    const base: OrdersQueryParams = {
      orderType: coerceEnum(searchParams.get('orderType'), view === 'design' ? ORDER_TYPES : STANDARD_ORDER_TYPES),
      orderStatus: coerceEnum(searchParams.get('orderStatus'), ORDER_STATUSES),
      paymentStatus: coerceEnum(searchParams.get('paymentStatus'), PAYMENT_STATUSES),
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
    return {
      ...rest,
      // Standard orders always default to a concrete mode (no "All" mode).
      orderType: (rest.orderType as StandardOrdersMode | undefined) ?? 'active_tracking',
    };
  }, [searchParams, view]);

  // Keep URL in sync: if orderType is missing/invalid, force default mode.
  useEffect(() => {
    if (view !== 'standard') return;
    const current = searchParams.get('orderType');
    if (current === 'active_tracking' || current === 'empty_package') return;
    const next = new URLSearchParams(searchParams);
    next.set('orderType', 'active_tracking');
    next.set('page', '1');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, view]);

  const { data, isLoading, isError, isFetching } = useQuery<OrdersResponse>({
    queryKey: ['orders', view, queryState],
    queryFn: () => fetchOrders(queryState),
  });

  const detailQuery = useQuery({
    queryKey: selectedOrderId ? ['orders', 'detail', selectedOrderId] : ['orders', 'detail', 'idle'],
    queryFn: () => (selectedOrderId ? fetchOrder(selectedOrderId) : Promise.reject()),
    enabled: !!selectedOrderId,
  });

  const detailOrder = detailQuery.data ?? selectedOrder;

  const summary = useMemo(() => {
    const orders = (data?.data ?? []) as Order[];
    const visible = view === 'design'
      ? orders.filter((o) => o.orderType === 'design')
      : orders.filter((o) => o.orderType !== 'design');
    const processing = visible.filter((o) => o.orderStatus === 'processing').length;
    const unpaid = visible.filter((o) => o.paymentStatus === 'unpaid').length;
    const errorCount = visible.filter((o) => o.orderStatus === 'error' || o.orderStatus === 'failed').length;
    const total = view === 'design' ? data?.meta.total ?? visible.length : visible.length;
    return { total, processing, unpaid, errorCount };
  }, [data, view]);

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

  const standardMode: StandardOrdersMode = useMemo(() => {
    return queryState.orderType === 'empty_package' ? 'empty_package' : 'active_tracking';
  }, [queryState.orderType]);

  const setStandardMode = (next: StandardOrdersMode) => {
    if (view !== 'standard') return;
    applyFilter({ orderType: next });
  };

  const handleResetFilters = () => {
    const next = new URLSearchParams();
    next.set('limit', String(DEFAULT_LIMIT));
    if (view === 'design') next.set('orderType', 'design');
    if (view === 'standard') next.set('orderType', standardMode);
    setSearchParams(next, { replace: true });
  };

  const currentPage = data?.meta.page ?? queryState.page ?? 1;
  const allOrders = (data?.data ?? []) as Order[];
  const visibleOrders = view === 'design'
    ? allOrders.filter((order) => order.orderType === 'design')
    : allOrders.filter((order) => order.orderType !== 'design');
  const totalCount = view === 'design' ? data?.meta.total ?? visibleOrders.length : visibleOrders.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / (data?.meta.limit ?? queryState.limit ?? DEFAULT_LIMIT)));

  const handleExport = useCallback(() => {
    if (visibleOrders.length === 0) return;
    setIsExporting(true);
    try {
      const headers = ['Order ID', 'Order Type', 'Tracking Number', 'Order Status', 'Payment Status', 'Created At'];
      const rows = visibleOrders.map((order) => [
        order.id,
        order.orderType,
        order.trackingCode ?? '',
        order.orderStatus,
        order.paymentStatus,
        new Date(order.createdAt).toISOString(),
      ]);
      const escape = (value: string) => {
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      };
      const csv = [headers, ...rows]
        .map((row) => row.map((cell) => escape(String(cell ?? ''))).join(','))
        .join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `orders_${date}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }, [visibleOrders]);

  const handleRowClick = useCallback((order: Order) => {
    setSelectedOrder(order);
    setSelectedOrderId(order.id);
    setIsDetailOpen(true);
  }, []);

  // Reset selection when filters/page change.
  useEffect(() => {
    setSelectedIds(new Set());
    setPayMessage(null);
  }, [view, queryState.orderType, queryState.orderStatus, queryState.paymentStatus, queryState.search, queryState.from, queryState.to, queryState.page, queryState.limit, queryState.designSubtype]);

  const unpaidSelectedCount = useMemo(() => {
    if (selectedIds.size === 0) return 0;
    const byId = new Map(visibleOrders.map((o) => [o.id, o] as const));
    let count = 0;
    selectedIds.forEach((id) => {
      const o = byId.get(id);
      if (o?.paymentStatus === 'unpaid') count += 1;
    });
    return count;
  }, [selectedIds, visibleOrders]);

  const payMutation = useMutation({
    mutationFn: (ids: string[]) => payOrders(ids),
    onSuccess: async (res) => {
      setSelectedIds(new Set());
      await queryClient.invalidateQueries({ queryKey: ['orders', view] });
      setPayResult(res);
      setPayResultOpen(true);
      if (res.unpaidOrderIds.length > 0) {
        setPayMessage(`Paid ${res.paidOrderIds.length}. Remaining unpaid: ${res.unpaidOrderIds.length} (insufficient balance).`);
      } else {
        setPayMessage(`Paid ${res.paidOrderIds.length} order(s).`);
      }
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Payment failed';
      setPayMessage(Array.isArray(msg) ? msg.join(', ') : String(msg));
    },
  });

  const toggleRow = useCallback(
    (id: string, checked: boolean) => {
      const order = visibleOrders.find((o) => o.id === id);
      if (!order || order.paymentStatus !== 'unpaid') return;
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (checked) next.add(id);
        else next.delete(id);
        return next;
      });
    },
    [visibleOrders],
  );

  const toggleAll = useCallback(
    (checked: boolean) => {
      if (!checked) {
        setSelectedIds(new Set());
        return;
      }
      setSelectedIds(new Set(visibleOrders.filter((o) => o.paymentStatus === 'unpaid').map((o) => o.id)));
    },
    [visibleOrders],
  );

  const closeDetail = useCallback(() => {
    setIsDetailOpen(false);
    setSelectedOrder(null);
    setSelectedOrderId(null);
  }, []);

  const extractDomain = useCallback((url?: string | null) => {
    if (!url) return '';
    try {
      const parsed = new URL(url);
      return parsed.hostname.replace(/^www\./, '');
    } catch (error) {
      return url.replace(/^https?:\/\//, '').split('/')[0] ?? url;
    }
  }, []);

  return (
    <DashboardLayout title={view === 'design' ? 'Design' : 'Orders'}>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {view === 'standard' && (
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              className={
                standardMode === 'active_tracking'
                  ? 'rounded-md bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white'
                  : 'rounded-md px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50'
              }
              onClick={() => setStandardMode('active_tracking')}
            >
              Active tracking
            </button>
            <button
              type="button"
              className={
                standardMode === 'empty_package'
                  ? 'rounded-md bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white'
                  : 'rounded-md px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50'
              }
              onClick={() => setStandardMode('empty_package')}
            >
              Empty package
            </button>
          </div>
        )}

        {view === 'design' ? (
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
            onClick={() => {
              setIsCreateDesignOpen(true);
            }}
          >
            Create Design
          </button>
        ) : (
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
            onClick={() => setIsImportOpen(true)}
          >
            {view === 'standard'
              ? standardMode === 'active_tracking'
                ? 'Import Active tracking (Excel)'
                : 'Import Empty package (Excel)'
              : 'Import Labels (Excel)'}
          </button>
        )}

        <button
          type="button"
          className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold shadow-sm ${
            visibleOrders.length === 0 || isExporting ? 'border-slate-200 text-slate-400' : 'border-slate-200 text-slate-800 hover:border-slate-300'
          }`}
          onClick={handleExport}
          disabled={visibleOrders.length === 0 || isExporting}
        >
          {isExporting ? 'Exporting…' : 'Export'}
        </button>

        <button
          type="button"
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold shadow-sm ${
            unpaidSelectedCount === 0 || payMutation.isPending
              ? 'bg-slate-200 text-slate-500'
              : 'bg-emerald-600 text-white hover:bg-emerald-700'
          }`}
          onClick={() => {
            const ids = visibleOrders.filter((o) => o.paymentStatus === 'unpaid' && selectedIds.has(o.id)).map((o) => o.id);
            if (ids.length === 0) return;
            setPendingPayIds(ids);
            setPayConfirmOpen(true);
          }}
          disabled={unpaidSelectedCount === 0 || payMutation.isPending}
          title={unpaidSelectedCount === 0 ? 'Select unpaid orders to pay' : undefined}
        >
          {payMutation.isPending ? 'Paying…' : `Pay selected (${unpaidSelectedCount})`}
        </button>
      </div>

      <ConfirmModal
        open={payConfirmOpen}
        title="Confirm payment"
        description={`Pay ${pendingPayIds.length} selected unpaid order(s)?`}
        confirmLabel={payMutation.isPending ? 'Paying…' : 'Pay now'}
        onCancel={() => {
          if (payMutation.isPending) return;
          setPayConfirmOpen(false);
          setPendingPayIds([]);
        }}
        onConfirm={() => {
          if (pendingPayIds.length === 0) return;
          setPayConfirmOpen(false);
          payMutation.mutate(pendingPayIds);
        }}
        confirmDisabled={payMutation.isPending || pendingPayIds.length === 0}
      />

      <AlertModal
        open={payResultOpen}
        title="Payment result"
        onClose={() => {
          setPayResultOpen(false);
          setPayResult(null);
        }}
        description={
          payResult ? (
            <div>
              <div>
                Paid: <span className="font-semibold">{payResult.paidOrderIds.length}</span>
              </div>
              <div className="mt-1">
                Unpaid: <span className="font-semibold">{payResult.unpaidOrderIds.length}</span>
                {payResult.unpaidOrderIds.length > 0 ? ' (insufficient credits)' : ''}
              </div>
              {payResult.unpaidOrderIds.length > 0 && (
                <div className="mt-3">
                  <div className="font-semibold">Unpaid order IDs (first 10)</div>
                  <div className="mt-1 break-all rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
                    {payResult.unpaidOrderIds.slice(0, 10).join(', ')}
                    {payResult.unpaidOrderIds.length > 10 ? '…' : ''}
                  </div>
                </div>
              )}
            </div>
          ) : (
            '—'
          )
        }
      />

      {payMessage && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
          {payMessage}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[{
          label: 'Total orders',
          value: summary.total,
          containerClass: 'border border-slate-100 bg-slate-50 hover:border-slate-200',
          labelClass: 'text-slate-600',
          valueClass: 'text-xl text-ink',
          onClick: () => applyFilter({ orderStatus: undefined, paymentStatus: undefined }),
        }, {
          label: 'Processing',
          value: summary.processing,
          containerClass: 'border border-indigo-100 bg-indigo-50 hover:border-indigo-200',
          labelClass: 'text-indigo-700',
          valueClass: 'text-xl text-indigo-900',
          onClick: () => applyFilter({ orderStatus: 'processing', paymentStatus: undefined }),
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
          onClick: () => applyFilter({ orderStatus: 'error', paymentStatus: undefined }),
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

      <div className="mt-5">
        <OrdersFilterBar
          values={queryState}
          disabled={isFetching}
          onChange={handleFiltersChange}
          showReset={hasActiveFilters}
          onReset={handleResetFilters}
          showPageSize={false}
          searchPlaceholder={view === 'design' ? 'Search design orders' : 'Search order ID or tracking code'}
          orderTypeOptions=
            {view === 'design'
              ? [{ label: 'Design orders', value: 'design' }]
              : [
                  { label: 'All order types', value: '' },
                  { label: 'Active tracking', value: 'active_tracking' },
                  { label: 'Empty package', value: 'empty_package' },
                  { label: 'Other', value: 'other' },
                ]}
          orderTypeDisabled={view === 'design'}
          hideOrderType={view === 'design' || view === 'standard'}
          designSubtypeOptions={
            view === 'design'
              ? [{ label: 'All design subtypes', value: '' }, ...DESIGN_SUBTYPE_OPTIONS]
              : undefined
          }
        />
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        {isLoading && <p className="text-sm text-slate-600">Loading orders…</p>}
        {isFetching && !isLoading && <p className="text-sm text-slate-500">Updating results…</p>}
        {isError && !isLoading && <p className="text-sm text-red-700">Could not load orders right now.</p>}

        {!isLoading && !isError && data && view === 'standard' && (
          <OrdersTable
            orders={visibleOrders}
            onRowClick={handleRowClick}
            columns={buildDefaultOrderColumns({ onOrderClick: handleRowClick })}
            selectedIds={selectedIds}
            onToggleRow={toggleRow}
            onToggleAll={toggleAll}
          />
        )}

        {!isLoading && !isError && data && view === 'design' && (
          <OrdersTable
            orders={visibleOrders}
            onRowClick={handleRowClick}
            hideTracking
            showDesignSubtype
            designSubtypeLabels={DESIGN_SUBTYPE_LABELS}
            selectedIds={selectedIds}
            onToggleRow={toggleRow}
            onToggleAll={toggleAll}
          />
        )}

        {!isLoading && !isError && data && visibleOrders.length === 0 && (
          <EmptyState
            title={hasActiveFilters ? 'No orders match these filters' : 'You have no orders yet'}
            description={hasActiveFilters ? 'Try widening your filters or resetting the date range.' : 'Create your first order to see it listed here.'}
            icon={
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
                  <path
                    d="M5 7.5c0-.83.67-1.5 1.5-1.5H9l1-1.5h4l1 1.5h2.5c.83 0 1.5.67 1.5 1.5V18a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7.5Z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path d="M9 11h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M9 14h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </span>
            }
            action={
              !hasActiveFilters ? (
                <button
                  type="button"
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
                  onClick={() => alert('Create order flow coming soon')}
                >
                  Create your first order
                </button>
              ) : undefined
            }
          />
        )}

        {!isLoading && !isError && data && visibleOrders.length > 0 && (
          <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 text-sm text-slate-700 md:flex-row md:items-center md:justify-between">
            <span>
              Showing page {currentPage} of {totalPages} · {totalCount} orders total
            </span>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Page size
                <select
                  className="w-24 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  value={queryState.limit ?? DEFAULT_LIMIT}
                  disabled={isFetching}
                  onChange={(event) => handleFiltersChange({ limit: Number(event.target.value) })}
                >
                  {[10, 20, 50].map((option) => (
                    <option key={option} value={option}>
                      {option} / page
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
      <OrderDetailModal open={isDetailOpen} order={detailOrder} onClose={closeDetail} isLoading={detailQuery.isFetching} />
      <ImportLabelsModal
        open={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        defaultServiceType={
          view === 'standard'
            ? standardMode === 'active_tracking'
              ? 'active'
              : standardMode === 'empty_package'
                ? 'empty'
                : undefined
            : undefined
        }
        onSubmit={(_rows) => {
          setIsImportOpen(false);
          void queryClient.invalidateQueries({ queryKey: ['orders'], exact: false });
        }}
      />
      <CreateDesignModal open={isCreateDesignOpen} onClose={() => setIsCreateDesignOpen(false)} />
    </DashboardLayout>
  );
};

export const OrdersPage = () => <OrdersPageBase view="standard" />;

export const DesignOrdersPage = () => <OrdersPageBase view="design" />;
