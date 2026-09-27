'use client';

import React, { useState } from 'react';
import { RiCloseLine, RiRocket2Line } from 'react-icons/ri';

interface PublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmPublish: () => Promise<boolean>;
  agentName: string;
}

export default function PublishModal({ isOpen, onClose, onConfirmPublish, agentName }: PublishModalProps) {
  const [isPublishing, setIsPublishing] = useState(false);

  if (!isOpen) return null;

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      if (await onConfirmPublish()) onClose();
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">Publish Voice Workflow</h3>
            <p className="text-xs text-slate-500 mt-1">Save workflow for voice testing.</p>
          </div>
          <button onClick={onClose} disabled={isPublishing} className="text-slate-400 hover:text-slate-700 disabled:opacity-50" aria-label="Close">
            <RiCloseLine className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-800">
          {agentName}
        </div>
        <p className="text-xs text-slate-600">Published workflow becomes available in Test Agent. Changes after publishing require another publish.</p>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} disabled={isPublishing} className="px-4 py-2 bg-slate-100 rounded-xl text-xs font-semibold disabled:opacity-50">Cancel</button>
          <button onClick={handlePublish} disabled={isPublishing} className="px-5 py-2 bg-black text-white rounded-xl text-xs font-bold flex items-center gap-2 disabled:opacity-50">
            <RiRocket2Line className="w-4 h-4" />
            {isPublishing ? 'Publishing...' : 'Publish for Voice Test'}
          </button>
        </div>
      </div>
    </div>
  );
}
