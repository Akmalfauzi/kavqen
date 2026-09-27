'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  RiRobot2Line,
  RiArrowLeftLine,
  RiStopFill,
  RiMicFill,
  RiMicLine,
  RiCheckLine,
} from 'react-icons/ri';
import toast from 'react-hot-toast';
import { AgentProfile } from '@/components/StudioApp';
import PageHeader from '@/components/PageHeader';
import { api } from '@/lib/api';

interface FieldDef {
  name: string;
  label?: string;
  type: string;
  required?: boolean;
  prompt_hint?: string;
  options?: string[];
}

type AgentStatus = 'idle' | 'connecting' | 'agent_speaking' | 'user_speaking' | 'completed' | 'error';

interface TestAgentViewProps {
  selectedTestAgentId: string | null;
  agentName: string;
  selectedLanguage: string;
  selectedVoice: string;
  isSessionActive: boolean;
  status: AgentStatus;
  statusMessage: string;
  agentTranscript: string;
  userTranscript: string;
  audioVolume: number;
  formFields: FieldDef[];
  formData: Record<string, string>;
  onSelectTestAgentId: (id: string | null) => void;
  onSelectLanguage: (lang: string) => void;
  onSelectVoice: (voice: string) => void;
  onSelectAgent: (agent: AgentProfile) => void;
  onStartSession: () => void;
  onStopSession: () => void;
  onUpdateFormData: (data: Record<string, string>) => void;
  onSubmitForm: () => Promise<boolean>;
}

export default function TestAgentView({
  selectedTestAgentId,
  agentName,
  selectedLanguage,
  selectedVoice,
  isSessionActive,
  status,
  statusMessage,
  agentTranscript,
  userTranscript,
  audioVolume,
  formFields,
  formData,
  onSelectTestAgentId,
  onSelectLanguage,
  onSelectVoice,
  onSelectAgent,
  onStartSession,
  onStopSession,
  onUpdateFormData,
  onSubmitForm,
}: TestAgentViewProps) {
  const router = useRouter();
  const [agents, setAgents] = useState<any[]>([]);

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const res = await api.get('/agents');
        setAgents(res.data.data || []);
      } catch (e) {
        console.error('Failed to fetch agents', e);
      }
    };
    fetchAgents();
  }, []);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Re-connect the soundwave visualization to the incoming audio volume prop
  // In a full implementation, you'd pass down the analyser nodes or raw volume.
  // For UI representation, we animate based on the `audioVolume` prop and `status`.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let time = 0;
    let animFrameId: number;

    const render = () => {
      time += 0.04;
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const isActive = status === 'agent_speaking' || status === 'user_speaking';
      const isAgent = status === 'agent_speaking';
      const isUser = status === 'user_speaking';

      const primaryColor = isAgent
        ? 'rgba(56, 189, 248, '
        : isUser
        ? 'rgba(52, 211, 153, '
        : 'rgba(99, 102, 241, ';
      const secondaryColor = isAgent
        ? 'rgba(129, 140, 248, '
        : isUser
        ? 'rgba(45, 212, 191, '
        : 'rgba(148, 163, 184, ';

      const centerY = height / 2;

      // Wave layers
      const waveLayers = [
        { freq: 0.022, speed: 2.2, amp: isActive ? 18 + audioVolume * 40 : 6, alpha: 0.85, color: primaryColor },
        { freq: 0.035, speed: -1.7, amp: isActive ? 14 + audioVolume * 30 : 4, alpha: 0.6, color: secondaryColor },
      ];

      waveLayers.forEach((layer) => {
        ctx.beginPath();
        ctx.moveTo(0, centerY);

        for (let x = 0; x < width; x += 3) {
          let audioMod = isActive ? (Math.random() * audioVolume * 15) : 0;
          const envelope = Math.sin((x / width) * Math.PI);
          const y = centerY + Math.sin(x * layer.freq + time * layer.speed) * (layer.amp + audioMod) * envelope;
          ctx.lineTo(x, y);
        }

        ctx.strokeStyle = `${layer.color}${layer.alpha})`;
        ctx.lineWidth = isActive ? 2.5 : 1.5;
        ctx.shadowBlur = isActive ? 14 : 4;
        ctx.shadowColor = `${layer.color}0.9)`;
        ctx.stroke();
      });

      ctx.shadowBlur = 0;

      // Equalizer bars
      const numBars = 32;
      const barWidth = 4;
      const barGap = 6;
      const totalWidth = numBars * (barWidth + barGap);
      const startX = (width - totalWidth) / 2;

      for (let i = 0; i < numBars; i++) {
        const x = startX + i * (barWidth + barGap);
        let barHeight = 4;

        if (isActive) {
          barHeight = 4 + (Math.random() * audioVolume * height * 0.4);
        } else {
          barHeight = 4 + Math.sin(time * 1.5 + i * 0.28) * 3.5;
        }

        const grad = ctx.createLinearGradient(0, centerY - barHeight / 2, 0, centerY + barHeight / 2);
        grad.addColorStop(0, `${primaryColor}0.95)`);
        grad.addColorStop(1, `${secondaryColor}0.95)`);

        ctx.fillStyle = grad;
        ctx.beginPath();
        if (typeof (ctx as any).roundRect === 'function') {
          (ctx as any).roundRect(x, centerY - barHeight / 2, barWidth, Math.max(3, barHeight), 2);
        } else {
          ctx.rect(x, centerY - barHeight / 2, barWidth, Math.max(3, barHeight));
        }
        ctx.fill();
      }

      animFrameId = requestAnimationFrame(render);
    };

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    animFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [status, audioVolume]);

  // The agent always comes from /agents/:id/live-test, so there is nothing to pick.
  if (!selectedTestAgentId) {
    return <div className="p-6 text-sm text-slate-500">Loading agent...</div>;
  }

  // Active Testing Cockpit
  return (
    <div className="flex-1 w-full overflow-y-auto p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="space-y-6 animate-in fade-in duration-200">
        <PageHeader icon={<RiRobot2Line />} eyebrow="Voice playground"
          title={agents.find(agent => agent.id === selectedTestAgentId)?.name || agentName}
          description={agents.find(agent => agent.id === selectedTestAgentId)?.role || 'Preview your agent and review the answers captured during a conversation.'}
          actions={<button type="button" disabled={isSessionActive} onClick={() => router.push('/agents')} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"><RiArrowLeftLine aria-hidden="true" className="h-4 w-4" />All agents</button>} />
        <section aria-labelledby="session-settings-title" className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 id="session-settings-title" className="text-sm font-semibold text-slate-900">Session settings</h2><p className="mt-1 text-xs text-slate-500">{isSessionActive ? 'End the call before changing the voice.' : 'Choose a voice, then start a call below.'}</p></div>
            <span role="status" className={`rounded-full px-3 py-1 text-xs font-semibold ${isSessionActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{isSessionActive ? status === 'connecting' ? 'Connecting' : 'Call in progress' : status === 'error' ? 'Connection error' : 'Ready to start'}</span>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="min-w-0 text-xs font-semibold text-slate-500 sm:col-span-2">Agent
              <p className="mt-2 flex h-10 items-center truncate rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-800">
                {agents.find(agent => agent.id === selectedTestAgentId)?.name || agentName}
              </p>
            </div>
            <label className="min-w-0 text-xs font-semibold text-slate-500">Language
              <select value={selectedLanguage} disabled={isSessionActive} onChange={event => onSelectLanguage(event.target.value)} className="mt-2 h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400">
                <option value="en">English</option><option value="id" disabled>Indonesian (unavailable)</option>
              </select>
            </label>
            <label className="min-w-0 text-xs font-semibold text-slate-500">Voice
              <select value={selectedVoice} disabled={isSessionActive} onChange={event => onSelectVoice(event.target.value)} className="mt-2 h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400">
              <optgroup label="English (US)">
                <option value="alba">Alba</option>
                <option value="eve">Eve</option>
                <option value="george">George</option>
                <option value="jane">Jane</option>
                <option value="jean">Jean</option>
                <option value="mary">Mary</option>
                <option value="michael">Michael</option>
              </optgroup>
              <optgroup label="English (UK)">
                <option value="anna">Anna</option>
                <option value="charles">Charles</option>
                <option value="paul">Paul</option>
                <option value="vera">Vera</option>
              </optgroup>
              <optgroup label="Italian" disabled>
                <option value="giovanni">Giovanni</option>
              </optgroup>
              <optgroup label="Spanish" disabled>
                <option value="lola">Lola</option>
              </optgroup>
              <optgroup label="German" disabled>
                <option value="juergen">Juergen</option>
              </optgroup>
              <optgroup label="Portuguese" disabled>
                <option value="rafael">Rafael</option>
              </optgroup>
              <optgroup label="French" disabled>
                <option value="estelle">Estelle</option>
              </optgroup>
              </select>
            </label>
          </div>
        </section>

        {/* Cockpit Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Voice Cockpit Left */}
          <section className="lg:col-span-7 bg-slate-950 text-white rounded-3xl p-6 md:p-8 border border-slate-800 shadow-xl flex flex-col justify-between items-center relative overflow-hidden">
            <div className="w-full flex justify-between items-center mb-4">
              <div className="flex items-center space-x-2.5 px-3.5 py-1.5 rounded-full bg-slate-800 border border-slate-700">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    isSessionActive ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'
                  }`}
                />
                <span className="text-xs font-medium text-slate-300">{statusMessage}</span>
              </div>
              <span className="text-[10px] font-mono font-bold text-sky-400 bg-sky-950/60 px-2.5 py-1 rounded-full border border-sky-800">
                24 kHz HD Audio
              </span>
            </div>

            {/* Reactive Voice Orb */}
            <div className="w-full flex flex-col items-center justify-center my-auto py-6 relative">
              <div
                className="w-64 h-64 rounded-full absolute bg-sky-500/20 blur-3xl pointer-events-none transition-transform"
                style={{ transform: `scale(${1 + audioVolume * 0.4})` }}
              />

              <button
                onClick={isSessionActive ? onStopSession : onStartSession}
                style={{ transform: `scale(${1 + audioVolume * 0.08})` }}
                className={`w-36 h-36 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all duration-300 transform active:scale-95 z-10 ${
                  isSessionActive
                    ? 'bg-gradient-to-tr from-rose-600 to-red-700 text-white shadow-rose-500/40'
                    : 'bg-gradient-to-tr from-indigo-600 via-sky-600 to-teal-500 text-white hover:scale-105 shadow-indigo-500/30'
                }`}
              >
                {isSessionActive ? (
                  <>
                    <RiStopFill className="w-10 h-10 mb-1 text-white" />
                    <span className="text-[11px] font-black uppercase tracking-widest text-white/90">
                      Stop
                    </span>
                  </>
                ) : (
                  <>
                    <RiMicFill className="w-11 h-11 mb-1 text-white" />
                    <span className="text-[11px] font-black uppercase tracking-widest text-white">
                      Start Call
                    </span>
                  </>
                )}
              </button>

              <span className="mt-4 text-xs font-semibold text-slate-400">
                {isSessionActive
                  ? `${
                      agents.find((a) => a.id === selectedTestAgentId)?.name || agentName
                    } is listening & filling the workflow...`
                  : `Click to test ${
                      agents.find((a) => a.id === selectedTestAgentId)?.name || agentName
                    }`}
              </span>

              {/* Soundwave Canvas */}
              <div className="w-full h-24 mt-4 relative flex items-center justify-center">
                <canvas
                  ref={canvasRef}
                  className="w-full h-full rounded-2xl bg-slate-900/60 border border-slate-800"
                />
              </div>
            </div>

            {/* Transcripts */}
            <div className="w-full bg-slate-900 rounded-2xl p-5 border border-slate-800 shadow-inner flex flex-col justify-end min-h-[160px] space-y-3">
              <div className="flex justify-between items-center text-[10px] font-extrabold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-2 mb-1">
                <span className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
                  </span>
                  Live Dialogue Stream
                </span>
                <span className="text-sky-400">English (US)</span>
              </div>
              <div className="flex flex-col gap-3 max-h-[220px] overflow-y-auto pr-1">
                {agentTranscript && (
                  <div className="text-sm md:text-base text-sky-100 leading-relaxed font-medium bg-sky-950/30 p-3 rounded-xl border border-sky-900/50">
                    <strong className="text-sky-400 block text-xs uppercase tracking-wider mb-1">
                      {agents.find((a) => a.id === selectedTestAgentId)?.name || agentName}
                    </strong>
                    {agentTranscript}
                    {status === 'agent_speaking' && <span className="inline-block w-1.5 h-4 ml-1 bg-sky-400 animate-pulse align-middle" />}
                  </div>
                )}
                {userTranscript && (
                  <div className="text-sm md:text-base text-emerald-100 leading-relaxed font-medium bg-emerald-950/30 p-3 rounded-xl border border-emerald-900/50">
                    <strong className="text-emerald-400 block text-xs uppercase tracking-wider mb-1">You</strong>
                    {userTranscript}
                    {status === 'user_speaking' && <span className="inline-block w-1.5 h-4 ml-1 bg-emerald-400 animate-pulse align-middle" />}
                  </div>
                )}
                {!agentTranscript && !userTranscript && (
                  <div className="text-sm text-slate-500 italic py-4 text-center my-auto">
                    Spoken conversation will appear here in real-time...
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Form Right */}
          <section className="lg:col-span-5 bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
            <div>
              <div className="border-b pb-3 mb-4">
                <h2 className="text-base font-bold text-slate-900">
                  {agents.find((a) => a.id === selectedTestAgentId)?.name || agentName} — Active Data
                </h2>
                <p className="text-xs text-slate-400">
                  Captured fields automatically populated during conversation
                </p>
              </div>

              <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                {formFields.map((f) => {
                  const val = formData[f.name] || '';
                  const isFilled = Boolean(val);
                  return (
                    <div
                      key={f.name}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        isFilled
                          ? 'border-emerald-300 bg-emerald-50/50'
                          : 'border-slate-200 bg-slate-50/40'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          {f.label || f.name}
                        </label>
                        {isFilled && (
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <RiCheckLine className="w-3 h-3" />
                            <span>Captured</span>
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        value={val}
                        onChange={(e) => onUpdateFormData({ ...formData, [f.name]: e.target.value })}
                        placeholder={f.prompt_hint || 'Waiting for caller...'}
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs outline-none bg-white font-medium"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 border-t flex gap-2">
              <button
                onClick={() => { void onSubmitForm(); }}
                disabled={!Object.values(formData).some(Boolean)}
                className="flex-1 h-10 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-sm transition disabled:opacity-40"
              >
                Confirm & Submit
              </button>
              <button
                onClick={() => {
                  onUpdateFormData({});
                  toast.success('Form fields cleared');
                }}
                className="h-10 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-sm border border-slate-200 transition"
              >
                Clear
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
