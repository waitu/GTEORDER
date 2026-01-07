import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '../../components/DashboardLayout';
import { fetchDevices } from '../../api/dashboard';

export const DevicesPage = () => {
  const { data: devices, isLoading, isError } = useQuery({ queryKey: ['devices'], queryFn: fetchDevices });

  return (
    <DashboardLayout title="Devices">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        {isLoading && <p className="text-sm text-slate-600">Loading devices…</p>}
        {isError && <p className="text-sm text-red-700">Could not load devices.</p>}
        {!isLoading && !isError && (
          <>
            {devices?.map((device, idx) => (
              <div key={device.id ?? idx} className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-3">
                <div>
                  <p className="font-semibold text-ink">{device.name}</p>
                  {device.lastUsed && <p className="text-xs text-slate-500">Last used {device.lastUsed}</p>}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{device.status ?? '—'}</span>
                  <button className="text-sm font-semibold text-red-600 hover:text-red-700">Revoke</button>
                </div>
              </div>
            ))}
            {(devices?.length ?? 0) === 0 && <p className="text-sm text-slate-600">No devices yet.</p>}
          </>
        )}
      </div>
    </DashboardLayout>
  );
};
