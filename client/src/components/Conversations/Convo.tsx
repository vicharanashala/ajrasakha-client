import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRecoilValue } from 'recoil';
import { useParams } from 'react-router-dom';
import { Constants } from 'librechat-data-provider';
import { useToastContext, useMediaQuery } from '@librechat/client';
import type { TConversation } from 'librechat-data-provider';
import { useUpdateConversationMutation } from '~/data-provider';
import { useNavigateToConvo, useLocalize, useShiftKey } from '~/hooks';
import { NotificationSeverity } from '~/common';
import { ConvoOptions } from './ConvoOptions';
import RenameForm from './RenameForm';
import { cn, logger } from '~/utils';
import ConvoLink from './ConvoLink';
import store from '~/store';

interface ConversationProps {
  conversation: TConversation;
  retainView: () => void;
  toggleNav: () => void;
  isGenerating?: boolean;
}

export default function Conversation({
  conversation,
  retainView,
  toggleNav,
  isGenerating = false,
}: ConversationProps) {
  const params = useParams();
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const { navigateToConvo } = useNavigateToConvo();
  const currentConvoId = useMemo(() => params.conversationId, [params.conversationId]);
  const updateConvoMutation = useUpdateConversationMutation(currentConvoId ?? '');
  const activeConvos = useRecoilValue(store.allConversationsSelector);
  const isSmallScreen = useMediaQuery('(max-width: 768px)');
  const isShiftHeld = useShiftKey();
  const { conversationId, title = '' } = conversation;

  const [titleInput, setTitleInput] = useState(title || '');
  const [renaming, setRenaming] = useState(false);
  const [isPopoverActive, setIsPopoverActive] = useState(false);
  // Lazy-load ConvoOptions to avoid running heavy hooks for all conversations
  const [hasInteracted, setHasInteracted] = useState(false);

  const previousTitle = useRef(title);

  useEffect(() => {
    if (title !== previousTitle.current) {
      setTitleInput(title as string);
      previousTitle.current = title;
    }
  }, [title]);

  const isActiveConvo = useMemo(() => {
    if (conversationId === Constants.NEW_CONVO) {
      return currentConvoId === Constants.NEW_CONVO;
    }

    if (currentConvoId !== Constants.NEW_CONVO) {
      return currentConvoId === conversationId;
    } else {
      const latestConvo = activeConvos?.[0];
      return latestConvo === conversationId;
    }
  }, [currentConvoId, conversationId, activeConvos]);

  const handleRename = () => {
    setIsPopoverActive(false);
    setTitleInput(title as string);
    setRenaming(true);
  };

  const handleRenameSubmit = async (newTitle: string) => {
    if (!conversationId || newTitle === title) {
      setRenaming(false);
      return;
    }

    try {
      await updateConvoMutation.mutateAsync({
        conversationId,
        title: newTitle.trim() || localize('com_ui_untitled'),
      });
      setRenaming(false);
    } catch (error) {
      logger.error('Error renaming conversation', error);
      setTitleInput(title as string);
      showToast({
        message: localize('com_ui_rename_failed'),
        severity: NotificationSeverity.ERROR,
        showIcon: true,
      });
      setRenaming(false);
    }
  };

  const handleCancelRename = () => {
    setTitleInput(title as string);
    setRenaming(false);
  };

  const handleMouseEnter = useCallback(() => {
    if (!hasInteracted) {
      setHasInteracted(true);
    }
  }, [hasInteracted]);

  const handleNavigation = (ctrlOrMetaKey: boolean) => {
    if (ctrlOrMetaKey) {
      toggleNav();
      const baseUrl = window.location.origin;
      const path = `/c/${conversationId}`;
      window.open(baseUrl + path, '_blank');
      return;
    }

    if (currentConvoId === conversationId || isPopoverActive) {
      return;
    }

    toggleNav();

    if (typeof title === 'string' && title.length > 0) {
      document.title = title;
    }

    navigateToConvo(conversation, {
      currentConvoId,
      resetLatestMessage: !(conversationId ?? '') || conversationId === Constants.NEW_CONVO,
    });
  };

  const convoOptionsProps = {
    title,
    retainView,
    renameHandler: handleRename,
    isActiveConvo,
    conversationId,
    isPopoverActive,
    setIsPopoverActive,
    isShiftHeld: isActiveConvo ? isShiftHeld : false,
  };

  return (
    <div
      className={cn(
        'group relative flex h-12 w-full items-center rounded-lg transition-colors duration-200 ease-out md:h-9',
        isActiveConvo || isPopoverActive
          ? 'bg-green-600/10'
          : 'hover:bg-surface-hover',
      )}
      role="button"
      tabIndex={renaming ? -1 : 0}
      aria-label={localize('com_ui_conversation_label', {
        title: title || localize('com_ui_untitled'),
      })}
      onMouseEnter={handleMouseEnter}
      onFocus={handleMouseEnter}
      onClick={(e) => {
        if (renaming) {
          return;
        }
        if (e.button === 0) {
          handleNavigation(e.ctrlKey || e.metaKey);
        }
      }}
      onKeyDown={(e) => {
        if (renaming) {
          return;
        }
        if (e.target !== e.currentTarget) {
          return;
        }
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleNavigation(false);
        }
      }}
      style={{ cursor: renaming ? 'default' : 'pointer' }}
      data-testid="convo-item"
    >
      {renaming ? (
        <RenameForm
          titleInput={titleInput}
          setTitleInput={setTitleInput}
          onSubmit={handleRenameSubmit}
          onCancel={handleCancelRename}
          localize={localize}
        />
      ) : (
        <ConvoLink
          isActiveConvo={isActiveConvo}
          isGenerating={isGenerating}
          isPopoverActive={isPopoverActive}
          title={title}
          onRename={handleRename}
          isSmallScreen={isSmallScreen}
          localize={localize}
        >
          {isGenerating ? (
            // Three bouncing dots shown while the conversation is generating a response.
            <span
              className="flex flex-shrink-0 items-center gap-0.5"
              role="status"
              aria-label={localize('com_ui_generating')}
            >
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  className="size-1.5 animate-bounce rounded-full bg-green-500"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </span>
          ) : null}
        </ConvoLink>
      )}
      <div
        className={cn(
          'mr-2 flex origin-left transition-all duration-200 ease-out',
          isPopoverActive || isActiveConvo
            ? 'pointer-events-auto scale-x-100 opacity-100'
            : 'pointer-events-none max-w-0 scale-x-0 opacity-0 group-focus-within:pointer-events-auto group-focus-within:max-w-[60px] group-focus-within:scale-x-100 group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:max-w-[60px] group-hover:scale-x-100 group-hover:opacity-100',
          !isPopoverActive && isActiveConvo && isShiftHeld ? 'max-w-[60px]' : 'max-w-[28px]',
        )}
        // Removing aria-hidden to fix accessibility issue: ARIA hidden element must not be focusable or contain focusable elements
        // but not sure what its original purpose was, so leaving the property commented out until it can be cleared safe to delete.
        // aria-hidden={!(isPopoverActive || isActiveConvo)}
      >
        {/* Only render ConvoOptions when user interacts (hover/focus) or for active conversation */}
        {!renaming && (hasInteracted || isActiveConvo) && <ConvoOptions {...convoOptionsProps} />}
      </div>
    </div>
  );
}
