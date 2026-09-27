'use client';

import { useEffect, useState } from 'react';
import { RiNotification3Line, RiCheckDoubleLine, RiDeleteBinLine } from 'react-icons/ri';
import { useNotifications } from '@/contexts/NotificationsContext';
import Pagination from '@/components/Pagination';
import PageHeader from '@/components/PageHeader';

export default function NotificationsView() {
  const { notifications, loading, error, refresh, markRead, markAllRead, clearAll } = useNotifications();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const unread = notifications.filter(item => !item.readAt).length;
  const visible = filter === 'unread' ? notifications.filter(item => !item.readAt) : notifications;
  const currentPage = Math.min(page, Math.max(1, Math.ceil(visible.length / 10)));
  const pageItems = visible.slice((currentPage - 1) * 10, currentPage * 10);
  useEffect(() => { setPage(currentPage); }, [currentPage]);
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try { await action(); } finally { setBusy(false); }
  };

  return <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
    <PageHeader icon={<RiNotification3Line />} eyebrow="Your workspace" title="Notifications"
      description="Stay up to date with invitations, submissions, and account activity." />
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div role="group" aria-label="Filter notifications" className="flex w-fit gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1">
        {(['all', 'unread'] as const).map(value => <button key={value} type="button" aria-pressed={filter === value} onClick={() => { setFilter(value); setPage(1); }} className={`rounded-lg px-4 py-2 text-sm font-semibold ${filter === value ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>
          {value === 'all' ? 'All' : 'Unread'} <span className="ml-1 text-xs opacity-70">{value === 'all' ? notifications.length : unread}</span>
        </button>)}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy || loading || !unread} onClick={() => { void run(markAllRead); }} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"><RiCheckDoubleLine aria-hidden="true" />Mark all as read</button>
        <button type="button" disabled={busy || loading || !notifications.length} onClick={() => { void run(clearAll); }} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-40"><RiDeleteBinLine aria-hidden="true" />Clear all</button>
      </div>
    </div>
    {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error} <button onClick={() => { void refresh(); }} className="font-semibold underline">Try again</button></div>}
    {loading && <p role="status" className="p-6 text-sm text-slate-500">Loading notifications...</p>}
    {!loading && !error && visible.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
      <RiNotification3Line aria-hidden="true" className="mx-auto h-10 w-10 text-indigo-300" />
      <h2 className="mt-4 font-semibold text-slate-900">{filter === 'unread' ? "You're all caught up" : 'No notifications yet'}</h2>
      <p className="mt-2 text-sm text-slate-500">{filter === 'unread' ? 'New unread notifications will appear here.' : 'Updates about your activity will appear here.'}</p>
    </div>}
    {!loading && <div className="space-y-3">{pageItems.map(item => <article key={item.id} className={`flex items-start gap-3 sm:gap-4 rounded-2xl border p-4 sm:p-5 ${item.readAt ? 'border-slate-200 bg-white' : 'border-indigo-200 bg-indigo-50/30'}`}>
      <div aria-hidden="true" className={`shrink-0 rounded-xl p-2.5 ${item.readAt ? 'bg-slate-100 text-slate-400' : 'bg-indigo-100 text-indigo-600'}`}><RiNotification3Line className="h-5 w-5" /></div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2"><h2 className="text-sm font-semibold text-slate-900 break-words">{item.title}</h2>{!item.readAt && <span aria-label="Unread" className="h-2 w-2 shrink-0 rounded-full bg-indigo-500" />}</div>
        <p className="mt-1 text-sm leading-relaxed text-slate-600 break-words">{item.description}</p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <time dateTime={item.createdAt} className="text-xs text-slate-400">{new Date(item.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</time>
          {!item.readAt && <button type="button" disabled={busy} onClick={() => { void run(() => markRead(item.id)); }} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 disabled:opacity-40">Mark as read</button>}
        </div>
      </div>
    </article>)}</div>}
    {!loading && !error && <Pagination total={visible.length} page={currentPage} onPageChange={setPage} label="Notification pagination" />}
  </div>;
}
