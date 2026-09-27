'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Script from 'next/script';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, hashPassword, saveToken } from '@/lib/api';

type GoogleIdentity = {
  initialize: (options: { client_id: string; callback: (response: { credential: string }) => void; auto_select: boolean; ux_mode: 'popup' }) => void;
  renderButton: (element: HTMLElement, options: { type: 'standard'; theme: 'outline'; size: 'large'; text: 'signin_with' | 'signup_with'; shape: 'pill'; width: number }) => void;
};

function googleIdentity() {
  return (window as Window & { google?: { accounts?: { id?: GoogleIdentity } } }).google?.accounts?.id;
}

export default function GoogleAuthButton({ mode, rememberMe = false, disabled = false, onBusyChange }: {
  mode: 'login' | 'signup';
  rememberMe?: boolean;
  disabled?: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const router = useRouter();
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim();
  const container = useRef<HTMLDivElement>(null);
  const active = useRef(true);
  const inFlight = useRef(false);
  const latest = useRef({ rememberMe, disabled, onBusyChange });
  latest.current = { rememberMe, disabled, onBusyChange };
  const [scriptReady, setScriptReady] = useState(false);
  const [scriptError, setScriptError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [linkAccount, setLinkAccount] = useState<{ credential: string; email: string } | null>(null);
  const [password, setPassword] = useState('');
  const authenticateRef = useRef<(credential: string) => void>(() => {});

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  async function authenticate(credential: string, accountPassword?: string) {
    if (inFlight.current || latest.current.disabled || !active.current) return;
    inFlight.current = true;
    setBusy(true);
    latest.current.onBusyChange(true);
    setError('');
    const remember = latest.current.rememberMe;
    try {
      const response = await api.post('/auth/google', {
        credential,
        rememberMe: remember,
        ...(accountPassword ? { password: await hashPassword(accountPassword) } : {}),
      }, { timeout: 20000 });
      if (!active.current) return;
      saveToken(response.data.data.token, remember);
      sessionStorage.setItem('pending_auth_notice', response.status === 201
        ? 'Akun berhasil dibuat dengan Google. Selamat datang!'
        : accountPassword
          ? 'Akun Google berhasil ditautkan. Kamu sudah masuk.'
          : 'Berhasil masuk dengan Google.');
      setPassword('');
      setLinkAccount(null);
      const pendingCode = sessionStorage.getItem('pending_share_code');
      if (pendingCode) sessionStorage.removeItem('pending_share_code');
      router.replace(pendingCode ? `/dashboard?code=${encodeURIComponent(pendingCode)}` : '/dashboard');
    } catch (err: any) {
      if (!active.current) return;
      if (err.response?.data?.code === 'GOOGLE_LINK_REQUIRED') {
        setLinkAccount({ credential, email: err.response.data.data.email });
      } else {
        setError(err.response?.data?.message || 'Google sign-in failed. Please try again.');
      }
    } finally {
      inFlight.current = false;
      if (active.current) {
        setBusy(false);
        latest.current.onBusyChange(false);
      }
    }
  }
  authenticateRef.current = credential => { void authenticate(credential); };

  useEffect(() => {
    if (!clientId || !scriptReady || !container.current) return;
    const identity = googleIdentity();
    if (!identity) { setScriptError(true); return; }
    const element = container.current;
    try {
      identity.initialize({ client_id: clientId, auto_select: false, ux_mode: 'popup', callback: response => authenticateRef.current(response.credential) });
      element.replaceChildren();
      identity.renderButton(element, { type: 'standard', theme: 'outline', size: 'large', text: mode === 'signup' ? 'signup_with' : 'signin_with', shape: 'pill', width: Math.min(400, Math.max(200, element.clientWidth)) });
    } catch { setScriptError(true); }
    return () => { element.replaceChildren(); };
  }, [clientId, scriptReady, mode]);

  useEffect(() => {
    if (!clientId || scriptReady || scriptError) return;
    const timeout = window.setTimeout(() => setScriptError(true), 15000);
    return () => window.clearTimeout(timeout);
  }, [clientId, scriptReady, scriptError]);

  const submitLink = (event: FormEvent) => {
    event.preventDefault();
    if (linkAccount && password) void authenticate(linkAccount.credential, password);
  };

  return <div className="space-y-3">
    {clientId && <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onReady={() => { setScriptReady(true); setScriptError(false); }} onError={() => setScriptError(true)} />}
    {!clientId && <p className="rounded-xl border border-slate-200 p-3 text-center text-sm text-slate-500">Google sign-in is not available yet. Use email and password.</p>}
    {clientId && !scriptReady && !scriptError && <p role="status" className="text-center text-sm text-slate-500">Loading Google sign-in...</p>}
    {scriptError && <p role="alert" className="text-sm text-red-700">Google sign-in could not load. Check your connection and reload this page, or use email and password.</p>}
    <div hidden={!!linkAccount || scriptError} inert={disabled || busy} ref={container} className={`min-h-0 w-full ${disabled || busy ? 'opacity-50' : ''}`} />
    {busy && <p role="status" className="text-center text-sm text-slate-500">Signing in with Google...</p>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {linkAccount && <form onSubmit={submitLink} className="rounded-xl border border-slate-200 p-4 space-y-3">
      <p className="text-sm text-slate-700">An account already exists for <strong className="break-all">{linkAccount.email}</strong>. Enter its Kavqen password to link Google and sign in.</p>
      <label className="block text-sm font-semibold text-slate-700">Kavqen password
        <input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} disabled={busy} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </label>
      <button type="submit" disabled={busy || disabled} className="w-full rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-white disabled:opacity-50">Link Google and sign in</button>
      <div className="flex justify-between gap-3 text-xs font-semibold text-indigo-600">
        <button type="button" disabled={busy} onClick={() => { setLinkAccount(null); setPassword(''); setError(''); }}>Cancel</button>
        <Link href="/forgot-password">Forgot password?</Link>
      </div>
    </form>}
  </div>;
}
