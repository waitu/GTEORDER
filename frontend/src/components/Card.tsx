import { ReactNode } from 'react';
import clsx from 'clsx';

type CardProps = {
  title?: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
};

export const Card = ({ title, description, actions, className, children }: CardProps) => (
  <div className={clsx('rounded-xl border border-slate-200 bg-white p-5 shadow-sm', className)}>
    {(title || description || actions) && (
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          {title && <p className="text-sm font-semibold text-ink">{title}</p>}
          {description && <p className="text-xs text-slate-500">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    )}
    {children}
  </div>
);
