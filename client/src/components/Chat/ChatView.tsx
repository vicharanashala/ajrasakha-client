import { memo, useCallback, useEffect } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { useForm } from 'react-hook-form';
import { Spinner } from '@librechat/client';
import { useParams } from 'react-router-dom';
import { Constants, buildTree } from 'librechat-data-provider';
import type { TMessage } from 'librechat-data-provider';
import type { ChatFormValues } from '~/common';
import { ChatContext, AddedChatContext, useFileMapContext, ChatFormProvider } from '~/Providers';
import {
  useResumableStreamToggle,
  useAddedResponse,
  useResumeOnLoad,
  useAdaptiveSSE,
  useChatHelpers,
} from '~/hooks';
import ConversationStarters from './Input/ConversationStarters';
import { useGetMessagesByConvoId } from '~/data-provider';
import MessagesView from './Messages/MessagesView';
import Presentation from './Presentation';
import ChatForm from './Input/ChatForm';
import Landing from './Landing';
import Header from './Header';
import Footer from './Footer';
import { cn } from '~/utils';
import store from '~/store';
import { requiresFeedbackFromConversation } from '~/utils/requiresFeedback';


function LoadingSpinner() {
  return (
    <div className="relative flex-1 overflow-hidden overflow-y-auto">
      <div className="relative flex h-full items-center justify-center">
        <Spinner className="text-text-primary" />
      </div>
    </div>
  );
}

function ChatView({ index = 0 }: { index?: number }) {
  const { conversationId } = useParams();
  const rootSubmission = useRecoilValue(store.submissionByIndex(index));
  const centerFormOnLanding = useRecoilValue(store.centerFormOnLanding);

  const fileMap = useFileMapContext();

  const { data: messagesTree = null, isLoading } = useGetMessagesByConvoId(conversationId ?? '', {
    select: useCallback(
      (data: TMessage[]) => {
        const dataTree = buildTree({ messages: data, fileMap });
        return dataTree?.length === 0 ? null : (dataTree ?? null);
      },
      [fileMap],
    ),
    enabled: !!fileMap,
  });

  const chatHelpers = useChatHelpers(index, conversationId);
  const addedChatHelpers = useAddedResponse();

  useResumableStreamToggle(
    chatHelpers.conversation?.endpoint,
    chatHelpers.conversation?.endpointType,
  );

  useAdaptiveSSE(rootSubmission, chatHelpers, false, index);

  // Auto-resume if navigating back to conversation with active job
  // Wait for messages to load before resuming to avoid race condition
  useResumeOnLoad(conversationId, chatHelpers.getMessages, index, !isLoading);

  // Check for feedback requirement on initial page load (only once, not on message streaming updates)
  const setShowFeedbackReminder = useSetRecoilState(store.showFeedbackReminder);

  useEffect(() => {
    // Capture conversationId at effect creation time; avoid checking stale IDs after navigation
    const convoId = conversationId;

    if (
      !isLoading &&
      convoId &&
      convoId !== Constants.NEW_CONVO &&
      messagesTree &&
      messagesTree.length > 0
    ) {
      const findLatestAssistantMessage = (msgs: TMessage[]): TMessage | null => {
        for (let i = msgs.length - 1; i >= 0; i--) {
          if (!msgs[i].isCreatedByUser) {
            return msgs[i];
          }
        }
        return null;
      };

      const flattenMessages = (tree: TMessage[]): TMessage[] => {
        const result: TMessage[] = [];
        const traverse = (nodes: TMessage[]) => {
          for (const node of nodes) {
            result.push(node);
            if (node.children && node.children.length > 0) {
              traverse(node.children);
            }
          }
        };
        traverse(tree);
        return result;
      };

      const allMessages = flattenMessages(messagesTree);
      const latestAssistantMessage = findLatestAssistantMessage(allMessages);

      requiresFeedbackFromConversation(convoId).then((toolCalled) => {
        if (toolCalled && latestAssistantMessage && !latestAssistantMessage.feedback) {
          setShowFeedbackReminder(true);
        }
      });
    }
    // Empty deps: intentionally run only once on component mount.
    // messagesTree is NOT included — we only care about the snapshot at mount time,
    // not subsequent updates from streaming LLM responses.
    // conversationId and isLoading are also intentionally omitted to prevent re-runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // eslint-disable-line react-hooks/rules-of-hooks

  const methods = useForm<ChatFormValues>({
    defaultValues: { text: '' },
  });

  let content: JSX.Element | null | undefined;
  const isLandingPage =
    (!messagesTree || messagesTree.length === 0) &&
    (conversationId === Constants.NEW_CONVO || !conversationId);
  const isNavigating = (!messagesTree || messagesTree.length === 0) && conversationId != null;

  if (isLoading && conversationId !== Constants.NEW_CONVO) {
    content = <LoadingSpinner />;
  } else if ((isLoading || isNavigating) && !isLandingPage) {
    content = <LoadingSpinner />;
  } else if (!isLandingPage) {
    content = <MessagesView messagesTree={messagesTree} />;
  } else {
    content = <Landing centerFormOnLanding={centerFormOnLanding} />;
  }

  return (
    <ChatFormProvider {...methods}>
      <ChatContext.Provider value={chatHelpers}>
        <AddedChatContext.Provider value={addedChatHelpers}>
          <Presentation>
            <div className="relative flex h-full w-full flex-col">
              {!isLoading && <Header />}
              <>
                <div
                  className={cn(
                    'flex flex-col',
                    isLandingPage
                      ? 'flex-1 items-center justify-end sm:justify-center'
                      : 'h-full overflow-y-auto',
                  )}
                >
                  {content}
                  <div
                    className={cn(
                      'w-full',
                      isLandingPage && 'max-w-3xl transition-all duration-200 xl:max-w-4xl',
                    )}
                  >
                    <ChatForm index={index} />
                    {isLandingPage ? <ConversationStarters /> : <Footer />}
                  </div>
                </div>
                {isLandingPage && <Footer />}
              </>
            </div>
          </Presentation>
        </AddedChatContext.Provider>
      </ChatContext.Provider>
    </ChatFormProvider>
  );
}

export default memo(ChatView);
