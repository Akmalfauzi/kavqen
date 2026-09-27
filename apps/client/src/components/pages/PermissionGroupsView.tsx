'use client';

import { useDebouncedValue } from '@/hooks/useDebouncedValue';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import {
  RiSearchLine,
  RiAddLine,
  RiEditLine,
  RiDeleteBinLine,
  RiCloseLine,
  RiFolderLine,
  RiLockLine,
  RiFilter3Line,
} from 'react-icons/ri';
import toast from 'react-hot-toast';

export interface PermissionGroup {
  id: string;
  name: string;
  description: string;
  color: string;
  permissionCount: number;
}

const COLOR_OPTIONS = ['sky', 'pink', 'indigo', 'emerald', 'amber', 'purple', 'teal', 'rose', 'slate'];

const COLOR_STYLES: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  sky:     { bg: 'bg-sky-50',     text: 'text-sky-700',     border: 'border-sky-200',     dot: 'bg-sky-500' },
  pink:    { bg: 'bg-pink-50',    text: 'text-pink-700',    border: 'border-pink-200',    dot: 'bg-pink-500' },
  indigo:  { bg: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-200',  dot: 'bg-indigo-500' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  amber:   { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-500' },
  purple:  { bg: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-200',  dot: 'bg-purple-500' },
  teal:    { bg: 'bg-teal-50',    text: 'text-teal-700',    border: 'border-teal-200',    dot: 'bg-teal-500' },
  rose:    { bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200',    dot: 'bg-rose-500' },
  slate:   { bg: 'bg-slate-100',  text: 'text-slate-700',   border: 'border-slate-200',   dot: 'bg-slate-500' },
};

export default function PermissionGroupsView() {
  const [groups, setGroups] = useState<PermissionGroup[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebouncedValue(searchQuery);
  const [isLoading, setIsLoading] = useState(true);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<PermissionGroup | null>(null);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formColor, setFormColor] = useState('indigo');

  const fetchGroups = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/permission-groups');
      const data = res.data.data || [];
      
      const mappedGroups: PermissionGroup[] = data.map((g: any, index: number) => ({
        id: g.id,
        name: g.name,
        description: g.description || 'Permission group',
        color: COLOR_OPTIONS[index % COLOR_OPTIONS.length], // Database doesn't have a color field yet, so we assign one deterministically
        permissionCount: g.permissionCount || 0
      }));

      setGroups(mappedGroups);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch permission groups');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const openCreate = () => {
    setEditingGroup(null);
    setFormName('');
    setFormDesc('');
    setFormColor('indigo');
    setIsModalOpen(true);
  };

  const openEdit = (group: PermissionGroup) => {
    setEditingGroup(group);
    setFormName(group.name);
    setFormDesc(group.description);
    setFormColor(group.color);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error('Group name is required');
      return;
    }

    try {
      if (editingGroup) {
        await api.put(`/permission-groups/${editingGroup.id}`, {
          name: formName.trim(),
          description: formDesc.trim(),
          color: formColor,
        });
        toast.success(`Updated group "${formName.trim()}"`);
      } else {
        await api.post('/permission-groups', {
          name: formName.trim(),
          description: formDesc.trim(),
          color: formColor,
        });
        toast.success(`Created group "${formName.trim()}"`);
      }
      fetchGroups();
      setIsModalOpen(false);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save group');
    }
  };

  const handleDelete = async (group: PermissionGroup) => {
    if (group.permissionCount > 0) {
      toast.error(`Cannot delete "${group.name}" — ${group.permissionCount} permissions still assigned. Move them first.`);
      return;
    }
    if (confirm(`Delete permission group "${group.name}"?`)) {
      try {
        await api.delete(`/permission-groups/${group.id}`);
        toast.success(`Deleted group "${group.name}"`);
        fetchGroups();
      } catch (error: any) {
        toast.error(error.response?.data?.message || 'Failed to delete group');
      }
    }
  };

  const filtered = groups.filter((g) =>
    g.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
    g.description.toLowerCase().includes(debouncedSearch.toLowerCase())
  );

  const totalPerms = groups.reduce((s, g) => s + g.permissionCount, 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 select-none animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs">
              <RiFolderLine className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                Permission Groups
                <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold px-2 py-0.5 rounded-full">
                  {groups.length} Groups
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Organize permissions into logical groups for easier role management.
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center space-x-1.5"
        >
          <RiAddLine className="w-4 h-4" />
          <span>New Group</span>
        </button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Total Groups</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <RiFolderLine className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">{groups.length}</div>
          <span className="text-[11px] text-slate-400">Permission categories</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Total Permissions</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <RiLockLine className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-600">{totalPerms}</div>
          <span className="text-[11px] text-slate-400">Across all groups</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Empty Groups</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <RiFolderLine className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-amber-600">{groups.filter((g) => g.permissionCount === 0).length}</div>
          <span className="text-[11px] text-slate-400">No permissions assigned</span>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-2 px-4">
        <RiSearchLine className="w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search groups..."
          className="w-full text-xs text-slate-800 outline-none bg-transparent"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="text-xs text-slate-400 hover:text-slate-600">Clear</button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Group Name</th>
                <th className="py-3.5 px-4">Description</th>
                <th className="py-3.5 px-4">Color</th>
                <th className="py-3.5 px-4">Permissions</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <p className="font-semibold text-slate-600">Loading...</p>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <RiFolderLine className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-600">No groups found</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Try adjusting your search.</p>
                  </td>
                </tr>
              ) : (
                filtered.map((group) => {
                  const cs = COLOR_STYLES[group.color] || COLOR_STYLES.slate;
                  return (
                    <tr key={group.id} className="hover:bg-slate-50/60 transition group/row">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-3">
                          <div className={`w-9 h-9 rounded-xl ${cs.bg} ${cs.border} border flex items-center justify-center ${cs.text}`}>
                            <RiFolderLine className="w-4 h-4" />
                          </div>
                          <span className="font-bold text-slate-900 text-sm">{group.name}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 max-w-xs">
                        <span className="text-[11px] text-slate-500 line-clamp-2">{group.description}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${cs.bg} ${cs.text} ${cs.border}`}>
                          <span className={`w-2 h-2 rounded-full ${cs.dot}`} />
                          <span className="capitalize">{group.color}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          <RiLockLine className="w-3 h-3" />
                          <span>{group.permissionCount}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1 opacity-80 group-hover/row:opacity-100 transition">
                          <button
                            onClick={() => openEdit(group)}
                            title="Edit Group"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-200 transition"
                          >
                            <RiEditLine className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(group)}
                            title="Delete Group"
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
        <div className="fixed inset-0 z-50 bg-slate-500/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <RiFolderLine className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingGroup ? 'Edit Group' : 'Create Permission Group'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {editingGroup ? 'Update group details' : 'Define a new category for permissions'}
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

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Group Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Reports"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 outline-none focus:border-indigo-500 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Brief description of what this group covers"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 outline-none focus:border-indigo-500 transition resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Color</label>
                <div className="flex items-center gap-1.5 py-1.5">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setFormColor(c)}
                      className={`w-6 h-6 rounded-full ${COLOR_STYLES[c].dot} border-2 transition ${formColor === c ? 'border-slate-900 scale-110' : 'border-transparent opacity-60 hover:opacity-100'}`}
                    />
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition"
                >
                  {editingGroup ? 'Save Changes' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
