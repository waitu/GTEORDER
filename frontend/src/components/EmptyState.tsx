import { ReactNode } from 'react';

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
};

export const EmptyState = ({ title, description, action, icon }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
    {icon && <div className="mb-3">{icon}</div>}
    <p className="text-sm font-semibold text-ink">{title}</p>
    {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
    {action && <div className="mt-3">{action}</div>}
  </div>
);
