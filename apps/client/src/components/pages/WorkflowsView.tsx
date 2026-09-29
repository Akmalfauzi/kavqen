import React, { useEffect, useState } from 'react';
import { RiFlowChart } from 'react-icons/ri';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import PageHeader from '@/components/PageHeader';
import ShareModal from '@/components/ShareModal';

interface Workflow {
  id: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
}

interface WorkflowsViewProps {
  onSelectWorkflow: (id: string) => void;
}

export default function WorkflowsView({ onSelectWorkflow }: WorkflowsViewProps) {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharingWorkflow, setSharingWorkflow] = useState<Workflow | null>(null);

  const fetchWorkflows = async () => {
    try {
      const res = await api.get('/workflows');
      const data = res.data;
      if (data.success) {
        setWorkflows(data.data);
      }
    } catch (err) {
      console.error('Error fetching workflows:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflows();
  }, []);

  if (loading) return <div className="p-8 text-center text-slate-500">Loading...</div>;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader icon={<RiFlowChart />} eyebrow="Your workspace" title="Workflows"
        description="Manage your conversation flows and routing logic."
        />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {workflows.map((wf) => (
          <div
            key={wf.id}
            onClick={() => onSelectWorkflow(wf.id)}
            className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-indigo-300 hover:shadow-md transition cursor-pointer group flex flex-col justify-between min-h-40"
          >
            <div className="flex justify-between items-start">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 mb-4">
                <RiFlowChart className="w-5 h-5" />
              </div>

            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition">{wf.name}</h3>
              <p className="text-xs text-slate-500 mt-1 line-clamp-1">{wf.description || 'No description'}</p>
            </div>
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                wf.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {wf.status}
              </span>
              <span className="text-[10px] font-medium text-slate-400">
                {new Date(wf.createdAt).toLocaleDateString()}
              </span>
            </div>
            {wf.status === 'PUBLISHED' && <button
              onClick={(event) => { event.stopPropagation(); setSharingWorkflow(wf); }}
              className="mt-3 inline-flex h-10 items-center justify-center rounded-lg bg-indigo-50 px-4 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 transition"
            >Share form</button>}
          </div>
        ))}
        
        {workflows.length === 0 && (
          <div className="col-span-full py-16 text-center border-2 border-dashed border-slate-200 rounded-3xl">
            <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 mx-auto mb-4">
              <RiFlowChart className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No workflows yet</h3>
            <p className="text-sm text-slate-500 mt-1 mb-4">Demo workflows will appear after setup is complete.</p>

          </div>
        )}
      </div>
      {sharingWorkflow && <ShareModal workflowId={sharingWorkflow.id} workflowName={sharingWorkflow.name} onClose={() => setSharingWorkflow(null)} />}
    </div>
  );
}
