import { memo, useCallback } from 'react';
import { useRecoilValue } from 'recoil';
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
import ExampleQuestionTiles from './ExampleQuestionTiles';
import MessagesView from './Messages/MessagesView';
import Presentation from './Presentation';
import ChatForm from './Input/ChatForm';
import Landing from './Landing';
import Header from './Header';
import Footer from './Footer';
import { cn } from '~/utils';
import store from '~/store';

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
            <div className="relative flex min-h-0 w-full flex-1 flex-col">
              {!isLoading && <Header />}
              <>
                <div
                  className={cn(
                    'flex flex-col',
                    isLandingPage
                      ?
                        'flex-1 items-center justify-center overflow-y-auto'
                      : // `relative` anchors the composer, which is pulled out of flow below
                        // so the message list can run its full height underneath it.
                        'relative min-h-0 flex-1 overflow-hidden',
                  )}
                >
                  {content}
                  {/* Kept as a sibling of Landing rather than nested inside it: Landing's own
                      wrapper collapses to `max-h-0` on larger screens when centerFormOnLanding
                      is on, and content nested inside that box would render past its zero
                      height and get visually covered by ChatForm below. As a sibling, its
                      layout height is unaffected by that collapse. */}
                  {isLandingPage && <ExampleQuestionTiles />}
                  <div
                    className={cn(
                      'w-full',
                      isLandingPage
                        ? 'max-w-3xl transition-all duration-200 xl:max-w-4xl'
                        : // The composer floats over the message list rather than sitting in
                          // normal flow, so messages can scroll a full screen's worth behind
                          // it instead of stopping at a hard edge above it. Its own backdrop
                          // is a gradient that fades from the page background at the bottom
                          // to fully transparent at the top, mirroring the Header's gradient
                          // above but pointing the other way: content stays visible as it
                          // passes behind the composer and mic, then dissolves out. The top
                          // padding gives that fade room without moving the input. Fixed to
                          // the viewport on mobile; absolute within the content column at sm+,
                          // where the sidebar means viewport-width positioning would be wrong.
                          cn(
                            'fixed inset-x-0 bottom-0 z-20 pt-6',
                            'bg-gradient-to-t from-presentation via-presentation/85 to-transparent',
                            'sm:absolute sm:pt-8',
                          ),
                    )}
                  >
                    {/* Zero-height host for the scroll-to-bottom button (portaled in from
                        MessagesView). Living inside the composer strip keeps the button
                        clear of the input and mic in both modes, whatever height the
                        composer happens to be; `h-0` keeps it from shifting the input when
                        the button appears. */}
                    <div id="scroll-to-bottom-portal" className="relative z-30 h-0 w-full" />
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
