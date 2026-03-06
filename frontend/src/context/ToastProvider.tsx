import { createContext, ReactNode, useCallback, useContext, useMemo, useRef, useState } from 'react';

type ToastType = 'success' | 'error' | 'info';

type ToastInput = {
  title?: string;
  message: string;
  type?: ToastType;
  durationMs?: number;
};

type ToastItem = {
  id: number;
  title?: string;
  message: string;
  type: ToastType;
};

type ToastContextValue = {
  showToast: (input: ToastInput) => void;
  dismissToast: (id: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION = 3200;

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const timersRef = useRef<Map<number, number>>(new Map());

  const dismissToast = useCallback((id: number) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const showToast = useCallback(
    ({ title, message, type = 'info', durationMs = DEFAULT_DURATION }: ToastInput) => {
      const id = ++idRef.current;
      setToasts((prev) => {
        const next = [...prev, { id, title, message, type }];
        return next.slice(-4);
      });
      const timer = window.setTimeout(() => {
        dismissToast(id);
      }, durationMs);
      timersRef.current.set(id, timer);
    },
    [dismissToast],
  );

  const value = useMemo<ToastContextValue>(() => ({ showToast, dismissToast }), [showToast, dismissToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-[5.75rem] z-[90] flex w-[min(92vw,26rem)] flex-col gap-2 sm:right-6 sm:top-[6.25rem]">
        {toasts.map((toast) => {
          const toneClass =
            toast.type === 'error'
              ? 'border-rose-200 text-rose-700'
              : toast.type === 'success'
                ? 'border-emerald-200 text-emerald-700'
                : 'border-slate-200 text-slate-700';

          const fallbackTitle =
            toast.type === 'error' ? 'Action failed' : toast.type === 'success' ? 'Action completed' : 'Notification';

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto rounded-xl border bg-white px-4 py-3 shadow-xl ring-1 ring-black/5 ${toneClass}`}
              role="status"
              aria-live="polite"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide">{toast.title ?? fallbackTitle}</p>
                  <p className="mt-1 whitespace-pre-line text-sm font-medium text-slate-800">{toast.message}</p>
                </div>
                <button
                  type="button"
                  className="rounded-md px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                  onClick={() => dismissToast(toast.id)}
                  aria-label="Close notification"
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};
