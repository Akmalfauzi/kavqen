'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { api, clearToken, hashPassword } from '@/lib/api';

export default function PasswordRecovery({ reset = false }: { reset?: boolean }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(!reset);

  useEffect(() => {
    if (!reset) return;
    // The fragment keeps reset credentials out of server request logs.
    const value = new URLSearchParams(window.location.hash.slice(1)).get('token') || '';
    setToken(value);
    if (!/^[a-f0-9]{64}$/.test(value)) setError('This reset link is incomplete. Request a new link.');
    setReady(true);
  }, [reset]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError('');
    setMessage('');

    // Validated here instead of by the browser, so the messages match the rest of the UI.
    const errors: Record<string, string> = {};
    if (reset) {
      if (!password) errors.password = 'New password is required.';
      else if (password.length < 8 || new TextEncoder().encode(password).length > 72) {
        errors.password = 'Password must contain at least 8 characters and at most 72 UTF-8 bytes.';
      }
      if (!confirmation) errors.confirmation = 'Please confirm your new password.';
      else if (password && password !== confirmation) errors.confirmation = 'Passwords do not match.';
    } else {
      if (!email.trim()) errors.email = 'Email address is required.';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = 'Enter a valid email address.';
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    setBusy(true);
    try {
      const response = reset
        ? await api.post('/auth/reset-password', { token, password: await hashPassword(password) })
        : await api.post('/auth/forgot-password', { email: email.trim() });
      setMessage(response.data.message);
      if (reset) {
        clearToken();
        setPassword('');
        setConfirmation('');
        window.history.replaceState(null, '', '/reset-password');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Request failed. Please try again.');
    } finally { setBusy(false); }
  }

  const inputClass = 'mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500';
  const invalidClass = 'mt-2 w-full rounded-xl border border-red-400 px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500';
  const clearFieldError = (name: string) => setFieldErrors(current => ({ ...current, [name]: '' }));
  const fieldError = (name: string) => fieldErrors[name]
    ? <span id={`error-${name}`} role="alert" className="mt-1 block text-xs font-normal text-red-600">{fieldErrors[name]}</span>
    : null;
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
      <section className="w-full max-w-md rounded-3xl bg-white border border-slate-200 p-8 shadow-xl shadow-slate-200/50">
        <h1 className="text-3xl font-black text-slate-900">{reset ? 'Choose a new password' : 'Forgot your password?'}</h1>
        <p className="mt-3 text-sm text-slate-500">{reset ? 'After saving, sign in again on your devices.' : 'Enter your account email. We will send a link to reset your password.'}</p>
        {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {message && <p role="status" className="mt-5 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
        {!(reset && message) && <form noValidate onSubmit={submit} className="mt-6 space-y-5">
          {reset ? <>
            <label className="block text-sm font-semibold text-slate-700">New password
              <input className={fieldErrors.password ? invalidClass : inputClass} type="password" autoComplete="new-password" required
                aria-invalid={!!fieldErrors.password} aria-describedby={fieldErrors.password ? 'error-password' : undefined}
                value={password} onChange={e => { setPassword(e.target.value); clearFieldError('password'); }} />
              {fieldError('password')}
            </label>
            <label className="block text-sm font-semibold text-slate-700">Confirm password
              <input className={fieldErrors.confirmation ? invalidClass : inputClass} type="password" autoComplete="new-password" required
                aria-invalid={!!fieldErrors.confirmation} aria-describedby={fieldErrors.confirmation ? 'error-confirmation' : undefined}
                value={confirmation} onChange={e => { setConfirmation(e.target.value); clearFieldError('confirmation'); }} />
              {fieldError('confirmation')}
            </label>
          </> : <label className="block text-sm font-semibold text-slate-700">Email address
            <input className={fieldErrors.email ? invalidClass : inputClass} type="email" autoComplete="email" maxLength={254} required
              aria-invalid={!!fieldErrors.email} aria-describedby={fieldErrors.email ? 'error-email' : undefined}
              value={email} onChange={e => { setEmail(e.target.value); clearFieldError('email'); }} />
            {fieldError('email')}
          </label>}
          <button disabled={busy || !ready || (reset && !/^[a-f0-9]{64}$/.test(token))} className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
            {busy ? 'Please wait...' : reset ? 'Save new password' : 'Send reset link'}
          </button>
        </form>}
        <div className="mt-6 flex justify-between gap-4 text-sm font-semibold text-indigo-600">
          <Link href="/login">Back to sign in</Link>
          {reset && !message && <Link href="/forgot-password">Request a new link</Link>}
        </div>
      </section>
    </main>
  );
}
