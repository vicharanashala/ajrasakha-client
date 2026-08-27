import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAtomValue } from 'jotai';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { CSSTransition } from 'react-transition-group';
import type { TMessage } from 'librechat-data-provider';
import { useScreenshot, useMessageScrolling, useLocalize } from '~/hooks';
import ScrollToBottom from '~/components/Messages/ScrollToBottom';
import { MessagesViewProvider } from '~/Providers';
import { fontSizeAtom } from '~/store/fontSize';
import MultiMessage from './MultiMessage';
import FeedbackReminderPanel from './FeedbackReminderPanel';
import { cn } from '~/utils';
import store from '~/store';

function MessagesViewContent({
  messagesTree: _messagesTree,
  bottomInset,
}: {
  messagesTree?: TMessage[] | null;
  bottomInset?: number;
}) {
  const localize = useLocalize();
  const fontSize = useAtomValue(fontSizeAtom);
  const { screenshotTargetRef } = useScreenshot();
  const scrollButtonPreference = useRecoilValue(store.showScrollButton);
  const [currentEditId, setCurrentEditId] = useState<number | string | null>(-1);
  const scrollToBottomRef = useRef<HTMLButtonElement>(null);
  /** Host node inside the composer strip (see ChatView). Rendering the button there keeps it
   *  above the input and the Voice/Text toggle instead of behind them; when the host is
   *  missing the button falls back to floating over the message list. */
  const [scrollButtonHost, setScrollButtonHost] = useState<Element | null>(null);

  useEffect(() => {
    setScrollButtonHost(document.getElementById('scroll-to-bottom-portal'));
  }, []);

  const {
    conversation,
    scrollableRef,
    messagesEndRef,
    showScrollButton,
    handleSmoothToRef,
    debouncedHandleScroll,
  } = useMessageScrolling(_messagesTree);

  const { conversationId } = conversation ?? {};

  const isScrollButtonVisible = showScrollButton && scrollButtonPreference;
  const setIsScrollToBottomVisible = useSetRecoilState(store.isScrollToBottomVisible);

  useEffect(() => {
    setIsScrollToBottomVisible(isScrollButtonVisible);
    return () => setIsScrollToBottomVisible(false);
  }, [isScrollButtonVisible, setIsScrollToBottomVisible]);

  const scrollButtonTransition = (
    <CSSTransition
      in={isScrollButtonVisible}
      timeout={{
        enter: 550,
        exit: 700,
      }}
      classNames="scroll-animation"
      unmountOnExit={true}
      appear={true}
      nodeRef={scrollToBottomRef}
    >
      {/* Dropped into the Voice/Text switch's own slot (the host is a zero-height line at the
          top of the composer, and that switch's row is ~40px tall below it) rather than
          floating above it: the switch fades out exactly when this arrow appears, so the two
          share one spot and crossfade in place instead of leaving a gap. Centred with
          `left-0 right-0 mx-auto` rather than a translate, so it lines up with the mic and
          the switch without fighting the enter/exit animations for the transform. */}
      <ScrollToBottom
        ref={scrollToBottomRef}
        scrollHandler={handleSmoothToRef}
        className={
          scrollButtonHost != null ? 'absolute -bottom-9 left-0 right-0 mx-auto' : undefined
        }
      />
    </CSSTransition>
  );

  return (
    <>
      <div className="relative flex-1 overflow-hidden overflow-y-auto">
        <FeedbackReminderPanel onSubmitFeedback={() => {}} />
        <div className="relative h-full">
          <div
            className="scrollbar-gutter-stable"
            onScroll={debouncedHandleScroll}
            ref={scrollableRef}
            style={{
              height: '100%',
              overflowY: 'auto',
              width: '100%',
            }}
          >
            {/* Clears the floating composer (see ChatView.tsx) so the last message and its
                action row scroll fully above it instead of being stuck underneath. Driven by
                the composer's measured height rather than fixed values, because that height
                varies a lot — Voice mode is far taller than Text, and Text itself grows as a
                draft wraps. The classes stay as the fallback for the first paint, before the
                measurement lands. */}
            <div
              className="flex flex-col pb-36 pt-14 dark:bg-transparent sm:pb-44"
              style={bottomInset ? { paddingBottom: bottomInset + 16 } : undefined}
            >
              {(_messagesTree && _messagesTree.length == 0) || _messagesTree === null ? (
                <div
                  className={cn(
                    'flex w-full items-center justify-center p-3 text-text-secondary',
                    fontSize,
                  )}
                >
                  {localize('com_ui_nothing_found')}
                </div>
              ) : (
                <>
                  <div ref={screenshotTargetRef}>
                    <MultiMessage
                      key={conversationId}
                      messagesTree={_messagesTree}
                      messageId={conversationId ?? null}
                      setCurrentEditId={setCurrentEditId}
                      currentEditId={currentEditId ?? null}
                    />
                  </div>
                </>
              )}
              <div
                id="messages-end"
                className="group h-0 w-full flex-shrink-0"
                ref={messagesEndRef}
              />
            </div>
          </div>

          {scrollButtonHost == null && scrollButtonTransition}
        </div>
      </div>
      {scrollButtonHost != null && createPortal(scrollButtonTransition, scrollButtonHost)}
    </>
  );
}

export default function MessagesView({
  messagesTree,
  bottomInset,
}: {
  messagesTree?: TMessage[] | null;
  /** Height of the composer overlaying the list, in px. */
  bottomInset?: number;
}) {
  return (
    <MessagesViewProvider>
      <MessagesViewContent messagesTree={messagesTree} bottomInset={bottomInset} />
    </MessagesViewProvider>
  );
}
