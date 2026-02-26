import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminLayout } from '../../components/AdminLayout';
import { Card } from '../../components/Card';
import { AlertModal } from '../../components/AlertModal';
import {
  ByeastsideSettings,
  ByeastsideSyncHistoryItem,
  ByeastsideSyncResult,
  fetchByeastsideSyncHistory,
  fetchByeastsideSettings,
  updateByeastsideSettings,
  runByeastsideSync,
} from '../../api/admin';

const defaultSettings: ByeastsideSettings = {
  cron: '0 21 * * *',
  enabled: true,
  limit: 10,
  pageSize: 10,
  page: 1,
};

const formatCount = (value?: number) => (value ?? 0).toLocaleString();

export const AdminByeastsidePage = () => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ByeastsideSettings>(defaultSettings);
  const [lastResult, setLastResult] = useState<ByeastsideSyncResult | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const historyLimit = 10;
  const [alert, setAlert] = useState<{ title: string; message: string } | null>(null);

  const settingsQuery = useQuery({
    queryKey: ['admin', 'byeastside', 'settings'],
    queryFn: fetchByeastsideSettings,
  });

  useEffect(() => {
    if (settingsQuery.data) {
      setForm(settingsQuery.data);
    }
  }, [settingsQuery.data]);

  const historyQuery = useQuery({
    queryKey: ['admin', 'byeastside', 'history', historyPage, historyLimit],
    queryFn: () => fetchByeastsideSyncHistory({ page: historyPage, limit: historyLimit }),
  });

  useEffect(() => {
    const first = historyQuery.data?.data?.[0];
    if (!lastResult && first?.result) {
      setLastResult(first.result);
    }
  }, [historyQuery.data, lastResult]);

  const saveMutation = useMutation({
    mutationFn: (payload: ByeastsideSettings) => updateByeastsideSettings(payload),
    onSuccess: async (data) => {
      setForm(data);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'byeastside', 'settings'] });
      setAlert({ title: 'Saved', message: 'Settings updated successfully.' });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Failed to save settings.';
      setAlert({ title: 'Save failed', message: Array.isArray(msg) ? msg.join(', ') : String(msg) });
    },
  });

  const syncMutation = useMutation({
    mutationFn: (payload: Partial<ByeastsideSettings>) => runByeastsideSync(payload),
    onSuccess: (data) => {
      setLastResult(data);
      queryClient.invalidateQueries({ queryKey: ['admin', 'byeastside', 'history'] });
      setAlert({ title: 'Sync complete', message: 'Tracking data was refreshed.' });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Sync failed.';
      setAlert({ title: 'Sync failed', message: Array.isArray(msg) ? msg.join(', ') : String(msg) });
    },
  });

  const statusRows = useMemo(() => {
    const counts = lastResult?.statusCounts ?? {};
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([status, count]) => ({ status, count }));
  }, [lastResult]);

  const updateForm = <K extends keyof ByeastsideSettings>(key: K, value: ByeastsideSettings[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const formatRunAt = (value?: string) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  };

  const renderHistoryResult = (row: ByeastsideSyncHistoryItem) => {
    if (row.status === 'failed') {
      return <span className="text-rose-600">{row.errorMessage ?? 'Sync failed'}</span>;
    }
    if (!row.result) {
      return <span className="text-slate-500">No result payload</span>;
    }
    return (
      <span className="text-slate-700">
        PDFs {formatCount(row.result.pdfsProcessed)} · Labels {formatCount(row.result.labelsScanned)} · Updated {formatCount(row.result.ordersUpdated)}
      </span>
    );
  };

  const runQuickSync = (limit: number) => {
    syncMutation.mutate({ limit, page: form.page, pageSize: form.pageSize });
  };

  return (
    <AdminLayout title="Byeastside Tracking Sync">
      <Card
        title="Auto Sync Settings"
        description="Configure how many PDF ids to scan each run. Only paid orders in pending/processing are updated."
        actions={
          <button
            className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-60"
            onClick={() => saveMutation.mutate(form)}
            disabled={saveMutation.isPending}
          >
            Save settings
          </button>
        }
      >
        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-1 text-sm font-semibold text-slate-700">
            Cron schedule (Asia/Ho_Chi_Minh)
            <input
              type="text"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={form.cron}
              onChange={(e) => updateForm('cron', e.target.value)}
            />
          </label>
          <label className="space-y-2 text-sm font-semibold text-slate-700">
            Auto sync
            <div className="flex items-center gap-3">
              <button
                type="button"
                className={`rounded-full px-3 py-1 text-xs font-semibold ${form.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}
                onClick={() => updateForm('enabled', !form.enabled)}
              >
                {form.enabled ? 'Enabled' : 'Disabled'}
              </button>
              <span className="text-xs text-slate-500">Toggle auto scheduler</span>
            </div>
          </label>
          <div className="space-y-2 text-sm">
            <p className="font-semibold text-slate-700">Quick presets</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => updateForm('cron', '0 */2 * * *')}
              >
                Every 2 hours
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => updateForm('cron', '0 */4 * * *')}
              >
                Every 4 hours
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => updateForm('cron', '0 21 * * *')}
              >
                Daily 21:00
              </button>
            </div>
          </div>
          <label className="space-y-1 text-sm font-semibold text-slate-700">
            Limit (ids/run)
            <input
              type="number"
              min={1}
              max={200}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={form.limit}
              onChange={(e) => updateForm('limit', Number(e.target.value))}
            />
          </label>
          <label className="space-y-1 text-sm font-semibold text-slate-700">
            Page size
            <input
              type="number"
              min={1}
              max={100}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={form.pageSize}
              onChange={(e) => updateForm('pageSize', Number(e.target.value))}
            />
          </label>
          <label className="space-y-1 text-sm font-semibold text-slate-700">
            Page
            <input
              type="number"
              min={1}
              max={1000}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={form.page}
              onChange={(e) => updateForm('page', Number(e.target.value))}
            />
          </label>
        </div>
        {settingsQuery.isLoading && <p className="mt-3 text-sm text-slate-600">Loading settings…</p>}
        {settingsQuery.isError && <p className="mt-3 text-sm text-rose-600">Failed to load settings.</p>}
      </Card>

      <Card
        title="Run Sync Now"
        description="Quickly refresh latest ids from Byeastside and update order status." 
      >
        <div className="flex flex-wrap items-center gap-2">
          {[10, 20, 50].map((limit) => (
            <button
              key={limit}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              onClick={() => runQuickSync(limit)}
              disabled={syncMutation.isPending}
            >
              Sync {limit}
            </button>
          ))}
          <button
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            onClick={() => syncMutation.mutate({ limit: form.limit, page: form.page, pageSize: form.pageSize })}
            disabled={syncMutation.isPending}
          >
            Sync with current settings
          </button>
        </div>
        {syncMutation.isPending && <p className="mt-3 text-sm text-slate-600">Syncing…</p>}
      </Card>

      <Card title="Last Result" description="Summary from the most recent sync run.">
        {lastResult ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 text-sm text-slate-700">
              <div><span className="font-semibold text-ink">PDFs processed:</span> {formatCount(lastResult.pdfsProcessed)}</div>
              <div><span className="font-semibold text-ink">Labels scanned:</span> {formatCount(lastResult.labelsScanned)}</div>
              <div><span className="font-semibold text-ink">Orders updated:</span> {formatCount(lastResult.ordersUpdated)}</div>
              <div><span className="font-semibold text-ink">Skipped unpaid:</span> {formatCount(lastResult.ordersSkippedUnpaid)}</div>
              <div><span className="font-semibold text-ink">Not found:</span> {formatCount(lastResult.ordersNotFound)}</div>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status breakdown</p>
              <div className="mt-2 space-y-1 text-sm text-slate-700">
                {statusRows.length === 0 && <div>No status data yet.</div>}
                {statusRows.map((row) => (
                  <div key={row.status} className="flex items-center justify-between">
                    <span className="font-semibold text-ink">{row.status}</span>
                    <span>{formatCount(row.count)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-600">No runs yet. Use the buttons above to sync.</p>
        )}
      </Card>

      <Card title="Sync History" description="Persistent run history for Byeastside tracking sync.">
        {historyQuery.isLoading && <p className="text-sm text-slate-600">Loading history…</p>}
        {historyQuery.isError && <p className="text-sm text-rose-600">Failed to load history.</p>}
        {!historyQuery.isLoading && !historyQuery.isError && (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600">Run at</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600">Status</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600">Settings</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {(historyQuery.data?.data ?? []).map((row) => (
                    <tr key={row.id}>
                      <td className="px-3 py-2 text-slate-700">{formatRunAt(row.createdAt)}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${row.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        limit {row.settings?.limit ?? '—'} · page {row.settings?.page ?? '—'} · pageSize {row.settings?.pageSize ?? '—'}
                      </td>
                      <td className="px-3 py-2">{renderHistoryResult(row)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {(historyQuery.data?.data?.length ?? 0) === 0 && (
              <p className="mt-3 text-sm text-slate-600">No sync history yet.</p>
            )}

            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-slate-500">Total runs: {formatCount(historyQuery.data?.meta.total ?? 0)}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-3 py-1 font-semibold text-slate-700 disabled:opacity-50"
                  onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                  disabled={(historyQuery.data?.meta.page ?? 1) <= 1}
                >
                  Previous
                </button>
                <span className="text-slate-600">Page {historyQuery.data?.meta.page ?? 1}</span>
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-3 py-1 font-semibold text-slate-700 disabled:opacity-50"
                  onClick={() => setHistoryPage((p) => p + 1)}
                  disabled={(historyQuery.data?.meta.page ?? 1) * (historyQuery.data?.meta.limit ?? historyLimit) >= (historyQuery.data?.meta.total ?? 0)}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </Card>

      <AlertModal
        open={!!alert}
        title={alert?.title ?? ''}
        description={alert?.message}
        onClose={() => setAlert(null)}
      />
    </AdminLayout>
  );
};
