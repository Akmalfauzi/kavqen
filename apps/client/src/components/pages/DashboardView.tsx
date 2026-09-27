'use client';

import PageHeader from '@/components/PageHeader';
import { RiDashboardLine } from 'react-icons/ri';

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

  return <div className="p-6 max-w-7xl mx-auto space-y-6">
    <PageHeader icon={<RiDashboardLine />} eyebrow="Your workspace" title="Dashboard" description="An overview of your workflows and forms." />
    {error && <p className="text-sm text-rose-700">{error}</p>}
    {!summary && !error && <p className="text-sm text-slate-500">Loading dashboard...</p>}
    {summary && <>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          ['Workflow', summary.totalWorkflows],
          ['Published', summary.publishedWorkflows],
          ['Submission', summary.totalSubmissions],
          ['Last 7 days', summary.submissionsLast7Days]
        ].map(([label, value]) => <div key={label} className="bg-white border border-slate-200 rounded-2xl p-5">
          <p className="text-xs font-semibold text-slate-500">{label}</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">{value}</p>
        </div>)}
      </div>
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <h2 className="font-bold text-slate-900">Workflows by submission</h2>
          {summary.byWorkflow.length === 0 ? <p className="text-sm text-slate-500 mt-4">No workflows yet.</p> :
            <div className="divide-y divide-slate-100 mt-3">{summary.byWorkflow.slice(0, 5).map((item) => <div key={item.id} className="flex justify-between py-3 text-sm">
              <span className="text-slate-800">{item.name}</span><span className="text-slate-500">{item.submissions} submissions</span>
            </div>)}</div>}
          <button onClick={() => onNavigate('workflows')} className="text-sm font-semibold text-indigo-700 mt-4">View workflows</button>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <h2 className="font-bold text-slate-900">Recent submissions</h2>
          {summary.recentSubmissions.length === 0 ? <p className="text-sm text-slate-500 mt-4">No submissions yet.</p> :
            <div className="divide-y divide-slate-100 mt-3">{summary.recentSubmissions.slice(0, 5).map((item) => <div key={item.id} className="flex justify-between py-3 text-sm gap-4">
              <span className="text-slate-800 truncate">{summary.byWorkflow.find((workflow) => workflow.id === item.workflowId)?.name || 'Workflow'}</span>
              <span className="text-slate-500 whitespace-nowrap">{new Date(item.createdAt).toLocaleString()}</span>
            </div>)}</div>}
          <button onClick={() => onNavigate('submissions')} className="text-sm font-semibold text-indigo-700 mt-4">View submissions</button>
        </div>
      </div>
      <button onClick={() => onNavigate('analytics')} className="text-sm font-semibold text-indigo-700">View full analytics</button>
    </>}
  </div>;
}
