'use client';

import Modal from '@/components/Modal';
import Pagination from '@/components/Pagination';
import PageHeader from '@/components/PageHeader';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { RiFileTextLine, RiDashboardLine, RiMailLine, RiCheckboxCircleLine, RiTimeLine, RiKey2Line, RiArrowRightLine } from 'react-icons/ri';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';

interface AvailableForm {
  id: string;
  name: string;
  description: string | null;
  expiresAt: string;
}

export default function UserFormsDashboard() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [invitePage, setInvitePage] = useState(1);
  const [formsError, setFormsError] = useState('');
  const [forms, setForms] = useState<AvailableForm[]>([]);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const codeInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const autoRedeemed = useRef(false);

  const [dashboard, setDashboard] = useState<{ totals: { active: number; pending: number; submitted: number; unfilled: number }; invites: { id: string; expiresAt: string; workflow: { name: string; description: string | null }; createdBy: { name: string | null; email: string } }[] } | null>(null);
  const [dashboardError, setDashboardError] = useState('');
  const [responding, setResponding] = useState('');
  const responseLock = useRef(false);
  const [confirmation, setConfirmation] = useState<{ id: string; name: string; action: 'accept' | 'decline' } | null>(null);
  const [responseError, setResponseError] = useState('');
  const loadDashboard = async () => {
    try { const response = await api.get('/share/dashboard'); setDashboard(response.data.data); setDashboardError(''); }
    catch { setDashboardError('Unable to load your overview and invitations.'); }
  };
  const respond = async (id: string, action: 'accept' | 'decline') => {
    if (responseLock.current) return;
    responseLock.current = true;
    setResponseError('');
    setResponding(id);
    try {
      await api.post(`/share/invites/${id}/respond`, { action });
      setConfirmation(null);
      toast.success(action === 'accept' ? 'Invitation accepted. Your form is ready to open.' : 'Invitation declined.');
    } catch (error: any) { setResponseError(error.response?.data?.message || 'Unable to respond to this invitation. Please try again.'); }
    finally { await Promise.all([loadDashboard(), loadForms()]); setResponding(''); responseLock.current = false; }
  };
  useEffect(() => {
    const refresh = () => { void loadDashboard(); void loadForms(); };
    void loadDashboard();
    window.addEventListener('participant-dashboard-refresh', refresh);
    window.addEventListener('focus', refresh);
    const timer = window.setInterval(refresh, 60000);
    return () => { window.clearInterval(timer); window.removeEventListener('participant-dashboard-refresh', refresh); window.removeEventListener('focus', refresh); };
  }, []);

  const loadForms = async () => {
    try {
      const response = await api.get('/share/forms');
      setForms(response.data.data || []);
      setFormsError('');
    } catch {
      setFormsError('Unable to load forms. Please try again.');
    } finally { setLoading(false); }
  };

  const redeem = async (value: string) => {
    if (busy) return;
    const normalizedCode = value.trim().toUpperCase();
    if (!normalizedCode) {
      setCodeError('Enter an access code.');
      codeInputRef.current?.focus();
      return;
    }
    setCodeError(''); setBusy(true);
    try {
      await api.post('/share/redeem', { code: normalizedCode });
      setCode('');
      await Promise.all([loadForms(), loadDashboard()]);
      toast.success('Form added to your workspace.');
    } catch (error: any) {
      setCodeError(error.response?.data?.message || 'Invalid access code. Please try again.');
    } finally { setBusy(false); }
  };

  useEffect(() => {
    void loadForms();
    const sharedCode = new URLSearchParams(window.location.search).get('code');
    if (sharedCode && !autoRedeemed.current) {
      autoRedeemed.current = true;
      void redeem(sharedCode).finally(() => router.replace('/dashboard'));
    }
  }, []);

    const formatExpiry = (value: string) => new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  const currentPage = Math.min(page, Math.max(1, Math.ceil(forms.length / 10)));
  const invites = dashboard?.invites || [];
  const currentInvitePage = Math.min(invitePage, Math.max(1, Math.ceil(invites.length / 10)));
  const stats = [
    { label: 'Active forms', count: dashboard?.totals.active, hint: 'Available in your workspace', icon: RiFileTextLine, tone: 'bg-indigo-50 text-indigo-600' },
    { label: 'Pending invitations', count: dashboard?.totals.pending, hint: 'Waiting for your response', icon: RiMailLine, tone: 'bg-amber-50 text-amber-600' },
    { label: 'Total submissions', count: dashboard?.totals.submitted, hint: 'Answers successfully saved', icon: RiCheckboxCircleLine, tone: 'bg-emerald-50 text-emerald-600' },
    { label: 'To complete', count: dashboard?.totals.unfilled, hint: 'Forms awaiting your answers', icon: RiTimeLine, tone: 'bg-sky-50 text-sky-600' },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader icon={<RiDashboardLine />} eyebrow="Your workspace" title="Dashboard" description="Your next conversation starts here. Manage invitations and open the forms shared with you." />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, count, hint, icon: Icon, tone }) => <div key={label} className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold text-slate-500">{label}</p><span className={`rounded-lg p-2 ${tone}`}><Icon aria-hidden="true" className="h-4 w-4" /></span></div>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{dashboardError ? '-' : count ?? '...'}</p>
          <p className="mt-2 text-xs text-slate-400">{hint}</p>
        </div>)}
      </div>
      {dashboardError && <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{dashboardError} <button onClick={() => { void loadDashboard(); }} className="font-semibold underline">Try again</button></div>}
      <div className="grid items-start gap-6 lg:grid-cols-3">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="font-semibold text-slate-900">Invitations</h2><p className="mt-1 text-xs text-slate-500">Choose which forms to add to your workspace.</p></div><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">{invites.length} pending</span></div>
          {!dashboard && !dashboardError && <p role="status" className="p-5 text-sm text-slate-500">Loading invitations...</p>}
          {dashboard && !dashboardError && !invites.length && <div className="p-8 text-center"><RiMailLine aria-hidden="true" className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-sm font-semibold text-slate-700">You're all caught up</p><p className="mt-1 text-xs text-slate-500">New invitations will appear here.</p></div>}
          <div className="divide-y divide-slate-100">{invites.slice((currentInvitePage - 1) * 10, currentInvitePage * 10).map(invite => <article key={invite.id} className="p-5">
            <h3 className="text-sm font-semibold text-slate-900">{invite.workflow.name}</h3>
            <p className="mt-1 text-xs text-slate-500 break-words">Invited by {invite.createdBy.name || invite.createdBy.email}</p>
            {invite.workflow.description && <p className="mt-3 text-sm leading-relaxed text-slate-600">{invite.workflow.description}</p>}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="flex items-center gap-1.5 text-xs text-slate-500"><RiTimeLine aria-hidden="true" />Expires {formatExpiry(invite.expiresAt)}</p>
              <div className="flex gap-2">
                <button disabled={!!responding} onClick={() => { setResponseError(''); setConfirmation({ id: invite.id, name: invite.workflow.name, action: 'decline' }); }} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">Decline</button>
                <button disabled={!!responding} onClick={() => { setResponseError(''); setConfirmation({ id: invite.id, name: invite.workflow.name, action: 'accept' }); }} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{responding === invite.id ? 'Processing...' : 'Accept invitation'}</button>
              </div>
            </div>
          </article>)}</div>
          {invites.length > 10 && <div className="p-4"><Pagination total={invites.length} page={currentInvitePage} onPageChange={setInvitePage} label="Invitation pagination" /></div>}
        </section>
        <section className="relative overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-sky-50 p-5">
          <span className="inline-flex rounded-xl border border-indigo-100 bg-white p-2.5 text-indigo-600"><RiKey2Line aria-hidden="true" className="h-5 w-5" /></span>
          <h2 className="mt-4 font-semibold text-slate-900">Have an access code?</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">Enter the code shared by the form owner to add it to your workspace.</p>
          <form noValidate onSubmit={event => { event.preventDefault(); void redeem(code); }} className="mt-5 space-y-3">
            <label htmlFor="access-code" className="block text-xs font-semibold text-slate-600">Access code</label>
            <input id="access-code" ref={codeInputRef} aria-required="true" aria-invalid={Boolean(codeError)} aria-describedby={codeError ? 'access-code-error' : undefined} disabled={busy} value={code} onChange={event => { setCode(event.target.value.toUpperCase()); setCodeError(''); }} placeholder="KQ-..." className={`w-full rounded-xl border bg-white px-3 py-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${codeError ? 'border-rose-400' : 'border-slate-200'}`} />
            {codeError && <p id="access-code-error" role="alert" className="text-xs text-rose-600">{codeError}</p>}
            <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{busy ? 'Checking code...' : 'Add form'}<RiArrowRightLine aria-hidden="true" /></button>
          </form>
        </section>
      </div>
      <section aria-labelledby="my-forms-title" className="space-y-4">
        <div><h2 id="my-forms-title" className="text-lg font-bold text-slate-900">My forms</h2><p className="mt-1 text-sm text-slate-500">Open a form to review its details and start your voice conversation.</p></div>
        {loading && <p role="status" className="text-sm text-slate-500">Loading forms...</p>}
        {formsError && <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{formsError} <button onClick={() => { void loadForms(); }} className="font-semibold underline">Try again</button></div>}
        {!loading && !formsError && forms.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><RiFileTextLine aria-hidden="true" className="mx-auto h-9 w-9 text-indigo-300" /><h3 className="mt-3 text-sm font-semibold text-slate-900">Your workspace is ready</h3><p className="mt-2 text-sm text-slate-500">Accept an invitation or enter an access code to add your first form.</p></div>}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {forms.slice((currentPage - 1) * 10, currentPage * 10).map(form => <Link key={form.id} href={`/forms/${form.id}`} className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-indigo-300 hover:shadow-md focus-visible:outline-indigo-500">
            <div className="mb-4 flex items-center justify-between"><span className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600"><RiFileTextLine aria-hidden="true" className="h-5 w-5" /></span><span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">Access granted</span></div>
            <h3 className="font-semibold text-slate-900">{form.name}</h3>
            {form.description && <p className="mt-2 text-sm leading-relaxed text-slate-500">{form.description}</p>}
            <div className="mt-auto pt-5"><p className="flex items-start gap-1.5 text-xs text-slate-400"><RiTimeLine aria-hidden="true" className="mt-0.5 shrink-0" />Access until {formatExpiry(form.expiresAt)}</p><div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 text-sm font-semibold text-indigo-600">Open form<RiArrowRightLine aria-hidden="true" className="transition-transform group-hover:translate-x-1" /></div></div>
          </Link>)}
        </div>
        {!loading && !formsError && <Pagination total={forms.length} page={currentPage} onPageChange={setPage} label="Available forms pagination" />}
      </section>
      {confirmation && <Modal title={confirmation.action === 'accept' ? 'Accept invitation?' : 'Decline invitation?'} subtitle="Form invitation"
        onClose={() => { if (!responseLock.current) setConfirmation(null); }}
        footer={<div className="flex justify-end gap-3">
          <button type="button" disabled={!!responding} onClick={() => setConfirmation(null)} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
          <button type="button" disabled={!!responding} onClick={() => { void respond(confirmation.id, confirmation.action); }} className={`rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${confirmation.action === 'accept' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-rose-600 hover:bg-rose-700'}`}>
            {responding ? 'Processing...' : confirmation.action === 'accept' ? 'Accept invitation' : 'Decline invitation'}
          </button>
        </div>}>
        <p className="font-semibold text-slate-900">{confirmation.name}</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{confirmation.action === 'accept' ? 'This form will be added to your workspace. You can open it until the access expiry date.' : 'This invitation will be removed from your pending list. You will not gain access to this form through this invitation.'}</p>
        {responseError && <p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-600">{responseError}</p>}
      </Modal>}
    </div>
  );
}
