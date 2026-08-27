import { useState, useRef, useEffect, memo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { QueryKeys } from 'librechat-data-provider';
import { useQueryClient } from '@tanstack/react-query';
import { TooltipAnchor, useMediaQuery } from '@librechat/client';
import { Bell } from 'lucide-react';
import { useLocalize, useNewConvo } from '~/hooks';
import { clearMessagesCache } from '~/utils';
import useNotifications from '~/hooks/useNotifications';
import store from '~/store';

const VIEWPORT_MARGIN = 8;

function NotificationBell({ collapsed = false }: { collapsed?: boolean }) {
  const localize = useLocalize();
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const { notifications, unreadCount, markAsVisited, markAllVisited, fetchNotifications } =
    useNotifications();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { newConversation: newConvo } = useNewConvo();
  const { conversation } = store.useCreateConversationAtom(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isSmallScreen = useMediaQuery('(max-width: 768px)');

  // Position the portal dropdown relative to the button. On desktop it opens
  // as a flyout to the right of the sidebar (so it can't overflow above the
  // viewport the way a top-anchored popover did); on mobile it becomes a
  // viewport-width sheet anchored below the button.
  const updatePosition = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();

    if (isSmallScreen) {
      const top = Math.min(rect.bottom + VIEWPORT_MARGIN, window.innerHeight - VIEWPORT_MARGIN);
      setDropdownStyle({
        position: 'fixed',
        top,
        left: VIEWPORT_MARGIN,
        right: VIEWPORT_MARGIN,
        maxHeight: `calc(100vh - ${top + VIEWPORT_MARGIN}px)`,
        zIndex: 9999,
      });
      return;
    }

    const dropdownWidth = 320;
    const estimatedHeight = 400;
    const top = Math.min(
      rect.top,
      Math.max(VIEWPORT_MARGIN, window.innerHeight - estimatedHeight - VIEWPORT_MARGIN),
    );
    setDropdownStyle({
      position: 'fixed',
      top,
      left: rect.right + VIEWPORT_MARGIN,
      width: dropdownWidth,
      maxHeight: `calc(100vh - ${top + VIEWPORT_MARGIN}px)`,
      zIndex: 9999,
    });
  };

  useEffect(() => {
    if (!open) return;
    updatePosition();

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        buttonRef.current &&
        !buttonRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, isSmallScreen]);

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next) fetchNotifications();
  };

  const dropdown = open
    ? createPortal(
        <div
            ref={dropdownRef}
            style={dropdownStyle}
            className="flex flex-col overflow-hidden rounded-xl border border-border-light bg-surface-primary shadow-lg"
          >
            <div className="flex flex-shrink-0 items-center justify-between border-b border-border-light px-4 py-3">
              <span className="text-sm font-semibold text-text-primary">
                {localize('com_nav_notifications')}
              </span>
              {unreadCount > 0 && (
                <button onClick={markAllVisited} className="text-xs text-blue-500 hover:underline">
                  Mark all read
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-text-secondary">
                  No notifications yet
                </div>
              ) : (
                notifications.map((n) => {
                  const isClickable = !!n.originalQuestion;
                  const displayText = n.message ?? n.originalQuestion ?? '';

                  return (
                    <div
                      key={n._id}
                      onClick={() => {
                        if (!isClickable) return;
                        markAsVisited(n._id);
                        setOpen(false);
                        clearMessagesCache(queryClient, conversation?.conversationId);
                        queryClient.invalidateQueries([QueryKeys.messages]);
                        newConvo();
                        navigate('/c/new', { state: { autoQuestion: n.originalQuestion } });
                      }}
                      className={`border-b border-border-light px-4 py-3 last:border-0 ${
                        isClickable ? 'cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-800' : 'cursor-default'
                      } ${!n.isVisited ? 'bg-surface-secondary' : ''}`}
                    >
                      <div className="flex items-start gap-2">
                        {!n.isVisited && (
                          <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
                        )}
                        <div className={!n.isVisited ? '' : 'ml-4'}>
                          {n.message && (
                            <p className="mb-0.5 text-xs font-medium text-blue-500">
                              {n.type === "CUSTOM" ? "Alert" : "Info"}                         
                            </p>
                          )}
                          <p
                            className="line-clamp-2 text-sm text-text-primary"
                            title={displayText}
                          >
                            {displayText}
                          </p>
                          <p className="mt-1 text-xs text-text-secondary">
                            {new Date(n.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
        </div>,
        document.body,
      )
    : null;

  const bellIcon = (
    <span className="relative flex h-5 w-5 flex-shrink-0 items-center justify-center">
      <Bell className="h-5 w-5 text-text-primary" />
      {unreadCount > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </span>
  );

  return (
    <div className="flex-shrink-0">
      {collapsed ? (
        <TooltipAnchor
          description={localize('com_nav_notifications')}
          side="right"
          render={
            <button
              type="button"
              ref={buttonRef}
              onClick={handleToggle}
              className="flex h-10 w-10 items-center justify-center rounded-xl border-none bg-transparent text-text-primary duration-0 hover:bg-gray-300 dark:hover:bg-gray-800"
              aria-label={localize('com_nav_notifications')}
            >
              {bellIcon}
            </button>
          }
        />
      ) : (
        <button
          type="button"
          ref={buttonRef}
          onClick={handleToggle}
          className="mb-1 flex w-full items-center gap-2 rounded-xl border-none bg-transparent px-2 py-2 text-left text-sm font-medium text-text-primary duration-0 hover:bg-gray-300 dark:hover:bg-gray-800"
          aria-label={localize('com_nav_notifications')}
        >
          {bellIcon}
          <span className="truncate">{localize('com_nav_notifications')}</span>
        </button>
      )}
      {dropdown}
    </div>
  );
}

export default memo(NotificationBell);
