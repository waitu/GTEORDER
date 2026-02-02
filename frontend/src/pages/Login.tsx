import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AxiosError } from 'axios';
import { AuthLayout } from '../components/AuthLayout';
import { FormField, Input } from '../components/FormField';
import { useAuth } from '../context/AuthProvider';

export const LoginPage = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState('');

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    setLoading(true);
    try {
      await login(email.trim());
      setInfo('Check your email for the login code');
    } catch (err) {
      const axiosErr = err as AxiosError<any>;
      const serverMessage = axiosErr?.response?.data?.message;
      if (typeof serverMessage === 'string' && serverMessage.trim().length > 0) {
        setError(serverMessage);
      } else if (Array.isArray(serverMessage) && serverMessage.length > 0) {
        setError(String(serverMessage[0]));
      } else {
        setError('Unable to send login code. Please try again.');
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Login with OTP">
      <form onSubmit={onSubmit} className="space-y-5">
        <FormField label="Email" error={error && !email ? error : undefined}>
          <Input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            hasError={!!error && !email}
            autoComplete="email"
          />
        </FormField>

        {info && <p className="text-sm text-sky-700">{info}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          className="w-full rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-900 disabled:opacity-60"
          disabled={loading}
        >
          {loading ? 'Sending…' : 'Send login code'}
        </button>

        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>
            No account?{' '}
            <Link to="/register" className="font-semibold text-sky-700 hover:text-sky-900">
              Register
            </Link>
          </span>
          <Link to="/otp" className="font-semibold text-sky-700 hover:text-sky-900">
            Enter OTP
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
};
