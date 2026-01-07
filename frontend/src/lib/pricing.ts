export const SERVICE_CREDIT_COST: Record<string, number> = {
  scan_label: 0.35,
  empty_package: 1,
  design_2d: 1,
  design_3d: 2,
  embroidery_text: 1.25,
  embroidery_image: 1.75,
  sidebow: 1.5,
  poster_canvas: 1.5,
};

export function getServiceCostByKey(key?: string | null): number | null {
  if (!key) return null;
  const k = String(key).toLowerCase();
  // aliases mapping
  const aliases: Record<string, string> = {
    active_tracking: 'scan_label',
    illustration: 'design_2d',
    design: 'design_2d',
    '2d': 'design_2d',
    '3d': 'design_3d',
    print: 'poster_canvas',
    embroidery: 'embroidery_image',
  };
  const mapped = aliases[k] ?? k;
  return SERVICE_CREDIT_COST[mapped] ?? null;
}

export function getServiceLabelForKey(key?: string | null): string {
  if (!key) return 'Service';
  const k = String(key).toLowerCase();
  switch (k) {
    case 'scan_label':
    case 'active_tracking':
      return 'Scan Label';
    case 'empty_package':
      return 'Empty Package';
    case 'design_2d':
      return 'Design 2D';
    case 'design_3d':
      return 'Design 3D';
    case 'embroidery_text':
      return 'Embroidery (text)';
    case 'embroidery_image':
      return 'Embroidery (image)';
    case 'sidebow':
      return 'Sidebow';
    case 'poster_canvas':
      return 'Poster / Canvas';
    case 'illustration':
    case 'design':
      return 'Design';
    case 'print':
      return 'Poster / Print';
    default:
      // humanize
      return k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

export function formatCostText(key?: string | null): string | null {
  const cost = getServiceCostByKey(key);
  if (cost == null) return null;
  const label = getServiceLabelForKey(key);
  const creditLabel = cost === 1 ? 'credit' : 'credits';
  return `${label} → ${cost} ${creditLabel}`;
}

export default { SERVICE_CREDIT_COST, getServiceCostByKey, getServiceLabelForKey, formatCostText };
