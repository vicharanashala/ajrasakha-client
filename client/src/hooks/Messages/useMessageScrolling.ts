import { useRecoilValue } from 'recoil';
import { Constants } from 'librechat-data-provider';
import { useState, useRef, useCallback, useEffect } from 'react';
import type { TMessage } from 'librechat-data-provider';
import { useMessagesConversation, useMessagesSubmission } from '~/Providers';
import useScrollToRef from '~/hooks/useScrollToRef';
import store from '~/store';

const threshold = 0.85;
const debounceRate = 150;

export default function useMessageScrolling(messagesTree?: TMessage[] | null) {
  const autoScroll = useRecoilValue(store.autoScroll);

  const scrollableRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const { conversation, conversationId } = useMessagesConversation();
  const { setAbortScroll, isSubmitting, abortScroll } = useMessagesSubmission();

  const timeoutIdRef = useRef<NodeJS.Timeout>();

  const debouncedSetShowScrollButton = useCallback((value: boolean) => {
    clearTimeout(timeoutIdRef.current);
    timeoutIdRef.current = setTimeout(() => {
      setShowScrollButton(value);
    }, debounceRate);
  }, []);

  useEffect(() => {
    if (!messagesEndRef.current || !scrollableRef.current) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        debouncedSetShowScrollButton(!entry.isIntersecting);
      },
      { root: scrollableRef.current, threshold },
    );

    observer.observe(messagesEndRef.current);

    return () => {
      observer.disconnect();
      clearTimeout(timeoutIdRef.current);
    };
  }, [messagesEndRef, scrollableRef, debouncedSetShowScrollButton]);

  const debouncedHandleScroll = useCallback(() => {
    if (messagesEndRef.current && scrollableRef.current) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          debouncedSetShowScrollButton(!entry.isIntersecting);
        },
        { root: scrollableRef.current, threshold },
      );
      observer.observe(messagesEndRef.current);
      return () => observer.disconnect();
    }
  }, [debouncedSetShowScrollButton]);

  const scrollCallback = () => debouncedSetShowScrollButton(false);

  const { scrollToRef: scrollToBottom, handleSmoothToRef } = useScrollToRef({
    targetRef: messagesEndRef,
    callback: scrollCallback,
    smoothCallback: () => {
      scrollCallback();
      setAbortScroll(false);
    },
  });

  useEffect(() => {
    if (!messagesTree || messagesTree.length === 0) {
      return;
    }

    if (!messagesEndRef.current || !scrollableRef.current) {
      return;
    }

    if (isSubmitting && scrollToBottom && abortScroll !== true) {
      scrollToBottom();
    }

    return () => {
      if (abortScroll === true) {
        scrollToBottom && scrollToBottom.cancel();
      }
    };
  }, [isSubmitting, messagesTree, scrollToBottom, abortScroll]);

  useEffect(() => {
    if (!messagesEndRef.current || !scrollableRef.current) {
      return;
    }

    if (scrollToBottom && autoScroll && conversationId !== Constants.NEW_CONVO) {
      scrollToBottom();
    }
  }, [autoScroll, conversationId, scrollToBottom]);

  /**
   * Land on the newest message the first time a conversation renders — after a refresh, or
   * when opening one from the list. The effect above only does this when the `autoScroll`
   * preference is on (it defaults to off), which left a reload sitting at the top of a long
   * thread. Guarded per conversation id so it fires once on load and never yanks a user who
   * has since scrolled up; it waits for the tree because the scroll target has no position
   * until the messages have rendered.
   */
  const initialScrollConvoRef = useRef<string | null>(null);
  useEffect(() => {
    if (!messagesTree || messagesTree.length === 0) {
      return;
    }

    if (!messagesEndRef.current || !scrollableRef.current || !scrollToBottom) {
      return;
    }

    if (conversationId == null || conversationId === Constants.NEW_CONVO) {
      return;
    }

    if (initialScrollConvoRef.current === conversationId) {
      return;
    }

    initialScrollConvoRef.current = conversationId;
    scrollToBottom();
  }, [conversationId, messagesTree, scrollToBottom]);

  return {
    conversation,
    scrollableRef,
    messagesEndRef,
    scrollToBottom,
    showScrollButton,
    handleSmoothToRef,
    debouncedHandleScroll,
  };
}
