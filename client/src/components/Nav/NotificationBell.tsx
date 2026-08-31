import { useRef, useState, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { QueryKeys } from 'librechat-data-provider';
import { useQueryClient } from '@tanstack/react-query';
import { TooltipAnchor, OGDialog, OGDialogContent, OGDialogHeader, OGDialogTitle } from '@librechat/client';
import { Bell, BellOff, Info, AlertTriangle, Check, ChevronRight } from 'lucide-react';
import type useLocalizeHook from '~/hooks/useLocalize';
import { useLocalize, useNewConvo } from '~/hooks';
import { clearMessagesCache, cn } from '~/utils';
import useNotifications, { AppNotification } from '~/hooks/useNotifications';
import store from '~/store';

type Localize = ReturnType<typeof useLocalizeHook>;

/** "2m ago" / "3h ago" / "Yesterday" / "4d ago", falling back to a plain date once it's more
 *  than a week old — the exact timestamp is always still available via the row's `title`. */
function formatRelativeTime(dateString: string, localize: Localize): string {
  const date = new Date(dateString);
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) {
    return localize('com_nav_notifications_time_just_now');
  }
  if (diffMin < 60) {
    return localize('com_nav_notifications_time_minutes_ago', { 0: diffMin });
  }
  if (diffHour < 24) {
    return localize('com_nav_notifications_time_hours_ago', { 0: diffHour });
  }
  if (diffDay === 1) {
    return localize('com_nav_notifications_time_yesterday');
  }
  if (diffDay < 7) {
    return localize('com_nav_notifications_time_days_ago', { 0: diffDay });
  }
  return date.toLocaleDateString();
}

function NotificationRow({
  notification,
  localize,
  onOpen,
}: {
  notification: AppNotification;
  localize: Localize;
  onOpen: (notification: AppNotification) => void;
}) {
  const isClickable = !!notification.originalQuestion;
  const displayText = notification.message ?? notification.originalQuestion ?? '';
  const isAlert = notification.type === 'CUSTOM';
  const TypeIcon = isAlert ? AlertTriangle : Info;
  const accentTextClass = isAlert ? 'text-amber-500' : 'text-green-600 dark:text-green-400';
  const accentBgClass = isAlert ? 'bg-amber-500/15' : 'bg-green-600/15';
  const accentDotClass = isAlert ? 'bg-amber-500' : 'bg-green-600 dark:bg-green-400';

  return (
    <div
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={() => isClickable && onOpen(notification)}
      onKeyDown={(event) => {
        if (!isClickable) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(notification);
        }
      }}
      className={cn(
        'group relative flex items-start gap-3 rounded-xl px-3.5 py-3 transition-colors',
        isClickable
          ? 'cursor-pointer hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-green-600'
          : 'cursor-default',
        !notification.isVisited ? 'bg-surface-tertiary' : '',
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full',
          accentBgClass,
          accentTextClass,
        )}
      >
        <TypeIcon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className={cn('min-w-0 flex-1', isClickable ? 'pr-5' : '')}>
        <div className="flex items-center gap-1.5">
          <span className={cn('text-[11px] font-bold uppercase tracking-wide', accentTextClass)}>
            {isAlert
              ? localize('com_nav_notifications_type_alert')
              : localize('com_nav_notifications_type_info')}
          </span>
          {!notification.isVisited && (
            <span className={cn('h-1.5 w-1.5 flex-shrink-0 rounded-full', accentDotClass)} />
          )}
        </div>
        <p
          className={cn(
            'line-clamp-2 text-sm',
            !notification.isVisited ? 'font-semibold text-text-primary' : 'text-text-secondary',
          )}
          title={displayText}
        >
          {displayText}
        </p>
        <span
          className="mt-0.5 block text-xs text-text-tertiary"
          title={new Date(notification.createdAt).toLocaleString()}
        >
          {formatRelativeTime(notification.createdAt, localize)}
        </span>
      </div>
      {isClickable && (
        <ChevronRight
          className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden="true"
        />
      )}
    </div>
  );
}

function NotificationBell({ collapsed = false }: { collapsed?: boolean }) {
  const localize = useLocalize();
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, markAsVisited, markAllVisited, fetchNotifications } =
    useNotifications();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { newConversation: newConvo } = useNewConvo();
  const { conversation } = store.useCreateConversationAtom(0);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      fetchNotifications();
    }
  };

  const handleOpenNotification = (notification: AppNotification) => {
    markAsVisited(notification._id);
    setOpen(false);
    clearMessagesCache(queryClient, conversation?.conversationId);
    queryClient.invalidateQueries([QueryKeys.messages]);
    newConvo();
    navigate('/c/new', { state: { autoQuestion: notification.originalQuestion } });
  };

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
              onClick={() => handleOpenChange(true)}
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
          onClick={() => handleOpenChange(true)}
          className="mb-1 flex w-full items-center gap-2 rounded-xl border-none bg-transparent px-2 py-2 text-left text-sm font-medium text-text-primary duration-0 hover:bg-gray-300 dark:hover:bg-gray-800"
          aria-label={localize('com_nav_notifications')}
        >
          {bellIcon}
          <span className="truncate">{localize('com_nav_notifications')}</span>
        </button>
      )}

      {/* OGDialog/OGDialogContent already animate in with Radix's fade + zoom + slide
          (see packages/client/src/components/OriginalDialog.tsx) — the same smooth,
          200ms open transition every other dialog in the app uses, so this modal opens
          consistently with the rest of the UI rather than a bespoke animation. */}
      <OGDialog open={open} onOpenChange={handleOpenChange} triggerRef={buttonRef}>
        <OGDialogContent
          showCloseButton
          className="notification-modal-shell flex w-11/12 max-w-md flex-col gap-0 overflow-hidden p-0 sm:max-w-lg lg:max-w-xl"
        >
          <OGDialogHeader className="flex shrink-0 flex-row items-center justify-between gap-3 space-y-0 border-b border-border-light py-4 pl-5 pr-14 text-left sm:pl-6">
            <div className="flex min-w-0 items-center gap-2.5">
              <OGDialogTitle className="text-base font-semibold text-text-primary sm:text-lg">
                {localize('com_nav_notifications')}
              </OGDialogTitle>
              {unreadCount > 0 && (
                <span className="inline-flex shrink-0 items-center rounded-full bg-green-600/15 px-2.5 py-0.5 text-xs font-semibold text-green-600 dark:text-green-400">
                  {localize('com_nav_notifications_new_count', { 0: unreadCount })}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllVisited}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border-medium px-3 py-1.5 text-xs font-semibold text-green-600 transition-colors hover:bg-surface-hover dark:text-green-400"
              >
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                {localize('com_nav_notifications_mark_all_read')}
              </button>
            )}
          </OGDialogHeader>

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-2 sm:p-3">
            {notifications.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3.5 px-8 py-14 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-green-600/10 text-green-600 dark:text-green-400">
                  <BellOff className="h-6 w-6" aria-hidden="true" />
                </span>
                <div className="flex flex-col items-center gap-1">
                  <p className="text-sm font-semibold text-text-primary">
                    {localize('com_nav_notifications_empty_title')}
                  </p>
                  <p className="max-w-[15rem] text-sm text-text-secondary">
                    {localize('com_nav_notifications_empty_subtitle')}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {notifications.map((notification) => (
                  <NotificationRow
                    key={notification._id}
                    notification={notification}
                    localize={localize}
                    onOpen={handleOpenNotification}
                  />
                ))}
              </div>
            )}
          </div>
        </OGDialogContent>
      </OGDialog>
    </div>
  );
}

export default memo(NotificationBell);
