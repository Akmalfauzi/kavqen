'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { WorkflowNode } from './ConfigurationDrawer';
import {
  RiZoomInLine,
  RiZoomOutLine,
  RiFullscreenLine,
  RiAddLine,
  RiFlag2Line,
  RiUserFollowLine,
  RiFileList3Line,
  RiToolsLine,
  RiPhoneLockLine,
  RiNodeTree,
  RiBookOpenLine,
  RiPuzzle2Line,
  RiDeleteBinLine,
  RiSettings4Line,
  RiFileCopyLine,
  RiCloseLine,
} from 'react-icons/ri';
import toast from 'react-hot-toast';

export interface WorkflowEdge {
  id: string;
  from: string;
  to: string;
}

interface WorkflowCanvasProps {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  selectedNodeId: string | null;
  onSelectNode: (node: WorkflowNode | null) => void;
  onNodesChange: (nodes: WorkflowNode[]) => void;
  onEdgesChange: (edges: WorkflowEdge[]) => void;
  onAddStep: () => void;
}

interface ContextMenuState {
  x: number;
  y: number;
  node: WorkflowNode;
}

export default function WorkflowCanvas({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
  onNodesChange,
  onEdgesChange,
  onAddStep,
}: WorkflowCanvasProps) {
  const [zoom, setZoom] = useState<number>(0.92);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 30, y: 10 });
  const [isPanning, setIsPanning] = useState(false);
  const [isDraggingNode, setIsDraggingNode] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Keep reference to latest nodes for smooth drag-drop persistence without stale closures
  const nodesRef = useRef<WorkflowNode[]>(nodes);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  // Restore saved canvas view (pan & zoom) from localStorage
  useEffect(() => {
    try {
      const savedView = localStorage.getItem('kavqen_workflow_canvas_view');
      if (savedView) {
        const parsed = JSON.parse(savedView);
        if (typeof parsed.zoom === 'number') setZoom(parsed.zoom);
        if (parsed.pan && typeof parsed.pan.x === 'number' && typeof parsed.pan.y === 'number') {
          setPan(parsed.pan);
        }
      }
    } catch (e) {}
  }, []);

  const saveCanvasView = (newZoom: number, newPan: { x: number; y: number }) => {
    try {
      localStorage.setItem('kavqen_workflow_canvas_view', JSON.stringify({ zoom: newZoom, pan: newPan }));
    } catch (e) {}
  };

  // Dragging refs for 60fps+ jitter-free math
  const dragRef = useRef<{
    nodeId: string;
    startX: number;
    startY: number;
    nodeStartX: number;
    nodeStartY: number;
    hasMoved: boolean;
  } | null>(null);

  const panStartRef = useRef<{
    startX: number;
    startY: number;
    panStartX: number;
    panStartY: number;
  } | null>(null);

  const NODE_WIDTH = 250;
  const NODE_HEIGHT = 120;
  const TRIGGER_WIDTH = 210;
  const TRIGGER_HEIGHT = 38;
  const PILL_WIDTH = 130;
  const PILL_HEIGHT = 44;

  const handleZoomIn = () => {
    setZoom((prev) => {
      const next = Math.min(prev + 0.1, 1.5);
      saveCanvasView(next, pan);
      return next;
    });
  };

  const handleZoomOut = () => {
    setZoom((prev) => {
      const next = Math.max(prev - 0.1, 0.6);
      saveCanvasView(next, pan);
      return next;
    });
  };

  const handleFitView = () => {
    const nextZoom = 0.92;
    const nextPan = { x: 30, y: 10 };
    setZoom(nextZoom);
    setPan(nextPan);
    saveCanvasView(nextZoom, nextPan);
  };

  // Canvas Mouse Events
  const handleMouseDownCanvas = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click for canvas pan
    if ((e.target as HTMLElement).closest('.workflow-node')) return;

    setContextMenu(null);
    setIsPanning(true);
    panStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      panStartX: pan.x,
      panStartY: pan.y,
    };
  };

  // Window-level mouse move & up listeners so dragging/panning is silky smooth
  // even if the cursor leaves the canvas or moves quickly
  useEffect(() => {
    if (!isPanning && !isDraggingNode) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      if (isPanning && panStartRef.current) {
        const dx = e.clientX - panStartRef.current.startX;
        const dy = e.clientY - panStartRef.current.startY;
        setPan({
          x: panStartRef.current.panStartX + dx,
          y: panStartRef.current.panStartY + dy,
        });
      } else if (isDraggingNode && dragRef.current) {
        const dx = (e.clientX - dragRef.current.startX) / zoom;
        const dy = (e.clientY - dragRef.current.startY) / zoom;

        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          dragRef.current.hasMoved = true;
        }

        const newX = Math.max(10, Math.round(dragRef.current.nodeStartX + dx));
        const newY = Math.max(10, Math.round(dragRef.current.nodeStartY + dy));

        const updatedNodes = nodesRef.current.map((node) => {
          if (node.id === dragRef.current?.nodeId) {
            return {
              ...node,
              position: { x: newX, y: newY },
            };
          }
          return node;
        });

        onNodesChange(updatedNodes);
      }
    };

    const handleWindowMouseUp = () => {
      if (isDraggingNode && dragRef.current) {
        if (dragRef.current.hasMoved) {
          const movedId = dragRef.current.nodeId;
          const movedNode = nodesRef.current.find((n) => n.id === movedId);
          const title = movedNode?.config?.step_name || movedNode?.title || 'Step';

          // Auto save immediately to localStorage
          try {
            localStorage.setItem('kavqen_sarah_nodes', JSON.stringify(nodesRef.current));
          } catch (e) {}

          // Display success toast notification
          toast.success(`Posisi "${title}" otomatis tersimpan!`, {
            id: 'node-pos-saved',
            duration: 2500,
          });
        }
        setIsDraggingNode(false);
        dragRef.current = null;
      }

      if (isPanning) {
        setIsPanning(false);
        if (panStartRef.current) {
          saveCanvasView(zoom, pan);
          panStartRef.current = null;
        }
      }
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [isPanning, isDraggingNode, zoom, pan, onNodesChange]);

  // Context Menu Handler on Right Click
  const handleNodeContextMenu = (e: React.MouseEvent, node: WorkflowNode) => {
    e.preventDefault();
    e.stopPropagation();

    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();

    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;

    // Keep menu within canvas bounds
    const menuWidth = 210;
    const menuHeight = 150;
    const x = Math.min(Math.max(10, rawX), rect.width - menuWidth - 15);
    const y = Math.min(Math.max(10, rawY), rect.height - menuHeight - 15);

    setContextMenu({ x, y, node });
  };

  // Node Actions from Context Menu
  const handleDeleteNode = useCallback(
    (targetNode: WorkflowNode) => {
      // Start and end anchor the flow, so they are not deletable.
      if (targetNode.type === 'trigger' || targetNode.type === 'action') {
        setContextMenu(null);
        toast.error('The start and end of a flow cannot be deleted.');
        return;
      }

      // 1. Remove node
      const updatedNodes = nodes.filter((n) => n.id !== targetNode.id);
      onNodesChange(updatedNodes);

      // 2. Reconnect the gap so the flow stays start -> ... -> end
      const incoming = edges.filter((e) => e.to === targetNode.id).map((e) => e.from);
      const outgoing = edges.filter((e) => e.from === targetNode.id).map((e) => e.to);
      const bridged = incoming.flatMap((from) =>
        outgoing.map((to) => ({ id: `edge_${from}_${to}`, from, to })));
      const updatedEdges = [
        ...edges.filter((e) => e.from !== targetNode.id && e.to !== targetNode.id),
        ...bridged.filter((b) => !edges.some((e) => e.from === b.from && e.to === b.to)),
      ];
      onEdgesChange(updatedEdges);

      // 3. Clear selected node if active
      if (selectedNodeId === targetNode.id) {
        onSelectNode(null);
      }

      setContextMenu(null);
      toast.success(`Step "${targetNode.config?.step_name || targetNode.title}" berhasil dihapus!`);
    },
    [nodes, edges, selectedNodeId, onNodesChange, onEdgesChange, onSelectNode]
  );

  const handleDuplicateNode = (targetNode: WorkflowNode) => {
    const newId = `node_${Date.now()}`;
    const duplicate: WorkflowNode = {
      ...targetNode,
      id: newId,
      title: `${targetNode.title} (Copy)`,
      config: {
        ...targetNode.config,
        step_name: `${targetNode.config?.step_name || targetNode.title} (Copy)`,
      },
      position: {
        x: targetNode.position.x + 30,
        y: targetNode.position.y + 40,
      },
    };
    onNodesChange([...nodes, duplicate]);
    onSelectNode(duplicate);
    setContextMenu(null);
    toast.success(`Step "${duplicate.title}" berhasil diduplikasi!`);
  };

  const handleConfigureNode = (targetNode: WorkflowNode) => {
    onSelectNode(targetNode);
    setContextMenu(null);
  };

  // Close context menu on click outside or Escape, and handle Delete keyboard shortcut
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      if (contextMenu) {
        setContextMenu(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
      }
      // Delete key deletes selected node
      if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        selectedNodeId &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        const target = nodes.find((n) => n.id === selectedNodeId);
        if (target) {
          handleDeleteNode(target);
        }
      }
    };

    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu, selectedNodeId, nodes, handleDeleteNode]);

  // Node Icon Helper with Remix Icons matching screenshot
  const renderNodeIcon = (node: WorkflowNode) => {
    if (node.icon === 'flag') {
      return (
        <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0">
          <RiFlag2Line className="w-4 h-4" />
        </div>
      );
    }

    if (node.icon === 'user' || node.color === 'emerald') {
      return (
        <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
          <RiUserFollowLine className="w-4 h-4" />
        </div>
      );
    }

    if (node.icon === 'yellow' || node.color === 'yellow') {
      return (
        <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
          <RiFileList3Line className="w-4 h-4" />
        </div>
      );
    }

    if (node.icon === 'wrench' || node.color === 'sky') {
      return (
        <div className="w-7 h-7 rounded-lg bg-sky-50 border border-sky-200 text-sky-600 flex items-center justify-center shrink-0">
          <RiToolsLine className="w-4 h-4" />
        </div>
      );
    }

    if (node.icon === 'phone-x' || node.color === 'rose') {
      return (
        <div className="w-6 h-6 rounded-lg bg-rose-50 border border-rose-200 text-rose-500 flex items-center justify-center shrink-0">
          <RiPhoneLockLine className="w-3.5 h-3.5" />
        </div>
      );
    }

    // Default Pink Network icon matching screenshot
    return (
      <div className="w-7 h-7 rounded-lg bg-pink-100 border border-pink-200 text-pink-600 flex items-center justify-center shrink-0">
        <RiNodeTree className="w-4 h-4" />
      </div>
    );
  };

  const isInteracting = isPanning || isDraggingNode;

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDownCanvas}
      className={`relative w-full h-[640px] lg:h-[720px] overflow-hidden rounded-2xl border border-slate-200/90 shadow-xs select-none ${
        isPanning ? 'cursor-grabbing' : 'cursor-grab'
      }`}
      style={{
        backgroundColor: '#fafbfc',
        backgroundImage: 'radial-gradient(#d1d5db 1.2px, transparent 1.2px)',
        backgroundSize: '24px 24px',
        backgroundPosition: `${pan.x}px ${pan.y}px`,
      }}
    >
      {/* Floating Canvas Controls */}
      <div className="absolute right-5 top-5 z-20 flex flex-col items-center bg-white rounded-xl border border-slate-200 shadow-sm p-1 space-y-1">
        <button
          onClick={handleZoomIn}
          className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-700 transition"
          title="Zoom In"
        >
          <RiZoomInLine className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomOut}
          className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-700 transition"
          title="Zoom Out"
        >
          <RiZoomOutLine className="w-4 h-4" />
        </button>
        <button
          onClick={handleFitView}
          className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-700 transition"
          title="Fit to Screen"
        >
          <RiFullscreenLine className="w-4 h-4" />
        </button>
        <div className="w-5 h-[1px] bg-slate-200" />
        <button
          onClick={onAddStep}
          className="w-9 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center transition shadow-sm"
          title="Add step"
          aria-label="Add step"
        >
          <RiAddLine className="w-5 h-5" />
        </button>
      </div>

      {/* Transformable Canvas Content - Zero lag during interaction */}
      <div
        className={`w-full h-full absolute inset-0 origin-top-left pointer-events-none will-change-transform ${
          isInteracting ? 'transition-none' : 'transition-transform duration-200 ease-out'
        }`}
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        }}
      >
        {/* SVG Connector Lines - No transition lag on path coordinate updates */}
        <svg className="w-[3000px] h-[3000px] absolute inset-0 pointer-events-none overflow-visible">
          {edges.map((edge) => {
            const fromNode = nodes.find((n) => n.id === edge.from);
            const toNode = nodes.find((n) => n.id === edge.to);
            if (!fromNode || !toNode) return null;

            const isFromTrigger = fromNode.type === 'trigger';
            const isToTrigger = toNode.type === 'trigger';
            const isFromPill = fromNode.type === 'action';
            const isToPill = toNode.type === 'action';

            const w1 = isFromTrigger ? TRIGGER_WIDTH : isFromPill ? PILL_WIDTH : NODE_WIDTH;
            const h1 = isFromTrigger ? TRIGGER_HEIGHT : isFromPill ? PILL_HEIGHT : NODE_HEIGHT;
            const w2 = isToTrigger ? TRIGGER_WIDTH : isToPill ? PILL_WIDTH : NODE_WIDTH;

            const x1 = fromNode.position.x + w1 / 2;
            const y1 = fromNode.position.y + h1;
            const x2 = toNode.position.x + w2 / 2;
            const y2 = toNode.position.y;

            const deltaY = y2 - y1;
            const curvature = Math.max(30, deltaY * 0.5);
            const pathData = `M ${x1} ${y1} C ${x1} ${y1 + curvature}, ${x2} ${y2 - curvature}, ${x2} ${y2}`;

            return (
              <path
                key={edge.id}
                d={pathData}
                fill="none"
                stroke="#cbd5e1"
                strokeWidth="1.8"
              />
            );
          })}
        </svg>

        {/* Nodes Layer */}
        {nodes.map((node) => {
          const isSelected = selectedNodeId === node.id;
          const isTrigger = node.type === 'trigger';
          const isPill = node.type === 'action';

          // Node 1: Trigger Node matching screenshot
          if (isTrigger) {
            return (
              <div
                key={node.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectNode(node);
                }}
                onMouseDown={(e) => {
                  if (e.button !== 0) return;
                  e.stopPropagation();
                  dragRef.current = {
                    nodeId: node.id,
                    startX: e.clientX,
                    startY: e.clientY,
                    nodeStartX: node.position.x,
                    nodeStartY: node.position.y,
                    hasMoved: false,
                  };
                  setIsDraggingNode(true);
                  setContextMenu(null);
                }}
                onContextMenu={(e) => handleNodeContextMenu(e, node)}
                style={{
                  left: `${node.position.x}px`,
                  top: `${node.position.y}px`,
                  width: `${TRIGGER_WIDTH}px`,
                  height: `${TRIGGER_HEIGHT}px`,
                }}
                className={`workflow-node absolute pointer-events-auto rounded-xl px-3.5 py-2 bg-[#ebf3ff] text-[#2563eb] border border-[#bfdbfe] shadow-2xs flex items-center justify-center space-x-2 cursor-pointer transition-[border-color,box-shadow] will-change-transform ${
                  isSelected ? 'ring-2 ring-blue-500 shadow-sm' : 'hover:border-blue-300'
                }`}
              >
                <RiFlag2Line className="w-3.5 h-3.5 text-[#2563eb]" />
                <span className="text-xs font-semibold text-[#1e40af] truncate">{node.title}</span>
              </div>
            );
          }

          // Node type: Action Pill (e.g. Close Call)
          if (isPill) {
            return (
              <div
                key={node.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectNode(node);
                }}
                onMouseDown={(e) => {
                  if (e.button !== 0) return;
                  e.stopPropagation();
                  dragRef.current = {
                    nodeId: node.id,
                    startX: e.clientX,
                    startY: e.clientY,
                    nodeStartX: node.position.x,
                    nodeStartY: node.position.y,
                    hasMoved: false,
                  };
                  setIsDraggingNode(true);
                  setContextMenu(null);
                }}
                onContextMenu={(e) => handleNodeContextMenu(e, node)}
                style={{
                  left: `${node.position.x}px`,
                  top: `${node.position.y}px`,
                  width: `${PILL_WIDTH}px`,
                  height: `${PILL_HEIGHT}px`,
                }}
                className={`workflow-node absolute pointer-events-auto bg-white rounded-xl px-3 py-2 border flex items-center space-x-2.5 shadow-2xs cursor-pointer transition-[border-color,box-shadow] will-change-transform ${
                  isSelected
                    ? 'border-blue-400 ring-2 ring-blue-200'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {renderNodeIcon(node)}
                <span className="text-xs font-semibold text-slate-800 truncate">{node.title}</span>
              </div>
            );
          }

          // Standard Card Node matching screenshot
          const rulesBadge = node.badges?.rules ?? 1;
          const toolsBadge = node.badges?.tools ?? 1;

          return (
            <div
              key={node.id}
              onClick={(e) => {
                e.stopPropagation();
                onSelectNode(node);
              }}
              onMouseDown={(e) => {
                if (e.button !== 0) return;
                e.stopPropagation();
                dragRef.current = {
                  nodeId: node.id,
                  startX: e.clientX,
                  startY: e.clientY,
                  nodeStartX: node.position.x,
                  nodeStartY: node.position.y,
                  hasMoved: false,
                };
                setIsDraggingNode(true);
                setContextMenu(null);
              }}
              onContextMenu={(e) => handleNodeContextMenu(e, node)}
              style={{
                left: `${node.position.x}px`,
                top: `${node.position.y}px`,
                width: `${NODE_WIDTH}px`,
                height: `${NODE_HEIGHT}px`,
              }}
              className={`workflow-node absolute pointer-events-auto bg-white rounded-2xl p-3.5 border transition-[border-color,box-shadow] shadow-2xs hover:shadow-xs cursor-pointer flex flex-col justify-between will-change-transform ${
                isSelected
                  ? 'border-[#93c5fd] ring-2 ring-[#bfdbfe] shadow-sm'
                  : 'border-slate-200/90 hover:border-slate-300'
              }`}
            >
              {/* Card Header & Title matching screenshot */}
              <div>
                <div className="flex items-center space-x-2.5 mb-1.5">
                  {renderNodeIcon(node)}
                  <h4 className="text-xs font-bold text-slate-900 truncate">
                    {node.config?.step_name || node.title}
                  </h4>
                </div>

                {/* Subtitle / Responsibilities */}
                <p className="text-[11px] leading-relaxed text-slate-500 line-clamp-2">
                  {node.description || node.config?.purpose}
                </p>
              </div>

              {/* Card Footer badges with Remix Icons: Book & Puzzle */}
              <div className="flex items-center space-x-3 pt-1.5 text-[11px] font-semibold text-slate-400">
                <span className="flex items-center space-x-1">
                  <RiBookOpenLine className="w-3.5 h-3.5 text-slate-400" />
                  <span>{rulesBadge}</span>
                </span>
                <span className="flex items-center space-x-1">
                  <RiPuzzle2Line className="w-3.5 h-3.5 text-slate-400" />
                  <span>{toolsBadge}</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Right-Click Context Tooltip Menu */}
      {contextMenu && (
        <div
          style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
          className="absolute z-50 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-2xl p-1.5 w-52 select-none animate-in fade-in zoom-in-95 duration-100 font-sans"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Node Mini Header */}
          <div className="px-2.5 py-2 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center space-x-2 min-w-0 pr-1">
              {renderNodeIcon(contextMenu.node)}
              <div className="min-w-0 overflow-hidden">
                <div className="text-xs font-bold text-slate-900 truncate">
                  {contextMenu.node.config?.step_name || contextMenu.node.title}
                </div>
                <span className="text-[10px] text-slate-400 capitalize font-semibold block">
                  {contextMenu.node.type} step
                </span>
              </div>
            </div>
            <button
              onClick={() => setContextMenu(null)}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded"
            >
              <RiCloseLine className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Menu Actions */}
          <div className="py-1 space-y-0.5">
            <button
              onClick={() => handleConfigureNode(contextMenu.node)}
              className="w-full px-2.5 py-1.5 text-left text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition flex items-center space-x-2"
            >
              <RiSettings4Line className="w-4 h-4 text-slate-500" />
              <span>Konfigurasi Step</span>
            </button>

            <button
              onClick={() => handleDuplicateNode(contextMenu.node)}
              className="w-full px-2.5 py-1.5 text-left text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition flex items-center space-x-2"
            >
              <RiFileCopyLine className="w-4 h-4 text-slate-500" />
              <span>Duplikat Step</span>
            </button>

            <div className="border-t border-slate-100 my-1" />

            {/* Delete button prominently styled in rose */}
            <button
              onClick={() => handleDeleteNode(contextMenu.node)}
              className="w-full px-2.5 py-1.5 text-left text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition flex items-center justify-between group"
            >
              <div className="flex items-center space-x-2">
                <RiDeleteBinLine className="w-4 h-4 text-rose-500 group-hover:scale-110 transition-transform" />
                <span>Hapus Step</span>
              </div>
              <span className="text-[10px] font-mono text-rose-500 bg-rose-100/70 px-1.5 py-0.5 rounded font-bold">
                Del
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
