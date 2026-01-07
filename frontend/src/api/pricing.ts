import { http } from './http';

export type PricingResponse = {
  serviceCreditCost: Record<string, number>;
  topupPackages: Record<string, { price: number; credits: number; discount: number }>;
};

export const fetchPricing = async (): Promise<PricingResponse> => {
  const { data } = await http.get<PricingResponse>('/pricing');
  return data ?? { serviceCreditCost: {}, topupPackages: {} };
};
