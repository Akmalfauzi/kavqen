'use client';

import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { RiFileListLine, RiCheckLine, RiDeleteBinLine, RiFileCopyLine, RiArrowLeftSLine } from 'react-icons/ri';
import PageHeader from '@/components/PageHeader';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface PublishedField {
  name: string;
  label?: string;
  type: string;
  required?: boolean;
  options?: string[];
}

interface CodeRecord {
  id: string;
  prefix: string;
  inviteEmail?: string;
  inviteStatus?: string;
  expiresAt: string;
  revokedAt: string | null;
}

// Mirrors the input the participant sees on /forms/:id, read-only.
function FieldPreview({ field }: { field: PublishedField }) {
  const label = field.label || field.name;
  const shared = 'mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm text-slate-400';
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}{field.required && <span className="text-rose-600"> *</span>}
      {field.type === 'enum' && field.options?.length
        ? <select disabled className={shared}><option>{field.options[0]}</option></select>
        : field.type === 'text'
          ? <textarea disabled rows={3} className={`${shared} resize-none`} placeholder={`Participant fills in ${label.toLowerCase()}`} />
          : <input disabled className={shared}
              type={field.type === 'datetime' ? 'datetime-local' : field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
              placeholder={`Participant fills in ${label.toLowerCase()}`} />}
    </label>
  );
}

export default function AgentFormView({ agentId }: { agentId: string }) {
  const router = useRouter();
  const [agent, setAgent] = useState<any>(null);
  const [fields, setFields] = useState<PublishedField[]>([]);
  const [codes, setCodes] = useState<CodeRecord[]>([]);
  const [expiresAt, setExpiresAt] = useState(() => {
    const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [newCode, setNewCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const workflow = agent?.workflow;
  const published = workflow?.status === 'PUBLISHED';

  const loadCodes = useCallback(async (workflowId: string) => {
    try {
      const response = await api.get('/share/codes', { params: { workflowId } });
      setCodes(response.data.data || []);
    } catch {
      setCodes([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.get(`/agents/${agentId}`)
      .then(async (response) => {
        if (cancelled) return;
        const found = response.data.data;
        setAgent(found);
        if (found.workflow?.status === 'PUBLISHED') {
          // publishedFields only exist once the workflow has been published.
          const form = await api.get(`/share/forms/${found.workflow.id}`).catch(() => null);
          if (!cancelled && form) setFields(form.data.data.fields || []);
          if (!cancelled) await loadCodes(found.workflow.id);
        }
      })
      .catch(() => toast.error('Could not load this agent'))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [agentId, loadCodes]);

  const createCode = async () => {
    setBusy(true);
    try {
      const response = await api.post('/share/codes', { workflowId: workflow.id, expiresAt: new Date(expiresAt).toISOString() });
      setNewCode(response.data.data.code);
      await loadCodes(workflow.id);
      toast.success('Access code created');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create access code');
    } finally {
      setBusy(false);
    }
  };

  const sendInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail.trim())) {
      setInviteError('Enter a valid email address.'); return;
    }
    if (!Number.isFinite(new Date(expiresAt).getTime()) || new Date(expiresAt) <= new Date()) {
      setInviteError('Pick an expiry in the future.'); return;
    }
    setBusy(true); setInviteError('');
    try {
      await api.post('/share/invites', { workflowId: workflow.id, email: inviteEmail.trim(), expiresAt: new Date(expiresAt).toISOString() });
      setInviteEmail('');
      await loadCodes(workflow.id);
      toast.success('Invitation created. The recipient responds from their dashboard.');
    } catch (error: any) {
      setInviteError(error.response?.data?.message || 'Could not create the invitation.');
    } finally { setBusy(false); }
  };

  const revokeCode = async (id: string) => {
    try {
      await api.delete(`/share/codes/${id}`);
      await loadCodes(workflow.id);
      toast.success('Access code revoked');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to revoke access code');
    }
  };

  const shareLink = newCode && typeof window !== 'undefined'
    ? `${window.location.origin}/dashboard?code=${encodeURIComponent(newCode)}` : '';

  if (loading) return <div className="p-6 text-sm text-slate-500">Loading form...</div>;

  return <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
    <button type="button" onClick={() => router.push('/agents')}
      className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 transition hover:text-slate-900">
      <RiArrowLeftSLine aria-hidden="true" className="h-4 w-4" />
      <span>Back to Agents</span>
    </button>

    <PageHeader icon={<RiFileListLine />} eyebrow={agent?.name || 'Agent'} title="Form"
      description="What participants see, and who is allowed to open it." />

    {!published && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <p className="text-sm font-semibold text-amber-900">This form is not published yet.</p>
      <p className="mt-1 text-sm text-amber-800">
        Publish the workflow first — participants cannot open the form, and access codes cannot be created, until then.
      </p>
    </div>}

    <div className="grid gap-5 lg:grid-cols-2">
      {/* Participant preview */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900">Participant view</h2>
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${published ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>
            {published && <RiCheckLine aria-hidden="true" className="h-3.5 w-3.5" />}
            {published ? 'Published' : 'Draft'}
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-500">{workflow?.name}</p>

        <div className="mt-5 space-y-4">
          {fields.length === 0
            ? <p className="text-sm text-slate-500">
                {published ? 'This form has no fields yet. Link master data fields to the workflow steps.' : 'Fields appear here once the workflow is published.'}
              </p>
            : fields.map((field) => <FieldPreview key={field.name} field={field} />)}
          {fields.length > 0 && <button type="button" disabled
            className="mt-2 h-10 w-full rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white opacity-50">Submit form</button>}
        </div>
      </section>

      {/* Access management */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Access</h2>
          <p className="mt-1 text-sm text-slate-500">Recipients must sign in. Access ends at the time you choose.</p>
        </div>

        <label className="block text-sm font-semibold text-slate-700">
          Valid until
          <input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm" />
        </label>

        <button type="button" onClick={createCode} disabled={busy || !published || !expiresAt}
          className="h-10 w-full rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40">
          {busy ? 'Working...' : 'Create access code'}
        </button>

        {newCode && <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 space-y-2">
          <p className="text-xs text-indigo-800">Copy it now — the full code is shown only once.</p>
          <p className="font-mono font-bold text-slate-900 select-all">{newCode}</p>
          <button type="button" onClick={() => { void navigator.clipboard.writeText(shareLink); toast.success('Link copied'); }}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-700">
            <RiFileCopyLine aria-hidden="true" className="h-4 w-4" />Copy sign-in + form link
          </button>
        </div>}

        <form noValidate onSubmit={sendInvite} className="space-y-2 border-t border-slate-100 pt-4">
          <label htmlFor="invite-email" className="block text-sm font-semibold text-slate-700">Invite by email</label>
          <p className="text-xs text-slate-500">The invitation appears on that account&apos;s dashboard. No email is sent. Access follows the expiry above.</p>
          <input id="invite-email" type="email" value={inviteEmail} disabled={!published}
            onChange={(e) => { setInviteEmail(e.target.value); setInviteError(''); }}
            aria-invalid={!!inviteError} aria-describedby={inviteError ? 'invite-error' : undefined}
            placeholder="participant@email.com"
            className={`w-full rounded-lg border p-2 text-sm disabled:bg-slate-50 ${inviteError ? 'border-red-400' : 'border-slate-200'}`} />
          {inviteError && <p id="invite-error" role="alert" className="text-xs text-red-600">{inviteError}</p>}
          <button type="submit" disabled={busy || !published}
            className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">
            Send invitation
          </button>
        </form>

        <div className="space-y-2 border-t border-slate-100 pt-4">
          <h3 className="text-sm font-semibold text-slate-800">Codes and invitations</h3>
          {codes.length === 0 && <p className="text-sm text-slate-500">Nothing shared yet.</p>}
          {codes.map((code) => {
            const active = !code.revokedAt && new Date(code.expiresAt) > new Date();
            return <div key={code.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-2.5 text-xs">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-800">
                  {code.inviteEmail ? `${code.inviteEmail} (${code.inviteStatus})` : `${code.prefix}…`}
                </p>
                <p className="text-slate-500">{new Date(code.expiresAt).toLocaleString()} · {active ? 'Active' : 'Inactive'}</p>
              </div>
              {active && <button type="button" onClick={() => { void revokeCode(code.id); }}
                aria-label="Revoke access"
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-semibold text-rose-600 hover:bg-rose-50">
                <RiDeleteBinLine aria-hidden="true" className="h-3.5 w-3.5" />Revoke
              </button>}
            </div>;
          })}
        </div>
      </section>
    </div>
  </div>;
}
