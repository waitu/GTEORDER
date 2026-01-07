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
  type: 'tracking' | 'empty-order';
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
  id?: string;
  name: string;
  lastUsed?: string;
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
  const { data } = await http.get<BalanceResponse>('/balance');
  return data;
};

export const fetchPricing = async () => {
  const { data } = await http.get('/pricing');
  return data ?? { serviceCreditCost: {}, topupPackages: {} };
};

export const fetchDevices = async () => {
  const { data } = await http.get<Device[]>('/me/devices');
  return data ?? [];
};
