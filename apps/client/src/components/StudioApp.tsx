'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import AppSidebar, { ActivePage } from '@/components/AppSidebar';
import { NotificationsProvider } from '@/contexts/NotificationsContext';
import TopNavbar from '@/components/TopNavbar';
import WorkflowCanvas, { WorkflowEdge } from '@/components/WorkflowCanvas';
import ConfigurationDrawer, { WorkflowNode } from '@/components/ConfigurationDrawer';
import DashboardView from '@/components/pages/DashboardView';
import UserFormsDashboard from '@/components/pages/UserFormsDashboard';
import AgentsView from '@/components/pages/AgentsView';
import AgentFormView from '@/components/pages/AgentFormView';
import KnowledgeView from '@/components/pages/KnowledgeView';
import AnalyticsView from '@/components/pages/AnalyticsView';
import IntegrationsView from '@/components/pages/IntegrationsView';
import MasterFieldsView, { MasterField } from '@/components/pages/MasterFieldsView';
import UsersView from '@/components/pages/UsersView';
import RolesView from '@/components/pages/RolesView';
import PermissionsView from '@/components/pages/PermissionsView';
import PermissionGroupsView from '@/components/pages/PermissionGroupsView';
import ProfileView from '@/components/pages/ProfileView';
import WorkflowsView from '@/components/pages/WorkflowsView';
import SubmissionsView from '@/components/pages/SubmissionsView';
import NotificationsView from '@/components/pages/NotificationsView';
import TestAgentView from '@/components/pages/TestAgentView';
import PublishModal from '@/components/PublishModal';
import toast, { Toaster } from 'react-hot-toast';
import { api, getToken, clearToken } from '@/lib/api';
import {
  RiStopFill,
  RiMicFill,
  RiMicLine,
  RiCheckLine,
  RiRobot2Line,
  RiArrowLeftLine,
  RiArrowRightLine,
  RiSparklingFill,
  RiFlowChart,
  RiArrowRightSLine,
  RiNodeTree,
  RiExternalLinkLine,
  RiAddLine,
  RiCloseLine,
  RiArrowLeftSLine,
  RiDeleteBinLine,
} from 'react-icons/ri';

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || '/gateway';

export interface AgentProfile {
  id: string;
  name: string;
  role: string;
  themeId: string;
  voice: string;
  model: string;
  workflowSteps: number;
  avatarGradient: string;
  description: string;
  tags: string[];
}

type AgentStatus = 'idle' | 'connecting' | 'agent_speaking' | 'user_speaking' | 'completed' | 'error';

interface FieldDef {
  name: string;
  label?: string;
  type: string;
  required?: boolean;
  prompt_hint?: string;
  options?: string[];
}

interface PendingToolCall {
  call_id: string;
  result: Record<string, any>;
}

const VALID_PAGES: ActivePage[] = [
  'dashboard',
  'agents',
  'workflows',
  'submissions',
  'fields',
  'users',
  'roles',
  'permissions',
  'permission-groups',
  'knowledge',
  'analytics',
  'test-agent',
  'integrations',
  'profile',
  'notifications',
];


export default function StudioApp({ initialPage, agentId }: { initialPage?: string; agentId?: string }) {
  const router = useRouter();
  const pathname = usePathname();

  // Derive active page directly from URL pathname (e.g. /dashboard -> 'dashboard').
  // Agent-nested routes (/agents/:id/workflows, /agents/:id/live-test) keep the
  // catalog highlighted but render the editor or the live test instead.
  const segments = (pathname?.replace(/^\//, '').split('/') || []).filter(Boolean);
  const nestedAgentSection = segments[0] === 'agents' && segments[1] ? segments[2] : undefined;
  const pathSegment = (nestedAgentSection === 'workflows' ? 'workflows'
    : nestedAgentSection === 'live-test' ? 'test-agent'
    : segments[0] || '') as ActivePage;
  const activePage: ActivePage = VALID_PAGES.includes(pathSegment)
    ? pathSegment
    : (VALID_PAGES.includes(initialPage as ActivePage) ? (initialPage as ActivePage) : 'dashboard');
  const routeAgentId = (segments[0] === 'agents' ? segments[1] : undefined) || agentId;

  const [currentUser, setCurrentUser] = useState<any>(null);
  const canManageWorkflows = ['SUPER-ADMIN', 'ADMIN'].includes(currentUser?.role?.code);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await api.get('/user/me');
        setCurrentUser(res.data.data);
        const authNotice = sessionStorage.getItem('pending_auth_notice');
        if (authNotice) {
          sessionStorage.removeItem('pending_auth_notice');
          toast.success(authNotice, { id: 'google-auth-success', duration: 4500 });
        }
      } catch (error) {
        sessionStorage.removeItem('pending_auth_notice');
        clearToken();
        const sharedCode = new URLSearchParams(window.location.search).get('code');
        if (sharedCode) sessionStorage.setItem('pending_share_code', sharedCode);
        router.replace('/login');
      }
    };
    fetchUser();
  }, [router]);
  useEffect(() => {
    if (currentUser?.role?.code === 'USER' && activePage !== 'dashboard' && activePage !== 'profile' && activePage !== 'notifications' && activePage !== 'submissions') {
      router.replace('/dashboard');
    }
  }, [currentUser, activePage, router]);
  useEffect(() => {
    const fetchFields = async () => {
      try {
        const res = await api.get('/fields');
        if (res.data.data) {
          setMasterFields(res.data.data);
          setFormFields(res.data.data);
        }
      } catch (error) {
        console.error('Failed to fetch fields:', error);
      }
    };
    if (canManageWorkflows) fetchFields();
  }, [canManageWorkflows]);


  const handleNavigate = useCallback((page: ActivePage) => {
    router.push(`/${page}`);
  }, [router]);

  // If user lands on root "/", redirect to "/workflows" so URL is explicit in browser.
  // Also redirect legacy "/test" to "/test-agent".
  useEffect(() => {
    if (pathname === '/' || pathname === '') {
      router.replace('/dashboard');
    }
    if (pathname === '/test') {
      router.replace('/test-agent');
    }
  }, [pathname, router]);

  // Navigation & Page State
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [agentName, setAgentName] = useState('Sarah AI Agent');
  const [selectedTheme, setSelectedTheme] = useState('clinic');
  const [selectedTestAgentId, setSelectedTestAgentId] = useState<string | null>(null);

  // /agents/:id/live-test names the agent, so the picker screen never applies.
  useEffect(() => {
    if (nestedAgentSection === 'live-test' && routeAgentId) setSelectedTestAgentId(routeAgentId);
  }, [nestedAgentSection, routeAgentId]);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en');
  const [selectedVoice, setSelectedVoice] = useState('alba');
  const [autoSubmit, setAutoSubmit] = useState(false);

  // Workflow Graph State
  
  const pathParts = pathname?.split('/') || [];
  // Legacy /workflows/:id still works; the agent route resolves its one workflow.
  const [agentWorkflowId, setAgentWorkflowId] = useState<string | null>(null);
  const selectedWorkflowId = nestedAgentSection === 'workflows'
    ? agentWorkflowId
    : ((activePage === 'workflows' && pathParts[2]) ? pathParts[2] : null);
  // The agent owns exactly one workflow, so the route only carries the agent id.
  useEffect(() => {
    if (!routeAgentId) { setAgentWorkflowId(null); return; }
    let cancelled = false;
    api.get(`/agents/${routeAgentId}`)
      .then((response) => { if (!cancelled) setAgentWorkflowId(response.data.data.workflow?.id ?? null); })
      .catch(() => { if (!cancelled) setAgentWorkflowId(null); });
    return () => { cancelled = true; };
  }, [routeAgentId]);

  const [workflowNodes, setWorkflowNodes] = useState<WorkflowNode[]>([]);
  const [workflowEdges, setWorkflowEdges] = useState<WorkflowEdge[]>([]);
  const [workflowName, setWorkflowName] = useState('');
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [workflowError, setWorkflowError] = useState('');
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
  const workflowNodesRef = useRef<WorkflowNode[]>([]);
  const workflowEdgesRef = useRef<WorkflowEdge[]>([]);
  const saveWorkflowTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const saveWorkflowQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const loadedWorkflowIdRef = useRef<string | null>(null);

  // Master Data Fields State
  const [masterFields, setMasterFields] = useState<MasterField[]>([]);

  // Modals & Notices
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showAIGenerateModal, setShowAIGenerateModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGeneratingWorkflow, setIsGeneratingWorkflow] = useState(false);

  // Live Voice Agent State
  const [status, setStatus] = useState<AgentStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('Click Start to begin voice session');
  const [agentTranscript, setAgentTranscript] = useState('');
  const [userTranscript, setUserTranscript] = useState('');
  const [formFields, setFormFields] = useState<FieldDef[]>([]);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const formDataRef = useRef<Record<string, string>>({});
  const submissionInFlightRef = useRef(false);
  const submittedRef = useRef(false);
  const [audioVolume, setAudioVolume] = useState<number>(0);

  const updateFormData = (data: Record<string, string>) => {
    formDataRef.current = data;
    setFormData(data);
  };

  // Modals state for Voice
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showCompletedModal, setShowCompletedModal] = useState(false);

  // Audio refs
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const speechRecRef = useRef<any>(null);
  const playbackTimeRef = useRef<number>(0);
  const isAgentSpeakingRef = useRef<boolean>(false);
  const pendingToolsRef = useRef<PendingToolCall[]>([]);
  const userAnalyserRef = useRef<AnalyserNode | null>(null);
  const agentAnalyserRef = useRef<AnalyserNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const statusRef = useRef<AgentStatus>('idle');
  const formFieldsRef = useRef<FieldDef[]>([]);
  const autoSubmitRef = useRef<boolean>(false);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    formFieldsRef.current = formFields;
  }, [formFields]);

  useEffect(() => {
    autoSubmitRef.current = autoSubmit;
  }, [autoSubmit]);

  const enqueueWorkflowSave = (workflowId: string, data: { nodes: WorkflowNode[]; edges: WorkflowEdge[] }) => {
    saveWorkflowQueueRef.current = saveWorkflowQueueRef.current
      .catch(() => undefined)
      .then(() => api.put(`/workflows/${workflowId}`, { data }))
      .catch((error) => {
        toast.error(error.response?.data?.message || 'Failed to save workflow');
      });
  };

  useEffect(() => {
    if (saveWorkflowTimeoutRef.current) clearTimeout(saveWorkflowTimeoutRef.current);
    loadedWorkflowIdRef.current = null;
    setSelectedNode(null);
    if (!selectedWorkflowId || selectedWorkflowId === 'new') return;

    let cancelled = false;
    setWorkflowLoading(true);
    setWorkflowError('');
    setWorkflowNodes([]);
    setWorkflowEdges([]);
    api.get(`/workflows/${selectedWorkflowId}`)
      .then((response) => {
        if (cancelled) return;
        const workflow = response.data.data;
        const data = workflow.data || {};
        const nodes = Array.isArray(data.nodes) ? data.nodes as WorkflowNode[] : [];
        const edges = Array.isArray(data.edges) ? data.edges as WorkflowEdge[] : [];
        setWorkflowName(workflow.name);
        setWorkflowNodes(nodes);
        setWorkflowEdges(edges);
        workflowNodesRef.current = nodes;
        workflowEdgesRef.current = edges;
        loadedWorkflowIdRef.current = selectedWorkflowId;
      })
      .catch((error) => {
        if (!cancelled) setWorkflowError(error.response?.data?.message || 'Failed to load workflow');
      })
      .finally(() => {
        if (!cancelled) setWorkflowLoading(false);
      });

    return () => {
      cancelled = true;
      if (saveWorkflowTimeoutRef.current) {
        clearTimeout(saveWorkflowTimeoutRef.current);
        saveWorkflowTimeoutRef.current = null;
        if (loadedWorkflowIdRef.current === selectedWorkflowId) {
          enqueueWorkflowSave(selectedWorkflowId, {
            nodes: workflowNodesRef.current,
            edges: workflowEdgesRef.current
          });
        }
      }
    };
  }, [selectedWorkflowId]);

  const scheduleWorkflowSave = () => {
    const workflowId = selectedWorkflowId;
    if (!workflowId || loadedWorkflowIdRef.current !== workflowId) return;
    if (saveWorkflowTimeoutRef.current) clearTimeout(saveWorkflowTimeoutRef.current);
    saveWorkflowTimeoutRef.current = setTimeout(() => {
      saveWorkflowTimeoutRef.current = null;
      enqueueWorkflowSave(workflowId, { nodes: workflowNodesRef.current, edges: workflowEdgesRef.current });
    }, 300);
  };

  const handleUpdateNodes = (newNodes: WorkflowNode[]) => {
    setWorkflowNodes(newNodes);
    workflowNodesRef.current = newNodes;
    scheduleWorkflowSave();
  };

  const handleUpdateEdges = (newEdges: WorkflowEdge[]) => {
    setWorkflowEdges(newEdges);
    workflowEdgesRef.current = newEdges;
    scheduleWorkflowSave();
  };

  const handleNodeSelect = (node: WorkflowNode | null) => {
    setSelectedNode(node);
  };

  // Master Fields CRUD & Relation Handlers
  const handleAddMasterField = async (field: MasterField, linkedNodeIds: string[] = []) => {
    try {
      const res = await api.post('/fields', field);
      const newField = res.data.data;
      const updated = [...masterFields, newField];
      setMasterFields(updated);
      setFormFields(updated as FieldDef[]);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to add field');
      return false;
    }

    if (linkedNodeIds.length > 0) {
      const newNodes = workflowNodes.map((n) => {
        if (linkedNodeIds.includes(n.id)) {
          const current = n.config?.target_fields || [];
          if (!current.includes(field.name)) {
            return {
              ...n,
              config: {
                ...n.config,
                target_fields: [...current, field.name],
              },
            };
          }
        }
        return n;
      });
      handleUpdateNodes(newNodes);
      if (selectedNode && linkedNodeIds.includes(selectedNode.id)) {
        const found = newNodes.find((n) => n.id === selectedNode.id);
        if (found) setSelectedNode(found);
      }
    }
    return true;
  };

  const handleUpdateMasterField = async (
    oldName: string,
    updatedField: MasterField,
    linkedNodeIds?: string[]
  ) => {
    try {
      const oldField = masterFields.find((f: any) => f.name === oldName) as any;
      if (!oldField?.id) throw new Error('Field ID is missing; reload page');
      const res = await api.put(`/fields/${oldField.id}`, updatedField);
      const updatedFields = masterFields.map((f) => (f.name === oldName ? res.data.data : f));
      setMasterFields(updatedFields);
      setFormFields(updatedFields as FieldDef[]);
    } catch (e: any) {
      toast.error(e.response?.data?.message || e.message || 'Failed to update field');
      return false;
    }

    const newNodes = workflowNodes.map((n) => {
      let currentFields = n.config?.target_fields || [];
      if (oldName !== updatedField.name && currentFields.includes(oldName)) {
        currentFields = currentFields.map((fn) => (fn === oldName ? updatedField.name : fn));
      }

      if (linkedNodeIds !== undefined) {
        const shouldBeLinked = linkedNodeIds.includes(n.id);
        if (shouldBeLinked && !currentFields.includes(updatedField.name)) {
          currentFields = [...currentFields, updatedField.name];
        } else if (!shouldBeLinked && currentFields.includes(updatedField.name)) {
          currentFields = currentFields.filter((fn) => fn !== updatedField.name);
        }
      }

      return {
        ...n,
        config: {
          ...n.config,
          target_fields: currentFields,
        },
      };
    });
    handleUpdateNodes(newNodes);
    if (selectedNode) {
      const found = newNodes.find((n) => n.id === selectedNode.id);
      if (found) setSelectedNode(found);
    }
    return true;
  };

  const handleDeleteMasterField = async (fieldName: string) => {
    const field = masterFields.find((item) => item.name === fieldName);
    if (!field?.id) {
      toast.error('Field ID is missing; reload page');
      return false;
    }
    try {
      await api.delete(`/fields/${field.id}`);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to delete field');
      return false;
    }
    const updatedFields = masterFields.filter((f) => f.name !== fieldName);
    setMasterFields(updatedFields);
    setFormFields(updatedFields as FieldDef[]);

    const newNodes = workflowNodes.map((n) => {
      const current = n.config?.target_fields || [];
      if (current.includes(fieldName)) {
        return {
          ...n,
          config: {
            ...n.config,
            target_fields: current.filter((fn) => fn !== fieldName),
          },
        };
      }
      return n;
    });
    handleUpdateNodes(newNodes);
    if (selectedNode) {
      const found = newNodes.find((n) => n.id === selectedNode.id);
      if (found) setSelectedNode(found);
    }
    return true;
  };

  const handleToggleFieldNodeRelation = (fieldName: string, nodeId: string) => {
    const newNodes = workflowNodes.map((n) => {
      if (n.id === nodeId) {
        const current = n.config?.target_fields || [];
        const isAssigned = current.includes(fieldName);
        const nextFields = isAssigned
          ? current.filter((fn) => fn !== fieldName)
          : [...current, fieldName];
        return {
          ...n,
          config: {
            ...n.config,
            target_fields: nextFields,
          },
        };
      }
      return n;
    });
    handleUpdateNodes(newNodes);
    if (selectedNode && selectedNode.id === nodeId) {
      const found = newNodes.find((n) => n.id === nodeId);
      if (found) setSelectedNode(found);
    }
    toast.success('Updated workflow step variable relation');
  };

  const handleNavigateToNode = (nodeId: string) => {
    const targetNode = workflowNodes.find((n) => n.id === nodeId);
    if (targetNode) {
      setSelectedNode(targetNode);
    }
    handleNavigate('workflows');
  };

  const handleSelectTestAgent = (agent: AgentProfile) => {
    if (isSessionActive) {
      stopVoiceSession();
    }
    setSelectedTestAgentId(agent.id);
    setAgentName(agent.name);
    setSelectedTheme(agent.themeId);
    loadThemeSchema(agent.themeId, selectedLanguage);
    toast.success(`Selected "${agent.name}" for live testing!`);
  };

  // Add Step
  // Every flow is start -> steps -> end. Adding a step inserts it before the end
  // and rewires the edges, so the canvas can never produce a dangling node.
  const START_ID = 'flow_start';
  const END_ID = 'flow_end';

  const handleAddStep = () => {
    const nodes = [...workflowNodes];
    const edges = [...workflowEdges];

    let start = nodes.find((n) => n.type === 'trigger');
    if (!start) {
      start = { id: START_ID, type: 'trigger', title: 'Call Started', icon: 'blue', color: 'blue',
        description: '', badges: { rules: 0, tools: 0 }, config: { step_name: 'Call Started', purpose: '', target_fields: [] },
        position: { x: 320, y: 40 } } as WorkflowNode;
      nodes.unshift(start);
    }
    let end = nodes.find((n) => n.type === 'action');
    if (!end) {
      end = { id: END_ID, type: 'action', title: 'Call Ended', icon: 'rose', color: 'rose',
        description: '', badges: { rules: 0, tools: 0 }, config: { step_name: 'Call Ended', purpose: '', target_fields: [] },
        position: { x: 320, y: 0 } } as WorkflowNode;
      nodes.push(end);
    }

    const steps = nodes.filter((n) => n.type !== 'trigger' && n.type !== 'action');
    const previous = steps[steps.length - 1] || start;
    const newId = `node_${Date.now()}`;
    const newNode: WorkflowNode = {
      id: newId,
      type: 'step',
      title: 'New Step',
      icon: 'pink',
      color: 'pink',
      description: 'Describe what this step should collect or decide.',
      badges: { rules: 0, tools: 0 },
      config: { step_name: 'New Step', purpose: '', voice: 'Jessica', voice_description: 'Calm, Reassuring', target_fields: [] },
      position: { x: previous.position.x, y: previous.position.y + 200 },
    };
    end.position = { x: newNode.position.x, y: newNode.position.y + 200 };

    const kept = edges.filter((e) => !(e.from === previous.id && e.to === end!.id));
    const nextEdges: WorkflowEdge[] = [...kept,
      { id: `edge_${newId}_in`, from: previous.id, to: newId },
      { id: `edge_${newId}_out`, from: newId, to: end.id }];

    handleUpdateNodes([...nodes.filter((n) => n.type !== 'action'), newNode, end]);
    handleUpdateEdges(nextEdges);
    setSelectedNode(newNode);
  };

  // Schema Loader
  const loadThemeSchema = useCallback(async (themeId: string, lang: string) => {
    try {
      const res = await fetch(`${GATEWAY_URL}/api/schema/${themeId}?lang=${lang}`, {
        headers: { Authorization: `Bearer ${getToken() || ''}` }
      });
      if (res.ok) {
        const rawData = await res.json();
        const data = rawData.data || rawData;
        const schema = data.schema || {};
        const fields: FieldDef[] = data.fields || schema.fields || [];
        setFormFields(fields);

        const initialForm: Record<string, string> = {};
        fields.forEach((f) => {
          initialForm[f.name] = '';
        });
        updateFormData(initialForm);
      }
    } catch (err) {
      console.error('Error fetching schema:', err);
    }
  }, []);

  useEffect(() => {
    if (canManageWorkflows && activePage === 'test-agent') {
      loadThemeSchema(selectedTheme, selectedLanguage);
    }
  }, [canManageWorkflows, activePage, selectedTheme, selectedLanguage, loadThemeSchema]);

  // Keyboard shortcut Ctrl+J / Cmd+J for AI Workflow Generation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setShowAIGenerateModal(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleGenerateWorkflow = async () => {
    if (!aiPrompt.trim()) return;
    setIsGeneratingWorkflow(true);
    try {
      const response = await api.post('/workflows/generate', { prompt: aiPrompt.trim() });
      const { nodes, edges } = response.data.data as { nodes: WorkflowNode[]; edges: WorkflowEdge[] };
      handleUpdateNodes(nodes);
      handleUpdateEdges(edges);
      setSelectedNode(null);
      setAiPrompt('');
      setShowAIGenerateModal(false);
      toast.success('Workflow draft generated. Review steps and fields before publishing.');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to generate workflow');
    } finally {
      setIsGeneratingWorkflow(false);
    }
  };

  // Publish
  const handlePublishConfirm = async () => {
    if (!selectedWorkflowId || selectedWorkflowId === 'new' || loadedWorkflowIdRef.current !== selectedWorkflowId) {
      toast.error('Open a saved workflow before publishing');
      return false;
    }
    // A publishable flow needs both anchors and something to do between them.
    const nodes = workflowNodesRef.current;
    if (!nodes.some((n) => n.type === 'trigger')) {
      toast.error('This flow has no start. Add a step to create one.');
      return false;
    }
    if (!nodes.some((n) => n.type === 'action')) {
      toast.error('This flow has no end. Add a step to create one.');
      return false;
    }
    if (!nodes.some((n) => n.type !== 'trigger' && n.type !== 'action')) {
      toast.error('Add at least one step between the start and the end.');
      return false;
    }
    try {
      if (saveWorkflowTimeoutRef.current) {
        clearTimeout(saveWorkflowTimeoutRef.current);
        saveWorkflowTimeoutRef.current = null;
      }
      await saveWorkflowQueueRef.current;
      await api.put(`/workflows/${selectedWorkflowId}`, {
        data: { nodes: workflowNodesRef.current, edges: workflowEdgesRef.current }
      });
      await api.post(`/workflows/${selectedWorkflowId}/publish`);
      setSelectedTheme(selectedWorkflowId);
      setSelectedTestAgentId(selectedWorkflowId);
      setAgentName(workflowName);
      await loadThemeSchema(selectedWorkflowId, selectedLanguage);
      toast.success('Workflow published for voice testing');
      return true;
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to publish workflow');
      return false;
    }
  };

  // Canvas visualizer animation for Voice Test
  useEffect(() => {
    if (activePage !== 'test-agent') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let time = 0;

    const render = () => {
      time += 0.04;
      const currentStatus = statusRef.current;
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      let activeAnalyser: AnalyserNode | null = null;
      if (currentStatus === 'agent_speaking') {
        activeAnalyser = agentAnalyserRef.current;
      } else if (currentStatus === 'user_speaking') {
        activeAnalyser = userAnalyserRef.current;
      }

      const bufferLength = activeAnalyser ? activeAnalyser.frequencyBinCount : 64;
      const dataArray = new Uint8Array(bufferLength);
      const timeArray = new Uint8Array(bufferLength);

      let currentVolume = 0;
      if (activeAnalyser) {
        activeAnalyser.getByteFrequencyData(dataArray);
        activeAnalyser.getByteTimeDomainData(timeArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += Math.abs(timeArray[i] - 128);
        }
        currentVolume = Math.min(1, (sum / bufferLength / 128) * 2.8);
      }
      setAudioVolume(currentVolume);

      const centerY = height / 2;
      const isAgent = currentStatus === 'agent_speaking';
      const isUser = currentStatus === 'user_speaking';
      const isActive = isAgent || isUser;

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

      // Waveform layers
      const waveLayers = [
        { freq: 0.022, speed: 2.2, amp: isActive ? 18 + currentVolume * 40 : 6, alpha: 0.85, color: primaryColor },
        { freq: 0.035, speed: -1.7, amp: isActive ? 14 + currentVolume * 30 : 4, alpha: 0.6, color: secondaryColor },
      ];

      waveLayers.forEach((layer) => {
        ctx.beginPath();
        ctx.moveTo(0, centerY);

        for (let x = 0; x < width; x += 3) {
          let audioMod = 0;
          if (activeAnalyser && isActive) {
            const binIndex = Math.floor((x / width) * (bufferLength / 2));
            audioMod = (dataArray[binIndex] / 255) * 18;
          }
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

        if (isActive && activeAnalyser) {
          const binIndex = Math.floor((i / numBars) * (bufferLength / 2));
          const val = dataArray[binIndex] / 255;
          barHeight = 4 + val * (height * 0.46);
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

      animFrameIdRef.current = requestAnimationFrame(render);
    };

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    animFrameIdRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [activePage]);

  // Voice Session Handlers
  const extractFromTranscript = async (text: string, currentFields: FieldDef[]) => {
    if (!text || !text.trim()) return;
    const lower = text.toLowerCase();
      const updated = { ...formDataRef.current };
      currentFields.forEach((field) => {
        if (updated[field.name]) return;

        if (field.name === 'phone_number' || field.name === 'no_hp' || field.name === 'phone') {
          const match = text.match(/(?:\+?[0-9\s-]{8,15})/);
          if (match) updated[field.name] = match[0].replace(/[\s-]/g, '');
        } else if (field.name === 'date_of_birth' || field.name === 'tanggal_lahir') {
          const match = text.match(/\b\d{1,2}\s+(?:january|february|march|april|may|june|july|august|september|october|november|december|\d{1,2})\s+\d{4}\b/i);
          if (match) updated[field.name] = match[0];
        } else if (field.name === 'full_name' || field.name === 'customer_name') {
          const match = text.match(/(?:my name is|i am|name is|call me)\s+([A-Za-z\s]{2,30})/i);
          if (match && match[1]) {
            const cleanName = match[1].replace(/(?:and|born|symptom|issue).*/i, '').trim();
            if (cleanName.length > 2 && !cleanName.toLowerCase().startsWith('want')) {
              updated[field.name] = cleanName;
            }
          }
        } else if (field.name === 'primary_symptoms' || field.name === 'issue_detail') {
          if (lower.includes('pain') || lower.includes('fever') || lower.includes('cough') || lower.includes('headache') || lower.includes('issue') || lower.includes('broken')) {
            updated[field.name] = text.trim();
          }
        }
      });
      updateFormData(updated);
  };

  const submitForm = async () => {
    if (submittedRef.current || submissionInFlightRef.current) return false;
    const data = Object.fromEntries(
      Object.entries(formDataRef.current).filter(([, value]) => typeof value === 'string' && value.trim())
    );
    if (Object.keys(data).length === 0) {
      toast.error('Fill at least one form field before submitting');
      return false;
    }
    submissionInFlightRef.current = true;
    try {
      await api.post('/submissions', { workflowId: selectedTheme, agentName, data });
      submittedRef.current = true;
      setStatus('completed');
      setStatusMessage('Form submitted successfully');
      toast.success('Form submitted and saved');
      return true;
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to submit form');
      return false;
    } finally {
      submissionInFlightRef.current = false;
    }
  };

  const startVoiceSession = async () => {
    try {
      setStatus('connecting');
      setStatusMessage('Connecting to AssemblyAI Voice Agent...');
      setAgentTranscript('');
      setUserTranscript('');
      pendingToolsRef.current = [];
      submittedRef.current = false;

      const authorization = { Authorization: `Bearer ${getToken() || ''}` };
      const tokenRes = await fetch(`${GATEWAY_URL}/api/voice-token`, { headers: authorization });
      if (!tokenRes.ok) throw new Error('Failed to get voice token');
      const tokenData = await tokenRes.json();
      const { token } = tokenData.data || tokenData;
      if (!token) throw new Error('Voice token missing from gateway response');

      const schemaRes = await fetch(`${GATEWAY_URL}/api/schema/${selectedTheme}?lang=${selectedLanguage}`, { headers: authorization });
      if (!schemaRes.ok) throw new Error(`Failed to load voice schema (${schemaRes.status})`);
      const schemaResponse = await schemaRes.json();
      const schemaData = schemaResponse.data;
      if (
        !schemaResponse.success ||
        !schemaData ||
        typeof schemaData.system_prompt !== 'string' ||
        !schemaData.system_prompt.trim() ||
        typeof schemaData.greeting !== 'string' ||
        !Array.isArray(schemaData.tools)
      ) {
        throw new Error('Voice schema response is incomplete');
      }

      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtxClass({ sampleRate: 24000 });
      if (audioCtx.state === 'suspended') await audioCtx.resume();
      audioCtxRef.current = audioCtx;
      playbackTimeRef.current = audioCtx.currentTime;

      await audioCtx.audioWorklet.addModule('/pcm-processor.js');

      const userAnalyser = audioCtx.createAnalyser();
      userAnalyser.fftSize = 128;
      userAnalyser.smoothingTimeConstant = 0.75;
      userAnalyserRef.current = userAnalyser;

      const agentAnalyser = audioCtx.createAnalyser();
      agentAnalyser.fftSize = 128;
      agentAnalyser.smoothingTimeConstant = 0.75;
      agentAnalyser.connect(audioCtx.destination);
      agentAnalyserRef.current = agentAnalyser;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: true, sampleRate: 24000 },
      });
      mediaStreamRef.current = stream;

      const micSource = audioCtx.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(audioCtx, 'pcm-processor');

      micSource.connect(workletNode);
      micSource.connect(userAnalyser);

      const wsUrl = new URL('wss://agents.assemblyai.com/v1/ws');
      wsUrl.searchParams.set('token', token);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      let sessionReady = false;
      let replyDone = false;
      let sessionFailed = false;
      const flushToolResults = () => {
        if (!replyDone || ws.readyState !== WebSocket.OPEN) return;
        for (const tool of pendingToolsRef.current.splice(0)) {
          ws.send(JSON.stringify({ type: 'tool.result', call_id: tool.call_id, result: JSON.stringify(tool.result) }));
        }
      };

      workletNode.port.onmessage = (e) => {
        if (sessionReady && ws.readyState === WebSocket.OPEN) {
          if (isAgentSpeakingRef.current) return;
          const uint8 = new Uint8Array(e.data);
          let binary = '';
          for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
          ws.send(JSON.stringify({ type: 'input.audio', audio: btoa(binary) }));
        }
      };

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: 'session.update',
            session: {
              system_prompt: schemaData.system_prompt,
              greeting: schemaData.greeting,
              tools: schemaData.tools,
              // The Voice Agent API does not support Indonesian; declaring the
              // language beats auto-detection for an English-only agent.
              input: {
                format: { encoding: 'audio/pcm' },
                language_codes: ['en'],
                transcription_prompt: 'Voice interview session in English. Expect names, phone numbers and dates.',
              },
              output: { voice: selectedVoice, format: { encoding: 'audio/pcm' }, volume: 100 },
            },
          })
        );
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'session.error') {
          sessionReady = false;
          sessionFailed = true;
          setStatus('error');
          setStatusMessage(msg.message || msg.error?.message || 'Voice session error');
          ws.close();
        } else if (msg.type === 'session.ready') {
          sessionReady = true;
          isAgentSpeakingRef.current = true;
          setStatus('agent_speaking');
          setStatusMessage('Sarah AI is speaking...');
        } else if (msg.type === 'reply.audio') {
          isAgentSpeakingRef.current = true;
          setStatus('agent_speaking');
          setStatusMessage('Sarah AI Agent speaking...');

          const binaryStr = atob(msg.data);
          const pcm16 = new Int16Array(binaryStr.length / 2);
          for (let i = 0; i < pcm16.length; i++) {
            pcm16[i] = binaryStr.charCodeAt(i * 2) | (binaryStr.charCodeAt(i * 2 + 1) << 8);
          }
          const float32 = new Float32Array(pcm16.length);
          for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 32768;

          const audioBuffer = audioCtx.createBuffer(1, float32.length, 24000);
          audioBuffer.getChannelData(0).set(float32);
          const bufferSource = audioCtx.createBufferSource();
          bufferSource.buffer = audioBuffer;
          if (agentAnalyserRef.current) bufferSource.connect(agentAnalyserRef.current);
          else bufferSource.connect(audioCtx.destination);

          playbackTimeRef.current = Math.max(playbackTimeRef.current, audioCtx.currentTime);
          bufferSource.start(playbackTimeRef.current);
          playbackTimeRef.current += audioBuffer.duration;
        } else if (msg.type === 'reply.started') {
          replyDone = false;
        } else if (msg.type === 'reply.done') {
          replyDone = true;
          flushToolResults();
          isAgentSpeakingRef.current = false;
          setStatus('user_speaking');
          setStatusMessage('Your turn to answer (speak now)...');
        } else if (msg.type === 'transcript.agent' || msg.type === 'transcript.agent.delta') {
          setAgentTranscript(msg.text || msg.transcript || '');
        } else if (msg.type === 'transcript.user' || msg.type === 'transcript.user.delta') {
          setUserTranscript(msg.text || msg.transcript || '');
          extractFromTranscript(msg.text || msg.transcript || '', formFieldsRef.current);
        } else if (msg.type === 'tool.call') {
          const rawArgs = msg.arguments || msg.parameters || {};
          let args = rawArgs;
          if (typeof rawArgs === 'string') {
            try { args = JSON.parse(rawArgs); } catch { args = {}; }
          }
          const callId = msg.call_id || msg.id;
          const sendToolResult = (result: Record<string, unknown>) => {
            if (callId && ws.readyState === WebSocket.OPEN) {
              pendingToolsRef.current.push({ call_id: callId, result });
              flushToolResults();
            }
          };
          const fieldName = args.field_name || args.fieldName || args.field;
          const val = args.value || args.val;
          if (msg.name === 'save_form_field' && fieldName && val) {
            updateFormData({ ...formDataRef.current, [fieldName]: String(val) });
            sendToolResult({ success: true, field_name: fieldName });
          } else if (msg.name === 'submit_form') {
            if (args.confirmation === true) {
              void submitForm().then((success) => sendToolResult({ success }));
            } else {
              sendToolResult({ success: false, message: 'Caller confirmation required' });
            }
          }
        }
      };

      ws.onerror = () => {
        setStatus('error');
        setStatusMessage('Connection failed');
      };
      ws.onclose = () => {
        if (sessionFailed) return;
        setStatus('idle');
        setStatusMessage('Voice session ended.');
      };
    } catch (err: any) {
      setStatus('error');
      setStatusMessage(err.message || 'Failed to start voice');
    }
  };

  const stopVoiceSession = () => {
    if (wsRef.current) {
      const socket = wsRef.current;
      wsRef.current = null;
      // A bare close leaves a 30s resumable session that AssemblyAI still bills.
      if (socket.readyState === WebSocket.OPEN) {
        try { socket.send(JSON.stringify({ type: 'session.end' })); } catch { /* already gone */ }
        // Give the server a moment to emit session.ended, then close regardless.
        const closeTimer = setTimeout(() => socket.close(), 1000);
        socket.addEventListener('close', () => clearTimeout(closeTimer), { once: true });
      } else {
        socket.close();
      }
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    isAgentSpeakingRef.current = false;
    setAudioVolume(0);
    setStatus('idle');
    setStatusMessage('Voice session ended.');
  };

  const isSessionActive = status === 'agent_speaking' || status === 'user_speaking' || status === 'connecting' || status === 'completed';

  return (
    <NotificationsProvider key={currentUser?.id || 'anonymous'} userId={currentUser?.id}>
    <div className="flex h-screen w-screen overflow-hidden bg-white text-slate-900 selection:bg-indigo-500 selection:text-white">
      {/* React Hot Toast Toaster */}
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3200,
          style: {
            background: '#0f172a',
            color: '#f8fafc',
            borderRadius: '16px',
            fontSize: '12px',
            fontWeight: 600,
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            border: '1px solid rgba(51, 65, 85, 0.6)',
            padding: '10px 18px',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#ffffff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#ffffff',
            },
          },
        }}
      />

      {/* 1. Collapsible Platform Sidebar */}
      <AppSidebar
        activePage={activePage}
        onSelectPage={handleNavigate}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        user={currentUser}
      />

      {/* 2. Main Studio Body */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar matching user screenshot 100% */}
        <TopNavbar
          activePage={activePage}
          onSelectPage={handleNavigate}
          agentName={agentName}
          user={currentUser}
        />

        {/* Dynamic Page Views */}
        <main className="flex-1 overflow-hidden relative flex">
          
          {/* VIEW: WORKFLOWS LIST */}
          {activePage === 'workflows' && !selectedWorkflowId && (
            <div className="flex-1 overflow-y-auto bg-[#fafbfc]">
              <WorkflowsView onSelectWorkflow={(id) => router.push(`/workflows/${id}`)} />
            </div>
          )}

          {/* VIEW 1 DETAIL: WORKFLOWS STUDIO (100% Screenshot Replication) */}
          {activePage === 'workflows' && selectedWorkflowId && (
            <div className="flex-1 flex overflow-hidden relative flex-col">
              {/* Back to list header */}
              <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center space-x-4">
                <button 
                  onClick={() => router.push('/agents')}
                  className="flex items-center space-x-1 text-xs font-bold text-slate-500 hover:text-slate-900 transition"
                >
                  <RiArrowLeftSLine className="w-4 h-4" />
                  <span>Back to Agents</span>
                </button>
                <div className="w-px h-4 bg-slate-200" />
                <span className="text-sm font-bold text-slate-900">
                  {selectedWorkflowId === 'new' ? 'New Workflow' : workflowName || 'Workflow Detail'}
                </span>
              </div>
              
              {workflowLoading && <div className="p-6 text-sm text-slate-500">Loading workflow...</div>}
              {workflowError && <div className="p-6 text-sm text-rose-600">{workflowError}</div>}
              {!workflowLoading && !workflowError && (
              <div className="flex-1 flex overflow-hidden relative">
              <div className="flex-1 overflow-y-auto bg-[#fafbfc]">
                {/* Header & Controls Section */}
                <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
                  {/* Top Row: AI Prompt & Actions */}
                  <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                    <button
                      onClick={() => setShowAIGenerateModal(true)}
                      className="flex items-center space-x-3 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-500 hover:border-indigo-300 hover:shadow-sm transition w-full md:w-80 shadow-xs"
                    >
                      <RiSparklingFill className="text-indigo-500 w-4 h-4 flex-shrink-0" />
                      <span className="flex-1 text-left">Ask AI to generate workflow...</span>
                      <kbd className="text-[10px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-400 font-bold border border-slate-200 shadow-2xs">Ctrl+J</kbd>
                    </button>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => routeAgentId && router.push(`/agents/${routeAgentId}/live-test`)}
                        className="flex items-center justify-center space-x-1.5 px-4 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-50 transition shadow-xs flex-1 md:flex-none"
                      >
                        <RiMicLine className="w-4 h-4 text-slate-500" />
                        <span>Test Your Agent</span>
                      </button>
                      <button
                        onClick={() => setShowPublishModal(true)}
                        className="flex items-center justify-center space-x-1.5 px-5 py-2 bg-black hover:bg-slate-800 text-white rounded-full text-xs font-semibold shadow-xs transition active:scale-95 flex-1 md:flex-none"
                      >
                        <RiSparklingFill className="w-4 h-4 text-amber-300" />
                        <span>Publish</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Canvas Area container */}
                <div className="px-4 md:px-6 pb-6 max-w-6xl mx-auto flex flex-col">
                  {/* Canvas Title Row */}
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center space-x-2.5 text-slate-800">
                      <div className="w-7 h-7 rounded bg-slate-200/50 flex items-center justify-center text-slate-600 border border-slate-200">
                        <RiNodeTree className="w-4 h-4" />
                      </div>
                      <h2 className="text-base font-bold text-slate-900">Call Flows</h2>
                      <span className="text-[10px] text-slate-500 ml-1 hidden sm:inline">
                        Guide your agent conversation, gather information and integrates with tools
                      </span>
                    </div>
                    <button className="flex items-center space-x-1.5 text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-slate-100/50 hover:bg-slate-200/50 px-3 py-1.5 rounded-lg border border-slate-200 transition">
                      <RiExternalLinkLine className="w-3.5 h-3.5" />
                      <span>Open the Flow</span>
                    </button>
                  </div>

                  {/* The actual Canvas */}
                  <div className="relative w-full">
                    <WorkflowCanvas
                      nodes={workflowNodes}
                      edges={workflowEdges}
                      selectedNodeId={selectedNode?.id || null}
                      onSelectNode={handleNodeSelect}
                      onNodesChange={handleUpdateNodes}
                      onEdgesChange={handleUpdateEdges}
                      onAddStep={handleAddStep}
                    />

                    {/* Floating Bottom Flow Selector (Inside Canvas area for better UX) */}
                    <div className="absolute bottom-5 left-5 z-20 flex items-center space-x-1 bg-white border border-slate-200 rounded-xl shadow-sm p-1">
                      <div className="px-3 py-1.5 flex items-center space-x-2 text-[11px] font-bold text-slate-700">
                        <span className="text-slate-400 font-medium">Flows:</span>
                        <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md cursor-pointer hover:bg-slate-100 transition">
                          <RiNodeTree className="w-3 h-3 text-indigo-500" />
                          <span>{workflowName || 'Workflow'}</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                        </div>
                      </div>
                      <div className="w-px h-4 bg-slate-200 mx-1" />
                      <button className="w-7 h-7 rounded-lg hover:bg-slate-50 flex items-center justify-center text-slate-500 hover:text-slate-900 transition">
                        <RiAddLine className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Configuration Drawer matching screenshot 100% */}
              {selectedNode && (
                <ConfigurationDrawer
                  node={selectedNode}
                  onClose={() => setSelectedNode(null)}
                  onUpdateNode={(updated) => {
                    const newNodes = workflowNodes.map((n) => (n.id === updated.id ? updated : n));
                    handleUpdateNodes(newNodes);
                    setSelectedNode(updated);
                  }}
                  availableFields={masterFields}
                  onCreateMasterField={(f) =>
                    handleAddMasterField(f as MasterField)
                  }
                />
              )}
            </div>
            )}
            </div>
          )}

          {/* VIEW: DATA MASTER FIELDS */}
          {activePage === 'submissions' && (
            <div className="flex-1 overflow-y-auto">
              {currentUser && <SubmissionsView personal={currentUser.role?.code === 'USER'} />}
            </div>
          )}

          {/* VIEW: DATA MASTER FIELDS */}
          {activePage === 'fields' && (
            <div className="flex-1 overflow-y-auto">
              <MasterFieldsView
                fields={masterFields}
                workflowNodes={workflowNodes}
                onAddField={handleAddMasterField}
                onUpdateField={handleUpdateMasterField}
                onDeleteField={handleDeleteMasterField}
                onToggleFieldNodeRelation={handleToggleFieldNodeRelation}
                onNavigateToNode={handleNavigateToNode}
              />
            </div>
          )}

          {/* VIEW: DATA MASTER USERS */}
          {activePage === 'users' && (
            <div className="flex-1 overflow-y-auto">
              <UsersView />
            </div>
          )}

          {/* VIEW: DATA MASTER ROLES */}
          {activePage === 'roles' && (
            <div className="flex-1 overflow-y-auto">
              <RolesView />
            </div>
          )}

          {/* VIEW: DATA MASTER PERMISSIONS */}
          {activePage === 'permissions' && (
            <div className="flex-1 overflow-y-auto">
              <PermissionsView />
            </div>
          )}

          {/* VIEW: DATA MASTER PERMISSION GROUPS */}
          {activePage === 'permission-groups' && (
            <div className="flex-1 overflow-y-auto">
              <PermissionGroupsView />
            </div>
          )}

          {/* VIEW 2: DASHBOARD */}
          {activePage === 'dashboard' && (
            <div className="flex-1 overflow-y-auto">
              {currentUser?.role?.code === 'USER'
                ? <UserFormsDashboard />
                : <DashboardView onNavigate={handleNavigate} />}
            </div>
          )}

          {/* VIEW: AGENT FORM */}
          {activePage === 'agents' && nestedAgentSection === 'form' && routeAgentId && (
            <div className="flex-1 overflow-y-auto">
              <AgentFormView agentId={routeAgentId} />
            </div>
          )}

          {/* VIEW 3: AGENTS */}
          {activePage === 'agents' && nestedAgentSection !== 'form' && (
            <div className="flex-1 overflow-y-auto">
              <AgentsView
                onNavigate={handleNavigate}
                onSelectAgent={(name, theme, agentId) => {
                  setAgentName(name);
                  setSelectedTheme(theme);
                  if (agentId) {
                    setSelectedTestAgentId(agentId);
                  }
                  loadThemeSchema(theme, selectedLanguage);
                }}
              />
            </div>
          )}

          {/* VIEW 4: KNOWLEDGE */}
          {activePage === 'knowledge' && (
            <div className="flex-1 overflow-y-auto">
              <KnowledgeView />
            </div>
          )}

          {/* VIEW 5: ANALYTICS */}
          {activePage === 'analytics' && (
            <div className="flex-1 overflow-y-auto">
              <AnalyticsView />
            </div>
          )}

          {/* VIEW 6: TEST AGENT (Live Voice Cockpit) */}
          {activePage === 'test-agent' && (
            <TestAgentView
              selectedTestAgentId={selectedTestAgentId}
              agentName={agentName}
              selectedLanguage={selectedLanguage}
              selectedVoice={selectedVoice}
              isSessionActive={isSessionActive}
              status={status}
              statusMessage={statusMessage}
              agentTranscript={agentTranscript}
              userTranscript={userTranscript}
              audioVolume={audioVolume}
              formFields={formFields}
              formData={formData}
              onSelectTestAgentId={setSelectedTestAgentId}
              onSelectLanguage={setSelectedLanguage}
              onSelectVoice={setSelectedVoice}
              onSelectAgent={handleSelectTestAgent}
              onStartSession={startVoiceSession}
              onStopSession={stopVoiceSession}
              onUpdateFormData={updateFormData}
              onSubmitForm={submitForm}
            />
          )}

          {/* VIEW 7: INTEGRATIONS */}
          {activePage === 'integrations' && (
            <div className="flex-1 overflow-y-auto">
              <IntegrationsView />
            </div>
          )}

          {/* VIEW 8: PROFILE */}
          {activePage === 'profile' && (
            <div className="flex-1 overflow-y-auto">
              <ProfileView onProfileUpdated={setCurrentUser} />
            </div>
          )}

          {/* VIEW 9: NOTIFICATIONS */}
          {activePage === 'notifications' && (
            <div className="flex-1 overflow-y-auto">
              <NotificationsView />
            </div>
          )}
        </main>
      </div>

      {/* 3. Publish Modal */}
      <PublishModal
        isOpen={showPublishModal}
        onClose={() => setShowPublishModal(false)}
        onConfirmPublish={handlePublishConfirm}
        agentName={agentName}
      />

      {/* 4. AI Generate Workflow Modal */}
      {showAIGenerateModal && (
        <div className="fixed inset-0 z-50 bg-slate-500/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <RiSparklingFill className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Generate Workflow with AI</h3>
                  <p className="text-xs text-slate-400">Describe the flow you want to build and let AI create the draft.</p>
                </div>
              </div>
              <button
                onClick={() => setShowAIGenerateModal(false)}
                className="w-7 h-7 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition"
              >
                <RiCloseLine className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Describe your workflow
                </label>
                <textarea
                  autoFocus
                  rows={4}
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="e.g., Create a customer support flow that asks for the order number, checks eligibility, and routes to a human agent if angry."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-800 outline-none focus:border-indigo-500 transition resize-none leading-relaxed shadow-xs"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAIGenerateModal(false)}
                  disabled={isGeneratingWorkflow}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerateWorkflow}
                  disabled={isGeneratingWorkflow || !aiPrompt.trim()}
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition flex items-center gap-2 disabled:opacity-50"
                >
                  {isGeneratingWorkflow ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <RiSparklingFill className="w-3.5 h-3.5" />
                      Generate Flow
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </NotificationsProvider>
  );
}
