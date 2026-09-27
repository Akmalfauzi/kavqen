'use client';

import Modal from '@/components/Modal';
import PageHeader from '@/components/PageHeader';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import {
  RiAddLine,
  RiBookOpenLine,
  RiSearchLine,
  RiFileTextLine,
  RiCloseLine,
} from 'react-icons/ri';

interface KnowledgeItem {
  id: string;
  title: string;
  category: string;
  content: string;
  updatedAt: string;
}

export default function KnowledgeView() {
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebouncedValue(searchQuery);
  const [currentPage, setCurrentPage] = useState(1);
  useEffect(() => { setCurrentPage(1); }, [debouncedSearch]);
  const itemsPerPage = 10;
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    api.get('/knowledge')
      .then((response) => setKnowledgeItems(response.data.data || []))
      .catch((error) => toast.error(error.response?.data?.message || 'Failed to load knowledge'))
      .finally(() => setLoading(false));
  }, []);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Guidelines');
  const [newSnippet, setNewSnippet] = useState('');

  const handleSaveKnowledge = async () => {
    if (!newTitle.trim() || !newSnippet.trim()) return toast.error('Title and content are required');
    setSaving(true);
    try {
      const payload = { title: newTitle.trim(), category: newCategory, content: newSnippet.trim() };
      const response = editingId
        ? await api.put(`/knowledge/${editingId}`, payload)
        : await api.post('/knowledge', payload);
      const item = response.data.data as KnowledgeItem;
      setKnowledgeItems((current) => [item, ...current.filter((entry) => entry.id !== item.id)]);
      setShowAddModal(false);
      setEditingId(null);
      setNewTitle('');
      setNewSnippet('');
      toast.success('Document saved. Republish workflow to use updated knowledge in voice calls.');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save document');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item: KnowledgeItem) => {
    setEditingId(item.id);
    setNewTitle(item.title);
    setNewCategory(item.category);
    setNewSnippet(item.content);
    setShowAddModal(true);
  };

  const handleDelete = async (item: KnowledgeItem) => {
    if (!confirm(`Delete "${item.title}"?`)) return;
    try {
      await api.delete(`/knowledge/${item.id}`);
      setKnowledgeItems((current) => current.filter((entry) => entry.id !== item.id));
      toast.success('Document deleted. Republish workflow to update voice knowledge.');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete document');
    }
  };

  const filtered = knowledgeItems.filter(
    (k) =>
      k.title.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      k.content.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      k.category.toLowerCase().includes(debouncedSearch.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  
  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 4) {
        pages.push(1, 2, 3, 4, 5, '...', totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }
    return pages;
  };
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedItems = filtered.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 select-none animate-in fade-in duration-200">
      <PageHeader icon={<RiBookOpenLine />} eyebrow="Your workspace" title="Agent Knowledge Base"
        description="Saved guidelines for your voice workflows. Republish workflow after changes."
        actions={<button type="button"
          onClick={() => { setEditingId(null); setNewTitle(''); setNewSnippet(''); setNewCategory('Guidelines'); setShowAddModal(true); }}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2">
          <RiAddLine aria-hidden="true" className="h-4 w-4" />Add Knowledge Document
        </button>} />

      {/* Search Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-3">
        <RiSearchLine className="w-4 h-4 text-slate-400 pl-1" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
          placeholder="Search knowledge documents, medical guidelines, or customer policies..."
          className="w-full text-xs text-slate-800 outline-none bg-transparent"
        />
        {searchQuery && (
          <button onClick={() => { setSearchQuery(''); setCurrentPage(1); }} className="text-xs text-slate-400 hover:text-slate-600 pr-2">
            Clear
          </button>
        )}
      </div>

      {/* Document Cards */}
      <div className="space-y-3">
        {loading && <p className="text-sm text-slate-500">Loading knowledge...</p>}
        {!loading && filtered.length === 0 && <p className="text-sm text-slate-500">No knowledge documents found.</p>}
        {paginatedItems.map((item) => (
          <div
            key={item.id}
            className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-sm transition space-y-2"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                  <RiFileTextLine className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">{item.title}</h3>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                  {item.category}
                </span>
                <span className="text-[11px] text-slate-400">{new Date(item.updatedAt).toLocaleDateString()}</span>
                <button onClick={() => handleEdit(item)} className="inline-flex h-10 items-center justify-center rounded-lg bg-indigo-50 px-4 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100">Edit</button>
                <button onClick={() => { void handleDelete(item); }} className="inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-50">Delete</button>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed pl-10">
              {item.content.length > 400 ? `${item.content.slice(0, 400)}…` : item.content}
            </p>
          </div>
        ))}
      </div>

      
      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs mt-4">
          <button
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="h-10 px-4 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition"
          >
            Previous
          </button>
          
          <div className="flex items-center space-x-1">
            {getPageNumbers().map((pageNum, idx) => (
              pageNum === '...' ? (
                <span key={`dots-${idx}`} className="px-2 text-xs font-bold text-slate-400">...</span>
              ) : (
                <button
                  key={`page-${pageNum}`}
                  onClick={() => setCurrentPage(pageNum as number)}
                  className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-semibold transition ${
                    currentPage === pageNum
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-transparent text-slate-600 hover:bg-slate-100 border border-slate-200/60 hover:border-slate-300'
                  }`}
                >
                  {pageNum}
                </button>
              )
            ))}
          </div>

          <button
            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="h-10 px-4 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition"
          >
            Next
          </button>
        </div>
      )}

      {showAddModal && <Modal title={editingId ? 'Edit Knowledge Document' : 'Add Knowledge Document'}
        onClose={() => { if (!saving) setShowAddModal(false); }} footer={
        <div className="flex gap-2">
          <button type="button" disabled={saving} onClick={() => setShowAddModal(false)}
            className="flex-1 h-10 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition disabled:opacity-40">Cancel</button>
          <button type="button" disabled={saving} onClick={() => { void handleSaveKnowledge(); }}
            className="flex-1 h-10 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50">
            {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Add Document'}</button>
        </div>
      }>
<div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Document Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Ineligibility Criteria Rules"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Category</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none bg-white"
                >
                  <option value="Guidelines">Guidelines</option>
                  <option value="Healthcare Policies">Healthcare Policies</option>
                  <option value="Support FAQ">Support FAQ</option>
                  <option value="Legal & Privacy">Legal & Privacy</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Knowledge Content / Prompt Snippet</label>
                <textarea
                  rows={5}
                  value={newSnippet}
                  onChange={(e) => setNewSnippet(e.target.value)}
                  placeholder="Write guidelines or copy-paste policy text..."
                  className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-500 resize-none"
                />
              </div>
            </div>
      </Modal>}
    </div>
  );
}
