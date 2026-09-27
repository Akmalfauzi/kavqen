'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { api, getToken } from '@/lib/api';
import { notificationCopy } from '@/lib/notification-copy';
import Modal from '@/components/Modal';

interface Notification {
  id: string;
  title: string;
  description: string;
  kind: string;
  createdAt: string;
  readAt: string | null;
}
interface NotificationsState {
  notifications: Notification[];
  loading: boolean;
  error: string;
  connected: boolean;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  clearAll: () => Promise<void>;
}
const Context = createContext<NotificationsState | null>(null);

export function NotificationsProvider({ userId, children }: { userId?: string; children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState('');
  const clearLock = useRef(false);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    if (!userId) return;
    const request = ++generation.current;
    try {
      const response = await api.get('/notifications');
      if (request !== generation.current) return;
      setNotifications((response.data.data as Notification[]).map(notificationCopy));
      setError('');
    } catch {
      if (request === generation.current) setError('Unable to load notifications.');
    } finally { if (request === generation.current) setLoading(false); }
  }, [userId]);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    void refresh();
    const configured = process.env.NEXT_PUBLIC_SOCKET_URL || process.env.NEXT_PUBLIC_GATEWAY_URL;
    const origin = configured ? new URL(configured, window.location.origin).origin : `${window.location.protocol}//${window.location.hostname}:3003`;
    const socket = io(`${origin}/notifications`, {
      transports: ['websocket'],
      auth: callback => callback({ token: getToken() }),
    });
    socket.on('connect', () => { setConnected(true); void refresh(); window.dispatchEvent(new Event('participant-dashboard-refresh')); });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));
    socket.on('notifications:changed', () => { void refresh(); window.dispatchEvent(new Event('participant-dashboard-refresh')); });
    const onFocus = () => { void refresh(); if (!socket.connected) socket.connect(); };
    window.addEventListener('focus', onFocus);
    return () => {
      generation.current++;
      socket.disconnect();
      window.removeEventListener('focus', onFocus);
    };
  }, [userId, refresh]);

  const mutate = async (action: () => Promise<unknown>) => {
    try { await action(); await refresh(); }
    catch { toast.error('Unable to update notifications. Please try again.'); }
  };
  return <Context.Provider value={{ notifications, loading, error, connected, refresh,
    markRead: id => mutate(() => api.patch(`/notifications/${id}/read`)),
    markAllRead: () => mutate(() => api.patch('/notifications/read-all')),
    clearAll: async () => {
      setClearError('');
      setConfirmClear(true);
    },
  }}>{children}
    {confirmClear && <Modal title="Clear all notifications?" onClose={() => { if (!clearLock.current) setConfirmClear(false); }} footer={
      <div className="flex justify-end gap-3">
        <button type="button" disabled={clearing} onClick={() => setConfirmClear(false)} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 disabled:opacity-40">Cancel</button>
        <button type="button" disabled={clearing} onClick={async () => {
          if (clearLock.current) return;
          clearLock.current = true;
          setClearing(true); setClearError('');
          try {
            await api.delete('/notifications');
            await refresh();
            setConfirmClear(false);
          } catch { setClearError('Unable to clear notifications. Please try again.'); }
          finally { clearLock.current = false; setClearing(false); }
        }} className="rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50">{clearing ? 'Clearing...' : 'Clear all'}</button>
      </div>
    }>
      <p className="text-sm leading-relaxed text-slate-600">This will permanently delete all your notifications, including read and unread items on every page. This action cannot be undone.</p>
      {clearError && <p role="alert" className="mt-3 text-sm text-rose-600">{clearError}</p>}
    </Modal>}
  </Context.Provider>;
}
export function useNotifications() {
  const context = useContext(Context);
  if (!context) throw new Error('NotificationsProvider is required');
  return context;
}
