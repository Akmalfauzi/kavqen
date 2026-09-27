'use client';

import React, { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import PageHeader from '@/components/PageHeader';
import { RiBarChartBoxLine } from 'react-icons/ri';
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
    {error && <p className="text-sm text-rose-700">{error}</p>}
    {!summary && !error && <p className="text-sm text-slate-500">Loading analytics...</p>}
    {summary && <>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          ['Total workflows', summary.totalWorkflows],
          ['Published workflows', summary.publishedWorkflows],
          ['Total submissions', summary.totalSubmissions],
          ['Submissions in the last 7 days', summary.submissionsLast7Days]
        ].map(([label, value]) => <div key={label} className="bg-white border border-slate-200 rounded-2xl p-5">
          <p className="text-xs text-slate-500">{label}</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">{value}</p>
        </div>)}
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <h2 className="font-bold text-slate-900 mb-4">Daily submissions - last 7 days</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={summary.lastSevenDays}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" name="Submissions" fill="#4f46e5" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <h2 className="font-bold text-slate-900 mb-4">Submissions by workflow</h2>
        {summary.byWorkflow.length === 0 ? <p className="text-sm text-slate-500">No workflows yet.</p> :
          <div className="divide-y divide-slate-100">{summary.byWorkflow.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
            <span className="text-slate-800">{item.name} <span className="text-xs text-slate-400">({item.status})</span></span>
            <strong>{item.submissions} {item.submissions === 1 ? 'submission' : 'submissions'}</strong>
          </div>)}</div>}
      </div>
      <p className="text-xs text-slate-500">Voice metrics such as latency and sentiment are not recorded yet.</p>
    </>}
  </div>;
}
