import { ReactNode } from 'react';
import clsx from 'clsx';

type FormFieldProps = {
  label: string;
  children: ReactNode;
  error?: string;
};

export const FormField = ({ label, children, error }: FormFieldProps) => {
  return (
    <label className="block space-y-2 text-sm font-medium text-slate-800">
      <span>{label}</span>
      {children}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </label>
  );
};

export const Input = (
  props: React.InputHTMLAttributes<HTMLInputElement> & { hasError?: boolean },
) => {
  const { className, hasError, ...rest } = props;
  return (
    <input
      className={clsx(
        'w-full rounded-lg border px-3 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500',
        hasError ? 'border-red-300' : 'border-slate-200',
        className,
      )}
      {...rest}
    />
  );
};
