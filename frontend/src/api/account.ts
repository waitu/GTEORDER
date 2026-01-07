import { http } from './http';

export type AccountProfile = {
  email: string;
  status: string;
  role: string;
  fullName?: string | null;
  phone?: string | null;
  createdAt?: string;
  lastLoginAt?: string | null;
  lastLoginIp?: string | null;
  trustedDevices: number;
  totals: {
    trackings: number;
    emptyOrders: number;
    balance: number;
  };
};

export const fetchAccountProfile = async (): Promise<AccountProfile> => {
  const { data } = await http.get<AccountProfile>('/me');
  return data;
};
