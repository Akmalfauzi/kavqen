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
  RiShieldLine,
  RiCheckLine,
  RiUserLine,
  RiLockLine,
  RiEyeLine,
} from 'react-icons/ri';
import toast from 'react-hot-toast';

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  userCount: number;
  color: string;
}

const ALL_PERMISSIONS = [
  'dashboard.view',
  'agents.view',
  'agents.create',
  'agents.edit',
  'agents.delete',
  'workflows.view',
  'workflows.edit',
  'fields.view',
  'fields.edit',
  'users.view',
  'users.manage',
  'roles.view',
  'roles.manage',
  'knowledge.view',
  'knowledge.edit',
  'analytics.view',
  'integrations.view',
  'integrations.manage',
  'test-agent.use',
  'publish',
];

const PERMISSION_GROUPS: Record<string, string[]> = {
  Dashboard: ['dashboard.view'],
  Agents: ['agents.view', 'agents.create', 'agents.edit', 'agents.delete'],
  Workflows: ['workflows.view', 'workflows.edit'],
  'Data Master': ['fields.view', 'fields.edit', 'users.view', 'users.manage', 'roles.view', 'roles.manage'],
  Knowledge: ['knowledge.view', 'knowledge.edit'],
  Analytics: ['analytics.view'],
  Integrations: ['integrations.view', 'integrations.manage'],
  'Voice Test': ['test-agent.use'],
  System: ['publish'],
};

const DEFAULT_ROLES: Role[] = [
  {
    id: 'r1',
    name: 'Admin',
    description: 'Full access to all features and settings',
    permissions: [...ALL_PERMISSIONS],
    userCount: 1,
    color: 'rose',
  },
  {
    id: 'r2',
    name: 'Editor',
    description: 'Can edit workflows, agents, and fields but cannot manage users or roles',
    permissions: [
      'dashboard.view', 'agents.view', 'agents.create', 'agents.edit',
      'workflows.view', 'workflows.edit', 'fields.view', 'fields.edit',
      'knowledge.view', 'knowledge.edit', 'analytics.view',
      'integrations.view', 'test-agent.use', 'publish',
    ],
    userCount: 2,
    color: 'indigo',
  },
  {
    id: 'r3',
    name: 'Viewer',
    description: 'Read-only access to dashboards, analytics, and agent configurations',
    permissions: [
      'dashboard.view', 'agents.view', 'workflows.view', 'fields.view',
      'knowledge.view', 'analytics.view', 'integrations.view', 'users.view', 'roles.view',
    ],
    userCount: 2,
    color: 'slate',
  },
];

const COLOR_OPTIONS = ['rose', 'indigo', 'emerald', 'amber', 'sky', 'purple', 'teal', 'slate'];
const COLOR_STYLES: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  rose:    { bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200',    dot: 'bg-rose-500' },
  indigo:  { bg: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-200',  dot: 'bg-indigo-500' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  amber:   { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-500' },
  sky:     { bg: 'bg-sky-50',     text: 'text-sky-700',     border: 'border-sky-200',     dot: 'bg-sky-500' },
  purple:  { bg: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-200',  dot: 'bg-purple-500' },
  teal:    { bg: 'bg-teal-50',    text: 'text-teal-700',    border: 'border-teal-200',    dot: 'bg-teal-500' },
  slate:   { bg: 'bg-slate-100',  text: 'text-slate-600',   border: 'border-slate-200',   dot: 'bg-slate-500' },
};

export default function RolesView() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRoles = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/roles');
      setRoles(res.data.data || []);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch roles');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebouncedValue(searchQuery);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formColor, setFormColor] = useState('indigo');
  const [formPerms, setFormPerms] = useState<string[]>([]);

  const openCreate = () => {
    setEditingRole(null);
    setFormName('');
    setFormDesc('');
    setFormColor('indigo');
    setFormPerms([]);
    setIsModalOpen(true);
  };

  const openEdit = (role: Role) => {
    setEditingRole(role);
    setFormName(role.name);
    setFormDesc(role.description);
    setFormColor(role.color);
    setFormPerms([...role.permissions]);
    setIsModalOpen(true);
  };

  const togglePerm = (p: string) => {
    setFormPerms((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);
  };

  const toggleGroup = (perms: string[]) => {
    const allChecked = perms.every((p) => formPerms.includes(p));
    if (allChecked) {
      setFormPerms((prev) => prev.filter((p) => !perms.includes(p)));
    } else {
      setFormPerms((prev) => [...new Set([...prev, ...perms])]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error('Role name is required');
      return;
    }

    try {
      if (editingRole) {
        await api.put(`/roles/${editingRole.id}`, {
          name: formName.trim(),
          description: formDesc.trim(),
          color: formColor,
          permissions: formPerms,
        });
        toast.success(`Updated role "${formName.trim()}"`);
      } else {
        await api.post('/roles', {
          name: formName.trim(),
          description: formDesc.trim(),
          color: formColor,
          permissions: formPerms,
        });
        toast.success(`Created role "${formName.trim()}"`);
      }
      fetchRoles();
      setIsModalOpen(false);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save role');
    }
  };

  const handleDelete = async (role: Role) => {
    if (role.name === 'Admin') {
      toast.error('Cannot delete the Admin role');
      return;
    }
    if (confirm(`Delete role "${role.name}"? Users with this role will lose their permissions.`)) {
      try {
        await api.delete(`/roles/${role.id}`);
        toast.success(`Deleted role "${role.name}"`);
        fetchRoles();
      } catch (error: any) {
        toast.error(error.response?.data?.message || 'Failed to delete role');
      }
    }
  };

  const filtered = roles.filter((r) =>
    r.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
    r.description.toLowerCase().includes(debouncedSearch.toLowerCase())
  );

  const totalPerms = ALL_PERMISSIONS.length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 select-none animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs">
              <RiShieldLine className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                Roles & Permissions
                <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold px-2 py-0.5 rounded-full">
                  {roles.length} Roles
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Define roles and assign granular permissions for workspace access control.
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center space-x-1.5"
        >
          <RiAddLine className="w-4 h-4" />
          <span>New Role</span>
        </button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Total Roles</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <RiShieldLine className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">{roles.length}</div>
          <span className="text-[11px] text-slate-400">Defined in workspace</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Total Permissions</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <RiLockLine className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-600">{totalPerms}</div>
          <span className="text-[11px] text-slate-400">Available system permissions</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Assigned Users</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <RiUserLine className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-amber-600">{roles.reduce((s, r) => s + r.userCount, 0)}</div>
          <span className="text-[11px] text-slate-400">Across all roles</span>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs flex items-center space-x-2 px-4">
        <RiSearchLine className="w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search roles..."
          className="w-full text-xs text-slate-800 outline-none bg-transparent"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="text-xs text-slate-400 hover:text-slate-600">Clear</button>
        )}
      </div>

      {/* Roles Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {isLoading ? (
          <div className="col-span-full py-12 text-center text-slate-400">
            <div className="w-8 h-8 mx-auto mb-2 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            <p className="font-semibold text-slate-600">Loading roles...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-400">
            <RiShieldLine className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="font-semibold text-slate-600">No roles found</p>
          </div>
        ) : (
          filtered.map((role) => {
            const cs = COLOR_STYLES[role.color] || COLOR_STYLES.slate;
            return (
              <div key={role.id} className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-2xl ${cs.bg} ${cs.border} border flex items-center justify-center ${cs.text} shadow-xs`}>
                        <RiShieldLine className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 leading-tight">{role.name}</h3>
                        <span className="text-[10px] font-semibold text-slate-400">{role.userCount} user{role.userCount !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold ${cs.bg} ${cs.text} ${cs.border} border px-2 py-0.5 rounded-full`}>
                      {role.permissions.length}/{totalPerms}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 mb-3 line-clamp-2">{role.description}</p>

                  <div className="space-y-1.5 text-xs border-t border-slate-100 pt-3">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Permissions:</span>
                      <span className="font-semibold text-slate-700">{role.permissions.length} of {totalPerms}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${cs.dot}`}
                        style={{ width: `${(role.permissions.length / totalPerms) * 100}%` }}
                      />
                    </div>
                    <div className="flex flex-wrap gap-1 pt-1">
                      {Object.entries(PERMISSION_GROUPS).map(([group, perms]) => {
                        const count = perms.filter((p) => role.permissions.includes(p)).length;
                        if (count === 0) return null;
                        return (
                          <span key={group} className="text-[10px] font-medium bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                            {group} ({count})
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => openEdit(role)}
                    className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1"
                  >
                    <RiEditLine className="w-3.5 h-3.5" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(role)}
                    className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold rounded-xl transition border border-rose-200"
                    title="Delete role"
                  >
                    <RiDeleteBinLine className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-500/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <RiShieldLine className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingRole ? 'Edit Role' : 'Create New Role'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {editingRole ? 'Update role details and permissions' : 'Define a new role with specific permissions'}
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Role Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Supervisor"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 outline-none focus:border-indigo-500 transition"
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
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Brief description of this role's purpose"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 outline-none focus:border-indigo-500 transition"
                />
              </div>

              {/* Permissions */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <RiLockLine className="w-3.5 h-3.5 text-indigo-600" />
                    Permissions
                  </label>
                  <span className="text-[10px] text-slate-400">{formPerms.length} of {totalPerms} selected</span>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto p-2 rounded-xl border border-slate-200 bg-slate-50/50">
                  {Object.entries(PERMISSION_GROUPS).map(([group, perms]) => {
                    const allChecked = perms.every((p) => formPerms.includes(p));
                    const someChecked = perms.some((p) => formPerms.includes(p));
                    return (
                      <div key={group} className="space-y-1">
                        <label
                          onClick={() => toggleGroup(perms)}
                          className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer border transition font-bold ${
                            allChecked ? 'bg-indigo-50 border-indigo-200 text-indigo-900' :
                            someChecked ? 'bg-indigo-50/50 border-indigo-100 text-indigo-800' :
                            'bg-white border-slate-200 text-slate-700 hover:bg-slate-100/60'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={allChecked}
                              readOnly
                              className="rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                            />
                            <span>{group}</span>
                          </div>
                          <span className="text-[10px] font-semibold text-slate-400">
                            {perms.filter((p) => formPerms.includes(p)).length}/{perms.length}
                          </span>
                        </label>
                        <div className="pl-6 space-y-0.5">
                          {perms.map((p) => (
                            <label
                              key={p}
                              onClick={() => togglePerm(p)}
                              className={`flex items-center space-x-2 p-1.5 rounded-lg text-[11px] cursor-pointer transition ${
                                formPerms.includes(p) ? 'text-indigo-800 font-semibold' : 'text-slate-500 hover:text-slate-700'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={formPerms.includes(p)}
                                readOnly
                                className="rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 w-3.5 h-3.5"
                              />
                              <code className="font-mono">{p}</code>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
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
                  {editingRole ? 'Save Changes' : 'Create Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
