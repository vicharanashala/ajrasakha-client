import { useState, useEffect, useCallback } from 'react';
import { useAuthContext } from './AuthContext';

export interface AppNotification {
  _id: string;
  userId: string;
  originalQuestion?: string;
  messageId?: string;
  message?: string;
  type?: string;
  isVisited: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function useNotifications(initialFilter = 'unread') {
  const { token } = useAuthContext();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState(initialFilter);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [serverUnreadCount, setServerUnreadCount] = useState<number | null>(null);

  const fetchNotifications = useCallback(async (currentFilter = filter, currentPage = page) => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/notifications?filter=${currentFilter}&page=${currentPage}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        // Fallback for backwards compatibility if backend not updated yet
        if (Array.isArray(data)) {
          setNotifications(data);
          setTotalPages(1);
        } else {
          setNotifications(data.notifications || []);
          setTotalPages(data.pages || 1);
          if (data.unreadCount !== undefined) {
             setServerUnreadCount(data.unreadCount);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [token, filter, page]);

  useEffect(() => {
    fetchNotifications(filter, page);
  }, [fetchNotifications, filter, page]);

  const markAsVisited = useCallback(
    async (id: string) => {
      if (!token) return;
      try {
        await fetch(`/api/notifications/${id}/visited`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
        });
        // Remove from list immediately when clicked
        if (filter === 'unread') {
          setNotifications((prev) => prev.filter((n) => n._id !== id));
        } else {
          setNotifications((prev) => prev.map((n) => n._id === id ? { ...n, isVisited: true } : n));
        }
        setServerUnreadCount((prev) => prev !== null ? Math.max(0, prev - 1) : null);
      } catch (err) {
        console.error('Failed to mark notification as visited:', err);
      }
    },
    [token, filter],
  );

  const markAllVisited = useCallback(async () => {
    if (!token) return;
    try {
      await fetch('/api/notifications/mark-all-visited', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (filter === 'unread') {
        setNotifications([]);
      } else {
        setNotifications((prev) => prev.map((n) => ({ ...n, isVisited: true })));
      }
      setServerUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all notifications as visited:', err);
    }
  }, [token]);

  const unreadCount = serverUnreadCount !== null ? serverUnreadCount : notifications.filter((n) => !n.isVisited).length;

  return { notifications, loading, unreadCount, fetchNotifications, markAsVisited, markAllVisited, filter, setFilter, page, setPage, totalPages };
}
