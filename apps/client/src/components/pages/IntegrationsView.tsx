'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { RiCalendarLine, RiCheckLine, RiPlugLine, RiLoader4Line, RiMailLine, RiWhatsappLine } from 'react-icons/ri';
import PageHeader from '@/components/PageHeader';
import Modal from '@/components/Modal';
import DemoQrCode from '@/components/DemoQrCode';
import { api } from '@/lib/api';

interface GoogleStatus {
  configured: boolean;
  permitted: boolean;
  connected: boolean;
  googleEmail: string | null;
  connectedAt: string | null;
}

// The Google Calendar flow is built and working (OAuth, token refresh, event
// creation). Flip this to true to put it back in front of users.
const CALENDAR_ENABLED = false;

const CALLBACK_MESSAGES: Record<string, { type: 'success' | 'error'; text: string }> = {
  connected: { type: 'success', text: 'Google Calendar connected.' },
  denied: { type: 'error', text: 'Connection cancelled.' },
  expired: { type: 'error', text: 'The request expired. Please try connecting again.' },
  unconfigured: { type: 'error', text: 'Google Calendar is not configured on the server.' },
  no_refresh_token: { type: 'error', text: 'Google did not return a refresh token. Remove Kavqen from your Google account permissions, then try again.' },
  missing_scope: { type: 'error', text: 'Google did not grant calendar access. Add the calendar.events scope to the OAuth consent screen, then reconnect.' },
  error: { type: 'error', text: 'Could not connect to Google Calendar.' }
};

export default function IntegrationsView() {
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [whatsappDemo, setWhatsappDemo] = useState(false);
  const router = useRouter();

  const loadStatus = useCallback(async () => {
    // A server without mail configured hides the email card entirely.
    api.get('/integrations/status')
      .then(response => setEmailEnabled(response.data.data.email === 'configured'))
      .catch(() => setEmailEnabled(false));
    try {
      const response = await api.get('/integrations/google/status');
      setStatus(response.data.data);
    } catch {
      setStatus({ configured: false, permitted: false, connected: false, googleEmail: null, connectedAt: null });
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  // The OAuth callback redirects back here with ?google=<result>. router.replace is
  // async, so this effect re-runs while the param is still there; the ref keeps one
  // result to one toast (StrictMode's double-invoke included).
  const handledResult = useRef<string | null>(null);
  useEffect(() => {
    // Read the URL directly: useSearchParams() would force this page out of
    // static prerendering and needs a Suspense boundary for a client-only concern.
    const result = new URLSearchParams(window.location.search).get('google');
    if (!result || handledResult.current === result) return;
    handledResult.current = result;
    const message = CALLBACK_MESSAGES[result] || CALLBACK_MESSAGES.error;
    // A stable id collapses duplicates: the ref is lost if this view remounts.
    const options = { id: `google-oauth-${result}` };
    message.type === 'success' ? toast.success(message.text, options) : toast.error(message.text, options);
    router.replace('/integrations');
    loadStatus();
  }, [router, loadStatus]);

  const connect = async () => {
    setBusy(true);
    try {
      const response = await api.get('/integrations/google/connect');
      window.location.href = response.data.data.url;
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Could not start the Google connection.');
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await api.delete('/integrations/google');
      setConfirmDisconnect(false);
      toast.success('Google Calendar disconnected.');
      await loadStatus();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Could not disconnect.');
    } finally {
      setBusy(false);
    }
  };

  return <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
    <PageHeader icon={<RiPlugLine />} eyebrow="Your workspace" title="Integrations"
      description="Connect the tools you use to manage your appointments." />
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <section aria-labelledby="google-calendar-title" className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="rounded-xl border border-sky-100 bg-sky-50 p-3 text-sky-600"><RiCalendarLine aria-hidden="true" className="h-6 w-6" /></div>
          {!CALENDAR_ENABLED
            ? <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">Coming soon</span>
            : status?.connected
            ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"><RiCheckLine aria-hidden="true" className="h-3.5 w-3.5" />Connected</span>
            : <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">{status && (!status.configured || !status.permitted) ? 'Unavailable' : 'Not connected'}</span>}
        </div>
        <h2 id="google-calendar-title" className="mt-5 text-base font-semibold text-slate-900">Google Calendar</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">Connect your calendar to manage appointments from your voice workflows.</p>
        {status?.connected && status.googleEmail &&
          <p className="mt-3 truncate text-sm font-medium text-slate-700" title={status.googleEmail}>{status.googleEmail}</p>}

        <div className="mt-5 border-t border-slate-100 pt-4">
          {!CALENDAR_ENABLED
            ? <button type="button" disabled
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">
                <RiPlugLine aria-hidden="true" className="h-4 w-4" />Connect Google Calendar
              </button>
            : !status
            ? <p className="text-xs text-slate-400">Checking connection...</p>
            : status.connected
              ? <button type="button" onClick={() => setConfirmDisconnect(true)} disabled={busy}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
                  {busy && <RiLoader4Line aria-hidden="true" className="h-4 w-4 animate-spin" />}Disconnect
                </button>
              : <button type="button" onClick={connect} disabled={busy || !status.configured || !status.permitted}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40">
                  {busy ? <RiLoader4Line aria-hidden="true" className="h-4 w-4 animate-spin" /> : <RiPlugLine aria-hidden="true" className="h-4 w-4" />}
                  Connect Google Calendar
                </button>}
        </div>
      </section>

      <section aria-labelledby="whatsapp-title" className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-emerald-600"><RiWhatsappLine aria-hidden="true" className="h-6 w-6" /></div>
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">Coming soon</span>
        </div>
        <h2 id="whatsapp-title" className="mt-5 text-base font-semibold text-slate-900">WhatsApp</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">Send form confirmations and appointment reminders to participants on WhatsApp.</p>

        <label className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
          <span className="text-sm font-medium text-slate-700">Demo mode</span>
          <button type="button" role="switch" aria-checked={whatsappDemo} aria-label="Toggle WhatsApp demo mode"
            onClick={() => setWhatsappDemo(value => !value)}
            className={`relative h-5 w-9 shrink-0 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${whatsappDemo ? 'bg-emerald-500' : 'bg-slate-300'}`}>
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${whatsappDemo ? 'left-[1.125rem]' : 'left-0.5'}`} />
          </button>
        </label>

        <div className="mt-4 border-t border-slate-100 pt-4">
          <button type="button" disabled
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">
            <RiPlugLine aria-hidden="true" className="h-4 w-4" />Connect WhatsApp
          </button>
        </div>
      </section>

      {emailEnabled && <section aria-labelledby="email-title" className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="rounded-xl border border-violet-100 bg-violet-50 p-3 text-violet-600"><RiMailLine aria-hidden="true" className="h-6 w-6" /></div>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"><RiCheckLine aria-hidden="true" className="h-3.5 w-3.5" />Active</span>
        </div>
        <h2 id="email-title" className="mt-5 text-base font-semibold text-slate-900">Email notifications</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">You receive an email whenever someone completes one of your forms.</p>
      </section>}
    </div>

    {whatsappDemo && <Modal title="Link WhatsApp" subtitle="Demo" onClose={() => setWhatsappDemo(false)} footer={
      <div className="flex justify-end">
        <button type="button" onClick={() => setWhatsappDemo(false)}
          className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Close</button>
      </div>
    }>
      <div className="flex flex-col items-center text-center">
        <p className="text-sm leading-relaxed text-slate-600">
          Open WhatsApp on your phone, go to <span className="font-semibold text-slate-900">Linked devices</span>, and scan this code.
        </p>
        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
          <DemoQrCode className="h-52 w-52" />
        </div>
        <p className="mt-4 text-xs text-slate-400">This is a mock-up. Scanning it just shows a short message.</p>
      </div>
    </Modal>}

    {confirmDisconnect && <Modal title="Disconnect Google Calendar?" onClose={() => { if (!busy) setConfirmDisconnect(false); }} footer={
      <div className="flex justify-end gap-3">
        <button type="button" disabled={busy} onClick={() => setConfirmDisconnect(false)}
          className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 disabled:opacity-40">Cancel</button>
        <button type="button" disabled={busy} onClick={disconnect}
          className="rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50">{busy ? 'Disconnecting...' : 'Disconnect'}</button>
      </div>
    }>
      <p className="text-sm leading-relaxed text-slate-600">
        Kavqen will lose access to {status?.googleEmail || 'your calendar'} and can no longer manage appointments from your voice workflows. You can connect it again at any time.
      </p>
    </Modal>}
  </div>;
}
