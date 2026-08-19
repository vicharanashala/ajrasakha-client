import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { QueryKeys } from 'librechat-data-provider';
import { useQueryClient } from '@tanstack/react-query';
import { TooltipAnchor, NewChatIcon, MobileSidebar, Sidebar, Button } from '@librechat/client';
import { CLOSE_SIDEBAR_ID, OPEN_SIDEBAR_ID } from '~/components/Chat/Menus/OpenSidebar';
import { useAgentsMapContext, useAssistantsMapContext } from '~/Providers';
import ConvoIcon from '~/components/Endpoints/ConvoIcon';
import { useGetEndpointsQuery } from '~/data-provider';
import { useLocalize, useNewConvo } from '~/hooks';
import { clearMessagesCache } from '~/utils';
import store from '~/store';

// Same "bubble" treatment used for the icon on the Landing/"Welcome" screen,
// so the sidebar logo and the welcome-screen icon look like one system.
const logoContainerClassName =
  'shadow-stroke relative flex h-full w-full items-center justify-center rounded-full bg-white dark:bg-presentation dark:text-white text-black dark:after:shadow-none';

export default function NewChat({
  index = 0,
  toggleNav,
  subHeaders,
  isSmallScreen,
  headerButtons,
  notificationBell,
  collapsed = false,
}: {
  index?: number;
  toggleNav: () => void;
  isSmallScreen?: boolean;
  subHeaders?: React.ReactNode;
  headerButtons?: React.ReactNode;
  notificationBell?: React.ReactNode;
  collapsed?: boolean;
}) {
  const queryClient = useQueryClient();
  /** Note: this component needs an explicit index passed if using more than one */
  const { newConversation: newConvo } = useNewConvo(index);
  // const navigate = useNavigate();
  const localize = useLocalize();
  const { conversation } = store.useCreateConversationAtom(index);
  const agentsMap = useAgentsMapContext();
  const assistantMap = useAssistantsMapContext();
  const { data: endpointsConfig } = useGetEndpointsQuery();

  const handleToggleNav = useCallback(() => {
    toggleNav();
    // Delay focus until after the sidebar animation completes (200ms)
    setTimeout(() => {
      document.getElementById(OPEN_SIDEBAR_ID)?.focus();
    }, 250);
  }, [toggleNav]);

  const clickHandler: React.MouseEventHandler<HTMLButtonElement> = useCallback(
    async (e) => {
      if (e.button === 0 && (e.ctrlKey || e.metaKey)) {
        window.open('/c/new', '_blank');
        return;
      }
      await newConvo();
      clearMessagesCache(queryClient, conversation?.conversationId);
      queryClient.invalidateQueries([QueryKeys.messages]);
      // navigate('/c/new', { state: { focusChat: true } });
      if (isSmallScreen) {
        toggleNav();
      }
    },
    [queryClient, conversation, newConvo, toggleNav, isSmallScreen],
  );


  const logo = (
    <ConvoIcon
      agentsMap={agentsMap}
      assistantMap={assistantMap}
      conversation={conversation}
      endpointsConfig={endpointsConfig}
      containerClassName={logoContainerClassName}
      context="nav"
      className="h-2/3 w-2/3 text-black dark:text-white"
      size={20}
    />
  );

  // Collapsed rail: logo, sidebar toggle, New Chat, and notifications stacked
  // as centered icon-only buttons (no labels, no search bar).
  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-1 py-[2px] md:py-2">
        <div className="mb-3 mt-1 flex-shrink-0" style={{ height: 28, width: 28 }}>
          {logo}
        </div>
        <TooltipAnchor
          description={localize('com_nav_open_sidebar')}
          side="right"
          render={
            <Button
              id={OPEN_SIDEBAR_ID}
              size="icon"
              variant="outline"
              data-testid="open-sidebar-button"
              aria-label={localize('com_nav_open_sidebar')}
              aria-expanded={false}
              className="rounded-full border-none bg-transparent duration-0 hover:bg-surface-active-alt md:rounded-xl"
              onClick={handleToggleNav}
            >
              <Sidebar aria-hidden="true" className="max-md:hidden" />
              <MobileSidebar
                aria-hidden="true"
                className="icon-lg m-1 inline-flex items-center justify-center md:hidden"
              />
            </Button>
          }
        />
        <TooltipAnchor
          description={localize('com_ui_new_chat')}
          side="right"
          render={
            <button
              type="button"
              data-testid="nav-new-chat-button"
              aria-label={localize('com_ui_new_chat')}
              onClick={clickHandler}
              className="flex h-10 w-10 items-center justify-center rounded-xl border-none bg-transparent text-text-primary duration-0 hover:bg-surface-active-alt"
            >
              <NewChatIcon className="icon-lg text-text-primary" />
            </button>
          }
        />
        {notificationBell}
      </div>
    );
  }

  return (
    <>
      <div className="mb-3 mt-2 flex items-center justify-between pl-1">
        <div className="flex-shrink-0" style={{ height: 28, width: 28 }}>
          {logo}
        </div>
        <div className="flex items-center gap-0.5">
          {headerButtons}
          <TooltipAnchor
            description={localize('com_nav_close_sidebar')}
            render={
              <Button
                id={CLOSE_SIDEBAR_ID}
                size="icon"
                variant="outline"
                data-testid="close-sidebar-button"
                aria-label={localize('com_nav_close_sidebar')}
                aria-expanded={true}
                className="rounded-full border-none bg-transparent duration-0 hover:bg-surface-active-alt md:rounded-xl"
                onClick={handleToggleNav}
              >
                <Sidebar aria-hidden="true" className="max-md:hidden" />
                <MobileSidebar
                  aria-hidden="true"
                  className="icon-lg m-1 inline-flex items-center justify-center md:hidden"
                />
              </Button>
            }
          />
        </div>
      </div>
      <button
        type="button"
        data-testid="nav-new-chat-button"
        aria-label={localize('com_ui_new_chat')}
        onClick={clickHandler}
        className="mb-1 flex w-full items-center gap-2 rounded-xl border-none bg-transparent px-2 py-2 text-left text-sm font-medium text-text-primary duration-0 hover:bg-surface-active-alt"
      >
        <NewChatIcon className="icon-lg flex-shrink-0 text-text-primary" />
        <span className="truncate">{localize('com_ui_new_chat')}</span>
      </button>
      {notificationBell}
      {subHeaders != null ? subHeaders : null}
    </>
  );
}
