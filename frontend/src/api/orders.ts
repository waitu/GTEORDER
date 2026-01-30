import { http } from './http';

export type OrderType = 'active_tracking' | 'empty_package' | 'design' | 'other';
export type OrderStatus = 'pending' | 'processing' | 'completed' | 'error' | 'failed';
export type PaymentStatus = 'unpaid' | 'paid';

export type Order = {
    id: string;
    orderType: OrderType;
    trackingCode: string | null;
    labelUrl: string | null;
    labelImageUrl: string | null;
    /** Customer-facing or processing result destination. */
    resultUrl?: string | null;
    /** All deliverable asset URLs (images, archives, etc.). */
    assetUrls?: string[] | null;
    /** Optional subtype for design requests (2D, 3D, embroidery, etc.). */
    designSubtype?: string | null;
    /** Internal notes visible to admins only. */
    adminNote?: string | null;
    /** Legacy name kept for compatibility until UI fully migrates. */
    internalNotes?: string | null;
    totalCost: number;
    orderStatus: OrderStatus;
    paymentStatus: PaymentStatus;
    carrier?: string | null;
    trackingUrl?: string | null;
    trackingActivatedAt?: string | null;
    firstCheckpointAt?: string | null;
    errorCode?: string | null;
    errorReason?: string | null;
    createdAt: string;
    updatedAt: string;
    user?: {
        id: string;
        email?: string | null;
    } | null;
};

export type OrdersQueryParams = {
    orderType?: OrderType;
    orderStatus?: OrderStatus;
    paymentStatus?: PaymentStatus;
    search?: string;
    from?: string;
    to?: string;
    designSubtype?: string;
    page?: number;
    limit?: number;
};

export type OrdersResponse = {
    data: Order[];
    meta: {
        page: number;
        limit: number;
        total: number;
    };
};

const normalizeDateParam = (value?: string | null) => {
    if (!value) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

export const serializeOrdersQueryParams = (params: OrdersQueryParams): Record<string, string | number> => {
    const query: Record<string, string | number> = {};
    if (params.orderType) query.orderType = params.orderType;
    if (params.orderStatus) query.orderStatus = params.orderStatus;
    if (params.paymentStatus) query.paymentStatus = params.paymentStatus;
    if (params.designSubtype) query.designSubtype = params.designSubtype;
    if (params.search) query.search = params.search.trim();
    const startDate = normalizeDateParam(params.from);
    const endDate = normalizeDateParam(params.to);
    if (startDate) query.startDate = startDate;
    if (endDate) query.endDate = endDate;
    query.page = params.page ?? 1;
    query.limit = params.limit ?? 20;
    return query;
};

export const fetchOrders = async (params: OrdersQueryParams = {}): Promise<OrdersResponse> => {
    const { data } = await http.get<OrdersResponse>('/orders', {
        params: serializeOrdersQueryParams(params),
    });

    return data;
};

export const fetchOrder = async (id: string): Promise<Order> => {
    const { data } = await http.get<Order>(`/orders/${id}`);
    return data;
};

export const scanLabel = async (params: { trackingCode: string }): Promise<Order> => {
    const { data } = await http.post<Order>('/orders/scan-label', { trackingCode: params.trackingCode });
    return data;
};

export type BulkImportTrackingResult = {
    total: number;
    created: number;
    failed: number;
    results: { trackingCode: string; ok: boolean; orderId?: string; error?: string }[];
};

export const bulkImportTracking = async (trackingCodes: string[]): Promise<BulkImportTrackingResult> => {
    const { data } = await http.post<BulkImportTrackingResult>('/orders/import/tracking-bulk', { trackingCodes });
    return data;
};
