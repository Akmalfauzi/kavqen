'use client';

import { useDebouncedValue } from '@/hooks/useDebouncedValue';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import {
  RiSearchLine,
  RiFilter3Line,
  RiAddLine,
  RiEditLine,
  RiDeleteBinLine,
  RiCloseLine,
  RiLockLine,
} from 'react-icons/ri';
import toast from 'react-hot-toast';

export interface Permission {
  id: string;
  key: string;
  label: string;
  group: string;
  description: string;
}

export default function PermissionsView() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebouncedValue(searchQuery);
  const [filterGroup, setFilterGroup] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPerm, setEditingPerm] = useState<Permission | null>(null);
  const [formKey, setFormKey] = useState('');
  const [formLabel, setFormLabel] = useState('');
  const [formGroup, setFormGroup] = useState('Dashboard');
  const [formDesc, setFormDesc] = useState('');

  const fetchPermissions = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/permissions');
      const groupsData = res.data.data || [];
      
      const flatPermissions: Permission[] = [];
      const groupNames: string[] = [];

      groupsData.forEach((g: any) => {
        groupNames.push(g.name);
        g.permissions.forEach((p: any) => {
          flatPermissions.push({
            id: p.id,
            key: p.name,
            label: p.name.split('.').map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)).join(' '),
            group: g.name,
            description: p.description || '',
          });
        });
      });

      setPermissions(flatPermissions);
      setGroups(groupNames);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch permissions');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, []);

  const openCreate = () => {
    setEditingPerm(null);
    setFormKey('');
    setFormLabel('');
    setFormGroup(groups[0] || 'Dashboard');
    setFormDesc('');
    setIsModalOpen(true);
  };

  const openEdit = (perm: Permission) => {
    setEditingPerm(perm);
    setFormKey(perm.key);
    setFormLabel(perm.label);
    setFormGroup(perm.group);
    setFormDesc(perm.description);
    setIsModalOpen(true);
  };

  const handleLabelChange = (val: string) => {
    setFormLabel(val);
    if (!editingPerm) {
      const slug = val.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '');
      setFormKey(slug);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingPerm) {
        await api.put(`/permissions/${editingPerm.id}`, {
          name: formKey,
          description: formDesc,
          groupName: formGroup
        });
        toast.success(`Updated permission "${formLabel.trim()}"`);
      } else {
        await api.post('/permissions', {
          name: formKey,
          description: formDesc,
          groupName: formGroup
        });
        toast.success(`Created permission "${formLabel.trim()}"`);
      }
      fetchPermissions();
      setIsModalOpen(false);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save permission');
    }
  };

  const handleDelete = async (perm: Permission) => {
    if (confirm(`Delete permission "${perm.label}" (${perm.key})? Roles using this permission will lose it.`)) {
      try {
        await api.delete(`/permissions/${perm.id}`);
        toast.success(`Deleted permission "${perm.label}"`);
        fetchPermissions();
      } catch (error: any) {
        toast.error(error.response?.data?.message || 'Failed to delete permission');
      }
    }
  };

  const filtered = permissions.filter((p) => {
    const matchSearch =
      p.key.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      p.label.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      p.description.toLowerCase().includes(debouncedSearch.toLowerCase());
    const matchGroup = filterGroup === 'all' || p.group === filterGroup;
    return matchSearch && matchGroup;
  });

  const groupCounts = groups.map((g) => ({
    group: g,
    count: permissions.filter((p) => p.group === g).length,
  }));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 select-none animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs">
              <RiLockLine className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                Permissions Catalog
                <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold px-2 py-0.5 rounded-full">
                  {permissions.length} Permissions
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Define granular access controls that can be assigned to roles.
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center space-x-1.5"
        >
          <RiAddLine className="w-4 h-4" />
          <span>New Permission</span>
        </button>
      </div>

      {/* Search & Filter */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex-1 min-w-[260px] flex items-center space-x-2 px-2">
          <RiSearchLine className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by key, label, or description..."
            className="w-full text-xs text-slate-800 outline-none bg-transparent"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-xs text-slate-400 hover:text-slate-600">Clear</button>
          )}
        </div>
        <div className="flex items-center space-x-1 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200 text-slate-600">
          <RiFilter3Line className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={filterGroup}
            onChange={(e) => setFilterGroup(e.target.value)}
            className="bg-transparent outline-none font-semibold text-slate-700 cursor-pointer text-xs"
          >
            <option value="all">All Groups</option>
            {groups.map((g) => (
              <option key={g} value={g}>{g} ({groupCounts.find((gc) => gc.group === g)?.count || 0})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Permission Key</th>
                <th className="py-3.5 px-4">Label</th>
                <th className="py-3.5 px-4">Group</th>
                <th className="py-3.5 px-4">Description</th>
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
                    <RiLockLine className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-600">No permissions found</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Try adjusting your search or group filter.
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((perm) => {
                  return (
                    <tr key={perm.id} className="hover:bg-slate-50/60 transition group">
                      <td className="py-3.5 px-4">
                        <code className="text-[11px] font-mono font-bold text-indigo-700 bg-indigo-50/80 px-2 py-0.5 rounded border border-indigo-100">
                          {perm.key}
                        </code>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-900 text-sm">{perm.label}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border bg-slate-100 text-slate-700 border-slate-200">
                          {perm.group}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 max-w-xs">
                        <span className="text-[11px] text-slate-500 line-clamp-2">{perm.description}</span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1 opacity-80 group-hover:opacity-100 transition">
                          <button
                            onClick={() => openEdit(perm)}
                            title="Edit Permission"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-200 transition"
                          >
                            <RiEditLine className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(perm)}
                            title="Delete Permission"
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
                  <RiLockLine className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingPerm ? 'Edit Permission' : 'Create Permission'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {editingPerm ? 'Update permission details' : 'Define a new granular permission'}
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
                  Display Label <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formLabel}
                  onChange={(e) => handleLabelChange(e.target.value)}
                  placeholder="e.g. Export Reports"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 outline-none focus:border-indigo-500 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Permission Key <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formKey}
                  onChange={(e) => setFormKey(e.target.value)}
                  placeholder="e.g. analytics.export"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono text-indigo-700 outline-none focus:border-indigo-500 transition bg-slate-50/50"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Group</label>
                <select
                  value={formGroup}
                  onChange={(e) => setFormGroup(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 outline-none focus:border-indigo-500 transition bg-white"
                >
                  {groups.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="What this permission allows the user to do"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 outline-none focus:border-indigo-500 transition resize-none"
                />
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
                  {editingPerm ? 'Save Changes' : 'Create Permission'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
