import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { http } from '../../api/http';
import { useQueryClient } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { fetchPricing } from '../../api/pricing';
import { formatCostText, getServiceCostByKey } from '../../lib/pricing';

export type ServiceType = 'scan_label' | 'active_tracking' | 'empty_package';

export type ImportRow = {
  id: string;
  filename: string;
  serviceType: ServiceType;
  trackingNumber?: string;
  carrier?: string;
  status: 'valid' | 'invalid';
  error?: string;
  source: 'upload' | 'excel';
  file?: File;
  previewUrl?: string;
};

export type ImportLabelsModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit?: (rows: ImportRow[]) => void;
  isSubmitting?: boolean;
};

type Tab = 'image' | 'excel';

const SERVICE_OPTIONS: { label: string; value: ServiceType }[] = [
  { label: 'Scan Label', value: 'scan_label' },
  { label: 'Active Tracking', value: 'active_tracking' },
  { label: 'Empty Package', value: 'empty_package' },
];

const acceptImages = 'application/pdf,image/png,image/jpeg';
const acceptSheets = '.csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel';

const makeId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

const validateRow = (row: ImportRow): ImportRow => {
  let error: string | undefined;
  if (!row.filename?.trim()) {
    error = 'Label is required';
  }
  if (row.serviceType !== 'scan_label') {
    if (!row.trackingNumber?.trim() || !row.carrier?.trim()) {
      error = 'Tracking number and carrier are required';
    }
  }
  return { ...row, status: error ? 'invalid' : 'valid', error };
};

const coerceService = (value?: string | null): ServiceType => {
  const normalized = (value ?? '').toLowerCase().replace(/\s+/g, '_');
  if (normalized.includes('active')) return 'active_tracking';
  if (normalized.includes('empty')) return 'empty_package';
  if (normalized.includes('scan')) return 'scan_label';
  if (normalized.includes('track')) return 'active_tracking';
  return 'scan_label';
};

const fileToRow = async (file: File): Promise<ImportRow> => {
  // Create a preview URL for images and PDFs so user can open them in a new tab
  const previewUrl = file.type.startsWith('image/') || file.type === 'application/pdf' ? URL.createObjectURL(file) : undefined;
  return validateRow({
    id: makeId(),
    filename: file.name,
    serviceType: 'scan_label',
    trackingNumber: '',
    carrier: '',
    status: 'valid',
    source: 'upload',
    file,
    previewUrl,
  });
};

const mapExcelRow = (row: Record<string, any>, index: number): ImportRow => {
  const filename = (row.label || row.filename || row.name || `Row ${index + 1}`).toString();
  // support many header variants (Type, serviceType, Service Type)
  const serviceField = row.serviceType ?? row['Service Type'] ?? row['service type'] ?? row.Type ?? row['Type'] ?? row.type ?? row.service ?? '';
  const serviceType = coerceService(String(serviceField));
  // support headers with spaces and different casing for tracking/carrier; coerce to strings
  const trackingRaw = row.trackingNumber ?? row['Tracking Number'] ?? row['tracking number'] ?? row.tracking ?? row.code ?? '';
  const carrierRaw = row.carrier ?? row['Tracking Carrier'] ?? row['tracking carrier'] ?? row.courier ?? row.provider ?? '';
  const trackingNumber = trackingRaw === undefined || trackingRaw === null ? '' : String(trackingRaw).trim();
  const carrier = carrierRaw === undefined || carrierRaw === null ? '' : String(carrierRaw).trim();

  const mapped = {
    id: makeId(),
    filename,
    serviceType,
    trackingNumber: trackingNumber.trim() || undefined, // Ensure empty strings are undefined
    carrier: carrier.trim() || undefined, // Ensure empty strings are undefined
    status: 'valid' as const,
    source: 'excel' as const,
  };

  return validateRow(mapped);
};

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const PreviewCell = ({ row }: { row: ImportRow }) => {
  if (row.previewUrl) {
    const isPdf = (row.file?.type === 'application/pdf') || row.filename.toLowerCase().endsWith('.pdf') || String(row.previewUrl).toLowerCase().endsWith('.pdf');
    if (isPdf) {
      return (
        <a href={row.previewUrl} target="_blank" rel="noreferrer" className="inline-flex h-12 w-12 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
          PDF
        </a>
      );
    }
    return <img src={row.previewUrl} alt={row.filename} className="h-12 w-12 rounded-lg object-cover" />;
  }
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
      {row.file?.type === 'application/pdf' || row.filename.toLowerCase().endsWith('.pdf') ? 'PDF' : 'FILE'}
    </div>
  );
};

export const ImportLabelsModal = ({ open, onClose, onSubmit, isSubmitting }: ImportLabelsModalProps) => {
  const [tab, setTab] = useState<Tab>('image');
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [serverResult, setServerResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localSubmitting, setLocalSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const excelInputRef = useRef<HTMLInputElement | null>(null);
  const queryClient = useQueryClient();

  const pushLog = (_msg: string, _data?: any) => {
    // no-op in production UI to avoid noisy logs
  };

  useEffect(() => {
    return () => {
      rows.forEach((row) => {
        if (row.previewUrl) URL.revokeObjectURL(row.previewUrl);
      });
    };
  }, []);

  const validCount = rows.filter((r) => r.status === 'valid').length;
  const invalidCount = rows.length - validCount;
  const canSubmit = rows.length > 0 && invalidCount === 0 && !isSubmitting;
  const estimatedCredits = rows.reduce((sum, r) => {
    if (r.status !== 'valid') return sum;
    // map serviceType to key used in pricing map
    const key = r.serviceType === 'active_tracking' ? 'scan_label' : r.serviceType;
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

  const updateRow = (id: string, patch: Partial<ImportRow>) => {
    setRows((prev) => prev.map((row) => (row.id === id ? validateRow({ ...row, ...patch }) : row)));
  };

  const removeRow = (id: string) => {
    setRows((prev) => {
      const next = prev.filter((row) => row.id !== id);
      return next;
    });
  };

  const clearAll = () => {
    setRows([]);
    setError(null);
  };

  const applyServiceToAll = (serviceType: ServiceType) => {
    setRows((prev) => prev.map((row) => validateRow({ ...row, serviceType })));
  };

  const handleImageFiles = async (fileList: FileList | null) => {
    if (!fileList) return;
    setError(null);
    const accepted = Array.from(fileList).filter((file) => acceptImages.split(',').some((type) => file.type === type.trim()));
    const newRows = await Promise.all(accepted.map((file) => fileToRow(file)));
    setRows((prev) => [...prev, ...newRows]);
    // clear any excel preview state
    setPreviewId(null);
    setServerResult(null);
  };
  const handleSheet = async (fileList: FileList | null) => {
    if (!fileList?.length) return;
    setError(null);
    const file = fileList[0];
    try {
      pushLog('uploading sheet to server', { name: file.name, size: file.size });
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await http.post('/labels/import/excel', fd);
      // server returns previewId and previewSample
      setPreviewId(data.previewId ?? null);
      setServerResult(data ?? null);
      // map previewSample to ImportRow for display (read-only)
      const mapped: ImportRow[] = (data.previewSample ?? []).map((r: any, idx: number) => {
        const service = (r.serviceType ?? '').toString().toLowerCase();
        const serviceType: ServiceType = service.includes('active') ? 'active_tracking' : service.includes('empty') ? 'empty_package' : 'scan_label';
        const filename = r.sourceFileName ?? r.labelFileUrl ?? `Row ${idx + 1}`;
        return {
          id: makeId(),
          filename: filename.toString(),
          serviceType,
          trackingNumber: r.trackingNumber ?? undefined,
          carrier: r.carrier ?? undefined,
          status: r.status === 'valid' ? 'valid' : 'invalid',
          error: r.error,
          source: 'excel',
          previewUrl: r.labelFileUrl ?? undefined,
        } as ImportRow;
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
      if (tab === 'excel') {
        if (!previewId) throw new Error('No preview available. Upload a sheet first.');
        const { data } = await http.post('/labels/import/excel/confirm', { previewId });
        setServerResult(data);
        setNotification({ type: 'success', message: `Imported ${data.created} labels, failed ${data.failed}` });
        // Invalidate orders queries so Orders page refreshes (non-exact to include filtered keys)
        void queryClient.invalidateQueries({ queryKey: ['orders'], exact: false });
        onSubmit?.(rows);
        // reset modal state and close
        clearAll();
        setPreviewId(null);
        setServerResult(null);
        onClose();
      } else {
        // image tab: send files + meta[]
        const uploadRows = rows.filter((r) => r.source === 'upload' && r.file) as ImportRow[];
        if (uploadRows.length === 0) throw new Error('No files to upload');
        const fd = new FormData();
        const meta: any[] = [];
        uploadRows.forEach((r) => {
          if (!r.file) return;
          fd.append('files', r.file);
          const clientRequestId = (r as any).clientRequestId ?? makeId();
          meta.push({ serviceType: r.serviceType, trackingNumber: r.trackingNumber ?? '', carrier: r.carrier ?? '', clientRequestId, sourceFileName: r.filename });
        });
        fd.append('meta', JSON.stringify(meta));
        const { data } = await http.post('/labels/import/image', fd);
        setServerResult(data);
        // server returns summary object
        if (data && typeof data === 'object') {
          const created = data.created ?? data.accepted ?? 0;
          const failed = data.failed ?? data.rejected?.length ?? 0;
          setNotification({ type: 'success', message: `Imported ${created} labels, failed ${failed}` });
          // Invalidate orders queries so Orders page refreshes
          void queryClient.invalidateQueries({ queryKey: ['orders'], exact: false });
        }
        onSubmit?.(rows);
        // reset modal state and close
        clearAll();
        setServerResult(null);
        onClose();
      }
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
            <h3 className="text-2xl font-semibold text-ink">{tab === 'excel' ? 'Excel Import' : 'Image Import'}</h3>
            <p className="text-sm text-slate-600">Upload label images or bulk import via Excel/CSV. Server preview & confirm supported.</p>
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

        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { key: 'image', label: 'Image Upload' },
            { key: 'excel', label: 'Excel Import' },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                tab === item.key ? 'bg-slate-900 text-white' : 'border border-slate-200 text-slate-700 hover:border-slate-300'
              }`}
              onClick={() => setTab(item.key as Tab)}
              disabled={isSubmitting}
            >
              {item.label}
            </button>
          ))}
        </div>

        {tab === 'image' && (
          <div className="mt-4 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-4">
            <div
              className="flex flex-col items-center justify-center gap-2 text-center text-slate-700"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                if (isSubmitting) return;
                handleImageFiles(event.dataTransfer.files);
              }}
            >
              <p className="text-sm font-semibold">Drag & drop PDF / PNG / JPG</p>
              <p className="text-xs text-slate-500">or click to choose multiple files</p>
              <p className="text-xs text-slate-400">Accepted formats: PDF, PNG, JPG — max 5 MB per file</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:border-slate-400"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSubmitting}
                >
                  Select files
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept={acceptImages}
                  multiple
                  onChange={(event) => {
                    handleImageFiles(event.target.files);
                    if (event.target) event.target.value = '';
                  }}
                  disabled={isSubmitting}
                />
              </div>
              <p className="text-[11px] text-slate-500">Multiple files supported. Each file becomes one row.</p>
            </div>
          </div>
        )}

            {tab === 'excel' && (
          <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-2 text-sm text-slate-700">
                  <p className="font-semibold">Upload .xlsx or .csv</p>
                  <p className="text-xs text-slate-500">Required columns: <span className="font-semibold">label</span> or <span className="font-semibold">url</span> (publicly reachable image/PDF URL). Optional: <span className="font-semibold">serviceType</span>, <span className="font-semibold">trackingNumber</span>, <span className="font-semibold">carrier</span>. Any unknown or unrecognized <span className="font-semibold">serviceType</span> value will be treated as <span className="font-semibold">scan</span>.</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:border-slate-400"
                  onClick={() => excelInputRef.current?.click()}
                  disabled={isSubmitting}
                >
                  Upload sheet
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
        )}

            {rows.length > 0 && (
          <div className="mt-6 overflow-x-auto">
            <div className="flex flex-col gap-3 pb-2 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <span className="font-semibold">Batch apply service type:</span>
                <select
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  onChange={(event) => applyServiceToAll(event.target.value as ServiceType)}
                  defaultValue=""
                  disabled={isSubmitting}
                >
                  <option value="" disabled>
                    Select service
                  </option>
                  {SERVICE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="text-sm text-slate-700">
                Valid rows: <span className="font-semibold text-emerald-700">{validCount}</span> · Invalid: <span className="font-semibold text-rose-700">{invalidCount}</span>
                {validCount > 0 && (
                  <span className="ml-3 text-slate-600">Estimated credits: <span className="font-semibold">{estimatedCredits.toFixed(2)}</span></span>
                )}
              </div>
            </div>

            <table className="w-full min-w-[900px] border-collapse overflow-hidden rounded-xl border border-slate-200 text-sm shadow-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left">Preview</th>
                  <th className="px-3 py-2 text-left">Filename</th>
                  <th className="px-3 py-2 text-left">Service Type</th>
                  <th className="px-3 py-2 text-left">Tracking Number</th>
                  <th className="px-3 py-2 text-left">Carrier</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const showTracking = (row.trackingNumber && row.trackingNumber.trim().length > 0) || row.serviceType !== 'scan_label';
                  return (
                    <tr key={row.id} className={row.status === 'invalid' ? 'bg-rose-50' : 'bg-white'}>
                      <td className="px-3 py-2 align-middle">
                        <PreviewCell row={row} />
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-900">{row.filename}</span>
                          {row.file && <span className="text-xs text-slate-500">{formatSize(row.file.size)}</span>}
                          <span className="text-[11px] text-slate-500">{row.source === 'upload' ? 'Image upload' : 'Excel import'}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <div className="flex flex-col">
                          <select
                            className="w-44 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            value={row.serviceType}
                            onChange={(event) => updateRow(row.id, { serviceType: event.target.value as ServiceType })}
                            disabled={isSubmitting}
                          >
                            {SERVICE_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                          <div className="mt-1 text-xs text-slate-500">{formatCostText(row.serviceType === 'active_tracking' ? 'scan_label' : row.serviceType) ?? '—'}</div>
                        </div>
                      </td>
                      <td className="px-3 py-2 align-middle">
                        {showTracking ? (
                          row.source === 'excel' ? (
                            <span className="text-sm text-slate-700">{row.trackingNumber ?? '—'}</span>
                          ) : (
                            <input
                              type="text"
                              className="w-48 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                              value={row.trackingNumber ?? ''}
                              onChange={(event) => updateRow(row.id, { trackingNumber: event.target.value })}
                              placeholder="Enter tracking"
                              disabled={isSubmitting || localSubmitting}
                            />
                          )
                        ) : (
                          <span className="text-xs text-slate-400">N/A</span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-middle">
                        {showTracking ? (
                          row.source === 'excel' ? (
                            <span className="text-sm text-slate-700">{row.carrier ?? '—'}</span>
                          ) : (
                            <input
                              type="text"
                              className="w-40 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                              value={row.carrier ?? ''}
                              onChange={(event) => updateRow(row.id, { carrier: event.target.value })}
                              placeholder="Carrier"
                              disabled={isSubmitting || localSubmitting}
                            />
                          )
                        ) : (
                          <span className="text-xs text-slate-400">N/A</span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-middle">
                        {row.status === 'valid' ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">Valid</span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-800">{row.error ?? 'Invalid'}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            onClick={() => removeRow(row.id)}
                            disabled={isSubmitting}
                          >
                            Remove
                          </button>
                        </div>
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
            {rows.length === 0 ? 'No rows added yet.' : `${validCount} valid · ${invalidCount} invalid · ${rows.length} total`}
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
