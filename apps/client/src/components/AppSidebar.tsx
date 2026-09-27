'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  RiDashboardLine,
  RiRobot2Line,
  RiBookOpenLine,
  RiBarChartBoxLine,
  RiSettings4Line,
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiArrowDownSLine,
  RiFolderUserLine,
  RiDatabase2Line,
  RiNotification3Line,
} from 'react-icons/ri';

export type ActivePage = 'dashboard' | 'agents' | 'workflows' | 'submissions' | 'fields' | 'users' | 'roles' | 'permissions' | 'permission-groups' | 'knowledge' | 'analytics' | 'test-agent' | 'integrations' | 'profile' | 'notifications';

interface AppSidebarProps {
  activePage: ActivePage;
  onSelectPage: (page: ActivePage) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  user?: any;
}

export default function AppSidebar({
  activePage,
  onSelectPage,
  collapsed,
  onToggleCollapse,
  user,
}: AppSidebarProps) {
  const navItems: { id: string; label: string; icon: React.ReactNode; subItems?: { id: ActivePage; label: string }[] }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <RiDashboardLine className="w-4 h-4" /> },
    { id: 'agents', label: 'Agents', icon: <RiRobot2Line className="w-4 h-4" /> },
    { id: 'submissions', label: 'Submissions', icon: <RiFolderUserLine className="w-4 h-4" /> },
    {
      id: 'data-master',
      label: 'Data Master',
      icon: <RiDatabase2Line className="w-4 h-4" />,
      subItems: [
        { id: 'fields', label: 'Field' },
        { id: 'users', label: 'User' },
        { id: 'roles', label: 'Roles' },
        { id: 'permissions', label: 'Permissions' },
        { id: 'permission-groups', label: 'Permission Groups' }
      ]
    },
    { id: 'knowledge', label: 'Knowledge', icon: <RiBookOpenLine className="w-4 h-4" /> },
    { id: 'analytics', label: 'Analytics', icon: <RiBarChartBoxLine className="w-4 h-4" /> },
    { id: 'integrations', label: 'Integrations', icon: <RiSettings4Line className="w-4 h-4" /> },
    { id: 'notifications', label: 'Notifications', icon: <RiNotification3Line className="w-4 h-4" /> },
  ];

  const visibleNavItems = user?.role?.code === 'USER'
    ? navItems.filter((item) => item.id === 'dashboard' || item.id === 'submissions')
      .map(item => item.id === 'submissions' ? { ...item, label: 'Form history' } : item) : navItems;
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});

  // Auto-expand menu if an active page belongs to it, and collapse if it doesn't.
  useEffect(() => {
    setOpenMenus((prev) => {
      const nextState = { ...prev };

      // We know navItems structure. For simplicity, check data-master.
      const isDataMasterActive = [
        'fields', 'users', 'roles', 'permissions', 'permission-groups'
      ].includes(activePage);

      // If we navigate away from Data Master sub-items, close it.
      // If we navigate TO a Data Master sub-item, ensure it's open.
      if (isDataMasterActive) {
        nextState['data-master'] = true;
      } else {
        nextState['data-master'] = false;
      }

      return nextState;
    });
  }, [activePage]);

  const toggleMenu = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (collapsed) {
      onToggleCollapse();
    }
    setOpenMenus((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <aside
      className={`bg-white border-r border-slate-200 shrink-0 flex flex-col justify-between transition-all duration-300 z-40 select-none ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      <div>
        {/* Sidebar Header / Brand */}
        <div className={`relative h-16 flex items-center border-b border-slate-100 ${collapsed ? 'justify-center' : 'px-4 justify-between'}`}>
          {!collapsed && (
            <Link href="/dashboard" onClick={() => onSelectPage('dashboard')} className="flex items-center space-x-2.5">
              <div className="w-8 h-8 shrink-0 rounded-xl bg-gradient-to-tr from-indigo-600 via-sky-600 to-teal-500 flex items-center justify-center text-white font-black text-sm shadow-md">
                K
              </div>
              <div>
                <span className="text-sm font-black text-slate-900 tracking-tight block leading-tight">
                  KavQen AI
                </span>
                <span className="text-[10px] text-slate-400 font-medium block">
                  Voice Agent Studio
                </span>
              </div>
            </Link>
          )}

          {collapsed && (
            <Link href="/dashboard" onClick={() => onSelectPage('dashboard')} className="w-8 h-8 shrink-0 rounded-xl bg-gradient-to-tr from-indigo-600 via-sky-600 to-teal-500 flex items-center justify-center text-white font-black text-sm shadow-md">
              K
            </Link>
          )}

          <button
            onClick={onToggleCollapse}
            className={`shrink-0 hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition ${collapsed ? 'absolute -right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white border border-slate-200 shadow-sm' : 'w-7 h-7 rounded-lg'}`}
            aria-label={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {collapsed ? <RiArrowRightSLine className="w-4 h-4" /> : <RiArrowLeftSLine className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1">
          {visibleNavItems.map((item) => {
            const hasSub = !!item.subItems;
            const isSubActive = hasSub && item.subItems?.some(s => s.id === activePage);
            const isActive = activePage === item.id || isSubActive;
            const isOpen = openMenus[item.id];

            return (
              <div key={item.id} className="space-y-1">
                <Link
                  href={hasSub ? '#' : `/${item.id}`}
                  onClick={(e) => {
                    if (hasSub) {
                      toggleMenu(e, item.id);
                    } else {
                      onSelectPage(item.id as ActivePage);
                    }
                  }}
                  className={`w-full flex items-center rounded-xl px-3 py-2.5 text-xs font-semibold transition-all ${
                    isActive && !hasSub
                      ? 'bg-slate-900 text-white shadow-sm'
                      : isActive && hasSub
                      ? 'bg-slate-100 text-slate-900 font-bold'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                  title={collapsed ? item.label : undefined}
                >
                  <span className={`mr-3 flex-shrink-0 ${isActive && !hasSub ? 'text-slate-400' : isActive && hasSub ? 'text-slate-900' : 'text-slate-400 group-hover:text-slate-700'}`}>
                    {item.icon}
                  </span>
                  {!collapsed && (
                    <div className="flex-1 flex items-center justify-between">
                      <span className="truncate">{item.label}</span>
                      {hasSub && (
                        <RiArrowDownSLine className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      )}
                    </div>
                  )}
                </Link>

                {/* Sub Items */}
                {hasSub && isOpen && !collapsed && (
                  <div className="pl-9 pr-2 space-y-1 mt-1 mb-2">
                    {item.subItems?.map((sub) => {
                      const isSubItemActive = activePage === sub.id;
                      return (
                        <Link
                          key={sub.id}
                          href={`/${sub.id}`}
                          onClick={() => onSelectPage(sub.id)}
                          className={`w-full flex items-center rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                            isSubItemActive
                              ? 'bg-slate-900 text-white shadow-sm'
                              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                          }`}
                        >
                          {/* Dot Marker */}
                          <span 
                            className={`w-1.5 h-1.5 rounded-full mr-2.5 flex-shrink-0 transition-colors ${
                              isSubItemActive ? 'bg-white' : 'bg-slate-300 group-hover:bg-slate-400'
                            }`} 
                          />
                          <span>{sub.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      
    </aside>
  );
}
