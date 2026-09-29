'use client';

import React, { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import PageHeader from '@/components/PageHeader';
import DashboardStatCard from '@/components/DashboardStatCard';
import { RiBarChartBoxLine, RiFlowChart, RiCheckboxCircleLine, RiFileTextLine, RiTimeLine } from 'react-icons/ri';
import { api } from '@/lib/api';
import type { AnalyticsSummary } from '@/lib/analytics';

export default function AnalyticsView() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/analytics/summary')
      .then((response) => setSummary(response.data.data))
      .catch((err) => setError(err.response?.data?.message || 'Unable to load analytics.'));
  }, []);

  return <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
    <PageHeader icon={<RiBarChartBoxLine />} eyebrow="Your workspace" title="Submission Analytics"
      description="Track form submissions and activity across your workflows." />
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
    {!summary && !error && <p role="status" className="text-sm text-slate-500">Loading analytics...</p>}
    {summary && <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <DashboardStatCard label="Workflows" count={summary.totalWorkflows} hint="Created in your workspace" icon={RiFlowChart} tone="bg-indigo-50 text-indigo-600" />
        <DashboardStatCard label="Published" count={summary.publishedWorkflows} hint="Ready to share with participants" icon={RiCheckboxCircleLine} tone="bg-emerald-50 text-emerald-600" />
        <DashboardStatCard label="Submissions" count={summary.totalSubmissions} hint="Answers successfully saved" icon={RiFileTextLine} tone="bg-sky-50 text-sky-600" />
        <DashboardStatCard label="Last 7 days" count={summary.submissionsLast7Days} hint="Recent submission activity" icon={RiTimeLine} tone="bg-amber-50 text-amber-600" />
      </div>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Daily submissions</h2><p className="mt-1 text-xs text-slate-500">Activity during the last 7 days.</p></div>
        {summary.submissionsLast7Days === 0 ? <div className="flex min-h-56 flex-col items-center justify-center p-6 text-center">
          <span className="rounded-xl bg-indigo-50 p-3 text-indigo-400"><RiBarChartBoxLine aria-hidden="true" className="h-7 w-7" /></span>
          <p className="mt-4 text-sm font-semibold text-slate-900">No submissions in the last 7 days</p>
          <p className="mt-1 text-xs text-slate-500">Activity will appear here when participants submit forms.</p>
        </div> : <div className="h-64 p-5">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={summary.lastSevenDays}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" name="Submissions" fill="#4f46e5" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>}
      </section>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Submissions by workflow</h2><p className="mt-1 text-xs text-slate-500">Compare response totals across your workflows.</p></div>
        {summary.byWorkflow.length === 0 ? <p className="p-5 text-sm text-slate-500">No workflows yet.</p> :
          <div className="divide-y divide-slate-100 px-5">{summary.byWorkflow.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm">
            <div className="min-w-0"><p className="break-words font-medium text-slate-800">{item.name}</p><p className="mt-1 text-xs capitalize text-slate-400">{item.status.toLowerCase()}</p></div>
            <span className="shrink-0 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">{item.submissions} {item.submissions === 1 ? 'submission' : 'submissions'}</span>
          </div>)}</div>}
      </section>
    </>}
  </div>;
}
