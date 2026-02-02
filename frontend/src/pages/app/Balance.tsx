import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '../../components/DashboardLayout';
import { fetchBalance } from '../../api/dashboard';
import { useAuth } from '../../context/AuthProvider';
import { createPingPongPackageTopup, createPingPongTopup, fetchMyTopups, UserCreditTopup } from '../../api/creditTopups';
import { fetchPricing } from '../../api/pricing';

const PINGPONG = {
  qrImageUrl: import.meta.env.VITE_PINGPONG_QR_IMAGE_URL as string | undefined,
  accountName: import.meta.env.VITE_PINGPONG_ACCOUNT_NAME as string | undefined,
  accountNumber: import.meta.env.VITE_PINGPONG_ACCOUNT_NUMBER as string | undefined,
  bankName: import.meta.env.VITE_PINGPONG_BANK_NAME as string | undefined,
};

const formatTime = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const StatusBadge = ({ status }: { status: 'pending' | 'approved' | 'rejected' }) => {
  const cls =
    status === 'approved'
      ? 'bg-emerald-100 text-emerald-800'
      : status === 'rejected'
        ? 'bg-rose-100 text-rose-800'
        : 'bg-amber-100 text-amber-800';
  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${cls}`}>{status}</span>;
};

export const BalancePage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, isLoading, isError } = useQuery({ queryKey: ['balance'], queryFn: fetchBalance });
  const balanceValue = data?.balance;

  const pricingQuery = useQuery({ queryKey: ['pricing'], queryFn: fetchPricing });
  const packages = pricingQuery.data?.topupPackages ?? {};

  const [transferNote, setTransferNote] = useState<string>('');
  useEffect(() => {
    if (!user?.id) {
      setTransferNote('');
      return;
    }
    // Must start with TOPUP_<userId>, but should also be unique per submission.
    const uniq = Math.random().toString(36).slice(2, 8).toUpperCase();
    setTransferNote(`TOPUP_${user.id}_${uniq}`);
  }, [user?.id]);

  const [selectedPackageKey, setSelectedPackageKey] = useState<string | null>(null);

  useEffect(() => {
    const pkg = (searchParams.get('package') || '').trim().toLowerCase();
    if (!pkg) return;
    setSelectedPackageKey(pkg);
  }, [searchParams]);

  const [amount, setAmount] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [billFile, setBillFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const selectedPackage = selectedPackageKey ? packages[selectedPackageKey] : undefined;

  useEffect(() => {
    if (!selectedPackage) return;
    setAmount(String(selectedPackage.price ?? ''));
  }, [selectedPackageKey, selectedPackage?.price]);

  const topupsQuery = useQuery({ queryKey: ['credits', 'topups'], queryFn: fetchMyTopups });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!transferNote) throw new Error('Transfer note is not available (missing user id)');
      if (!billFile) throw new Error('Bill image is required');

      if (!['image/png', 'image/jpeg'].includes(billFile.type)) {
        throw new Error('Bill image must be JPG/PNG');
      }
      if (billFile.size > 5 * 1024 * 1024) {
        throw new Error('Bill image must be <= 5MB');
      }

      if (selectedPackageKey && selectedPackage) {
        return createPingPongPackageTopup({
          packageKey: selectedPackageKey,
          transferNote,
          note: note.trim() ? note.trim() : undefined,
          billImage: billFile,
        });
      }

      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt <= 0) throw new Error('Amount is required');
      return createPingPongTopup({
        amount: amt,
        transferNote,
        note: note.trim() ? note.trim() : undefined,
        billImage: billFile,
      });
    },
    onSuccess: async () => {
      setAmount('');
      setNote('');
      setBillFile(null);
      setSelectedPackageKey(null);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('package');
        return next;
      });
      await queryClient.invalidateQueries({ queryKey: ['credits', 'topups'] });
    },
  });

  const rows = (topupsQuery.data ?? []) as UserCreditTopup[];

  return (
    <DashboardLayout title="Credit">
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 shadow-xl shadow-slate-300/30 text-white">
          {isLoading && <p className="text-sm text-slate-200">Loading credit balance…</p>}
          {isError && <p className="text-sm text-rose-200">Could not load credit balance.</p>}
          {!isLoading && !isError && (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-200">Credit balance</p>
              <p className="text-5xl font-bold">{balanceValue != null ? balanceValue.toLocaleString(undefined, { style: 'currency', currency: 'USD' }) : '—'}</p>
              <p className="text-sm text-slate-200">Credits will be added after admin confirmation (usually within 1–24h).</p>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-ink">Top up via PingPong (Manual)</h3>
          <p className="mt-2 text-sm text-slate-600">Please use correct transfer content to avoid delays.</p>

          <div className="mt-4 grid gap-4 lg:grid-cols-[320px_1fr]">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">QR Code</p>
              {PINGPONG.qrImageUrl ? (
                <img src={PINGPONG.qrImageUrl} alt="PingPong QR" className="mt-3 w-full rounded-lg border border-slate-200 bg-white p-2" />
              ) : (
                <div className="mt-3 rounded-lg border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-600">
                  PingPong QR is not configured. Set `VITE_PINGPONG_QR_IMAGE_URL`.
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Receiver info</p>
              <div className="mt-3 grid gap-2 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Bank</span>
                  <span className="font-semibold text-ink">{PINGPONG.bankName ?? 'Not configured'}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Account name</span>
                  <span className="font-semibold text-ink">{PINGPONG.accountName ?? 'Not configured'}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Account number</span>
                  <span className="font-semibold text-ink">{PINGPONG.accountNumber ?? 'Not configured'}</span>
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Required transfer content</p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-sm font-semibold text-ink">{transferNote || '—'}</span>
                  <button
                    type="button"
                    className="rounded-lg border border-slate-200 px-3 py-1 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60"
                    disabled={!transferNote}
                    onClick={async () => {
                      if (!transferNote) return;
                      await navigator.clipboard.writeText(transferNote);
                    }}
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Top-up form</p>

                <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-800">Choose a package (discounted)</div>
                      <div className="text-xs text-slate-600">Optional — pick a package to receive discounted credits.</div>
                    </div>
                    <button
                      type="button"
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm font-semibold hover:bg-slate-50"
                      onClick={() => {
                        setSelectedPackageKey(null);
                        setSearchParams((prev) => {
                          const next = new URLSearchParams(prev);
                          next.delete('package');
                          return next;
                        });
                      }}
                    >
                      Use custom amount
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {Object.entries(packages).map(([k, p]) => (
                      <button
                        key={k}
                        type="button"
                        className={
                          selectedPackageKey === k
                            ? 'rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white'
                            : 'rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:bg-white'
                        }
                        onClick={() => {
                          setSelectedPackageKey(k);
                          setSearchParams((prev) => {
                            const next = new URLSearchParams(prev);
                            next.set('package', k);
                            return next;
                          });
                        }}
                      >
                        {k.toUpperCase()} · ${Number(p.price).toFixed(2)} → {Number(p.credits).toLocaleString()} credits
                      </button>
                    ))}
                    {Object.keys(packages).length === 0 && (
                      <div className="text-sm text-slate-600">No packages configured.</div>
                    )}
                  </div>

                  {selectedPackage && (
                    <div className="mt-3 text-sm text-slate-700">
                      You pay <span className="font-semibold text-slate-900">${Number(selectedPackage.price).toFixed(2)}</span> and receive{' '}
                      <span className="font-semibold text-slate-900">{Number(selectedPackage.credits).toLocaleString()}</span> credits.
                    </div>
                  )}
                </div>

                <div className="mt-3 grid gap-3">
                  <label className="grid gap-1">
                    <span className="text-sm font-semibold text-slate-700">Amount</span>
                    <input
                      type="number"
                      min={0.01}
                      step={0.01}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="Enter amount"
                      disabled={!!selectedPackage}
                    />
                    {selectedPackage && (
                      <span className="text-xs text-slate-500">Amount is locked to the selected package price.</span>
                    )}
                  </label>

                  <label className="grid gap-1">
                    <span className="text-sm font-semibold text-slate-700">Transfer note</span>
                    <input
                      type="text"
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono"
                      value={transferNote}
                      readOnly
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60"
                        disabled={!transferNote}
                        onClick={async () => {
                          if (!transferNote) return;
                          await navigator.clipboard.writeText(transferNote);
                        }}
                      >
                        Copy
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60"
                        disabled={!user?.id}
                        onClick={() => {
                          if (!user?.id) return;
                          const uniq = Math.random().toString(36).slice(2, 8).toUpperCase();
                          setTransferNote(`TOPUP_${user.id}_${uniq}`);
                        }}
                      >
                        Regenerate
                      </button>
                    </div>
                    <span className="text-xs text-slate-500">Must start with <span className="font-mono">TOPUP_{user?.id ?? '...'}</span>.</span>
                  </label>

                  <label className="grid gap-1">
                    <span className="text-sm font-semibold text-slate-700">Upload bill image (JPG/PNG, max 5MB)</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                      onChange={(e) => setBillFile(e.target.files?.[0] ?? null)}
                    />
                    {billFile && <span className="text-xs text-slate-500">Selected: {billFile.name}</span>}
                  </label>

                  <label className="grid gap-1">
                    <span className="text-sm font-semibold text-slate-700">Optional note</span>
                    <textarea
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      rows={3}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Optional note for admin"
                    />
                  </label>

                  {(formError || (createMutation.error as any)?.message) && (
                    <p className="text-sm text-rose-700">{formError ?? (createMutation.error as any)?.message}</p>
                  )}

                  <button
                    type="button"
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                    disabled={createMutation.isPending || !user?.id}
                    onClick={async () => {
                      setFormError(null);
                      try {
                        await createMutation.mutateAsync();
                      } catch (err: any) {
                        setFormError(err?.message || 'Submit failed');
                      }
                    }}
                  >
                    {createMutation.isPending ? 'Submitting…' : 'Submit for review'}
                  </button>

                  <p className="text-xs text-slate-500">Status will be Pending review. Balance will not update until admin approval.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-ink">Top-up history</h3>
            {topupsQuery.isFetching && <span className="text-xs text-slate-500">Refreshing…</span>}
          </div>

          {topupsQuery.isLoading && <p className="mt-3 text-sm text-slate-600">Loading…</p>}
          {topupsQuery.isError && <p className="mt-3 text-sm text-rose-700">Could not load history.</p>}

          {!topupsQuery.isLoading && !topupsQuery.isError && (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="py-3 pr-4">Amount</th>
                    <th className="py-3 pr-4">Method</th>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3 pr-4">Created</th>
                    <th className="py-3 pr-4">Reviewed</th>
                    <th className="py-3 pr-0">Admin note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((t) => (
                    <tr key={t.id}>
                      <td className="py-3 pr-4 font-semibold">${Number(t.amount).toFixed(2)}</td>
                      <td className="py-3 pr-4">PingPong Manual</td>
                      <td className="py-3 pr-4"><StatusBadge status={t.status} /></td>
                      <td className="py-3 pr-4">{formatTime(t.createdAt)}</td>
                      <td className="py-3 pr-4">{formatTime(t.reviewedAt ?? null)}</td>
                      <td className="py-3 pr-0 text-slate-700">{t.status === 'rejected' ? (t.adminNote ?? '—') : '—'}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-sm text-slate-600">No top-ups yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};
