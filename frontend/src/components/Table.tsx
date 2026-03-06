import { MouseEvent, ReactNode } from 'react';
import clsx from 'clsx';

export type TableColumn<T> = {
  key: keyof T | string;
  header: string;
  render?: (row: T) => ReactNode;
  className?: string;
};

type TableProps<T> = {
  columns: TableColumn<T>[];
  data: T[];
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleRow?: (id: string, checked: boolean) => void;
  onToggleAll?: (checked: boolean) => void;
};
export function Table<T extends Record<string, any>>({ columns, data, emptyMessage = 'No records', onRowClick, selectable, selectedIds, onToggleRow, onToggleAll }: TableProps<T>) {
  const handleRowClick = (event: MouseEvent<HTMLTableRowElement>, row: T) => {
    if (!onRowClick) return;

    const target = event.target as HTMLElement;

    if (
      target.closest('button, a, input, select, textarea, label, [role="button"], [data-prevent-row-click]') ||
      target.closest('[data-row-content]')
    ) {
      return;
    }

    const selection = window.getSelection?.();
    if (selection && selection.toString().trim().length > 0) {
      return;
    }

    onRowClick(row);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              {selectable && (
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={data.length > 0 && selectedIds != null && data.every((d) => selectedIds.has(d.id))}
                    onChange={(e) => onToggleAll?.(e.target.checked)}
                    onClick={(ev) => ev.stopPropagation()}
                  />
                </th>
              )}
              {columns.map((col) => (
                <th key={col.key as string} className={clsx('px-4 py-3', col.className)}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)} className="px-4 py-6 text-center text-slate-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, idx) => (
                <tr
                  key={idx}
                  className={clsx('hover:bg-slate-50', onRowClick ? 'cursor-pointer' : undefined)}
                  onClick={onRowClick ? (event) => handleRowClick(event, row) : undefined}
                >
                  {selectable && (
                    <td className="px-4 py-3 text-slate-800" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds?.has(row.id)}
                        onChange={(e) => onToggleRow?.(row.id, e.target.checked)}
                        onClick={(ev) => ev.stopPropagation()}
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col.key as string} className={clsx('px-4 py-3 text-slate-800', col.className)}>
                      <span data-row-content className="inline-block max-w-full align-middle">
                        {col.render ? col.render(row) : (row as any)[col.key]}
                      </span>
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
