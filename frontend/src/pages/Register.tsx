import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { FormField, Input } from '../components/FormField';
import { registerEmail } from '../api/auth';

export const RegisterPage = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

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
      await registerEmail(email.trim());
      setInfo('Your request has been sent. Please wait for admin approval.');
    } catch (err) {
      console.error(err);
      setError('Could not submit your request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Register">
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
        {error && !info ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          type="submit"
          className="w-full rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-900"
          disabled={loading}
        >
          {loading ? 'Submitting…' : 'Request access'}
        </button>

        <p className="text-center text-sm text-slate-600">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-sky-700 hover:text-sky-900">
            Login
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
};
