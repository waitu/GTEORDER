import { useEffect, useMemo, useRef, useState } from 'react';
import { OrdersQueryParams } from '../../api/orders';

type OrdersFilterBarProps = {
  values: OrdersQueryParams;
  disabled?: boolean;
  onChange: (update: Partial<OrdersQueryParams>) => void;
  searchPlaceholder?: string;
  showReset?: boolean;
  onReset?: () => void;
  showPageSize?: boolean;
  orderTypeOptions?: { label: string; value: string }[];
  orderTypeDisabled?: boolean;
  hideOrderType?: boolean;
  designSubtypeOptions?: { label: string; value: string }[];
};

const defaultTypeOptions = [
  { label: 'All order types', value: '' },
  { label: 'Active tracking', value: 'active_tracking' },
  { label: 'Empty package', value: 'empty_package' },
  { label: 'Design', value: 'design' },
  { label: 'Other', value: 'other' },
];

const statusOptions = [
  { label: 'All statuses', value: '' },
  { label: 'Pending', value: 'pending' },
  { label: 'Processing', value: 'processing' },
  { label: 'Completed', value: 'completed' },
  { label: 'Error', value: 'error' },
];

const paymentOptions = [
  { label: 'All payments', value: '' },
  { label: 'Unpaid', value: 'unpaid' },
  { label: 'Paid', value: 'paid' },
];

const limitOptions = [10, 20, 50];

const formatRangeLabel = (from?: string, to?: string) => {
  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;
  if (fromDate && toDate && !Number.isNaN(fromDate.getTime()) && !Number.isNaN(toDate.getTime())) {
    const diffDays = Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isToToday = Math.abs(toDate.getTime() - today.getTime()) < 86_400_000;
    if (isToToday && Math.abs(diffDays - 29) <= 2) return 'Date: Last 30 days';
    const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
    return `Date: ${formatter.format(fromDate)} – ${formatter.format(toDate)}`;
  }
  if (fromDate && !Number.isNaN(fromDate.getTime())) return 'Date: From selected';
  if (toDate && !Number.isNaN(toDate.getTime())) return 'Date: Until selected';
  return 'Date: Any time';
};

export const OrdersFilterBar = ({
  values,
  disabled,
  onChange,
  searchPlaceholder,
  showReset,
  onReset,
  showPageSize = true,
  orderTypeOptions,
  orderTypeDisabled,
  hideOrderType,
  designSubtypeOptions,
}: OrdersFilterBarProps) => {
  const handleChange = (field: keyof OrdersQueryParams, value: string) => {
    const sanitized = value || undefined;
    onChange({ [field]: sanitized });
  };

  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const label = useMemo(() => formatRangeLabel(values.from, values.to), [values.from, values.to]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (!popoverRef.current) return;
      if (!popoverRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const applyDates = (from: string, to: string) => {
    handleChange('from', from);
    handleChange('to', to);
    setOpen(false);
  };

  const typeOptions = orderTypeOptions ?? defaultTypeOptions;
  const hasDesignSubtype = Boolean(designSubtypeOptions?.length);
  const gridCols = hideOrderType
    ? hasDesignSubtype
      ? 'md:grid-cols-2 lg:grid-cols-4'
      : 'md:grid-cols-2 lg:grid-cols-3'
    : hasDesignSubtype
    ? 'md:grid-cols-2 lg:grid-cols-4'
    : 'md:grid-cols-2 lg:grid-cols-4';

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 flex-col gap-2 md:flex-row md:items-center">
          <input
            type="search"
            className="w-full max-w-xl rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
            placeholder={searchPlaceholder ?? 'Search order ID or tracking code'}
            value={values.search ?? ''}
            disabled={disabled}
            onChange={(event) => handleChange('search', event.target.value)}
          />
          {showPageSize && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <span className="hidden text-xs font-semibold uppercase tracking-wide text-slate-500 md:inline">Page size</span>
              <select
                className="w-24 rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                value={values.limit ?? 20}
                disabled={disabled}
                onChange={(event) => onChange({ limit: Number(event.target.value) })}
              >
                {limitOptions.map((option) => (
                  <option key={option} value={option}>
                    {option} / page
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        {showReset && onReset && (
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300 hover:bg-white disabled:opacity-50"
            disabled={disabled}
            onClick={onReset}
          >
            Clear filters
          </button>
        )}
      </div>

      <div className={`grid gap-2.5 ${gridCols}`}>
        {hasDesignSubtype && (
          <select
            className="rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
            value={values.designSubtype ?? ''}
            disabled={disabled}
            onChange={(event) => handleChange('designSubtype', event.target.value)}
          >
            {designSubtypeOptions?.map((option) => {
              if (option.value.startsWith('__divider')) {
                return (
                  <option key={option.value} value="" disabled>
                    --------------------
                  </option>
                );
              }
              if (option.value.startsWith('__label')) {
                return (
                  <option key={option.value} value="" disabled>
                    {option.label}
                  </option>
                );
              }
              return (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              );
            })}
          </select>
        )}
        {!hideOrderType && (
          <select
            className="rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
            value={values.orderType ?? ''}
            disabled={disabled || orderTypeDisabled}
            onChange={(event) => handleChange('orderType', event.target.value)}
          >
            {typeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )}
        <select
          className="rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
          value={values.orderStatus ?? ''}
          disabled={disabled}
          onChange={(event) => handleChange('orderStatus', event.target.value)}
        >
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          className="rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
          value={values.paymentStatus ?? ''}
          disabled={disabled}
          onChange={(event) => handleChange('paymentStatus', event.target.value)}
        >
          {paymentOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="relative" ref={popoverRef}>
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300"
            onClick={() => setOpen((v) => !v)}
            disabled={disabled}
          >
            <span className="truncate text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
            <span className="text-xs text-slate-500">▾</span>
          </button>

          {open && (
            <div className="absolute right-0 z-20 mt-2 w-72 rounded-lg border border-slate-200 bg-white p-3 shadow-lg shadow-slate-200/60">
              <div className="space-y-3 text-sm text-slate-700">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">From</label>
                  <input
                    type="date"
                    className="rounded-md border border-slate-200 px-2 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    placeholder="From date"
                    value={values.from ?? ''}
                    disabled={disabled}
                    onChange={(event) => handleChange('from', event.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">To</label>
                  <input
                    type="date"
                    className="rounded-md border border-slate-200 px-2 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    placeholder="To date"
                    value={values.to ?? ''}
                    disabled={disabled}
                    onChange={(event) => handleChange('to', event.target.value)}
                  />
                </div>
                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    className="text-xs font-semibold text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
                    onClick={() => applyDates('', '')}
                  >
                    Clear
                  </button>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
                      onClick={() => setOpen(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
                      onClick={() => applyDates(values.from ?? '', values.to ?? '')}
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
