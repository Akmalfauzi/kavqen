'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useNotifications } from '@/contexts/NotificationsContext';
import { SEARCH_DEBOUNCE_MS } from '@/hooks/useDebouncedValue';
import { useRouter } from 'next/navigation';
import { api, clearToken } from '@/lib/api';
import { ActivePage } from './AppSidebar';
import toast from 'react-hot-toast';
import {
  RiArrowLeftLine,
  RiUser3Line,
  RiSearchLine,
  RiShareForwardLine,
  RiSparklingFill,
  RiNotification3Line,
  RiPhoneLine,
  RiFileTextLine,
  RiFlashlightLine,
  RiArrowDownSLine,
  RiRobot2Line,
  RiKey2Line,
  RiLogoutBoxRLine,
  RiCloseLine,
} from 'react-icons/ri';

interface TopNavbarProps {
  activePage: ActivePage;
  onSelectPage: (page: ActivePage) => void;
  agentName: string;
  user?: { name: string | null; email: string; role?: { code: string } | null } | null;
}

export default function TopNavbar({
  activePage,
  onSelectPage,
  agentName,
  user,
}: TopNavbarProps) {
  const roleCode = user?.role?.code;
  const isOwner = roleCode === 'ADMIN' || roleCode === 'SUPER-ADMIN';
  const roleLabel = roleCode === 'SUPER-ADMIN' ? 'Super Admin' : roleCode === 'ADMIN' ? 'Admin' : roleCode === 'USER' ? 'Participant' : 'Account';
  const displayName = user?.name?.trim() || user?.email || 'Account';
  const initials = user?.name?.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U';

  // Search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Notification state
  const [notificationOpen, setNotificationOpen] = useState(false);
  const { notifications: items, loading, error: notificationError, refresh,
    markRead, markAllRead: handleMarkAllRead, clearAll: handleClearNotifications } = useNotifications();
  const notifications = items.map(item => ({ ...item, unread: !item.readAt,
    desc: item.description, time: new Date(item.createdAt).toLocaleString(),
    iconType: item.kind === 'submission' ? 'file' : 'bolt' }));

  // Profile state
  const [profileOpen, setProfileOpen] = useState(false);

  const notifRef = useRef<HTMLDivElement | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Close popovers on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotificationOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut Command/Ctrl + K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setNotificationOpen(false);
        setProfileOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [searchOpen]);

  const unreadCount = notifications.filter((n) => n.unread).length;

  const router = useRouter();
  const [filteredSearch, setFilteredSearch] = useState<{ id: string; title: string; category: string; hint: string; href: string }[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  useEffect(() => {
    setFilteredSearch([]);
    setSearchError('');
    if (!searchOpen || !user) return;
    const controller = new AbortController();
    setSearchLoading(true);
    const timer = window.setTimeout(() => {
      api.get('/search', { params: { q: searchQuery }, signal: controller.signal })
        .then(response => { if (!controller.signal.aborted) setFilteredSearch(response.data.data); })
        .catch(error => { if (!controller.signal.aborted) setSearchError(error.response?.data?.message || 'Search failed. Please try again.'); })
        .finally(() => { if (!controller.signal.aborted) setSearchLoading(false); });
    }, SEARCH_DEBOUNCE_MS);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [searchOpen, searchQuery, user?.email, roleCode]);

  return (
    <header className="h-16 w-full bg-white border-b border-slate-200/90 px-5 md:px-6 flex items-center justify-between shadow-xs sticky top-0 z-30 select-none">
      {/* 1. Left Context Banner */}
      <div className="flex items-center space-x-3 min-w-0">
        <div className="flex items-center space-x-2.5 truncate">
          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 flex-shrink-0">
            <RiUser3Line className="w-4 h-4" />
          </div>
          <span className="text-sm font-bold text-slate-900 tracking-tight truncate">
            {activePage === 'workflows' ? agentName : activePage.charAt(0).toUpperCase() + activePage.slice(1)}
          </span>
        </div>
      </div>

      {/* 2. Middle: Global Search Bar */}
      <div className="flex-1 max-w-md mx-4 hidden sm:block">
        <div
          onClick={() => setSearchOpen(true)}
          className="w-full flex items-center justify-between px-3.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-100/80 hover:border-slate-300 text-xs text-slate-500 cursor-pointer transition shadow-2xs"
        >
          <div className="flex items-center space-x-2 truncate">
            <RiSearchLine className="w-3.5 h-3.5 text-slate-400" />
            <span className="truncate">Search here...</span>
          </div>
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-semibold text-slate-400 bg-white border border-slate-200 rounded-md shadow-2xs">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* 3. Right: Actions, Notifications, Profile */}
      <div className="flex items-center space-x-2.5 flex-shrink-0">
        {/* Notification Bell Dropdown */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => {
              setNotificationOpen(!notificationOpen);
              setProfileOpen(false);
            }}
            className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-600 relative transition"
            title="Notifications"
          >
            <RiNotification3Line className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-rose-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center shadow-xs">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notification Popover Dropdown */}
          {notificationOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-xl border border-slate-200/90 z-50 animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
              <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-slate-900">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.2 rounded-full">
                      {unreadCount} New
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[11px] font-semibold text-indigo-600 hover:underline"
                  >
                    Mark all as read
                  </button>
                )}
              </div>

              {notificationError && <button onClick={() => { void refresh(); }} className="p-3 text-xs text-red-700">{notificationError}</button>}
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 italic">
                    {loading ? 'Loading notifications...' : notificationError ? 'Unable to load notifications' : 'No notifications yet'}
                  </div>
                ) : (
                  notifications.slice(0, 10).map((n) => (
                    <button
                      type="button"
                      onClick={() => { if (n.unread) void markRead(n.id); }}
                      key={n.id}
                      className={`w-full text-left p-3.5 flex items-start space-x-3 transition hover:bg-slate-50 ${
                        n.unread ? 'bg-indigo-50/30' : ''
                      }`}
                    >
                      <span className="flex-shrink-0 mt-0.5">
                        {n.kind === 'call' ? (
                          <RiPhoneLine className="w-4 h-4 text-sky-500" />
                        ) : n.iconType === 'file' ? (
                          <RiFileTextLine className="w-4 h-4 text-indigo-500" />
                        ) : (
                          <RiFlashlightLine className="w-4 h-4 text-amber-500" />
                        )}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className={`text-xs font-bold truncate ${n.unread ? 'text-slate-900' : 'text-slate-700'}`}>
                            {n.title}
                          </span>
                          <span className="text-[10px] text-slate-400 ml-2 flex-shrink-0">{n.time}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-snug line-clamp-2">{n.desc}</p>
                      </div>
                      {n.unread && <span className="w-2 h-2 rounded-full bg-indigo-600 flex-shrink-0 mt-1.5" />}
                    </button>
                  ))
                )}
              </div>

              {notifications.length > 0 && (
                <div className="p-2.5 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <button
                    onClick={() => {
                      setNotificationOpen(false);
                      onSelectPage('notifications');
                    }}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700"
                  >
                    View all
                  </button>
                  <button
                    onClick={handleClearNotifications}
                    className="text-[11px] font-semibold text-slate-500 hover:text-slate-800"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* User Profile Dropdown */}
        <div ref={profileRef} className="relative">
          <button
            type="button"
            aria-label="Account menu"
            aria-expanded={profileOpen}
            aria-controls="account-menu"
            onClick={() => {
              setProfileOpen(!profileOpen);
              setNotificationOpen(false);
            }}
            className="flex items-center space-x-2 pl-1 pr-1.5 py-1 rounded-full hover:bg-slate-100 transition"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-pink-500 text-white font-black text-xs flex items-center justify-center shadow-xs">
              {initials}
            </div>
            <RiArrowDownSLine className="text-slate-400 w-3.5 h-3.5 hidden md:inline" />
          </button>

          {/* Profile Menu Popover */}
          {profileOpen && (
            <div id="account-menu" className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-xl border border-slate-200/90 z-50 animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
              <div className="p-3.5 border-b border-slate-100 bg-slate-50/50">
                <span className="text-xs font-bold text-slate-900 block break-words">{displayName}</span>
                <span className="text-[11px] text-slate-500 block break-all">{user?.email}</span>
                <span className="inline-block mt-1 text-[9px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                  {roleLabel}
                </span>
              </div>

              <div className="p-1.5 space-y-0.5 text-xs text-slate-700">
                <button
                  onClick={() => {
                    setProfileOpen(false);
                    onSelectPage('profile');
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100 font-medium flex items-center space-x-2.5"
                >
                  <RiUser3Line className="w-4 h-4 text-slate-500" />
                  <span>My Profile</span>
                </button>
                <button
                  onClick={() => {
                    setProfileOpen(false);
                    onSelectPage('dashboard');
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100 font-medium flex items-center space-x-2.5"
                >
                  <RiFileTextLine className="w-4 h-4 text-slate-500" />
                  <span>{isOwner ? 'Dashboard' : 'My Forms'}</span>
                </button>
                {isOwner && <>
                <button
                  onClick={() => {
                    setProfileOpen(false);
                    onSelectPage('agents');
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100 font-medium flex items-center space-x-2.5"
                >
                  <RiRobot2Line className="w-4 h-4 text-slate-500" />
                  <span>Agent Management</span>
                </button>
                <button
                  onClick={() => {
                    setProfileOpen(false);
                    onSelectPage('integrations');
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100 font-medium flex items-center space-x-2.5"
                >
                  <RiKey2Line className="w-4 h-4 text-slate-500" />
                  <span>Integrations</span>
                </button>
                </>}
              </div>

              <div className="p-1.5 border-t border-slate-100">
                <button
                  onClick={() => {
                    setProfileOpen(false);
                    clearToken();
                    sessionStorage.removeItem('pending_share_code');
                    window.location.replace('/login');
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-rose-50 text-rose-600 font-semibold text-xs flex items-center space-x-2.5"
                >
                  <RiLogoutBoxRLine className="w-4 h-4 text-rose-500" />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. Global Search Modal (⌘K) */}
      {searchOpen && (
        <div
          onClick={() => setSearchOpen(false)}
          className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-slate-900/60 p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150"
          >
            {/* Input Bar */}
            <div className="p-4 border-b border-slate-100 flex items-center space-x-3">
              <RiSearchLine className="w-4 h-4 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="What would you like to find?"
                maxLength={100}
                className="w-full text-sm text-slate-900 outline-none bg-transparent"
              />
              <button
                onClick={() => setSearchOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700"
              >
                <RiCloseLine className="w-4 h-4" />
              </button>
            </div>

            {/* Results */}
            <div className="max-h-80 overflow-y-auto p-2 space-y-1">
              {filteredSearch.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  {searchLoading ? 'Searching...' : searchError || 'No results found.'}
                </div>
              ) : (
                filteredSearch.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => {
                      router.push(item.href);
                      setSearchOpen(false);
                      setSearchQuery('');
                    }}
                    className="w-full text-left p-3 rounded-2xl hover:bg-indigo-50/70 cursor-pointer transition flex items-center justify-between group"
                  >
                    <div>
                      <span className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 block">
                        {item.title}
                      </span>
                      <span className="text-[11px] text-slate-400 block">{item.hint}</span>
                    </div>
                    <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                      {item.category}
                    </span>
                  </button>
                ))
              )}
            </div>

            <div className="p-3 border-t border-slate-100 bg-slate-50 flex justify-between items-center text-[11px] text-slate-400">
              <span>Navigate with mouse or keyboard</span>
              <span>Press ESC to close</span>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
