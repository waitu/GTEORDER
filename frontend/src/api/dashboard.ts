import { http } from './http';

export type SummaryResponse = {
  activeTrackings: number;
  emptyOrders: number;
  balance: number;
};

export type Tracking = {
  id?: string;
  tracking: string;
  status?: 'pending' | 'in_transit' | 'delivered' | 'cancelled';
  price?: number;
  updatedAt?: string;
};

export type Activity = {
  id?: string;
  orderType: 'active_tracking' | 'empty_package' | 'design' | (string & {});
  ref: string;
  status?: string;
  amount?: number;
  updatedAt: string;
};

export type EmptyOrder = {
  id?: string;
  tracking: string;
  price?: number;
  labelLink?: string;
  shipping?: 'created' | 'picked_up' | 'shipping' | 'completed';
};

export type BalanceResponse = {
  balance?: number;
  transactions?: { id: string | number; description: string; amount: number; date: string }[];
};

export type PricingTier = {
  id?: string;
  tier: string;
  perScan: number;
  monthly: number;
  notes?: string;
};

export type Device = {
  id: string;
  deviceName?: string;
  name: string;
  lastIp?: string | null;
  lastUsedAt?: string | null;
  lastUsed?: string;
  expiresAt?: string | null;
  createdAt?: string;
  status?: string;
};

export const fetchSummary = async () => {
  const { data } = await http.get<SummaryResponse>('/dashboard/summary');
  return data;
};

export const fetchActivity = async () => {
  const { data } = await http.get<Activity[]>('/dashboard/activity');
  return data ?? [];
};

export const fetchTrackings = async () => {
  const { data } = await http.get<Tracking[]>('/trackings');
  return data ?? [];
};

export const fetchEmptyOrders = async () => {
  const { data } = await http.get<EmptyOrder[]>('/empty-orders');
  return data ?? [];
};

export const fetchBalance = async () => {
  const { data } = await http.get<SummaryResponse>('/dashboard/summary');
  return { balance: data?.balance } as BalanceResponse;
};

export const fetchPricing = async () => {
  const { data } = await http.get('/pricing');
  return data ?? { serviceCreditCost: {}, topupPackages: {} };
};

export const fetchDevices = async () => {
  const { data } = await http.get<any[]>('/me/devices');
  return (data ?? []).map((row) => {
    const lastUsedRaw = row.lastUsedAt ?? row.lastUsed;
    const expiresAt = row.expiresAt ?? null;
    const isExpired = expiresAt ? new Date(expiresAt).getTime() < Date.now() : false;
    return {
      id: row.id,
      deviceName: row.deviceName ?? row.name,
      name: row.deviceName ?? row.name ?? 'Unknown device',
      lastIp: row.lastIp ?? null,
      lastUsedAt: lastUsedRaw ?? null,
      lastUsed: lastUsedRaw ? new Date(lastUsedRaw).toLocaleString() : undefined,
      expiresAt,
      createdAt: row.createdAt,
      status: isExpired ? 'Expired' : 'Trusted',
    } as Device;
  });
};

export const revokeDevice = async (id: string) => {
  await http.delete(`/me/devices/${id}`);
};
