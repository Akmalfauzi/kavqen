'use client';

import PageHeader from '@/components/PageHeader';
import DashboardStatCard from '@/components/DashboardStatCard';
import { RiDashboardLine, RiFlowChart, RiCheckboxCircleLine, RiFileTextLine, RiTimeLine, RiArrowRightLine } from 'react-icons/ri';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { AnalyticsSummary } from '@/lib/analytics';
import type { ActivePage } from '../AppSidebar';

interface DashboardViewProps {
  onNavigate: (page: ActivePage) => void;
}

export default function DashboardView({ onNavigate }: DashboardViewProps) {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/analytics/summary')
      .then((response) => setSummary(response.data.data))
      .catch((err) => setError(err.response?.data?.message || 'Could not load the dashboard'));
  }, []);

  const stats = summary && [
    { label: 'Workflows', count: summary.totalWorkflows, hint: 'Created in your workspace', icon: RiFlowChart, tone: 'bg-indigo-50 text-indigo-600' },
    { label: 'Published', count: summary.publishedWorkflows, hint: 'Ready to share with participants', icon: RiCheckboxCircleLine, tone: 'bg-emerald-50 text-emerald-600' },
    { label: 'Submissions', count: summary.totalSubmissions, hint: 'Answers successfully saved', icon: RiFileTextLine, tone: 'bg-sky-50 text-sky-600' },
    { label: 'Last 7 days', count: summary.submissionsLast7Days, hint: 'Recent submission activity', icon: RiTimeLine, tone: 'bg-amber-50 text-amber-600' },
  ];

  return <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
    <PageHeader icon={<RiDashboardLine />} eyebrow="Your workspace" title="Dashboard" description="An overview of your workflows and forms." />
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
    {!summary && !error && <p role="status" className="text-sm text-slate-500">Loading dashboard...</p>}
    {summary && <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats?.map(stat => <DashboardStatCard key={stat.label} {...stat} />)}
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Workflows by submission</h2><p className="mt-1 text-xs text-slate-500">See which workflows receive responses.</p></div>
          {summary.byWorkflow.length === 0 ? <p className="p-5 text-sm text-slate-500">No workflows yet.</p> :
            <div className="divide-y divide-slate-100 px-5">{summary.byWorkflow.slice(0, 5).map((item) => <div key={item.id} className="flex items-center justify-between gap-3 py-4 text-sm">
              <span className="min-w-0 break-words font-medium text-slate-800">{item.name}</span><span className="shrink-0 text-xs text-slate-500">{item.submissions} {item.submissions === 1 ? 'submission' : 'submissions'}</span>
            </div>)}</div>}
          <div className="border-t border-slate-100 px-5 py-4"><button onClick={() => onNavigate('workflows')} className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-indigo-600 hover:bg-indigo-50">View workflows<RiArrowRightLine aria-hidden="true" /></button></div>
        </section>
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Recent submissions</h2><p className="mt-1 text-xs text-slate-500">Latest answers across your forms.</p></div>
          {summary.recentSubmissions.length === 0 ? <p className="p-5 text-sm text-slate-500">No submissions yet.</p> :
            <div className="divide-y divide-slate-100 px-5">{summary.recentSubmissions.slice(0, 5).map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-4 text-sm">
              <span className="min-w-0 break-words font-medium text-slate-800">{summary.byWorkflow.find((workflow) => workflow.id === item.workflowId)?.name || 'Workflow'}</span>
              <time dateTime={item.createdAt} className="shrink-0 text-xs text-slate-500">{new Date(item.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</time>
            </div>)}</div>}
          <div className="border-t border-slate-100 px-5 py-4"><button onClick={() => onNavigate('submissions')} className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-indigo-600 hover:bg-indigo-50">View submissions<RiArrowRightLine aria-hidden="true" /></button></div>
        </section>
      </div>
      <button onClick={() => onNavigate('analytics')} className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-indigo-600 hover:bg-indigo-50">View full analytics<RiArrowRightLine aria-hidden="true" /></button>
    </>}
  </div>;
}
