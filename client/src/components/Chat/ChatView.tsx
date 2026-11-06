import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { useForm } from 'react-hook-form';
import { Spinner } from '@librechat/client';
import { useParams } from 'react-router-dom';
import { Constants, buildTree } from 'librechat-data-provider';
import type { TMessage } from 'librechat-data-provider';
import type { ChatFormValues } from '~/common';
import {
  ChatContext,
  AddedChatContext,
  useFileMapContext,
  ChatFormProvider,
  MessagesViewProvider,
} from '~/Providers';
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
import FeedbackReminderPanel from './Messages/FeedbackReminderPanel';
import Presentation from './Presentation';
import ChatForm from './Input/ChatForm';
import Landing from './Landing';
import { EXAMPLE_QUESTIONS } from './exampleQuestions.config';
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
  const showExampleQuestions = isLandingPage && EXAMPLE_QUESTIONS.length > 0;

  /**
   * The composer overlays the message list, so the list needs bottom room equal to its height
   * or the newest message's action row ends up behind it. That height is not a constant —
   * Voice mode is much taller than Text, and Text grows as a draft wraps — so it is measured
   * rather than guessed.
   */
  const composerRef = useRef<HTMLDivElement>(null);
  const [composerHeight, setComposerHeight] = useState(0);
  const landingScrollRef = useRef<HTMLDivElement>(null);

  // Starts the landing content at the top so the greeting is visible. Something on load, such
  // as focusing the input, can otherwise leave the box scrolled to the bottom on phones.
  useEffect(() => {
    const element = landingScrollRef.current;
    if (!isLandingPage || !element) {
      return;
    }
    const resetScroll = () => {
      element.scrollTop = 0;
    };
    resetScroll();
    const frame = requestAnimationFrame(resetScroll);
    const timer = window.setTimeout(resetScroll, 300);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [isLandingPage]);

  useEffect(() => {
    const element = composerRef.current;
    if (!element || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(() => setComposerHeight(element.offsetHeight));
    observer.observe(element);
    return () => observer.disconnect();
  }, [isLandingPage]);

  if (isLoading && conversationId !== Constants.NEW_CONVO) {
    content = <LoadingSpinner />;
  } else if ((isLoading || isNavigating) && !isLandingPage) {
    content = <LoadingSpinner />;
  } else if (!isLandingPage) {
    content = <MessagesView messagesTree={messagesTree} bottomInset={composerHeight} />;
  } else {
    // The feedback reminder must also show on the landing page, otherwise a required-feedback
    // block on send fails silently there.
    content = (
      <MessagesViewProvider>
        <FeedbackReminderPanel onSubmitFeedback={() => {}} />
        <Landing centerFormOnLanding={centerFormOnLanding} hasContentBelow={showExampleQuestions} />
      </MessagesViewProvider>
    );
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
                      ? // The composer is pinned to the bottom of this box, just above the
                        // in-development notice that renders outside it, while the greeting,
                        // tagline and question cards centre in the space left above. From `sm`
                        // up the inner scroll box's bottom margin reserves that space, so the two
                        // can't overlap — driven by the composer's measured height below, since a
                        // fixed value is wrong for Voice mode, which is far taller than Text.
                        // Unlike a live conversation, the composer isn't fixed to the viewport
                        // on phones here — the notice has to sit below it, not behind it — so
                        // this applies at every width.
                        // The greeting and cards scroll inside their own box below, never this
                        // one, so the composer pinned here stays put while the cards scroll.
                        'relative flex min-h-0 flex-1 flex-col'
                      : // `relative` anchors the composer, which is pulled out of flow below
                        // so the message list can run its full height underneath it.
                        'relative min-h-0 flex-1 overflow-hidden',
                  )}
                  style={
                    isLandingPage && composerHeight
                      ? ({ '--composer-pad': `${composerHeight + 16}px` } as React.CSSProperties)
                      : undefined
                  }
                >
                  <div
                    ref={landingScrollRef}
                    className={
                      isLandingPage
                        ? // `safe center` centres the content when it fits and, when it is taller than
                          // the space available, grows downward and scrolls instead of spilling upward.
                          // The bottom edge fades out instead of cutting off.
                          // Phones: the box overlaps the top of the composer by 3.5rem (the negative
                          // margin) and the fade is 96px tall, so cards dissolve gradually behind the
                          // see-through Voice/Text switch. The bottom padding matches the fade so the last
                          // card can scroll fully clear.
                          // From `sm` up: the composer is absolutely positioned at the bottom, so the box
                          // ends just above it (the margin is the composer's measured height) and uses a
                          // short fade. The top padding keeps the greeting clear of the floating header
                          // and location pill.
                          '-mb-14 flex min-h-0 w-full flex-1 flex-col items-center justify-center [justify-content:safe_center] overflow-y-auto pb-24 pt-14 [-webkit-mask-image:linear-gradient(to_bottom,black_calc(100%_-_96px),transparent)] [mask-image:linear-gradient(to_bottom,black_calc(100%_-_96px),transparent)] sm:mb-[var(--composer-pad,11rem)] sm:pb-7 sm:pt-16 sm:[-webkit-mask-image:linear-gradient(to_bottom,black_calc(100%_-_28px),transparent)] sm:[mask-image:linear-gradient(to_bottom,black_calc(100%_-_28px),transparent)]'
                        : 'contents'
                    }
                  >
                  {content}
                  {/* Kept as a sibling of Landing rather than nested inside it: Landing's own
                      wrapper collapses to `max-h-0` on larger screens when centerFormOnLanding
                      is on, and content nested inside that box would render past its zero
                      height and get visually covered by ChatForm below. As a sibling, its
                      layout height is unaffected by that collapse. */}
                  {showExampleQuestions && <ExampleQuestionTiles />}
                  </div>
                  <div
                    ref={composerRef}
                    className={cn(
                      'w-full',
                      isLandingPage
                        ? 'relative z-10 mx-auto max-w-3xl shrink-0 transition-all duration-200 sm:absolute sm:inset-x-0 sm:bottom-0 xl:max-w-4xl'
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
