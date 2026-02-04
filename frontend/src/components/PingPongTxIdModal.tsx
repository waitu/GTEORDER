import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useNavigate } from 'react-router-dom';
import { createPingPongPackageTxIdTopup } from '../api/creditTopups';
import { useAuth } from '../context/AuthProvider';

type PackageInfo = {
  price: number;
  credits: number;
  discount: number;
};

export type PingPongTxIdModalProps = {
  open: boolean;
  packageKey: string | null;
  packageInfo: PackageInfo | null;
  onClose: () => void;
};

const usd = (value: number) => `$${value.toFixed(2)}`;

export const PingPongTxIdModal = ({ open, packageKey, packageInfo, onClose }: PingPongTxIdModalProps) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [txid, setTxid] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<null | { kind: 'success' } | { kind: 'error'; message: string }>(null);

  const pingpongAccountName = (import.meta.env.VITE_PINGPONG_ACCOUNT_NAME as string | undefined)?.trim();
  const referenceEmail = (user?.email ?? '').trim();

  const title = useMemo(() => {
    if (!packageKey || !packageInfo) return 'Buy credits';
    return `Buy ${packageInfo.credits.toLocaleString()} credits`;
  }, [packageInfo, packageKey]);

  useEffect(() => {
    if (!open) return;
    setTxid('');
    setError(null);
    setResult(null);
  }, [open]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const normalized = txid.trim();
      if (!normalized) throw new Error('Transaction ID is required');
      if (!packageKey || !packageInfo) throw new Error('Package is required');
      return createPingPongPackageTxIdTopup({ packageKey, pingpongTxId: normalized });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['credits', 'history'], exact: false });
      await queryClient.invalidateQueries({ queryKey: ['credits', 'topups'], exact: false });
      setResult({ kind: 'success' });
    },
  });

  const closeAll = () => {
    setResult(null);
    setError(null);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-ink">{title}</h3>
            {packageKey && packageInfo && (
              <p className="mt-1 text-sm text-slate-600">
                Package: <span className="font-semibold text-slate-900">{packageKey.toUpperCase()}</span> · Pay{' '}
                <span className="font-semibold text-slate-900">{usd(Number(packageInfo.price))}</span>
              </p>
            )}
            <p className="mt-2 text-sm text-slate-600">Paste your PingPong transaction ID (TXID). Your credits will show as Pending until confirmed.</p>
          </div>

          <button
            type="button"
            className="rounded-lg border border-slate-200 px-3 py-1 text-sm font-semibold hover:bg-slate-50"
            onClick={() => {
              if (submitMutation.isPending) return;
              closeAll();
            }}
          >
            Close
          </button>
        </div>

        <div className="mt-5 grid gap-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">How to pay</div>
            <div className="mt-2 text-sm text-slate-700">
              <div className="font-semibold">To buy credits:</div>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>
                  Send <span className="font-semibold">{packageInfo ? usd(Number(packageInfo.price)) : '—'}</span> to our PingPong account
                  <div className="mt-1 text-xs text-slate-600">
                    <div>Method: Bank transfer / Card</div>
                    <div>
                      Recipient:{' '}
                      <span className="font-semibold text-slate-900">{pingpongAccountName || 'Not configured'}</span>
                    </div>
                    <div>
                      Reference:{' '}
                      <span className="font-mono font-semibold text-slate-900">{referenceEmail || 'your email'}</span>
                    </div>
                  </div>
                </li>
                <li>After payment, copy Transaction ID (TXID)</li>
                <li>Paste TXID here to receive credits</li>
              </ol>
            </div>
          </div>

          <label className="grid gap-1">
            <span className="text-sm font-semibold text-slate-700">PingPong TXID</span>
            <input
              type="text"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono"
              value={txid}
              onChange={(e) => setTxid(e.target.value)}
              placeholder="e.g. 9f3a..."
              autoFocus
            />
            <span className="text-xs text-slate-500">We use TXID to match your payment. Do not upload bill images.</span>
          </label>

          {(error || (submitMutation.error as any)?.message) && (
            <p className="text-sm text-rose-700">{error ?? (submitMutation.error as any)?.message}</p>
          )}

          <div className="mt-2 flex justify-end gap-3">
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => {
                if (submitMutation.isPending) return;
                closeAll();
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className={clsx(
                'rounded-lg px-4 py-2 text-sm font-semibold text-white',
                submitMutation.isPending ? 'bg-slate-400 cursor-not-allowed' : 'bg-slate-900 hover:bg-slate-800',
              )}
              disabled={submitMutation.isPending}
              onClick={async () => {
                setError(null);
                setResult(null);
                try {
                  await submitMutation.mutateAsync();
                } catch (e: any) {
                  const message = e?.message || 'Submit failed';
                  setError(message);
                  setResult({ kind: 'error', message });
                }
              }}
            >
              {submitMutation.isPending ? 'Submitting…' : 'Submit'}
            </button>
          </div>
        </div>
      </div>

      {result && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            {result.kind === 'success' ? (
              <>
                <h3 className="text-lg font-semibold text-ink">Submitted successfully</h3>
                <p className="mt-2 text-sm text-slate-600">Your purchase is now Pending. We’ll confirm it after payment verification.</p>
                <div className="mt-6 flex justify-end gap-3 text-sm font-semibold">
                  <button
                    type="button"
                    className="rounded-lg border border-slate-200 px-4 py-2 text-slate-700 hover:bg-slate-50"
                    onClick={closeAll}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-800"
                    onClick={() => {
                      closeAll();
                      navigate('/balance');
                    }}
                  >
                    Go to credit history
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-ink">Submit failed</h3>
                <p className="mt-2 text-sm text-rose-700">{result.message}</p>
                <div className="mt-6 flex justify-end gap-3 text-sm font-semibold">
                  <button
                    type="button"
                    className="rounded-lg border border-slate-200 px-4 py-2 text-slate-700 hover:bg-slate-50"
                    onClick={() => setResult(null)}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-800"
                    onClick={() => setResult(null)}
                  >
                    Try again
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
