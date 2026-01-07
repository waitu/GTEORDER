import { useMemo, useState } from 'react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { ConfirmModal } from '../../components/ConfirmModal';

const initialDevices = [
  { id: '1', name: 'Chrome · MacOS', lastUsed: '2025-12-10 14:32', trusted: true },
  { id: '2', name: 'Safari · iOS', lastUsed: '2025-12-08 09:15', trusted: true },
  { id: '3', name: 'Edge · Windows', lastUsed: '2025-12-05 18:44', trusted: false },
];

export const MeDevicesPage = () => {
  const [devices, setDevices] = useState(initialDevices);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(() => devices.find((d) => d.id === selectedId), [devices, selectedId]);

  const revoke = (id: string) => {
    setSelectedId(id);
  };

  const confirmRevoke = () => {
    if (!selectedId) return;
    setDevices((list) => list.filter((d) => d.id !== selectedId));
    setSelectedId(null);
  };

  return (
    <DashboardLayout title="Trusted Devices">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        {devices.map((device) => (
          <div
            key={device.id}
            className="flex flex-col gap-3 rounded-lg border border-slate-100 px-4 py-3 md:flex-row md:items-center md:justify-between"
          >
            <div>
              <p className="font-semibold text-ink">{device.name}</p>
              <p className="text-xs text-slate-500">Last used {device.lastUsed}</p>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                {device.trusted ? 'Trusted' : 'Untrusted'}
              </span>
              <button
                className="font-semibold text-red-600 hover:text-red-700"
                onClick={() => revoke(device.id)}
              >
                Revoke
              </button>
            </div>
          </div>
        ))}
        {devices.length === 0 && <p className="text-sm text-slate-600">No trusted devices yet.</p>}
      </div>

      <ConfirmModal
        open={!!selected}
        title="Revoke this device?"
        description={selected ? `${selected.name} will require OTP on next login.` : undefined}
        confirmLabel="Revoke"
        onCancel={() => setSelectedId(null)}
        onConfirm={confirmRevoke}
      />
    </DashboardLayout>
  );
};
