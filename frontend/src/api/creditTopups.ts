import { http } from './http';

// Note: The legacy PingPong/manual bill-upload top-up flow is deprecated and intentionally removed.

export type CreditTopupStatus = 'pending' | 'approved' | 'rejected' | string;
export type CreditTopupPaymentMethod = 'pingpong_manual' | string;

export type UserCreditHistoryItem = {
  id: string;
  amountUsd: number | null;
  paymentMethod: CreditTopupPaymentMethod | null;
  status: CreditTopupStatus;
  pingpongTxId: string | null;
  credits: number | null;
  createdAt: string;
  confirmedAt: string | null;
  adminNote: string | null;
};

const asNumberOrNull = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
};

const asStringOrNull = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const s = value.trim();
    return s ? s : null;
  }
  return null;
};

const mapHistoryItem = (raw: any): UserCreditHistoryItem => {
  const createdAt = asStringOrNull(raw?.createdAt ?? raw?.created_at) ?? '';
  const confirmedAt = asStringOrNull(raw?.confirmedAt ?? raw?.confirmed_at ?? raw?.reviewedAt ?? raw?.reviewed_at);
  const amountUsd = asNumberOrNull(raw?.amountUsd ?? raw?.amount_usd ?? raw?.amount);
  const credits = asNumberOrNull(raw?.credits ?? raw?.creditAmount ?? raw?.credit_amount);

  return {
    id: String(raw?.id ?? ''),
    amountUsd,
    paymentMethod: (raw?.paymentMethod ?? raw?.payment_method ?? raw?.method ?? null) as CreditTopupPaymentMethod | null,
    status: String(raw?.status ?? ''),
    pingpongTxId: asStringOrNull(raw?.pingpongTxId ?? raw?.pingpong_tx_id),
    credits,
    createdAt,
    confirmedAt,
    adminNote: asStringOrNull(raw?.adminNote ?? raw?.admin_note),
  };
};

export const createPingPongPackageTxIdTopup = async (params: {
  packageKey: string;
  pingpongTxId: string;
}): Promise<UserCreditHistoryItem> => {
  const { data } = await http.post<any>('/api/credits/topup/pingpong/package/txid', {
    packageKey: params.packageKey,
    pingpongTxId: params.pingpongTxId,
  });
  return mapHistoryItem(data);
};

export const createPingPongTxIdTopup = async (params: {
  amountUsd: number;
  pingpongTxId: string;
}): Promise<UserCreditHistoryItem> => {
  const { data } = await http.post<any>('/api/credits/topup/pingpong/txid', {
    amountUsd: params.amountUsd,
    pingpongTxId: params.pingpongTxId,
  });
  return mapHistoryItem(data);
};

export const fetchMyCreditHistory = async (): Promise<UserCreditHistoryItem[]> => {
  const { data } = await http.get<any[]>('/api/credits/topups');
  const arr = Array.isArray(data) ? data : [];
  return arr.map(mapHistoryItem);
};
