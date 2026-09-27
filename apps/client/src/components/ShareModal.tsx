'use client';

import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';

interface CodeRecord {
  id: string;
  prefix: string;
  inviteEmail?: string;
  inviteStatus?: string;
  expiresAt: string;
  revokedAt: string | null;
}

export default function ShareModal({ workflowId, workflowName, onClose }: {
  workflowId: string;
  workflowName: string;
  onClose: () => void;
}) {
  const [codes, setCodes] = useState<CodeRecord[]>([]);
  const [expiresAt, setExpiresAt] = useState(() => {
    const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [newCode, setNewCode] = useState('');
  const [busy, setBusy] = useState(false);

  const loadCodes = async () => {
    try {
      const response = await api.get('/share/codes', { params: { workflowId } });
      setCodes(response.data.data || []);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load access codes');
    }
  };

  useEffect(() => { void loadCodes(); }, [workflowId]);

  const createCode = async () => {
    setBusy(true);
    try {
      const response = await api.post('/share/codes', { workflowId, expiresAt: new Date(expiresAt).toISOString() });
      setNewCode(response.data.data.code);
      await loadCodes();
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
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail.trim()) || !Number.isFinite(new Date(expiresAt).getTime()) || new Date(expiresAt) <= new Date()) {
      setInviteError('Isi email dan waktu kedaluwarsa yang valid.'); return;
    }
    setBusy(true); setInviteError('');
    try {
      await api.post('/share/invites', { workflowId, email: inviteEmail.trim(), expiresAt: new Date(expiresAt).toISOString() });
      setInviteEmail(''); await loadCodes(); toast.success('Undangan dibuat. Penerima dapat merespons di dashboard.');
    } catch (error: any) { setInviteError(error.response?.data?.message || 'Gagal membuat undangan.'); }
    finally { setBusy(false); }
  };

  const revokeCode = async (id: string) => {
    try {
      await api.delete(`/share/codes/${id}`);
      await loadCodes();
      toast.success('Access code revoked');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to revoke access code');
    }
  };

  const shareLink = newCode && typeof window !== 'undefined'
    ? `${window.location.origin}/dashboard?code=${encodeURIComponent(newCode)}` : '';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto space-y-4" onClick={(event) => event.stopPropagation()}>
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold">Share: {workflowName}</h2>
          <button onClick={onClose} aria-label="Close" className="text-slate-500">✕</button>
        </div>
        <p className="text-sm text-slate-600">Penerima harus login. Akses form berakhir pada waktu yang dipilih.</p>
        <label className="block text-sm font-semibold">
          Berlaku sampai
          <input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} className="block mt-1 w-full border border-slate-300 rounded-lg p-2" />
        </label>
        <button onClick={createCode} disabled={busy || !expiresAt} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
          {busy ? 'Membuat...' : 'Buat kode akses'}
        </button>

        <form noValidate onSubmit={sendInvite} className="border-t pt-4 space-y-2">
          <label htmlFor="invite-email" className="block text-sm font-semibold">Undang participant lewat email</label>
          <p className="text-xs text-slate-500">Undangan muncul di dashboard akun dengan email ini. Tidak mengirim email. Masa akses mengikuti waktu di atas.</p>
          <input id="invite-email" type="email" value={inviteEmail} onChange={e => { setInviteEmail(e.target.value); setInviteError(''); }} aria-invalid={!!inviteError} aria-describedby={inviteError ? 'invite-error' : undefined} className="w-full border rounded-lg p-2 text-sm" placeholder="participant@email.com" />
          {inviteError && <p id="invite-error" role="alert" className="text-xs text-red-600">{inviteError}</p>}
          <button disabled={busy} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">Kirim undangan</button>
        </form>

        {newCode && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-2">
            <p className="text-xs text-indigo-800">Salin sekarang. Kode lengkap hanya tampil sekali.</p>
            <p className="font-mono font-bold select-all">{newCode}</p>
            <button onClick={() => { void navigator.clipboard.writeText(shareLink); toast.success('Link disalin'); }} className="text-sm font-semibold text-indigo-700">Salin link login + form</button>
          </div>
        )}

        <div className="space-y-2 max-h-48 overflow-y-auto">
          <h3 className="text-sm font-bold">Kode dan undangan</h3>
          {codes.map((code) => {
            const active = !code.revokedAt && new Date(code.expiresAt) > new Date();
            return <div key={code.id} className="flex justify-between items-center border rounded-lg p-2 text-xs">
              <span>{code.inviteEmail ? `${code.inviteEmail} (${code.inviteStatus})` : `${code.prefix}…`} · {new Date(code.expiresAt).toLocaleString()} · {active ? 'Aktif' : 'Tidak aktif'}</span>
              {active && <button onClick={() => { void revokeCode(code.id); }} className="text-rose-600 font-semibold">Cabut</button>}
            </div>;
          })}
        </div>
      </div>
    </div>
  );
}
