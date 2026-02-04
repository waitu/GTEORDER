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
      <div className="w-full max-w-[900px] rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold text-ink">Buy credits · PingPong payment</h3>
            <p className="mt-1 text-sm text-slate-600">Pay via PingPong, then paste your Transaction ID (TXID) to receive credits.</p>
          </div>
          <button
            type="button"
            className="rounded-full border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
            aria-label="Close"
            onClick={() => {
              if (submitMutation.isPending) return;
              closeAll();
            }}
          >
            <span aria-hidden>×</span>
          </button>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payment summary</div>
                  <div className="mt-2 text-3xl font-semibold text-ink">{packageInfo ? usd(Number(packageInfo.price)) : '—'}</div>
                  <div className="mt-1 text-sm text-slate-600">
                    for <span className="font-semibold text-slate-900">{packageInfo ? packageInfo.credits.toLocaleString() : '—'}</span> credits
                  </div>
                  <div className="mt-3 text-xs text-slate-500">Payment method: PingPong</div>
                </div>
                <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                  Waiting for TXID
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-semibold text-slate-900">Paste your PingPong Transaction ID</div>
              <label className="mt-3 grid gap-2">
                <span className="text-sm font-semibold text-slate-700">Transaction ID (TXID)</span>
                <input
                  type="text"
                  className="w-full rounded-lg border border-slate-200 px-3 py-3 text-sm font-mono focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  value={txid}
                  onChange={(e) => setTxid(e.target.value)}
                  placeholder="TR042026602020917424249737"
                  autoFocus
                />
                <span className="text-xs text-slate-500">We use TXID to match and confirm your payment.</span>
              </label>

              {(error || (submitMutation.error as any)?.message) && (
                <p className="mt-2 text-sm text-rose-700">{error ?? (submitMutation.error as any)?.message}</p>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-3">
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
                    'rounded-lg px-5 py-2.5 text-sm font-semibold text-white',
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
                  {submitMutation.isPending ? 'Submitting…' : 'Confirm payment'}
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold text-slate-900">How to find your Transaction ID</div>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-600">
              <li>Open PingPong and go to Transaction details</li>
              <li>Find “Transaction ID (TXID)”</li>
              <li>Copy the full value</li>
            </ol>

            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex h-44 items-center justify-center rounded-md bg-white">
                <svg viewBox="0 0 600 360" className="h-40 w-full" role="img" aria-label="TXID location example">
                  <rect x="20" y="20" width="560" height="320" rx="16" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="2" />
                  <rect x="60" y="70" width="480" height="40" rx="8" fill="#F8FAFC" />
                  <rect x="60" y="130" width="220" height="24" rx="6" fill="#E2E8F0" />
                  <rect x="60" y="170" width="360" height="24" rx="6" fill="#E2E8F0" />
                  <rect x="60" y="210" width="480" height="40" rx="8" fill="#F8FAFC" />
                  <rect x="160" y="218" width="320" height="24" rx="6" fill="#FFFFFF" stroke="#94A3B8" />
                  <text x="170" y="235" fontSize="12" fill="#334155">Transaction ID (TXID)</text>
                  <path d="M120 230 L150 230" stroke="#2563EB" strokeWidth="4" />
                  <polygon points="150,224 160,230 150,236" fill="#2563EB" />
                </svg>
              </div>
              <p className="mt-2 text-xs text-slate-500">Example only. Always copy the full TXID.</p>
            </div>
          </div>
        </div>

        <p className="mt-6 text-xs text-slate-500">Payments are verified manually. Credits will be added once your TXID is confirmed.</p>
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
