export const SERVICE_CREDIT_COST = {
  scan_label: 0.35,
  empty_package: 1,
  design_2d: 1,
  design_3d: 2,
  embroidery_text: 1.25,
  embroidery_image: 1.75,
  sidebow: 1.5,
  poster_canvas: 1.5,
} as const;

export const TOPUP_PACKAGES = {
  basic: { price: 1.5, credits: 1, discount: 0 },
  standard: { price: 14.5, credits: 10, discount: 0.03 },
  premier: { price: 70, credits: 50, discount: 0.07 },
  ultra: { price: 135, credits: 100, discount: 0.10 },
} as const;

type ServiceKey = keyof typeof SERVICE_CREDIT_COST;

/**
 * Try to derive a normalized pricing key from an order-like object.
 * The function is intentionally permissive: it will look for several
 * common fields (`service`, `type`, `subtype`, `category`) and
 * normalize the value to match keys in `SERVICE_CREDIT_COST`.
 *
 * If no match is found it returns `null`.
 */
function inferServiceKey(order: any): ServiceKey | null {
  if (!order) return null;

  const candidates: Array<string | undefined> = [
    order.service,
    order.type,
    order.subtype,
    order.category,
    // nested shapes commonly used in different modules
    order.product?.type,
    order.design?.type,
  ];

  for (const raw of candidates) {
    if (!raw) continue;
    const s = String(raw).toLowerCase().trim();
    // normalize separators to underscores
    const norm = s.replace(/[\s-]+/g, '_');
    // direct match
    if ((SERVICE_CREDIT_COST as any)[norm]) return norm as ServiceKey;

    // fuzzy checks
    if (norm.includes('embroid') || norm.includes('embroidery')) {
      // prefer image if the name mentions image/logo
      if (norm.includes('image') || norm.includes('logo') || norm.includes('picture')) return 'embroidery_image';
      return 'embroidery_text';
    }

    if (norm.includes('design')) {
      if (norm.includes('3d') || norm.includes('3_d') || norm.includes('three_d')) return 'design_3d';
      return 'design_2d';
    }

    if (norm.includes('sidebow') || norm.includes('side_bow') || norm.includes('side')) return 'sidebow';
    if (norm.includes('poster') || norm.includes('canvas')) return 'poster_canvas';
    if (norm.includes('scan') || norm.includes('label')) return 'scan_label';
    if (norm.includes('empty') && norm.includes('package')) return 'empty_package';
  }

  return null;
}

/**
 * Get the service cost (in credits) for an order-like object.
 * Returns the numeric cost if a matching service is found, otherwise `null`.
 */
export function getServiceCost(order: any): number | null {
  const key = inferServiceKey(order);
  if (!key) return null;
  return SERVICE_CREDIT_COST[key];
}

/**
 * Get the normalized service key for an order-like object (e.g. 'scan_label', 'design_2d').
 */
export function getServiceKey(order: any): string | null {
  return inferServiceKey(order);
}

/**
 * Return a top-up package object by its key, or null when not found.
 */
export function getPackageByKey(key?: string) {
  if (!key) return null;
  const k = String(key).toLowerCase().trim();
  return (TOPUP_PACKAGES as any)[k] ?? null;
}

export default {
  SERVICE_CREDIT_COST,
  TOPUP_PACKAGES,
  getServiceCost,
  getPackageByKey,
};
