import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { FormField, Input } from '../components/FormField';
import { useAuth } from '../context/AuthProvider';

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

export const OtpPage = () => {
  const navigate = useNavigate();
  const { pendingOtpRequestId, verifyOtp, resendOtp, isAuthenticated } = useAuth();

  const [otp, setOtp] = useState('');
  const [trustDevice, setTrustDevice] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  const disabledResend = secondsLeft > 0;
  const mmss = useMemo(() => `${pad(Math.floor(secondsLeft / 60))}:${pad(secondsLeft % 60)}`, [secondsLeft]);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
      return;
    }

    if (!pendingOtpRequestId) {
      navigate('/login', { replace: true });
      return;
    }

    const id = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [pendingOtpRequestId, navigate, isAuthenticated]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    if (otp.trim().length !== 6) {
      setError('Enter the 6-digit code');
      return;
    }
    if (!pendingOtpRequestId) {
      navigate('/login', { replace: true });
      return;
    }

    setVerifying(true);
    try {
      await verifyOtp(otp.trim(), trustDevice);
      navigate('/dashboard');
    } catch (err) {
      console.error(err);
      setError('Invalid or expired code. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const onResend = async () => {
    if (disabledResend || !pendingOtpRequestId) return;

    setResending(true);
    setError('');
    setInfo('');
    try {
      await resendOtp();
      setInfo('OTP resent.');
      setSecondsLeft(60);
    } catch (err) {
      console.error(err);
      setError('Could not resend code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthLayout title="Enter OTP">
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <FormField label="6-digit code">
          <Input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="123456"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            hasError={!!error}
          />
        </FormField>

        <div className="flex items-center gap-2 text-sm text-slate-700">
          <input
            id="trust"
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            checked={trustDevice}
            onChange={(e) => setTrustDevice(e.target.checked)}
          />
          <label htmlFor="trust">Trust this device</label>
        </div>

        {info && <p className="text-sm text-sky-700">{info}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center justify-between text-sm text-slate-700">
          <span>Resend available in {mmss}</span>
          <button
            type="button"
            onClick={onResend}
            disabled={disabledResend || resending}
            className="font-semibold text-sky-700 hover:text-sky-900 disabled:opacity-50"
          >
            {resending ? 'Resending…' : 'Resend OTP'}
          </button>
        </div>

        <button
          type="submit"
          className="w-full rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-900"
          disabled={verifying}
        >
          {verifying ? 'Verifying…' : 'Verify'}
        </button>
      </form>
    </AuthLayout>
  );
};
