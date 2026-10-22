import { useState, useEffect, useCallback, useRef } from 'react';
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

  // Latest request id, used to ignore responses that arrive after the tab or page changed.
  const latestRequestId = useRef(0);

  // Loads one page of notifications. Page 1 replaces the list and later pages are appended.
  const fetchNotifications = useCallback(async (currentFilter = filter, currentPage = page) => {
    if (!token) return;
    const requestId = ++latestRequestId.current;
    setLoading(true);
    try {
      const res = await fetch(`/api/notifications?filter=${currentFilter}&page=${currentPage}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok || requestId !== latestRequestId.current) return;

      const data = await res.json();
      // Fallback for backwards compatibility if backend not updated yet
      const incoming: AppNotification[] = Array.isArray(data) ? data : data.notifications || [];
      setNotifications((prev) => {
        if (currentPage <= 1) return incoming;
        const knownIds = new Set(prev.map((n) => n._id));
        return [...prev, ...incoming.filter((n) => !knownIds.has(n._id))];
      });
      if (Array.isArray(data)) {
        setTotalPages(1);
      } else {
        setTotalPages(data.pages || 1);
        if (data.unreadCount !== undefined) {
          setServerUnreadCount(data.unreadCount);
        }
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      if (requestId === latestRequestId.current) {
        setLoading(false);
      }
    }
  }, [token, filter, page]);

  // Clears the list when the tab changes so the loading state shows instead of stale rows.
  useEffect(() => {
    if (page === 1) {
      setNotifications([]);
    }
    fetchNotifications(filter, page);
  }, [fetchNotifications, filter, page]);

  const hasMore = page < totalPages;

  // Requests the next page for infinite scrolling.
  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      setPage((prev) => prev + 1);
    }
  }, [loading, hasMore]);

  // Reloads the first page, used when the notification dialog opens.
  const refresh = useCallback(() => {
    if (page === 1) {
      fetchNotifications(filter, 1);
    } else {
      setPage(1);
    }
  }, [page, filter, fetchNotifications]);

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

  return { notifications, loading, unreadCount, refresh, loadMore, hasMore, markAsVisited, markAllVisited, filter, setFilter, setPage };
}
