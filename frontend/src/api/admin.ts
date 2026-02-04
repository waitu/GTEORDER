import { http } from './http';
import { Order, OrderStatus, OrdersQueryParams, OrdersResponse, PaymentStatus, serializeOrdersQueryParams } from './orders';

export type RegistrationState = 'pending' | 'approved' | 'rejected';

export type RegistrationRequest = {
  id: string;
  email?: string;
  createdAt?: string;
  status?: RegistrationState;
  state?: RegistrationState;
  reason?: string;
  user?: { id: string; email?: string | null } | null;
};

export type AuditLog = {
  id?: string;
  action: string;
  targetId?: string | null;
  createdAt: string;
};

export type AdminOverview = {
  counts: {
    totalUsers: number;
    activeUsers: number;
    pendingUsers: number;
    registrationPending: number;
    registrationApproved: number;
    registrationRejected: number;
    loginSuccess24h: number;
    loginFail24h: number;
  };
  recentUsers: { id: string; email?: string; status?: string; createdAt: string; lastLoginAt?: string | null }[];
  recentRequests: { id: string; email?: string; state: string; status?: RegistrationState; createdAt: string; reviewedAt?: string | null }[];
  recentAdminAudits: AuditLog[];
};

export type AdminUser = {
  id: string;
  email: string;
  role?: 'user' | 'admin';
  status?: string;
  createdAt?: string;
  lastLoginAt?: string;
  creditBalance?: number;
};

export type BalanceTransaction = {
  id: string;
  amount: number;
  direction: 'credit' | 'debit';
  balanceAfter: number;
  reason?: string | null;
  reference?: string | null;
  createdAt: string;
};

export type CreditTopupStatus = 'pending' | 'approved' | 'rejected';
export type CreditTopupMethod = 'pingpong_manual';

export type AdminCreditTopup = {
  id: string;
  user: { id: string; email?: string | null };
  amount: number;
  amountUsd?: number;
  creditAmount?: number;
  credits?: number;
  packageKey?: string | null;
  paymentMethod: CreditTopupMethod;
  transferNote: string;
  pingpongTxId?: string | null;
  note?: string | null;
  status: CreditTopupStatus;
  adminId?: string | null;
  adminNote?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
};

export type Paginated<T> = { data: T[]; meta: { page: number; limit: number; total: number } };

export type AdminOrder = Order;

export type AdminOrdersResponse = OrdersResponse & { data: AdminOrder[] };

export const fetchRegistrationRequests = async (): Promise<RegistrationRequest[]> => {
  const { data } = await http.get<RegistrationRequest[]>('/admin/registration-requests');
  return (data ?? []).map((item) => {
    const status: RegistrationState = item.status ?? item.state ?? 'pending';
    const email = item.email ?? item.user?.email ?? '';

    return {
      id: item.id,
      email,
      createdAt: item.createdAt,
      status,
      state: status,
      reason: item.reason,
    } satisfies RegistrationRequest;
  });
};

export const approveRegistrationRequest = async (id: string) => {
  await http.post(`/admin/registration-requests/${id}/approve`);
};

export const rejectRegistrationRequest = async (id: string, reason: string) => {
  await http.post(`/admin/registration-requests/${id}/reject`, { reason });
};

export const fetchAuditLogs = async () => {
  const { data } = await http.get<AuditLog[]>('/admin/audits');
  return data ?? [];
};

export const fetchAdminOverview = async () => {
  const { data } = await http.get<AdminOverview>('/admin/overview');
  if (!data) return data;

  return {
    ...data,
    recentRequests: (data.recentRequests ?? []).map((r) => {
      const status: RegistrationState = (r.status as RegistrationState) ?? (r.state as RegistrationState) ?? 'pending';
      const email = r.email ?? (r as any).user?.email ?? '';
      return { ...r, status, state: status, email };
    }),
  } satisfies AdminOverview;
};

export const fetchAdminUsers = async () => {
  const { data } = await http.get<AdminUser[]>('/admin/users');
  return data ?? [];
};

export const fetchAdminUser = async (id: string) => {
  const { data } = await http.get<AdminUser>(`/admin/users/${id}`);
  return data;
};

export const fetchUserCreditHistory = async (id: string): Promise<BalanceTransaction[]> => {
  const { data } = await http.get<BalanceTransaction[]>(`/admin/users/${id}/credit/transactions`);
  return data ?? [];
};

export const fetchAdminCreditTopups = async (params: {
  status?: CreditTopupStatus;
  q?: string;
  page?: number;
  limit?: number;
} = {}): Promise<Paginated<AdminCreditTopup>> => {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.q?.trim()) qs.set('q', params.q.trim());
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  const query = qs.toString() ? `?${qs.toString()}` : '';
  const { data } = await http.get<Paginated<AdminCreditTopup>>(`/api/admin/credits/topups${query}`);
  return (
    data ?? {
      data: [],
      meta: { page: params.page ?? 1, limit: params.limit ?? 50, total: 0 },
    }
  );
};

export const approveCreditTopup = async (id: string) => {
  await http.post(`/api/admin/credits/topups/${id}/approve`);
};

export const rejectCreditTopup = async (id: string, adminNote: string) => {
  await http.post(`/api/admin/credits/topups/${id}/reject`, { adminNote });
};

export const adjustAdminUserCredit = async (id: string, payload: { amount: number; direction: 'credit' | 'debit'; reason?: string; note?: string }) => {
  const { data } = await http.post<{ id: string; creditBalance: number }>(`/admin/users/${id}/credit`, payload);
  return data;
};

export const updateUserStatus = async (id: string, status: 'pending' | 'active' | 'disabled') => {
  const { data } = await http.post<AdminUser>(`/admin/users/${id}/status`, { status });
  return data;
};

export const updateUserRole = async (id: string, role: 'user' | 'admin') => {
  const { data } = await http.post<AdminUser>(`/admin/users/${id}/role`, { role });
  return data;
};

export const fetchAdminOrders = async (params: OrdersQueryParams = {}): Promise<AdminOrdersResponse> => {
  const { data } = await http.get<AdminOrdersResponse>('/admin/orders', {
    params: serializeOrdersQueryParams(params),
  });
  return data;
};

export const fetchAdminOrderDetail = async (id: string): Promise<AdminOrder> => {
  const { data } = await http.get<AdminOrder>(`/admin/orders/${id}`);
  return data;
};

export const updateAdminOrderStatus = async (id: string, orderStatus: OrderStatus): Promise<AdminOrder> => {
  const { data } = await http.patch<AdminOrder>(`/admin/orders/${id}/status`, { orderStatus });
  return data;
};

export const updateAdminPaymentStatus = async (id: string, paymentStatus: PaymentStatus): Promise<AdminOrder> => {
  const { data } = await http.patch<AdminOrder>(`/admin/orders/${id}/payment`, { paymentStatus });
  return data;
};

export const updateAdminResultUrl = async (id: string, resultUrl: string): Promise<AdminOrder> => {
  const { data } = await http.patch<AdminOrder>(`/admin/orders/${id}/result`, { resultUrl });
  return data;
};

export const updateAdminNote = async (id: string, adminNote: string): Promise<AdminOrder> => {
  const { data } = await http.patch<AdminOrder>(`/admin/orders/${id}/note`, { adminNote });
  return data;
};

export const startAdminOrder = async (id: string) => {
  const { data } = await http.post<AdminOrder>(`/admin/orders/${id}/start`);
  return data;
};

export const bulkStartOrders = async (ids: string[]) => {
  const { data } = await http.post<AdminOrder[]>(`/admin/orders/bulk/start`, { ids });
  return data;
};

export const bulkFailOrders = async (ids: string[], adminNote: string, refund = false) => {
  const { data } = await http.post<AdminOrder[]>(`/admin/orders/bulk/fail`, { ids, adminNote, refund });
  return data;
};

export const bulkArchiveOrders = async (ids: string[]) => {
  const { data } = await http.post<AdminOrder[]>(`/admin/orders/bulk/archive`, { ids });
  return data;
};
