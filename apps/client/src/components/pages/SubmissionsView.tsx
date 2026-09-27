'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { RiFolderUserLine, RiGridLine, RiListCheck, RiSearchLine, RiCheckboxCircleLine, RiArrowDownSLine, RiDownloadLine } from 'react-icons/ri';
import Pagination from '@/components/Pagination';
import PageHeader from '@/components/PageHeader';
import Modal from '@/components/Modal';
import DatePicker from '@/components/DatePicker';
import { api } from '@/lib/api';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { downloadSubmissionPdf, orderedSubmissionAnswers, submissionAnswer } from '@/lib/submission-pdf';

interface Submission {
  fields?: { name: string; label?: string }[];
  id: string;
  workflowId: string;
  agentName: string | null;
  user: { name: string | null; email: string } | null;
  workflow: { name: string };
  data: Record<string, unknown>;
  createdAt: string;
}

export default function SubmissionsView({ personal = false }: { personal?: boolean }) {
  const [items, setItems] = useState<Submission[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [view, setView] = useState<'cards' | 'list'>('cards');
  const [page, setPage] = useState(1);
  const [activeId, setActiveId] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const pageSize = 10;
  const [query, setQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const invalidRange = Boolean(startDate && endDate && startDate > endDate);
  const hasFilters = Boolean(query || startDate || endDate);
  const resetFilters = () => { setQuery(''); setStartDate(''); setEndDate(''); setPage(1); };
  const search = useDebouncedValue(query).trim().toLowerCase();
  const selectedId = useSearchParams().get('submission') || '';

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    api.get(personal ? '/submissions/mine' : '/submissions', { signal: controller.signal })
      .then((response) => setItems(response.data.data || []))
      .catch((err) => { if (!controller.signal.aborted) setError(err.response?.data?.message || 'Unable to load submissions.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [personal, reload]);

  const visible = items.filter(item => {
    const date = new Date(item.createdAt);
    const localDay = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return !invalidRange && (!startDate || localDay >= startDate) && (!endDate || localDay <= endDate);
  }).filter(item => !search || [item.workflow.name, item.id,
    ...(personal ? [] : [item.user?.name, item.user?.email, item.agentName])]
    .some(value => value?.toLowerCase().includes(search)))
    .sort((a, b) => Number(b.id === selectedId) - Number(a.id === selectedId));
  useEffect(() => { setPage(1); }, [search, startDate, endDate, personal]);
  useEffect(() => { setActiveId(selectedId); }, [selectedId]);
  useEffect(() => { setExportError(''); }, [activeId]);
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageItems = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const activeItem = items.find(item => item.id === activeId);
  const answer = submissionAnswer;
  const exportPdf = async () => {
    if (!activeItem || exporting) return;
    setExporting(true);
    setExportError('');
    try {
      await downloadSubmissionPdf(activeItem, personal);
    } catch {
      setExportError('Unable to export PDF. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader icon={<RiFolderUserLine />} eyebrow={personal ? 'Your workspace' : 'Response library'}
        title={personal ? 'Form history' : 'Form submissions'}
        description={personal ? 'Your answers, all in one place. Revisit submitted forms even after access expires.' : 'Browse responses and explore the answers submitted to your forms.'} />
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <label className="relative flex-1"><span className="sr-only">Search submissions</span><RiSearchLine aria-hidden="true" className="absolute left-3.5 top-3.5 text-slate-400 w-5 h-5" />
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search submissions..." className="w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </label>
        <div role="group" aria-label="Submission layout" className="flex shrink-0 rounded-xl border border-slate-200 bg-slate-100 p-1">
          {(['cards', 'list'] as const).map(mode => <button key={mode} type="button" aria-pressed={view === mode} onClick={() => setView(mode)} className={`flex items-center justify-center flex-1 gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${view === mode ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>
            {mode === 'cards' ? <RiGridLine aria-hidden="true" /> : <RiListCheck aria-hidden="true" />}{mode === 'cards' ? 'Cards' : 'List'}
          </button>)}
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <DatePicker label="Start date" value={startDate} onChange={setStartDate} max={endDate || undefined} invalid={invalidRange} describedBy={invalidRange ? "date-filter-help" : undefined} />
          <DatePicker label="End date" value={endDate} onChange={setEndDate} min={startDate || undefined} invalid={invalidRange} describedBy={invalidRange ? "date-filter-help" : undefined} />
          <button type="button" disabled={!hasFilters} onClick={resetFilters} className="rounded-lg px-3 py-2.5 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 disabled:text-slate-400 disabled:cursor-not-allowed">Reset filters</button>
        </div>
        {invalidRange && <p id="date-filter-help" role="alert" className="mt-2 text-xs text-rose-600">End date must be on or after start date.</p>}
      </div>
      {loading ? <div role="status" className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">Loading submissions...</div>
        : error ? <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">{error} <button className="underline font-semibold" onClick={() => setReload(value => value + 1)}>Try again</button></div>
        : <>
          <p role="status" className="text-xs font-medium text-slate-500">{visible.length} {visible.length === 1 ? 'submission' : 'submissions'}{hasFilters ? ' matching your filters' : ' loaded'} · Newest first</p>
          {visible.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center"><RiFolderUserLine aria-hidden="true" className="mx-auto w-10 h-10 text-indigo-300" /><h2 className="mt-4 font-semibold text-slate-900">{hasFilters ? 'No matching submissions' : 'No submissions yet'}</h2><p className="mt-2 text-sm text-slate-500">{hasFilters ? 'Try another search or date range.' : 'Completed forms will appear here once submitted.'}</p>{hasFilters && <button onClick={resetFilters} className="mt-4 text-sm font-semibold text-indigo-600">Reset filters</button>}</div>
            : <div className={view === 'cards' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start' : 'space-y-3'}>
              {pageItems.map(item => <article key={item.id} className={`group rounded-2xl border bg-white shadow-xs overflow-hidden ${selectedId === item.id ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-slate-200 hover:border-indigo-200'}`}>
                <div className={`p-5 ${view === 'list' ? 'flex flex-wrap items-center gap-4' : 'space-y-5'}`}>
                  <div className={`flex items-start gap-3 ${view === 'list' ? 'flex-1 min-w-0' : ''}`}>
                    <div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-500 shrink-0"><RiFolderUserLine className="w-5 h-5" aria-hidden="true" /></div>
                    <div className="min-w-0"><h2 className="text-base font-semibold text-slate-900 break-words">{item.workflow.name}</h2><p className="mt-1 text-xs text-slate-500">{Object.keys(item.data).length} answers saved</p>{!personal && <p className="text-xs text-slate-500 mt-1 break-words">{item.user?.name || item.user?.email || item.agentName || 'Owner'}</p>}</div>
                  </div>
                  <div className="flex items-center justify-between gap-3"><span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700"><RiCheckboxCircleLine aria-hidden="true" />Submitted</span><time dateTime={item.createdAt} className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</time></div>
                  <button type="button" onClick={() => setActiveId(item.id)} aria-label={`View answers for ${item.workflow.name}`} className={`flex items-center justify-between text-xs font-semibold text-indigo-600 hover:text-indigo-800 focus-visible:outline-indigo-500 ${view === 'cards' ? 'w-full border-t border-slate-100 pt-4' : 'gap-3'}`}>View answers<RiArrowDownSLine aria-hidden="true" className="w-4 h-4 -rotate-90" /></button>
                </div>
              </article>)}
            </div>}
          <Pagination total={visible.length} page={currentPage} onPageChange={setPage} pageSize={pageSize} label="Submission pagination" />
        </>}
      {activeItem && <Modal title={activeItem.workflow.name} subtitle="Submission details" onClose={() => setActiveId('')}
        footer={<div className="flex items-center justify-between gap-3">
          <button type="button" onClick={() => setActiveId('')} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Close</button>
          <button type="button" disabled={exporting} onClick={() => { void exportPdf(); }} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-wait">
            <RiDownloadLine aria-hidden="true" />{exporting ? 'Preparing PDF...' : 'Export PDF'}
          </button>
        </div>}>
        {exportError && <p role="alert" className="mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-600">{exportError}</p>}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100/70 px-2.5 py-1 text-xs font-semibold text-emerald-700"><RiCheckboxCircleLine aria-hidden="true" />Submitted</span>
            <time dateTime={activeItem.createdAt} className="text-xs text-slate-500">{new Date(activeItem.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}</time>
          </div>
          {!personal && <p className="mt-3 text-sm text-slate-700">Submitted by <span className="font-semibold">{activeItem.user?.name || activeItem.user?.email || activeItem.agentName || 'Owner'}</span></p>}
          <div className="mt-3 border-t border-slate-200 pt-3"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Receipt ID</p><p className="mt-1 break-all font-mono text-xs text-slate-500 select-all">{activeItem.id}</p></div>
        </div>
        <div className="mt-6 mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold text-slate-900">{personal ? 'Your answers' : 'Submitted answers'}</h3><span className="text-xs text-slate-400">{Object.keys(activeItem.data).length} fields</span></div>
        <dl className="divide-y divide-slate-100">
          {orderedSubmissionAnswers(activeItem).map(({ name, label, value }, index) => <div key={name} className="flex gap-3 py-4">
            <span aria-hidden="true" className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-[10px] font-semibold text-indigo-500">{String(index + 1).padStart(2, '0')}</span>
            <div className="min-w-0 flex-1"><dt className="text-xs font-medium text-slate-500">{label}</dt><dd className="mt-1.5 text-sm leading-relaxed text-slate-900 whitespace-pre-wrap break-words">{answer(value)}</dd></div>
          </div>)}
        </dl>
      </Modal>}
    </div>
  );
}
