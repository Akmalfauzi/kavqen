'use client';

import React, { useEffect, useState } from 'react';
import { api, hashPassword, clearToken } from '@/lib/api';
import {
  RiUser3Line,
  RiMailLine,
  RiShieldUserLine,
  RiBuildingLine,
  RiSmartphoneLine,
  RiKey2Line,
  RiGlobalLine,
  RiCheckLine,
} from 'react-icons/ri';
import toast from 'react-hot-toast';

interface Profile {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  company: string | null;
  language: string;
  createdAt: string;
  role: { code: string; name: string } | null;
  hasPassword: boolean;
  googleLinked: boolean;
}

export default function ProfileView({ onProfileUpdated }: { onProfileUpdated?: (profile: Profile) => void }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const [formData, setFormData] = useState({ firstName: '', lastName: '', email: '', phone: '', company: '', language: 'en' });
  const [passwordData, setPasswordData] = useState({ current: '', new: '', confirm: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingPass, setIsChangingPass] = useState(false);

  const applyProfile = (data: Profile) => {
    setProfile(data);
    const [firstName = '', ...rest] = (data.name || '').trim().split(/\s+/);
    setFormData({ firstName, lastName: rest.join(' '), email: data.email, phone: data.phone || '', company: data.company || '', language: 'en' });
  };

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError('');
    api.get('/user/me', { signal: controller.signal }).then(response => {
      if (!controller.signal.aborted) applyProfile(response.data.data);
    }).catch(error => {
      if (!controller.signal.aborted) setLoadError(error.response?.data?.message || 'Unable to load your profile.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reload]);

  const handleProfileSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    try {
      const { firstName, lastName, phone, company, language } = formData;
      const response = await api.patch('/user/me', { name: [firstName.trim(), lastName.trim()].filter(Boolean).join(' '), phone, company, language });
      applyProfile(response.data.data);
      onProfileUpdated?.(response.data.data);
      toast.success('Profile updated successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Unable to save profile.');
    } finally { setIsSaving(false); }
  };

  const handlePasswordChange = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isChangingPass) return;
    if (passwordData.new !== passwordData.confirm) return toast.error('New passwords do not match');
    if (passwordData.new.length < 8 || new TextEncoder().encode(passwordData.new).length > 72) return toast.error('Password must contain at least 8 characters and at most 72 UTF-8 bytes');
    setIsChangingPass(true);
    try {
      await api.post('/user/me/password', { currentPassword: await hashPassword(passwordData.current), newPassword: await hashPassword(passwordData.new) });
      clearToken();
      window.location.replace('/login?passwordChanged=1');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Unable to change password.');
    } finally { setIsChangingPass(false); }
  };

  if (loading) return <div role="status" className="p-6 text-sm text-slate-500">Loading your profile...</div>;
  if (loadError || !profile) return <div className="p-6 space-y-3"><p role="alert" className="text-sm text-red-700">{loadError || 'Profile unavailable.'}</p><button onClick={() => setReload(value => value + 1)} className="text-sm font-semibold text-indigo-600">Try again</button></div>;
  const initials = (profile.name || profile.email).trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 select-none animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs">
              <RiUser3Line className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                My Profile
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage your personal information, account settings, and security.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Avatar & Summary */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 flex flex-col items-center text-center">
            <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-pink-500 to-amber-400 p-1 mb-4 shadow-md relative">
              <div className="w-full h-full bg-white rounded-full flex items-center justify-center overflow-hidden relative">
                <span className="text-3xl font-black text-slate-300">
                  {initials}
                </span>

              </div>
            </div>
            <h2 className="text-lg font-bold text-slate-900">{profile.name || profile.email}</h2>
            <p className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full mt-1.5 inline-flex items-center gap-1.5 border border-indigo-100">
              <RiShieldUserLine className="w-3.5 h-3.5" />
              {profile.role?.name || 'Account'}
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">Account Summary</h3>
            <div className="flex items-center justify-between text-xs pb-3 border-b border-slate-100">
              <span className="text-slate-500">Member Since</span>
              <span className="font-semibold text-slate-700">{new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
            </div>
            <div className="flex items-center justify-between text-xs pb-3 border-b border-slate-100">
              <span className="text-slate-500">Sign-in Method</span>
              <span className="font-semibold text-slate-700">{profile.googleLinked ? (profile.hasPassword ? 'Google + Password' : 'Google') : 'Password'}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Google Account</span>
              <span className="font-semibold text-slate-700">{profile.googleLinked ? 'Linked' : 'Not linked'}</span>
            </div>
          </div>
        </div>

        {/* Right Column: Forms */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Form */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">Personal Information</h2>
              <p className="text-xs text-slate-400">Update your contact details and preferences.</p>
            </div>
            <form onSubmit={handleProfileSave} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">First Name</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <RiUser3Line className="text-slate-400 w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      required
                      maxLength={100}
                      autoComplete="given-name"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 outline-none focus:border-indigo-500 transition"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Last Name</label>
                  <input
                    type="text"
                    maxLength={100}
                    autoComplete="family-name"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 outline-none focus:border-indigo-500 transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Email Address</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <RiMailLine className="text-slate-400 w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      value={formData.email}
                      readOnly
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-500 bg-slate-50 outline-none cursor-not-allowed"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Your sign-in email cannot be changed here.</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Phone Number</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <RiSmartphoneLine className="text-slate-400 w-4 h-4" />
                    </div>
                    <input
                      type="tel"
                      maxLength={40}
                      autoComplete="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 outline-none focus:border-indigo-500 transition"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 mt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Company</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <RiBuildingLine className="text-slate-400 w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        maxLength={150}
                        autoComplete="organization"
                        value={formData.company}
                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 outline-none focus:border-indigo-500 transition"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Language</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <RiGlobalLine className="text-slate-400 w-4 h-4" />
                      </div>
                      <select
                        value={formData.language}
                        onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 outline-none focus:border-indigo-500 transition bg-white"
                      >
                        <option value="en">English (US)</option>
                        <option value="id" disabled>Indonesian (unavailable)</option>
                        <option value="es" disabled>Spanish (unavailable)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <RiCheckLine className="w-4 h-4" />
                  )}
                  {isSaving ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>

          {/* Security Form */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">Security</h2>
              <p className="text-xs text-slate-400">Update your password and secure your account.</p>
            </div>
            {profile.hasPassword ? <form onSubmit={handlePasswordChange} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Current Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <RiKey2Line className="text-slate-400 w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    required
                    autoComplete="current-password"
                    value={passwordData.current}
                    onChange={(e) => setPasswordData({ ...passwordData, current: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 outline-none focus:border-indigo-500 transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">New Password</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <RiKey2Line className="text-slate-400 w-4 h-4" />
                    </div>
                    <input
                      type="password"
                      required
                      autoComplete="new-password"
                      minLength={8}
                      value={passwordData.new}
                      onChange={(e) => setPasswordData({ ...passwordData, new: e.target.value })}
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 outline-none focus:border-indigo-500 transition"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Confirm New Password</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <RiKey2Line className="text-slate-400 w-4 h-4" />
                    </div>
                    <input
                      type="password"
                      required
                      autoComplete="new-password"
                      minLength={8}
                      value={passwordData.confirm}
                      onChange={(e) => setPasswordData({ ...passwordData, confirm: e.target.value })}
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 outline-none focus:border-indigo-500 transition"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={isChangingPass}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isChangingPass ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <RiCheckLine className="w-4 h-4" />
                  )}
                  {isChangingPass ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form> : <div className="p-6 text-sm text-slate-600 space-y-3">
              <p>You sign in with Google. Manage your password and account security through Google.</p>
              <a href="https://myaccount.google.com/security" target="_blank" rel="noopener noreferrer" className="inline-block font-semibold text-indigo-600">Manage Google security</a>
            </div>}
          </div>
        </div>
      </div>
    </div>
  );
}
