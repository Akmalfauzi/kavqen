'use client';

export default function Pagination({ total, page, onPageChange, pageSize = 10, label = 'Pagination' }: {
  total: number; page: number; onPageChange: (page: number) => void; pageSize?: number; label?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.max(1, Math.min(page, pages));
  if (!total) return null;
  return <nav aria-label={label} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
    <p className="text-xs text-slate-500">Showing {(current - 1) * pageSize + 1}-{Math.min(current * pageSize, total)} of {total} · {pageSize} per page</p>
    <div className="flex items-center gap-3 text-sm">
      <button type="button" disabled={current === 1} onClick={() => onPageChange(current - 1)} className="rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">Previous</button>
      <span aria-live="polite" className="text-slate-600">Page {current} of {pages}</span>
      <button type="button" disabled={current === pages} onClick={() => onPageChange(current + 1)} className="rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">Next</button>
    </div>
  </nav>;
}
