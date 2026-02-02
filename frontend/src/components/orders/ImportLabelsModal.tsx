import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { useQueryClient } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { fetchPricing } from '../../api/pricing';
import { getServiceCostByKey } from '../../lib/pricing';
import { http } from '../../api/http';

export type ImportRow = {
  id: string;
  labelFileUrl?: string;
  serviceType?: 'scan' | 'active' | 'empty';
  trackingNumber?: string;
  status: 'valid' | 'invalid';
  error?: string;
  source: 'excel';
};

export type ImportLabelsModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit?: (rows: ImportRow[]) => void;
  isSubmitting?: boolean;
  defaultServiceType?: 'active' | 'empty';
};

const acceptSheets = '.csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel';

const makeId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

const validateRow = (row: ImportRow): ImportRow => {
  let error: string | undefined;
  if (!row.serviceType) error = 'serviceType required';
  else if (!row.labelFileUrl?.trim()) error = 'labelFileUrl required';
  else if (row.serviceType === 'scan') error = 'Scan is temporarily disabled';
  else if (row.serviceType !== 'scan' && !row.trackingNumber?.trim()) error = 'trackingNumber required';
  return { ...row, status: error ? 'invalid' : 'valid', error };
};

const mapExcelRow = (row: Record<string, any>, index: number, defaultServiceType?: ImportRow['serviceType']): ImportRow => {
  // Legacy client-side parsing kept for template preview only.
  const serviceRaw = row.serviceType ?? row.type ?? row.service ?? row['Service Type'] ?? row['service type'] ?? '';
  const serviceText = String(serviceRaw ?? '').trim().toLowerCase();
  const serviceType: ImportRow['serviceType'] = serviceText.includes('active')
    ? 'active'
    : serviceText.includes('empty')
      ? 'empty'
      : serviceText.includes('scan')
        ? 'scan'
        : defaultServiceType;

  const labelRaw = row.label ?? row.url ?? row.labelFileUrl ?? row['Label'] ?? row['URL'] ?? '';
  const labelFileUrl = String(labelRaw ?? '').trim();

  const trackingRaw = row.trackingNumber ?? row.tracking ?? row['Tracking Number'] ?? row['tracking number'] ?? '';
  const trackingNumber = String(trackingRaw ?? '').trim();

  return validateRow({
    id: makeId(),
    serviceType,
    labelFileUrl: labelFileUrl || undefined,
    trackingNumber: trackingNumber || undefined,
    status: 'valid',
    source: 'excel',
  });
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const downloadTemplateXlsx = (defaultServiceType?: 'active' | 'empty') => {
  const rows = defaultServiceType
    ? [{ label: 'https://example.com/label.pdf', trackingNumber: '9400000000000000000000' }]
    : [
        { label: 'https://example.com/label.pdf', serviceType: 'active', trackingNumber: '9400000000000000000000' },
        { label: 'https://example.com/label.pdf', serviceType: 'empty', trackingNumber: 'EA123456789US' },
      ];
  const header = defaultServiceType ? ['label', 'trackingNumber'] : ['label', 'serviceType', 'trackingNumber'];
  const ws = XLSX.utils.json_to_sheet(rows, { header });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'trackings');
  const arrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const suffix = defaultServiceType ? `_${defaultServiceType}` : '';
  downloadBlob(new Blob([arrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `label_import_template${suffix}.xlsx`);
};

const downloadTemplateCsv = (defaultServiceType?: 'active' | 'empty') => {
  const headers = defaultServiceType ? ['label', 'trackingNumber'] : ['label', 'serviceType', 'trackingNumber'];
  const rows = defaultServiceType
    ? [['https://example.com/label.pdf', '9400000000000000000000']]
    : [
        ['https://example.com/label.pdf', 'active', '9400000000000000000000'],
        ['https://example.com/label.pdf', 'empty', 'EA123456789US'],
      ];
  const csv = [headers, ...rows]
    .map((r) => r.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const suffix = defaultServiceType ? `_${defaultServiceType}` : '';
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `label_import_template${suffix}.csv`);
};

export const ImportLabelsModal = ({ open, onClose, onSubmit, isSubmitting, defaultServiceType }: ImportLabelsModalProps) => {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [localSubmitting, setLocalSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [serverResult, setServerResult] = useState<any>(null);
  const excelInputRef = useRef<HTMLInputElement | null>(null);
  const queryClient = useQueryClient();

  const pushLog = (_msg: string, _data?: any) => {
    // no-op in production UI to avoid noisy logs
  };

  useEffect(() => {
    return () => {};
  }, []);

  const validCount = rows.filter((r) => r.status === 'valid').length;
  const totalCount = rows.length;
  const errorCount = rows.filter((r) => r.status === 'invalid').length;
  const canSubmit = totalCount > 0 && errorCount === 0 && !isSubmitting;
  const estimatedCredits = rows.reduce((sum, r) => {
    if (r.status !== 'valid') return sum;
    const key = r.serviceType === 'empty' ? 'empty_package' : 'scan_label';
    const cost = getServiceCostByKey(key);
    return sum + (cost ?? 0);
  }, 0);

  // fetch pricing to estimate USD value per credit (use cheapest package per-credit price)
  const { data: pricingData } = useQuery({ queryKey: ['pricing'], queryFn: fetchPricing });
  const perCreditUsd = useMemo(() => {
    const packages = pricingData?.topupPackages ?? {};
    const vals = Object.values(packages)
      .filter((p) => p.credits > 0)
      .map((p) => (p.price / p.credits));
    if (vals.length === 0) return null;
    return Math.min(...vals);
  }, [pricingData]);
  const estimatedUsd = perCreditUsd != null ? estimatedCredits * perCreditUsd : null;

  const clearAll = () => {
    setRows([]);
    setError(null);
    setPreviewId(null);
    setServerResult(null);
  };

  const handleSheet = async (fileList: FileList | null) => {
    if (!fileList?.length) return;
    setError(null);
    const file = fileList[0];
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (defaultServiceType) {
        fd.append('serviceType', defaultServiceType);
      }
      const { data } = await http.post('/labels/import/excel', fd);
      setPreviewId(data.previewId ?? null);
      setServerResult(data);
      const mapped: ImportRow[] = (data.previewSample ?? []).map((r: any, idx: number) => {
        const serviceText = String(r.serviceType ?? '').toLowerCase();
        const serviceType: ImportRow['serviceType'] = serviceText.includes('active')
          ? 'active'
          : serviceText.includes('empty')
            ? 'empty'
            : serviceText.includes('scan')
              ? 'scan'
              : undefined;
        return validateRow({
          id: makeId(),
          labelFileUrl: r.labelFileUrl ?? undefined,
          serviceType,
          trackingNumber: r.trackingNumber ? String(r.trackingNumber) : undefined,
          status: r.status === 'valid' ? 'valid' : 'invalid',
          error: r.error,
          source: 'excel',
        });
      });
      setRows(mapped);
    } catch (err: any) {
      setError(err?.message || 'Could not parse the spreadsheet.');
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setError(null);
    setLocalSubmitting(true);
    try {
      if (!previewId) throw new Error('No preview available. Upload a sheet first.');
      const { data } = await http.post('/labels/import/excel/confirm', { previewId });
      setServerResult(data);
      setNotification({ type: 'success', message: `Imported ${data.created ?? 0} labels, failed ${data.failed ?? 0}` });
      // Invalidate orders queries so Orders page refreshes (non-exact to include filtered keys)
      void queryClient.invalidateQueries({ queryKey: ['orders'], exact: false });
      onSubmit?.(rows);
      // reset modal state and close
      clearAll();
      onClose();
    } catch (err: any) {
      const msg = err?.message || 'Upload failed';
      setError(msg);
      setNotification({ type: 'error', message: msg });
    } finally {
      setLocalSubmitting(false);
    }
  };

  useEffect(() => {
    if (!notification) return;
    const t = setTimeout(() => setNotification(null), 4000);
    return () => clearTimeout(t);
  }, [notification]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-8">
      <div className="w-full max-w-6xl rounded-2xl bg-white p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Import labels</p>
            <h3 className="text-2xl font-semibold text-ink">Excel Import</h3>
            <p className="text-sm text-slate-600">Bulk import via Excel/CSV. Carrier is fixed to USPS.</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
              onClick={clearAll}
              disabled={isSubmitting || rows.length === 0}
            >
              Clear all
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Close
            </button>
          </div>
        </div>

        {/* Notification toast */}
        {notification && (
          <div className={`fixed top-6 right-6 z-60 rounded-md px-4 py-3 shadow-lg ${notification.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
            <div className="text-sm font-semibold">{notification.type === 'success' ? 'Import successful' : 'Import error'}</div>
            <div className="text-xs mt-1">{notification.message}</div>
          </div>
        )}

            {
          <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-2 text-sm text-slate-700">
                  <p className="font-semibold">Upload .xlsx or .csv</p>
                  {defaultServiceType ? (
                    <p className="text-xs text-slate-500">
                      Importing as <span className="font-semibold">{defaultServiceType}</span>. Required columns: <span className="font-semibold">label</span> (or url) and <span className="font-semibold">trackingNumber</span>.
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Required columns: <span className="font-semibold">label</span> (or url) and <span className="font-semibold">serviceType</span>. For <span className="font-semibold">active</span> / <span className="font-semibold">empty</span>, <span className="font-semibold">trackingNumber</span> is required.
                    </p>
                  )}
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:border-slate-400"
                  onClick={() => excelInputRef.current?.click()}
                  disabled={isSubmitting}
                >
                  Upload sheet
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:border-slate-400"
                  onClick={() => downloadTemplateXlsx(defaultServiceType)}
                  disabled={isSubmitting}
                >
                  Download template (.xlsx)
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:border-slate-400"
                  onClick={() => downloadTemplateCsv(defaultServiceType)}
                  disabled={isSubmitting}
                >
                  Download template (.csv)
                </button>
                <input
                  ref={excelInputRef}
                  type="file"
                  className="hidden"
                  accept={acceptSheets}
                  onChange={(event) => {
                    handleSheet(event.target.files);
                    if (event.target) event.target.value = '';
                  }}
                  disabled={isSubmitting}
                />
              </div>
            </div>
            {/* debug logs removed from UI to reduce noise */}
          </div>
            }

            {rows.length > 0 && (
          <div className="mt-6 overflow-x-auto">
            <div className="flex flex-col gap-3 pb-2 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-slate-700">
                Valid rows: <span className="font-semibold text-emerald-700">{validCount}</span> · Errors: <span className="font-semibold text-rose-700">{errorCount}</span> · Total: <span className="font-semibold">{totalCount}</span>
                {validCount > 0 && (
                  <span className="ml-3 text-slate-600">Estimated credits: <span className="font-semibold">{estimatedCredits.toFixed(2)}</span></span>
                )}
              </div>
            </div>

            <table className="w-full min-w-[720px] border-collapse overflow-hidden rounded-xl border border-slate-200 text-sm shadow-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left">Label URL</th>
                  <th className="px-3 py-2 text-left">Service Type</th>
                  <th className="px-3 py-2 text-left">Tracking Number</th>
                  <th className="px-3 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  return (
                    <tr key={row.id} className={row.status === 'invalid' ? 'bg-rose-50' : 'bg-white'}>
                      <td className="px-3 py-2 align-middle">
                        {row.labelFileUrl ? (
                          <a className="text-sm text-sky-700 hover:underline" href={row.labelFileUrl} target="_blank" rel="noreferrer">
                            {row.labelFileUrl}
                          </a>
                        ) : (
                          <span className="text-sm text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <span className="text-sm text-slate-700">{row.serviceType ?? '—'}</span>
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <span className="text-sm text-slate-700">{row.trackingNumber ?? '—'}</span>
                      </td>
                      <td className="px-3 py-2 align-middle">
                        {row.status === 'valid' ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">Valid</span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-800">{row.error ?? 'Invalid'}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {error && <p className="mt-3 text-sm text-rose-700">{error}</p>}

            <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-4 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-slate-700">
            {totalCount === 0 ? 'No rows uploaded yet.' : `${validCount} valid · ${errorCount} errors · ${totalCount} total`}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className={`rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm ${
                canSubmit ? 'bg-slate-900 hover:bg-slate-800' : 'bg-slate-400'
              }`}
              onClick={() => { if (canSubmit) setConfirmOpen(true); }}
              disabled={!canSubmit || localSubmitting}
            >
              {(isSubmitting || localSubmitting) ? 'Starting…' : 'Start Import'}
            </button>
          </div>
        </div>
        <div className="mt-2 text-xs text-slate-500">Credits will be deducted when admin starts processing.</div>
        <div className="mt-2 text-sm text-slate-700">Estimated credits: <span className="font-semibold">{estimatedCredits.toFixed(2)}</span></div>
        {estimatedUsd != null && (
          <div className="mt-1 text-sm text-slate-600">(~{estimatedUsd.toLocaleString(undefined, { style: 'currency', currency: 'USD' })})</div>
        )}
        {/* Show concise server result summary, avoid noisy raw logs */}
        {/* {serverResult && (
          <div className="mt-4 rounded border border-slate-200 bg-slate-50 p-3 text-sm">
            <div className="font-semibold">Import result</div>
            <div className="mt-2 text-sm">
              {typeof serverResult === 'object' && (serverResult.created != null || serverResult.failed != null) ? (
                <>
                  <div>Imported <span className="font-semibold">{serverResult.created ?? 0}</span> labels</div>
                  <div>Failed <span className="font-semibold">{serverResult.failed ?? 0}</span></div>
                </>
              ) : (
                <div>{String(serverResult)}</div>
              )}
            </div>
          </div>
        )} */}
      </div>
      {confirmOpen && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold">Confirm import</h3>
            <p className="mt-2 text-sm text-slate-700">You are about to import <span className="font-semibold">{rows.length}</span> rows ({validCount} valid). This will deduct <span className="font-semibold">{estimatedCredits.toFixed(2)}</span> credits</p>
            {estimatedUsd != null && (
              <p className="mt-1 text-sm text-slate-600">Estimated cost: <span className="font-semibold">{estimatedUsd.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</span></p>
            )}
            <div className="mt-4 flex justify-end gap-3">
              <button className="rounded-lg border px-4 py-2" onClick={() => setConfirmOpen(false)}>Cancel</button>
              <button className="rounded-lg bg-ink px-4 py-2 text-white" onClick={async () => { setConfirmOpen(false); await handleSubmit(); }}>
                Confirm and Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
