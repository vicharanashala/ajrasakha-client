import React, { useCallback, useMemo, memo } from 'react';
import { useRecoilValue } from 'recoil';
import { type TMessage } from 'librechat-data-provider';
import type { TMessageProps, TMessageIcon } from '~/common';
import MessageContent from '~/components/Chat/Messages/Content/MessageContent';
import PlaceholderRow from '~/components/Chat/Messages/ui/PlaceholderRow';
import SiblingSwitch from '~/components/Chat/Messages/SiblingSwitch';
import HoverButtons from '~/components/Chat/Messages/HoverButtons';
import MessageIcon from '~/components/Chat/Messages/MessageIcon';
import { useLocalize, useMessageActions, useContentMetadata } from '~/hooks';
import SubRow from '~/components/Chat/Messages/SubRow';
import { cn, getMessageAriaLabel } from '~/utils';
import { MessageContext } from '~/Providers';
import store from '~/store';

type MessageRenderProps = {
  message?: TMessage;
  isSubmitting?: boolean;
} & Pick<
  TMessageProps,
  'currentEditId' | 'setCurrentEditId' | 'siblingIdx' | 'setSiblingIdx' | 'siblingCount'
>;

const MessageRender = memo(
  ({
    message: msg,
    siblingIdx,
    siblingCount,
    setSiblingIdx,
    currentEditId,
    setCurrentEditId,
    isSubmitting = false,
  }: MessageRenderProps) => {
    const localize = useLocalize();
    const {
      ask,
      edit,
      index,
      agent,
      assistant,
      enterEdit,
      conversation,
      messageLabel,
      latestMessage,
      handleFeedback,
      handleContinue,
      copyToClipboard,
      regenerateMessage,
      feedback,
    } = useMessageActions({
      message: msg,
      currentEditId,
      setCurrentEditId,
    });
    const maximizeChatSpace = useRecoilValue(store.maximizeChatSpace);

    const handleRegenerateMessage = useCallback(() => regenerateMessage(), [regenerateMessage]);
    const hasNoChildren = !(msg?.children?.length ?? 0);
    const isLast = useMemo(
      () => hasNoChildren && (msg?.depth === latestMessage?.depth || msg?.depth === -1),
      [hasNoChildren, msg?.depth, latestMessage?.depth],
    );
    const isLatestMessage = msg?.messageId === latestMessage?.messageId;
    /** Only pass isSubmitting to the latest message to prevent unnecessary re-renders */
    const effectiveIsSubmitting = isLatestMessage ? isSubmitting : false;

    const iconData: TMessageIcon = useMemo(
      () => ({
        endpoint: msg?.endpoint ?? conversation?.endpoint,
        model: msg?.model ?? conversation?.model,
        iconURL: msg?.iconURL,
        modelLabel: messageLabel,
        isCreatedByUser: msg?.isCreatedByUser,
      }),
      [
        messageLabel,
        conversation?.endpoint,
        conversation?.model,
        msg?.model,
        msg?.iconURL,
        msg?.endpoint,
        msg?.isCreatedByUser,
      ],
    );

    const { hasParallelContent } = useContentMetadata(msg);

    if (!msg) {
      return null;
    }

    const getChatWidthClass = () => {
      if (maximizeChatSpace) {
        return 'w-full max-w-full md:px-5 lg:px-1 xl:px-5';
      }
      if (hasParallelContent) {
        return 'md:max-w-[58rem] xl:max-w-[70rem]';
      }
      return 'md:max-w-[47rem] xl:max-w-[55rem]';
    };

    const baseClasses = {
      common: 'group mx-auto flex flex-1 gap-3 transition-all duration-300 transform-gpu ',
      chat: getChatWidthClass(),
    };

    const conditionalClasses = {
      focus: 'focus:outline-none focus:ring-2 focus:ring-border-xheavy',
    };

    const isUser = msg.isCreatedByUser;

    // Avatars are hidden on mobile to save horizontal space in the chat
    // bubbles; they still show from the sm breakpoint up.
    const avatarBlock = !hasParallelContent && (
      <div className="relative hidden flex-shrink-0 flex-col items-center sm:flex">
        <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full">
          <MessageIcon iconData={iconData} assistant={assistant} agent={agent} />
        </div>
      </div>
    );

    const contentColumn = (
      <div
        className={cn(
          'relative flex min-w-0 flex-col',
          hasParallelContent ? 'w-full' : 'chat-bubble-col',
          isUser ? 'user-turn items-end' : 'agent-turn items-start',
        )}
      >
        <div className="flex min-w-0 flex-col gap-1">
          <div
            className={cn(
              'flex min-w-0 max-w-full flex-grow flex-col gap-0 overflow-hidden break-all',
              // AI bubble uses bg-surface-tertiary: in dark mode
              // surface-secondary is the exact same color as the page
              // background (presentation), so it was invisible there.
              // User bubble gets a slight green tint (the app's existing
              // brand-green scale, already used for badges elsewhere) so
              // it stays visually distinct from the AI bubble. green-600
              // at low opacity reads as a clear muted teal-green on the
              // dark background, unlike green-900 which was too close to
              // black to register as green.
              !hasParallelContent &&
                (isUser
                  ? 'rounded-2xl rounded-tr-sm px-4 py-2.5 bg-[oklch(0.8348_0.1302_160.908)] dark:bg-[oklch(0.4365_0.1044_156.7556)]'
                  : 'rounded-2xl rounded-tl-sm bg-gray-50 px-4 py-2.5 dark:bg-gray-900'),
            )}
          >
            <MessageContext.Provider
              value={{
                messageId: msg.messageId,
                conversationId: conversation?.conversationId,
                isExpanded: false,
                isSubmitting: effectiveIsSubmitting,
                isLatestMessage,
              }}
            >
              <MessageContent
                ask={ask}
                edit={edit}
                isLast={isLast}
                text={msg.text || ''}
                message={msg}
                enterEdit={enterEdit}
                error={!!(msg.error ?? false)}
                isSubmitting={effectiveIsSubmitting}
                unfinished={msg.unfinished ?? false}
                isCreatedByUser={msg.isCreatedByUser ?? true}
                siblingIdx={siblingIdx ?? 0}
                setSiblingIdx={setSiblingIdx ?? (() => ({}))}
              />
            </MessageContext.Provider>
          </div>
          {hasNoChildren && effectiveIsSubmitting ? (
            <PlaceholderRow />
          ) : (
            <SubRow classes={cn('text-xs', isUser && 'justify-end')}>
              <SiblingSwitch
                siblingIdx={siblingIdx}
                siblingCount={siblingCount}
                setSiblingIdx={setSiblingIdx}
              />
              <HoverButtons
                index={index}
                isEditing={edit}
                message={msg}
                enterEdit={enterEdit}
                isSubmitting={isSubmitting}
                conversation={conversation ?? null}
                regenerate={handleRegenerateMessage}
                copyToClipboard={copyToClipboard}
                handleContinue={handleContinue}
                latestMessage={latestMessage}
                handleFeedback={handleFeedback}
                isLast={isLast}
                feedback={feedback}
              />
            </SubRow>
          )}
        </div>
      </div>
    );

    return (
      <div
        id={msg.messageId}
        aria-label={getMessageAriaLabel(msg, localize)}
        className={cn(
          baseClasses.common,
          baseClasses.chat,
          conditionalClasses.focus,
          'message-render',
          !hasParallelContent && (isUser ? 'justify-end' : 'justify-start'),
        )}
      >
        {isUser ? (
          <>
            {contentColumn}
            {avatarBlock}
          </>
        ) : (
          <>
            {avatarBlock}
            {contentColumn}
          </>
        )}
      </div>
    );
  },
);

export default MessageRender;
