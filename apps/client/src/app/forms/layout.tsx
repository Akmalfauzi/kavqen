'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import AppSidebar, { type ActivePage } from '@/components/AppSidebar';
import TopNavbar from '@/components/TopNavbar';
import { NotificationsProvider } from '@/contexts/NotificationsContext';
import { api, getToken } from '@/lib/api';

interface Account {
  id: string;
  name: string | null;
  email: string;
  role?: { code: string } | null;
}

export default function FormsLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<Account | null>(null);
  const [collapsed, setCollapsed] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => { setCollapsed(window.innerWidth < 1024); }, []);
  useEffect(() => {
    if (!getToken()) { router.replace('/login'); return; }
    const controller = new AbortController();
    setError('');
    api.get('/user/me', { signal: controller.signal })
      .then(response => setUser(response.data.data))
      .catch(err => {
        if (controller.signal.aborted) return;
        if (err.response?.status === 401) router.replace('/login');
        else setError('Unable to load your workspace.');
      });
    return () => controller.abort();
  }, [router, retry]);
  const navigate = (page: ActivePage) => router.push(`/${page}`);

  if (!user) return <div className="min-h-screen bg-slate-50 p-6 text-sm text-slate-500" role="status">
    {error || 'Loading your workspace...'}
    {error && <button onClick={() => setRetry(value => value + 1)} className="ml-2 font-semibold text-indigo-600">Try again</button>}
  </div>;

  return <NotificationsProvider userId={user.id}>
    <div className="flex h-dvh overflow-hidden bg-slate-50">
      <AppSidebar activePage="dashboard" onSelectPage={navigate} collapsed={collapsed} onToggleCollapse={() => setCollapsed(value => !value)} user={user} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopNavbar activePage="dashboard" onSelectPage={navigate} agentName="" user={user} />
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  </NotificationsProvider>;
}
