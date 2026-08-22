import { useCallback, useMemo, memo } from 'react';
import { useRecoilValue } from 'recoil';
import type { TMessage, TMessageContentParts } from 'librechat-data-provider';
import type { TMessageProps, TMessageIcon } from '~/common';
import { useAttachments, useLocalize, useMessageActions, useContentMetadata } from '~/hooks';
import ContentParts from '~/components/Chat/Messages/Content/ContentParts';
import PlaceholderRow from '~/components/Chat/Messages/ui/PlaceholderRow';
import SiblingSwitch from '~/components/Chat/Messages/SiblingSwitch';
import HoverButtons from '~/components/Chat/Messages/HoverButtons';
import MessageIcon from '~/components/Chat/Messages/MessageIcon';
import SubRow from '~/components/Chat/Messages/SubRow';
import { cn, getMessageAriaLabel } from '~/utils';
import store from '~/store';

type ContentRenderProps = {
  message?: TMessage;
  isSubmitting?: boolean;
} & Pick<
  TMessageProps,
  'currentEditId' | 'setCurrentEditId' | 'siblingIdx' | 'setSiblingIdx' | 'siblingCount'
>;

const ContentRender = memo(
  ({
    message: msg,
    siblingIdx,
    siblingCount,
    setSiblingIdx,
    currentEditId,
    setCurrentEditId,
    isSubmitting = false,
  }: ContentRenderProps) => {
    const localize = useLocalize();
    const { attachments, searchResults } = useAttachments({
      messageId: msg?.messageId,
      attachments: msg?.attachments,
    });
    const {
      edit,
      index,
      agent,
      assistant,
      enterEdit,
      conversation,
      messageLabel,
      latestMessage,
      handleContinue,
      handleFeedback,
      copyToClipboard,
      regenerateMessage,
    } = useMessageActions({
      message: msg,
      searchResults,
      currentEditId,
      setCurrentEditId,
    });
    const maximizeChatSpace = useRecoilValue(store.maximizeChatSpace);

    const handleRegenerateMessage = useCallback(() => regenerateMessage(), [regenerateMessage]);
    const isLast = useMemo(
      () =>
        !(msg?.children?.length ?? 0) && (msg?.depth === latestMessage?.depth || msg?.depth === -1),
      [msg?.children, msg?.depth, latestMessage?.depth],
    );
    const hasNoChildren = !(msg?.children?.length ?? 0);
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
      common: 'group mx-auto flex flex-1 gap-2 sm:gap-3 transition-all duration-300 transform-gpu ',
      chat: getChatWidthClass(),
    };

    const conditionalClasses = {
      focus: 'focus:outline-none focus:ring-2 focus:ring-border-xheavy',
    };

    const isUser = msg.isCreatedByUser;

    // True while the bubble is showing the "still working on it..." status
    // (no content parts have streamed in yet) — same condition ContentParts
    // uses internally to decide whether to render the loading text. Drives
    // the animated gradient-border treatment on the bubble itself, below.
    const contentLength = (msg.content as Array<TMessageContentParts | undefined> | undefined)
      ?.length ?? 0;
    const isEmptyLoading = !isUser && contentLength === 0 && effectiveIsSubmitting;

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
          hasParallelContent ? 'w-full' : 'w-fit max-w-[85%] sm:max-w-[75%]',
          isUser ? 'user-turn items-end' : 'agent-turn items-start',
        )}
      >
        <div className="flex min-w-0 flex-col gap-1">
          <div
            className={cn(
              'flex min-w-0 max-w-full flex-grow flex-col gap-0',
              // AI bubble uses bg-surface-tertiary: in dark mode
              // surface-secondary is the exact same color as the page
              // background (presentation), so it was invisible there.
              // User bubble gets a slight green tint (the app's existing
              // brand-green scale, already used for badges elsewhere) so
              // it stays visually distinct from the AI bubble.
              !hasParallelContent &&
                (isUser
                  ? 'rounded-2xl rounded-tr-sm bg-green-100 px-4 py-2.5 dark:bg-green-600/25'
                  : 'rounded-2xl rounded-tl-sm bg-surface-tertiary px-4 py-2.5'),
              isEmptyLoading && 'ajrasakha-orbit-bubble',
            )}
          >
            <ContentParts
              edit={edit}
              isLast={isLast}
              enterEdit={enterEdit}
              siblingIdx={siblingIdx}
              messageId={msg.messageId}
              attachments={attachments}
              searchResults={searchResults}
              setSiblingIdx={setSiblingIdx}
              isLatestMessage={isLatestMessage}
              isSubmitting={effectiveIsSubmitting}
              isCreatedByUser={msg.isCreatedByUser}
              conversationId={conversation?.conversationId}
              content={msg.content as Array<TMessageContentParts | undefined>}
            />
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
                message={msg}
                isEditing={edit}
                enterEdit={enterEdit}
                isSubmitting={isSubmitting}
                conversation={conversation ?? null}
                regenerate={handleRegenerateMessage}
                copyToClipboard={copyToClipboard}
                handleContinue={handleContinue}
                latestMessage={latestMessage}
                handleFeedback={handleFeedback}
                isLast={isLast}
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

export default ContentRender;
