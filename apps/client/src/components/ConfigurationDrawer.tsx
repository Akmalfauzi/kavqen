'use client';

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  RiNodeTree,
  RiCloseLine,
  RiPhoneLockLine,
  RiUserFollowLine,
  RiArrowDownSLine,
  RiSparklingFill,
  RiCheckLine,
  RiAddLine,
  RiDatabase2Line,
  RiInputField,
  RiCalendarLine,
  RiPhoneLine,
  RiListCheck2,
  RiPriceTag3Line,
} from 'react-icons/ri';

export interface WorkflowNode {
  id: string;
  type: 'trigger' | 'step' | 'condition' | 'action';
  title: string;
  icon?: string;
  color?: string;
  description?: string;
  badges?: { rules: number; tools: number };
  config: {
    step_name: string;
    purpose: string;
    rules?: string;
    voice?: string;
    voice_description?: string;
    target_fields?: string[];
  };
  position: { x: number; y: number };
}

export interface FieldDefItem {
  name: string;
  label?: string;
  type?: string;
  required?: boolean;
  prompt_hint?: string;
  options?: string[];
  category?: string;
}

interface ConfigurationDrawerProps {
  node: WorkflowNode | null;
  onClose: () => void;
  onUpdateNode: (updatedNode: WorkflowNode) => void;
  availableFields?: FieldDefItem[];
  onCreateMasterField?: (field: FieldDefItem, bindToNodeId?: string) => Promise<boolean>;
}

export default function ConfigurationDrawer({
  node,
  onClose,
  onUpdateNode,
  availableFields = [],
  onCreateMasterField,
}: ConfigurationDrawerProps) {
  const [stepName, setStepName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [rules, setRules] = useState('');
  const [voiceName, setVoiceName] = useState('Jessica');
  const [voiceDesc, setVoiceDesc] = useState('Calm, Reassuring');
  const [targetFields, setTargetFields] = useState<string[]>([]);

  // Quick Inline Master Field creation state
  const [showQuickAddField, setShowQuickAddField] = useState(false);
  const [quickLabel, setQuickLabel] = useState('');
  const [quickKey, setQuickKey] = useState('');
  const [quickType, setQuickType] = useState('string');
  const [quickHint, setQuickHint] = useState('');

  useEffect(() => {
    if (node) {
      setStepName(node.config?.step_name || node.title || '');
      setPurpose(node.config?.purpose || node.description || '');
      setRules(node.config?.rules || '');
      setVoiceName(node.config?.voice || 'Jessica');
      setVoiceDesc(node.config?.voice_description || 'Calm, Reassuring');
      setTargetFields(node.config?.target_fields || []);
    }
  }, [node]);

  if (!node) return null;

  const handleSave = (targetFieldsArg?: string[] | React.SyntheticEvent) => {
    const fieldsToSave = Array.isArray(targetFieldsArg) ? targetFieldsArg : targetFields;
    const updated: WorkflowNode = {
      ...node,
      title: stepName,
      description: purpose.slice(0, 90) + (purpose.length > 90 ? '...' : ''),
      config: {
        ...node.config,
        step_name: stepName,
        purpose,
        rules,
        voice: voiceName,
        voice_description: voiceDesc,
        target_fields: fieldsToSave,
      },
    };
    onUpdateNode(updated);
  };

  const toggleField = (fieldName: string) => {
    const next = targetFields.includes(fieldName)
      ? targetFields.filter((item) => item !== fieldName)
      : [...targetFields, fieldName];
    setTargetFields(next);
    handleSave(next);
    toast.success(
      next.includes(fieldName)
        ? `Linked "${fieldName}" to step`
        : `Unlinked "${fieldName}" from step`
    );
  };

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickLabel.trim()) return;
    const cleanKey = (quickKey || quickLabel)
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/^_+|_+$/g, '');
    if (!cleanKey) return;

    const newField: FieldDefItem = {
      name: cleanKey,
      label: quickLabel.trim(),
      type: quickType,
      required: false,
      prompt_hint: quickHint.trim() || undefined,
    };

    if (onCreateMasterField) {
      if (!await onCreateMasterField(newField)) return;
    }
    const next = targetFields.includes(cleanKey) ? targetFields : [...targetFields, cleanKey];
    setTargetFields(next);
    handleSave(next);

    setQuickLabel('');
    setQuickKey('');
    setQuickType('string');
    setQuickHint('');
    setShowQuickAddField(false);
    toast.success(`Created & linked "${newField.label}"`);
  };

  const getIconHeader = () => {
    return (
      <div className="w-7 h-7 rounded-lg bg-pink-100 border border-pink-200 text-pink-600 flex items-center justify-center text-xs shadow-xs">
        <RiNodeTree className="w-4 h-4" />
      </div>
    );
  };

  return (
    <aside className="w-full lg:w-[380px] bg-white border-l border-slate-200/90 shadow-xl flex flex-col h-full z-30 select-none">
      {/* Top Header: Configuration + Close Button */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-900 tracking-tight">Configuration</h2>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition"
        >
          <RiCloseLine className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Selected Step Banner matching screenshot */}
      <div className="px-5 pt-3.5 pb-2 flex items-center space-x-2.5">
        {getIconHeader()}
        <span className="text-sm font-bold text-slate-900 tracking-tight">
          {stepName || node.title}
        </span>
      </div>

      {/* Drawer Content */}
      <div className="p-5 flex-1 overflow-y-auto space-y-4 text-xs">
        <>
            {/* Step Name */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">
                Step name
              </label>
              <input
                type="text"
                value={stepName}
                onChange={(e) => setStepName(e.target.value)}
                onBlur={handleSave}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs font-medium outline-none focus:border-slate-400"
              />
            </div>

            {/* What this step is responsible for */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">
                What this step is responsible for
              </label>
              <textarea
                rows={7}
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                onBlur={handleSave}
                className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-800 text-xs leading-relaxed outline-none focus:border-slate-400 resize-none"
              />
            </div>

            {/* Voice Dropdown matching screenshot */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">
                Voice
              </label>
              <div className="flex items-center p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition relative">
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-400 via-purple-400 to-pink-400 shadow-xs mr-2.5 flex-shrink-0" />
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <select
                    value={voiceName}
                    onChange={(e) => {
                      setVoiceName(e.target.value);
                      const option = e.target.options[e.target.selectedIndex];
                      setVoiceDesc(option.getAttribute('data-desc') || '');
                    }}
                    onBlur={handleSave}
                    className="w-full text-xs font-bold text-slate-900 bg-transparent outline-none appearance-none cursor-pointer"
                  >
                    <optgroup label="English (US)">
                      <option value="alba" data-desc="US English">Alba</option>
                      <option value="eve" data-desc="US English">Eve</option>
                      <option value="george" data-desc="US English">George</option>
                      <option value="jane" data-desc="US English">Jane</option>
                      <option value="jean" data-desc="US English">Jean</option>
                      <option value="mary" data-desc="US English">Mary</option>
                      <option value="michael" data-desc="US English">Michael</option>
                    </optgroup>
                    <optgroup label="English (UK)">
                      <option value="anna" data-desc="UK English">Anna</option>
                      <option value="charles" data-desc="UK English">Charles</option>
                      <option value="paul" data-desc="UK English">Paul</option>
                      <option value="vera" data-desc="UK English">Vera</option>
                    </optgroup>
                    <optgroup label="Italian">
                      <option value="giovanni" data-desc="Italian">Giovanni</option>
                    </optgroup>
                    <optgroup label="Spanish">
                      <option value="lola" data-desc="Spanish">Lola</option>
                    </optgroup>
                    <optgroup label="German">
                      <option value="juergen" data-desc="German">Juergen</option>
                    </optgroup>
                    <optgroup label="Portuguese">
                      <option value="rafael" data-desc="Portuguese">Rafael</option>
                    </optgroup>
                    <optgroup label="French">
                      <option value="estelle" data-desc="French">Estelle</option>
                    </optgroup>
                  </select>
                  <span className="text-[10px] text-slate-400 font-medium block leading-tight truncate">{voiceDesc || 'US English'}</span>
                </div>
                <RiArrowDownSLine className="text-slate-400 w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
        </>


        <>
          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">
                Step Rules & Form Fields
              </label>
              <textarea
                rows={3}
                value={rules}
                onChange={(e) => setRules(e.target.value)}
                onBlur={handleSave}
                placeholder="Validation constraints for this step..."
                className="w-full p-3 rounded-xl border border-slate-200 bg-white text-slate-800 text-xs leading-relaxed outline-none focus:border-slate-400 resize-none"
              />
            </div>

            {/* Master Fields Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                  <RiDatabase2Line className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Master Data Fields ({targetFields.length} linked)</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowQuickAddField(!showQuickAddField)}
                  className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 hover:underline"
                >
                  <RiAddLine className="w-3.5 h-3.5" />
                  <span>{showQuickAddField ? 'Cancel' : 'New Field'}</span>
                </button>
              </div>

              {/* Quick Add Inline Form */}
              {showQuickAddField && (
                <div className="p-3 mb-3 bg-indigo-50/50 border border-indigo-200 rounded-xl space-y-2.5 animate-in fade-in zoom-in-95 duration-150">
                  <div className="text-[11px] font-bold text-indigo-900">Add & Link Master Field</div>
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      placeholder="Field Label (e.g. Account Number)"
                      value={quickLabel}
                      onChange={(e) => {
                        setQuickLabel(e.target.value);
                        setQuickKey(
                          e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, '_')
                            .replace(/^_+|_+$/g, '')
                        );
                      }}
                      className="w-full px-2.5 py-1.5 bg-white rounded-lg border border-indigo-200 text-xs text-slate-800 outline-none"
                    />
                    <div className="grid grid-cols-2 gap-1.5">
                      <input
                        type="text"
                        placeholder="Key (account_number)"
                        value={quickKey}
                        onChange={(e) => setQuickKey(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white rounded-lg border border-indigo-200 text-[11px] font-mono text-indigo-800 outline-none"
                      />
                      <select
                        value={quickType}
                        onChange={(e) => setQuickType(e.target.value)}
                        className="w-full px-2 py-1.5 bg-white rounded-lg border border-indigo-200 text-xs text-slate-700 outline-none"
                      >
                        <option value="string">String</option>
                        <option value="number">Number</option>
                        <option value="phone">Phone</option>
                        <option value="date">Date</option>
                        <option value="datetime">Date &amp; time</option>
                        <option value="text">Text</option>
                      </select>
                    </div>
                    <input
                      type="text"
                      placeholder="Prompt hint for Voice AI..."
                      value={quickHint}
                      onChange={(e) => setQuickHint(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white rounded-lg border border-indigo-200 text-xs text-slate-800 outline-none"
                    />
                  </div>
                  <div className="flex justify-end gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowQuickAddField(false)}
                      className="px-2.5 py-1 text-[11px] text-slate-600 hover:bg-white rounded-lg transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleQuickAdd}
                      className="px-3 py-1 bg-indigo-600 text-white font-bold text-[11px] rounded-lg shadow-xs hover:bg-indigo-700 transition"
                    >
                      Add & Bind
                    </button>
                  </div>
                </div>
              )}

              {/* Fields List */}
              {availableFields.length === 0 ? (
                <p className="text-xs text-slate-400 italic p-2 text-center">
                  No master fields defined yet.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
                  {availableFields.map((f) => {
                    const isChecked = targetFields.includes(f.name);
                    return (
                      <div
                        key={f.name}
                        onClick={() => toggleField(f.name)}
                        className={`p-2 rounded-xl border text-xs cursor-pointer transition select-none ${
                          isChecked
                            ? 'border-indigo-300 bg-indigo-50/60 text-indigo-900 shadow-xs'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-semibold">{f.label || f.name}</span>
                            <span className="text-[10px] font-mono text-slate-400">
                              ({f.name})
                            </span>
                          </div>
                          <div className="flex items-center space-x-1.5">
                            {f.type && (
                              <span className="text-[9px] uppercase font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                {f.type}
                              </span>
                            )}
                            {f.required && (
                              <span className="text-[9px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                                Req
                              </span>
                            )}
                            <div
                              className={`w-4 h-4 rounded flex items-center justify-center border transition ${
                                isChecked
                                  ? 'bg-indigo-600 border-indigo-600 text-white'
                                  : 'border-slate-300 bg-white'
                              }`}
                            >
                              {isChecked && <RiCheckLine className="w-3 h-3" />}
                            </div>
                          </div>
                        </div>
                        {f.prompt_hint && (
                          <div className="text-[10px] text-slate-500 italic mt-1 line-clamp-1">
                            &ldquo;{f.prompt_hint}&rdquo;
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>

      </div>

      {/* Footer */}
      <div className="p-3.5 border-t border-slate-100 flex justify-end space-x-2 bg-slate-50/60">
        <button
          onClick={onClose}
          className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition"
        >
          Close
        </button>
        <button
          onClick={() => {
            handleSave();
            toast.success('Step configuration saved!');
            onClose();
          }}
          className="px-4 py-1.5 text-xs font-semibold text-white bg-black hover:bg-slate-800 rounded-xl shadow-xs transition"
        >
          Save
        </button>
      </div>
    </aside>
  );
}
