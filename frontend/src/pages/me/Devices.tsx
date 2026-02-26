import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '../../components/DashboardLayout';
import { ConfirmModal } from '../../components/ConfirmModal';
import { fetchDevices, revokeDevice } from '../../api/dashboard';

export const MeDevicesPage = () => {
  const queryClient = useQueryClient();
  const { data: devices = [], isLoading, isError } = useQuery({ queryKey: ['me', 'devices'], queryFn: fetchDevices });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(() => devices.find((d) => d.id === selectedId), [devices, selectedId]);

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokeDevice(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['me', 'devices'] });
      setSelectedId(null);
    },
  });

  const revoke = (id: string) => {
    setSelectedId(id);
  };

  const confirmRevoke = () => {
    if (!selectedId) return;
    revokeMutation.mutate(selectedId);
  };

  return (
    <DashboardLayout title="Trusted Devices">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        {isLoading && <p className="text-sm text-slate-600">Loading devices…</p>}
        {isError && <p className="text-sm text-rose-600">Failed to load devices.</p>}
        {devices.map((device) => (
          <div
            key={device.id}
            className="flex flex-col gap-3 rounded-lg border border-slate-100 px-4 py-3 md:flex-row md:items-center md:justify-between"
          >
            <div>
              <p className="font-semibold text-ink">{device.deviceName ?? device.name}</p>
              <p className="text-xs text-slate-500">Last used {device.lastUsed ?? '—'}</p>
              {device.lastIp && <p className="text-xs text-slate-500">IP: {device.lastIp}</p>}
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                {device.status ?? 'Trusted'}
              </span>
              <button
                className="font-semibold text-red-600 hover:text-red-700"
                onClick={() => revoke(device.id)}
                disabled={revokeMutation.isPending}
              >
                {revokeMutation.isPending && selectedId === device.id ? 'Revoking…' : 'Revoke'}
              </button>
            </div>
          </div>
        ))}
        {!isLoading && devices.length === 0 && <p className="text-sm text-slate-600">No trusted devices yet.</p>}
      </div>

      <ConfirmModal
        open={!!selected}
        title="Revoke this device?"
        description={selected ? `${selected.deviceName ?? selected.name} will require OTP on next login.` : undefined}
        confirmLabel="Revoke"
        onCancel={() => !revokeMutation.isPending && setSelectedId(null)}
        onConfirm={confirmRevoke}
      />
    </DashboardLayout>
  );
};
