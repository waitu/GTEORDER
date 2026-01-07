import clsx from 'clsx';
import { ReactNode } from 'react';

type BadgeProps = {
  children: ReactNode;
  variant?: 'info' | 'success' | 'warning' | 'danger' | 'neutral';
};

const variantClass = {
  info: 'bg-sky-100 text-sky-800',
  success: 'bg-emerald-100 text-emerald-800',
  warning: 'bg-amber-100 text-amber-800',
  danger: 'bg-rose-100 text-rose-800',
  neutral: 'bg-slate-100 text-slate-800',
};

export const Badge = ({ children, variant = 'neutral' }: BadgeProps) => (
  <span className={clsx('rounded-full px-3 py-1 text-xs font-semibold', variantClass[variant])}>{children}</span>
);
