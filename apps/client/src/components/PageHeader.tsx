import type { ReactNode } from 'react';

export default function PageHeader({ title, description, eyebrow, icon, actions }: {
  title: string;
  description?: string;
  eyebrow?: string;
  icon: ReactNode;
  actions?: ReactNode;
}) {
  return <header className="relative overflow-hidden bg-white p-6 sm:p-8 rounded-2xl border border-slate-200/80 shadow-xs">
    <div aria-hidden="true" className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-gradient-to-br from-indigo-100/70 to-sky-50" />
    <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-start gap-4 min-w-0">
        <div aria-hidden="true" className="p-3 shrink-0 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 [&>svg]:w-6 [&>svg]:h-6">{icon}</div>
        <div className="min-w-0">
          {eyebrow && <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">{eyebrow}</p>}
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">{title}</h1>
          {description && <p className="text-sm text-slate-500 mt-2 max-w-xl">{description}</p>}
        </div>
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  </header>;
}
