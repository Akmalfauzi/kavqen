'use client';

import { useDebouncedValue } from '@/hooks/useDebouncedValue';

import React, { useState } from 'react';
import {
  RiDatabase2Line,
  RiAddLine,
  RiSearchLine,
  RiFilter3Line,
  RiNodeTree,
  RiFlowChart,
  RiLinkM,
  RiLinkUnlinkM,
  RiEditLine,
  RiDeleteBinLine,
  RiCheckLine,
  RiCloseLine,
  RiInputField,
  RiCalendarLine,
  RiPhoneLine,
  RiListCheck2,
  RiToggleLine,
  RiFileTextLine,
  RiPriceTag3Line,
  RiSparklingFill,
  RiInformationLine,
  RiArrowRightLine,
} from 'react-icons/ri';
import toast from 'react-hot-toast';
import { WorkflowNode } from '@/components/ConfigurationDrawer';

export interface MasterField {
  id?: string;
  name: string;
  label: string;
  type: 'string' | 'text' | 'number' | 'date' | 'datetime' | 'phone' | 'email' | 'enum' | 'boolean';
  required: boolean;
  prompt_hint?: string;
  options?: string[];
  category?: string;
  description?: string;
}

interface MasterFieldsViewProps {
  fields: MasterField[];
  workflowNodes: WorkflowNode[];
  onAddField: (field: MasterField, linkedNodeIds?: string[]) => Promise<boolean>;
  onUpdateField: (oldName: string, updatedField: MasterField, linkedNodeIds?: string[]) => Promise<boolean>;
  onDeleteField: (fieldName: string) => Promise<boolean>;
  onToggleFieldNodeRelation: (fieldName: string, nodeId: string) => void;
  onNavigateToNode: (nodeId: string) => void;
}

export default function MasterFieldsView({
  fields,
  workflowNodes,
  onAddField,
  onUpdateField,
  onDeleteField,
  onToggleFieldNodeRelation,
  onNavigateToNode,
}: MasterFieldsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebouncedValue(searchQuery);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedRelation, setSelectedRelation] = useState<'all' | 'linked' | 'unlinked'>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<MasterField | null>(null);
  const [saving, setSaving] = useState(false);

  // Form State
  const [formName, setFormName] = useState('');
  const [formLabel, setFormLabel] = useState('');
  const [formType, setFormType] = useState<MasterField['type']>('string');
  const [formRequired, setFormRequired] = useState(false);
  const [formPromptHint, setFormPromptHint] = useState('');
  const [formOptions, setFormOptions] = useState('');
  const [formCategory, setFormCategory] = useState('General');
  const [formLinkedNodeIds, setFormLinkedNodeIds] = useState<string[]>([]);

  // Popover State for Quick Linking on a Row
  const [linkingField, setLinkingField] = useState<string | null>(null);

  // Available Step Nodes in Workflow (steps and triggers can collect data)
  const candidateNodes = workflowNodes.filter((n) => n.type === 'step' || n.type === 'trigger');

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingField(null);
    setFormName('');
    setFormLabel('');
    setFormType('string');
    setFormRequired(false);
    setFormPromptHint('');
    setFormOptions('');
    setFormCategory('General');
    setFormLinkedNodeIds([]);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (field: MasterField) => {
    setEditingField(field);
    setFormName(field.name);
    setFormLabel(field.label || field.name);
    setFormType(field.type || 'string');
    setFormRequired(Boolean(field.required));
    setFormPromptHint(field.prompt_hint || '');
    setFormOptions(field.options ? field.options.join(', ') : '');
    setFormCategory(field.category || 'General');

    // Find currently linked nodes
    const linked = workflowNodes
      .filter((n) => n.config?.target_fields?.includes(field.name))
      .map((n) => n.id);
    setFormLinkedNodeIds(linked);
    setIsModalOpen(true);
  };

  // Helper to auto-generate slug name from label
  const handleLabelChange = (val: string) => {
    setFormLabel(val);
    if (!editingField) {
      const slug = val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
      setFormName(slug);
    }
  };

  // Save Modal (Create or Update)
  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = formName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!cleanName) {
      toast.error('Field key (identifier) is required');
      return;
    }

    if (!formLabel.trim()) {
      toast.error('Field display label is required');
      return;
    }

    const parsedOptions =
      formType === 'enum'
        ? formOptions
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;

    const payload: MasterField = {
      name: cleanName,
      label: formLabel.trim(),
      type: formType,
      required: formRequired,
      prompt_hint: formPromptHint.trim() || undefined,
      options: parsedOptions,
      category: formCategory.trim() || 'General',
    };

    if (!editingField) {
      // Check duplicate
      if (fields.some((f) => f.name === cleanName)) {
        toast.error(`Field with key "${cleanName}" already exists`);
        return;
      }
    }
    setSaving(true);
    try {
      const saved = editingField
        ? await onUpdateField(editingField.name, payload, formLinkedNodeIds)
        : await onAddField(payload, formLinkedNodeIds);
      if (!saved) return;
      toast.success(editingField ? `Updated field "${payload.label}"` : `Created master field "${payload.label}"`);
      setIsModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (field: MasterField) => {
    if (confirm(`Are you sure you want to delete "${field.label}" (${field.name})? This will also unlink it from all workflow steps.`)) {
      if (await onDeleteField(field.name)) toast.success(`Deleted field "${field.label}"`);
    }
  };

  // Filtered master fields
  const filteredFields = fields.filter((f) => {
    const matchesSearch =
      f.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      (f.label && f.label.toLowerCase().includes(debouncedSearch.toLowerCase())) ||
      (f.prompt_hint && f.prompt_hint.toLowerCase().includes(debouncedSearch.toLowerCase())) ||
      (f.category && f.category.toLowerCase().includes(debouncedSearch.toLowerCase()));

    const matchesType = selectedType === 'all' || f.type === selectedType;

    const isLinked = workflowNodes.some((n) => n.config?.target_fields?.includes(f.name));
    const matchesRelation =
      selectedRelation === 'all' ||
      (selectedRelation === 'linked' && isLinked) ||
      (selectedRelation === 'unlinked' && !isLinked);

    return matchesSearch && matchesType && matchesRelation;
  });

  // Calculate stats
  const totalCount = fields.length;
  const linkedCount = fields.filter((f) =>
    workflowNodes.some((n) => n.config?.target_fields?.includes(f.name))
  ).length;
  const unlinkedCount = totalCount - linkedCount;
  const requiredCount = fields.filter((f) => f.required).length;

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'date':
      case 'datetime':
        return <RiCalendarLine className="w-3.5 h-3.5 text-amber-600" />;
      case 'phone':
        return <RiPhoneLine className="w-3.5 h-3.5 text-emerald-600" />;
      case 'number':
        return <RiPriceTag3Line className="w-3.5 h-3.5 text-purple-600" />;
      case 'enum':
        return <RiListCheck2 className="w-3.5 h-3.5 text-sky-600" />;
      case 'boolean':
        return <RiToggleLine className="w-3.5 h-3.5 text-teal-600" />;
      case 'text':
        return <RiFileTextLine className="w-3.5 h-3.5 text-indigo-600" />;
      default:
        return <RiInputField className="w-3.5 h-3.5 text-slate-600" />;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 select-none animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs">
              <RiDatabase2Line className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                Data Master Fields
                <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold px-2 py-0.5 rounded-full">
                  Workflow Relations
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Central catalog of variables captured, validated, and passed between Voice AI workflow steps.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleOpenCreate}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center space-x-1.5"
        >
          <RiAddLine className="w-4 h-4" />
          <span>New Master Field</span>
        </button>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Total Fields</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <RiDatabase2Line className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">{totalCount}</div>
          <span className="text-[11px] text-slate-400">Defined in system schema</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Workflow Linked</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <RiLinkM className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-600">{linkedCount}</div>
          <span className="text-[11px] text-slate-400">Active in workflow nodes</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Required Variables</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <RiSparklingFill className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-rose-600">{requiredCount}</div>
          <span className="text-[11px] text-slate-400">Mandatory for caller intake</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Unlinked Fields</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <RiLinkUnlinkM className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-amber-600">{unlinkedCount}</div>
          <span className="text-[11px] text-slate-400">Not tied to any workflow step</span>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex-1 min-w-[260px] flex items-center space-x-2 px-2">
          <RiSearchLine className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search fields by name, label, category, or prompt hint..."
            className="w-full text-xs text-slate-800 outline-none bg-transparent"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-xs text-slate-400 hover:text-slate-600">
              Clear
            </button>
          )}
        </div>

        <div className="flex items-center space-x-2 text-xs">
          {/* Filter Type */}
          <div className="flex items-center space-x-1 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200 text-slate-600">
            <RiFilter3Line className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="bg-transparent outline-none font-semibold text-slate-700 cursor-pointer text-xs"
            >
              <option value="all">All Data Types</option>
              <option value="string">String</option>
              <option value="text">Long Text</option>
              <option value="number">Number</option>
              <option value="date">Date</option>
              <option value="datetime">Date &amp; Time</option>
              <option value="phone">Phone</option>
              <option value="email">Email</option>
              <option value="enum">Enum</option>
              <option value="boolean">Boolean</option>
            </select>
          </div>

          {/* Filter Workflow Relation */}
          <div className="flex items-center space-x-1 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200 text-slate-600">
            <RiFlowChart className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedRelation}
              onChange={(e) => setSelectedRelation(e.target.value as any)}
              className="bg-transparent outline-none font-semibold text-slate-700 cursor-pointer text-xs"
            >
              <option value="all">All Relations</option>
              <option value="linked">Linked to Workflow</option>
              <option value="unlinked">Unlinked</option>
            </select>
          </div>
        </div>
      </div>

      {/* Master Fields Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Field Identifier & Label</th>
                <th className="py-3.5 px-4">Type</th>
                <th className="py-3.5 px-4">Requirement</th>
                <th className="py-3.5 px-4">Voice AI Prompt Hint</th>
                <th className="py-3.5 px-4 min-w-[240px]">Associated Workflow Steps</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredFields.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <RiDatabase2Line className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-600">No master fields found</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Try adjusting your search filters or click &ldquo;New Master Field&rdquo; to define one.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredFields.map((field) => {
                  const linkedNodes = workflowNodes.filter((n) =>
                    n.config?.target_fields?.includes(field.name)
                  );
                  const isLinked = linkedNodes.length > 0;

                  return (
                    <tr key={field.name} className="hover:bg-slate-50/60 transition group">
                      {/* Field Name & Label */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <div className="font-bold text-slate-900 text-sm">{field.label || field.name}</div>
                          <div className="flex items-center space-x-1.5">
                            <code className="text-[11px] font-mono text-indigo-700 bg-indigo-50/80 px-1.5 py-0.5 rounded border border-indigo-100">
                              {field.name}
                            </code>
                            {field.category && (
                              <span className="text-[10px] text-slate-400 font-medium">
                                • {field.category}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Type */}
                      <td className="py-3.5 px-4">
                        <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-700">
                          {getTypeIcon(field.type)}
                          <span className="capitalize">{field.type}</span>
                          {field.options && field.options.length > 0 && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              ({field.options.length})
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Requirement */}
                      <td className="py-3.5 px-4">
                        {field.required ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <span>Required</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">
                            <span>Optional</span>
                          </span>
                        )}
                      </td>

                      {/* Prompt Hint */}
                      <td className="py-3.5 px-4 max-w-xs">
                        {field.prompt_hint ? (
                          <div className="text-[11px] text-slate-600 line-clamp-2 italic bg-slate-50/80 p-1.5 rounded-lg border border-slate-200/60">
                            &ldquo;{field.prompt_hint}&rdquo;
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">No agent guidance</span>
                        )}
                      </td>

                      {/* Workflow Relation Chips */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {isLinked ? (
                            linkedNodes.map((node) => (
                              <button
                                key={node.id}
                                onClick={() => onNavigateToNode(node.id)}
                                title={`Click to jump to "${node.title}" in Workflow canvas`}
                                className="group/chip inline-flex items-center space-x-1 px-2 py-1 rounded-lg text-[11px] font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition"
                              >
                                <RiNodeTree className="w-3 h-3 text-indigo-500 group-hover/chip:rotate-12 transition-transform" />
                                <span className="max-w-[120px] truncate">{node.title || node.config?.step_name}</span>
                                <RiArrowRightLine className="w-3 h-3 opacity-0 group-hover/chip:opacity-100 transition-opacity ml-0.5" />
                              </button>
                            ))
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                              <RiLinkUnlinkM className="w-3 h-3 text-amber-500" />
                              <span>Not linked yet</span>
                            </span>
                          )}

                          {/* Quick Link Button */}
                          <div className="relative inline-block">
                            <button
                              onClick={() =>
                                setLinkingField(linkingField === field.name ? null : field.name)
                              }
                              title="Assign/unassign workflow steps"
                              className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-200 transition text-[11px]"
                            >
                              <RiLinkM className="w-3.5 h-3.5" />
                            </button>

                            {/* Dropdown Popover */}
                            {linkingField === field.name && (
                              <div className="absolute left-0 top-full mt-1.5 w-60 bg-white rounded-xl shadow-xl border border-slate-200 p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 mb-1.5">
                                  <span className="text-[11px] font-bold text-slate-800">
                                    Link to Workflow Step:
                                  </span>
                                  <button
                                    onClick={() => setLinkingField(null)}
                                    className="text-slate-400 hover:text-slate-600"
                                  >
                                    <RiCloseLine className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                <div className="max-h-48 overflow-y-auto space-y-1">
                                  {candidateNodes.map((node) => {
                                    const isAssigned = node.config?.target_fields?.includes(
                                      field.name
                                    );
                                    return (
                                      <label
                                        key={node.id}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onToggleFieldNodeRelation(field.name, node.id);
                                        }}
                                        className={`flex items-center justify-between p-1.5 rounded-lg text-xs cursor-pointer transition ${
                                          isAssigned
                                            ? 'bg-indigo-50 text-indigo-900 font-bold'
                                            : 'text-slate-600 hover:bg-slate-50'
                                        }`}
                                      >
                                        <span className="truncate pr-1">{node.title}</span>
                                        {isAssigned && (
                                          <RiCheckLine className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                        )}
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1 opacity-80 group-hover:opacity-100 transition">
                          <button
                            onClick={() => handleOpenEdit(field)}
                            title="Edit Master Field"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-200 transition"
                          >
                            <RiEditLine className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(field)}
                            title="Delete Master Field"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition"
                          >
                            <RiDeleteBinLine className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <RiDatabase2Line className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingField ? 'Edit Master Field' : 'Create Master Field'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Define variable properties and associate it with workflow nodes
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-7 h-7 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition"
              >
                <RiCloseLine className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveModal} className="space-y-4">
              {/* Display Label & Slug Key */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Display Label <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formLabel}
                    onChange={(e) => handleLabelChange(e.target.value)}
                    placeholder="e.g. National ID Number"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 outline-none focus:border-indigo-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Variable Key / Identifier <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. national_id_number"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono text-indigo-700 outline-none focus:border-indigo-500 transition bg-slate-50/50"
                  />
                </div>
              </div>

              {/* Data Type & Category */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Data Type</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 outline-none focus:border-indigo-500 transition bg-white"
                  >
                    <option value="string">String (Generic text line)</option>
                    <option value="text">Long Text / Narrative</option>
                    <option value="number">Number (Currency, Amount, Age)</option>
                    <option value="date">Date (Birthdate, Booking)</option>
                    <option value="datetime">Date &amp; Time (Appointment slot)</option>
                    <option value="phone">Phone Number</option>
                    <option value="email">Email Address</option>
                    <option value="enum">Enum (Select from preset options)</option>
                    <option value="boolean">Boolean (Yes / No)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                  <input
                    type="text"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    placeholder="e.g. Personal, Financial, Medical"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 outline-none focus:border-indigo-500 transition"
                  />
                </div>
              </div>

              {/* Enum Options if Enum */}
              {formType === 'enum' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Enum Options <span className="text-slate-400 font-normal">(comma-separated)</span>
                  </label>
                  <input
                    type="text"
                    value={formOptions}
                    onChange={(e) => setFormOptions(e.target.value)}
                    placeholder="low, medium, high"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 outline-none focus:border-indigo-500 transition"
                  />
                </div>
              )}

              {/* Voice Agent Prompt Hint */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Voice Agent Prompt Hint
                  <span className="text-slate-400 font-normal ml-1">
                    (How the LLM should naturally ask the caller)
                  </span>
                </label>
                <textarea
                  rows={2}
                  value={formPromptHint}
                  onChange={(e) => setFormPromptHint(e.target.value)}
                  placeholder="e.g. Ask caller for their 16-digit national ID and confirm pronunciation"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 outline-none focus:border-indigo-500 transition resize-none"
                />
              </div>

              {/* Required Checkbox */}
              <label className="flex items-center space-x-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50/50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formRequired}
                  onChange={(e) => setFormRequired(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                />
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Required Variable</span>
                  <span className="text-[11px] text-slate-500 block">
                    Caller cannot progress past the workflow step until this variable is captured.
                  </span>
                </div>
              </label>

              {/* Direct Relation to Workflow Steps */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <RiFlowChart className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Associate with Workflow Steps</span>
                  </label>
                  <span className="text-[10px] text-slate-400">Select which step collects this field</span>
                </div>

                <div className="space-y-1.5 max-h-40 overflow-y-auto p-2 rounded-xl border border-slate-200 bg-slate-50/50">
                  {candidateNodes.length === 0 ? (
                    <p className="text-xs text-slate-400 p-2 text-center">No workflow steps available</p>
                  ) : (
                    candidateNodes.map((node) => {
                      const isChecked = formLinkedNodeIds.includes(node.id);
                      return (
                        <label
                          key={node.id}
                          className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer border transition ${
                            isChecked
                              ? 'bg-indigo-50 border-indigo-200 text-indigo-900 font-bold'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100/60'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormLinkedNodeIds([...formLinkedNodeIds, node.id]);
                                } else {
                                  setFormLinkedNodeIds(
                                    formLinkedNodeIds.filter((id) => id !== node.id)
                                  );
                                }
                              }}
                              className="rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                            />
                            <span>{node.title || node.config?.step_name}</span>
                          </div>
                          <span className="text-[10px] uppercase font-semibold text-slate-400">
                            {node.type}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition"
                >
                  {saving ? 'Saving...' : editingField ? 'Save Changes' : 'Create Master Field'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
