import { http } from './http';

export type CreditTopupStatus = 'pending' | 'approved' | 'rejected';
export type CreditTopupMethod = 'pingpong_manual';

export type UserCreditTopup = {
  id: string;
  amount: number;
  method: CreditTopupMethod;
  status: CreditTopupStatus;
  transferNote: string;
  note?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
  adminNote?: string | null;
  billImageUrl: string;
};

export const createPingPongTopup = async (params: {
  amount: number;
  transferNote: string;
  note?: string;
  billImage: File;
}): Promise<UserCreditTopup> => {
  const fd = new FormData();
  fd.append('amount', String(params.amount));
  fd.append('transferNote', params.transferNote);
  if (params.note) fd.append('note', params.note);
  fd.append('bill_image', params.billImage);

  const { data } = await http.post<UserCreditTopup>('/api/credits/topup/pingpong', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const fetchMyTopups = async (): Promise<UserCreditTopup[]> => {
  const { data } = await http.get<UserCreditTopup[]>('/api/credits/topups');
  return data ?? [];
};

export const fetchTopupBillBlob = async (billImageUrl: string): Promise<Blob> => {
  const { data } = await http.get(billImageUrl, { responseType: 'blob' });
  return data as Blob;
};
