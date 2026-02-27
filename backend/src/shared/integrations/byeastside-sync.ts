import { DataSource } from 'typeorm';

import { Order, OrderStatus, PaymentStatus } from '../../modules/orders/order.entity.js';

export type ByeastsideSyncOptions = {
  dataSource: DataSource;
  apiKey: string;
  apiBase: string;
  labelsBase: string;
  page: number;
  pageSize: number;
  limit: number;
};

export type ByeastsideSyncResult = {
  pdfsProcessed: number;
  labelsScanned: number;
  ordersUpdated: number;
  ordersSkippedUnpaid: number;
  ordersNotFound: number;
  statusCounts: Record<string, number>;
};

type ByeastsidePdfList = {
  items: ByeastsidePdfItem[];
  totalItems: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type ByeastsidePdfItem = {
  id: number;
  name?: string;
  status?: string;
  totalLabels?: number;
  scannedLabels?: number;
  createdAt?: string;
};

type ByeastsideLabelItem = {
  id: number;
  trackingNumber?: string;
  status?: string;
  page?: number;
  createdAt?: string;
  pickedAt?: string;
  eventSummaries?: string[];
};

const getFirstEventSummary = (value?: string[] | string | null): string | undefined => {
  if (Array.isArray(value)) {
    const first = value[0];
    if (typeof first !== 'string') return undefined;
    const normalized = first.trim();
    return normalized.length > 0 ? normalized : undefined;
  }
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
  }
  return undefined;
};

const fetchJson = async <T>(url: string, apiKey: string): Promise<T> => {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Byeastside request failed: ${response.status} ${detail}`);
  }

  return (await response.json()) as T;
};

const normalizeStatus = (value?: string | null): string => (value ?? '').trim().toUpperCase();

const completedStatuses = new Set(['PICKED']);

export const runByeastsideSync = async (options: ByeastsideSyncOptions): Promise<ByeastsideSyncResult> => {
  const { dataSource, apiKey, apiBase, labelsBase, page, pageSize, limit } = options;

  const pdfItems: ByeastsidePdfItem[] = [];
  let currentPage = Math.max(1, page);

  while (pdfItems.length < limit) {
    const params = new URLSearchParams();
    params.set('page', String(currentPage));
    params.set('pageSize', String(pageSize));
    const listUrl = `${apiBase}?${params.toString()}`;

    const list = await fetchJson<ByeastsidePdfList>(listUrl, apiKey);
    const items = list.items || [];

    if (items.length === 0) {
      break;
    }

    pdfItems.push(...items);

    const totalPages = Number.isFinite(list.totalPages) ? list.totalPages : currentPage;
    if (currentPage >= totalPages) {
      break;
    }

    if (items.length < pageSize) {
      break;
    }

    currentPage += 1;
  }

  const limitedPdfItems = pdfItems.slice(0, limit);

  const ordersRepo = dataSource.getRepository(Order);
  const result: ByeastsideSyncResult = {
    pdfsProcessed: 0,
    labelsScanned: 0,
    ordersUpdated: 0,
    ordersSkippedUnpaid: 0,
    ordersNotFound: 0,
    statusCounts: {},
  };

  for (const pdf of limitedPdfItems) {
    const pdfId = pdf.id;
    if (!pdfId) continue;

    const labelsUrl = `${labelsBase}/${pdfId}/labels`;
    const labels = await fetchJson<ByeastsideLabelItem[]>(labelsUrl, apiKey);

    result.pdfsProcessed += 1;

    for (const label of labels || []) {
      result.labelsScanned += 1;
      const status = normalizeStatus(label.status);
      if (status) {
        result.statusCounts[status] = (result.statusCounts[status] ?? 0) + 1;
      }

      const trackingNumber = label.trackingNumber?.trim();
      if (!trackingNumber) continue;

      const summary = getFirstEventSummary(label.eventSummaries as any);

      if (summary) {
        const trackingOrders = await ordersRepo
          .createQueryBuilder('o')
          .where('LOWER(o.trackingCode) = LOWER(:tracking)', { tracking: trackingNumber })
          .andWhere('o.orderStatus IN (:...statuses)', {
            statuses: [OrderStatus.PENDING, OrderStatus.PROCESSING],
          })
          .getMany();

        for (const order of trackingOrders) {
          if ((order.adminNote ?? '').trim() !== summary) {
            order.adminNote = summary;
            await ordersRepo.save(order);
          }
        }
      }

      if (!completedStatuses.has(status)) {
        continue;
      }

      const orders = await ordersRepo
        .createQueryBuilder('o')
        .where('LOWER(o.trackingCode) = LOWER(:tracking)', { tracking: trackingNumber })
        .andWhere('o.paymentStatus = :paymentStatus', { paymentStatus: PaymentStatus.PAID })
        .andWhere('o.orderStatus IN (:...statuses)', {
          statuses: [OrderStatus.PENDING, OrderStatus.PROCESSING],
        })
        .getMany();

      if (orders.length === 0) {
        const unpaidCount = await ordersRepo
          .createQueryBuilder('o')
          .where('LOWER(o.trackingCode) = LOWER(:tracking)', { tracking: trackingNumber })
          .andWhere('o.paymentStatus = :paymentStatus', { paymentStatus: PaymentStatus.UNPAID })
          .andWhere('o.orderStatus IN (:...statuses)', {
            statuses: [OrderStatus.PENDING, OrderStatus.PROCESSING],
          })
          .getCount();

        if (unpaidCount > 0) {
          result.ordersSkippedUnpaid += 1;
        } else {
          result.ordersNotFound += 1;
        }
        continue;
      }

      for (const order of orders) {
        order.orderStatus = OrderStatus.COMPLETED;
        if (summary && !(order.adminNote ?? '').trim()) {
          order.adminNote = summary;
        }
        await ordersRepo.save(order);
        result.ordersUpdated += 1;
      }
    }
  }

  return result;
};
