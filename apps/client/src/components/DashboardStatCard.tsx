import type { IconType } from 'react-icons';

export default function DashboardStatCard({ label, count, hint, icon: Icon, tone }: {
  label: string;
  count: number | string | null | undefined;
  hint: string;
  icon: IconType;
  tone: string;
}) {
  return <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5">
    <div className="flex items-center justify-between gap-2">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <span className={`rounded-lg p-2 ${tone}`}><Icon aria-hidden="true" className="h-4 w-4" /></span>
    </div>
    <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{count ?? '...'}</p>
    <p className="mt-2 text-xs text-slate-400">{hint}</p>
  </div>;
}
