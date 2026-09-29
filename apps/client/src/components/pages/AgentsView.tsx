'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/Modal';
import PageHeader from '@/components/PageHeader';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { ActivePage } from '../AppSidebar';
import { RiMicLine, RiRobot2Line, RiPencilLine, RiFileListLine } from 'react-icons/ri';

interface AgentsViewProps {
  onNavigate: (page: ActivePage) => void;
  onSelectAgent: (agentName: string, themeId: string, agentId?: string) => void;
}

export default function AgentsView({ onNavigate, onSelectAgent }: AgentsViewProps) {
  const router = useRouter();
  const [agents, setAgents] = useState<any[]>([]);

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      const res = await api.get('/agents');
      setAgents(res.data.data);
    } catch (e: any) {
      console.error(e);
    }
  };

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentRole, setNewAgentRole] = useState('');
  const [saving, setSaving] = useState(false);
  const [pendingToggle, setPendingToggle] = useState<any>(null);

  const confirmToggle = async () => {
    if (!pendingToggle || saving) return;
    setSaving(true);
    const next = !pendingToggle.isActive;
    try {
      await api.put(`/agents/${pendingToggle.id}`, { isActive: next });
      toast.success(`${pendingToggle.name} is now ${next ? 'active' : 'inactive'}`);
      fetchAgents();
      setPendingToggle(null);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to change agent status');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (agent: any) => {
    setEditingId(agent.id);
    setNewAgentName(agent.name || '');
    setNewAgentRole(agent.role || '');
    setShowCreateModal(true);
  };

  // One modal serves both modes: create posts, edit patches only the two fields shown.
  const handleSaveAgent = async () => {
    if (!newAgentName.trim() || saving) return;
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/agents/${editingId}`, {
          name: newAgentName.trim(),
          role: newAgentRole.trim() || 'Custom Conversational Agent'
        });
        toast.success('Agent updated successfully');
      }
      fetchAgents();
      setShowCreateModal(false);
      setEditingId(null);
      setNewAgentName('');
      setNewAgentRole('');
    } catch (e: any) {
      toast.error(e.response?.data?.message || `Failed to ${editingId ? 'update' : 'create'} agent`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 select-none animate-in fade-in duration-200">
      <PageHeader icon={<RiRobot2Line />} eyebrow="Your workspace" title="AI Agent Catalog"
        description="Configure conversational personalities, assigned workflow diagrams, and voice models."
        />

      {/* Agents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition flex flex-col justify-between space-y-4"
          >
            <div>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-2xl bg-gradient-to-tr ${agent.avatarGradient} flex items-center justify-center text-white text-base font-black shadow-sm`}>
                    {agent.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 leading-tight">{agent.name}</h3>
                    <span className="text-[10px] font-semibold text-slate-400 block">{agent.role}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button type="button" role="switch" aria-checked={!!agent.isActive}
                    aria-label={`${agent.isActive ? 'Deactivate' : 'Activate'} ${agent.name}`}
                    title={agent.isActive ? 'Active' : 'Inactive'}
                    onClick={() => setPendingToggle(agent)}
                    className={`relative h-5 w-9 shrink-0 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${agent.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${agent.isActive ? 'left-[1.125rem]' : 'left-0.5'}`} />
                  </button>
                  <button type="button" onClick={() => openEdit(agent)} title={`Edit ${agent.name}`}
                    aria-label={`Edit ${agent.name}`}
                    className="w-7 h-7 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 flex items-center justify-center transition">
                    <RiPencilLine aria-hidden="true" className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-xs py-2 border-y border-slate-100">
                <div className="flex justify-between">
                  <span className="text-slate-400">Voice Synthesis:</span>
                  <span className="font-semibold text-slate-700">{agent.voice}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">LLM & Audio Engine:</span>
                  <span className="font-semibold text-slate-700 truncate max-w-[170px]">{agent.model}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Workflow Nodes:</span>
                  <span className="font-semibold text-indigo-600">{agent.workflowSteps} Steps Configured</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Form:</span>
                  <span className={`font-semibold ${agent.workflow?.status === 'PUBLISHED' ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {agent.workflow?.status === 'PUBLISHED' ? 'Published' : 'Draft'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => {
                  onSelectAgent(agent.name, agent.themeId);
                  router.push(`/agents/${agent.id}/workflows`);
                }}
                className="flex-1 h-10 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-semibold rounded-lg transition"
              >
                Workflow
              </button>
              <button
                onClick={() => router.push(`/agents/${agent.id}/form`)}
                className="h-10 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-semibold rounded-lg transition inline-flex items-center justify-center gap-2"
                title="Form, access codes and invitations"
              >
                <RiFileListLine aria-hidden="true" className="w-3.5 h-3.5" />
                <span>Form</span>
              </button>
              <button
                onClick={() => {
                  onSelectAgent(agent.name, agent.themeId, agent.id);
                  router.push(`/agents/${agent.id}/live-test`);
                }}
                className="h-10 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition inline-flex items-center justify-center gap-2"
                title="Test voice session"
              >
                <RiMicLine className="w-3.5 h-3.5" />
                <span>Test</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {pendingToggle && <Modal
        title={pendingToggle.isActive ? 'Deactivate this agent?' : 'Activate this agent?'}
        onClose={() => { if (!saving) setPendingToggle(null); }} footer={
        <div className="flex gap-2">
          <button type="button" disabled={saving} onClick={() => setPendingToggle(null)}
            className="flex-1 h-10 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition disabled:opacity-40">Cancel</button>
          <button type="button" disabled={saving} onClick={confirmToggle}
            className={`flex-1 h-10 px-4 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50 ${pendingToggle.isActive ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
            {saving ? 'Saving...' : pendingToggle.isActive ? 'Deactivate' : 'Activate'}</button>
        </div>
      }>
        <p className="text-sm leading-relaxed text-slate-600">
          {pendingToggle.isActive
            ? <><span className="font-semibold text-slate-900">{pendingToggle.name}</span> will stop handling voice sessions until you activate it again.</>
            : <><span className="font-semibold text-slate-900">{pendingToggle.name}</span> will start handling voice sessions again.</>}
        </p>
      </Modal>}

      {showCreateModal && <Modal title={editingId ? 'Edit Voice Agent' : 'Create New Voice Agent'} onClose={() => { if (!saving) setShowCreateModal(false); }} footer={
        <div className="flex gap-2">
          <button type="button" disabled={saving} onClick={() => setShowCreateModal(false)}
            className="flex-1 h-10 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition disabled:opacity-40">Cancel</button>
          <button type="button" disabled={saving || !newAgentName.trim()} onClick={handleSaveAgent}
            className="flex-1 h-10 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50">
            {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Agent'}</button>
        </div>
      }>
        <div className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Agent Name</label>
            <input type="text" value={newAgentName} onChange={(e) => setNewAgentName(e.target.value)}
              placeholder="e.g. Rachel Appointment Desk"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none focus:border-indigo-500" />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Agent Responsibility / Role</label>
            <input type="text" value={newAgentRole} onChange={(e) => setNewAgentRole(e.target.value)}
              placeholder="e.g. Schedule appointments and answer clinic inquiries"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none focus:border-indigo-500" />
          </div>
        </div>
      </Modal>}
    </div>
  );
}
