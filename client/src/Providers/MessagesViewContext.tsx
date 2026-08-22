import React, {
  createContext,
  useContext,
  useMemo,
  useEffect,
  useCallback,
  useRef,
  useState,
} from 'react';
import { useUpdateFeedbackMutation } from 'librechat-data-provider/react-query';
import {
  Constants,
  TFeedback,
  getTagByKey,
  toMinimalFeedback,
  TUpdateFeedbackRequest,
} from 'librechat-data-provider';
import { useChatContext } from './ChatContext';
import { requiresFeedbackFromConversation } from '~/utils/requiresFeedback';
import store from '~/store';
import { useRecoilState } from 'recoil';

interface MessagesViewContextValue {
  /** Core conversation data */
  conversation: ReturnType<typeof useChatContext>['conversation'];
  conversationId: string | null | undefined;

  /** Submission and control states */
  isSubmitting: ReturnType<typeof useChatContext>['isSubmitting'];
  abortScroll: ReturnType<typeof useChatContext>['abortScroll'];
  setAbortScroll: ReturnType<typeof useChatContext>['setAbortScroll'];

  /** Message operations */
  ask: ReturnType<typeof useChatContext>['ask'];
  regenerate: ReturnType<typeof useChatContext>['regenerate'];
  handleContinue: ReturnType<typeof useChatContext>['handleContinue'];

  /** Message state management */
  index: ReturnType<typeof useChatContext>['index'];
  latestMessage: ReturnType<typeof useChatContext>['latestMessage'];
  setLatestMessage: ReturnType<typeof useChatContext>['setLatestMessage'];
  getMessages: ReturnType<typeof useChatContext>['getMessages'];
  setMessages: ReturnType<typeof useChatContext>['setMessages'];

  /** Feedback submission */
  submitFeedback?: (opts: { feedback?: TFeedback }) => void;
  showFeedbackReminder: boolean;
}

const MessagesViewContext = createContext<MessagesViewContextValue | undefined>(undefined);

// Export the context so it can be provided by other providers (e.g., ShareMessagesProvider)
export { MessagesViewContext };
export type { MessagesViewContextValue };

export function MessagesViewProvider({ children }: { children: React.ReactNode }) {
  const chatContext = useChatContext();

  const {
    ask,
    index,
    regenerate,
    isSubmitting,
    conversation,
    latestMessage,
    setAbortScroll,
    handleContinue,
    setLatestMessage,
    abortScroll,
    getMessages,
    setMessages,
  } = chatContext;

  // --- Feedback Tracker ---
  // Watches isSubmitting transitions: true→false means an LLM response just completed.
  // After a 2-second wait, we call the required-feedback API and store the result.
  // Initialise from localStorage on first mount so conversation switches restore the state.
  const [isRequiredFeedback, setIsRequiredFeedback] = useRecoilState(store.isRequiredFeedback);
  const [showFeedbackReminder] = useRecoilState(store.showFeedbackReminder);
  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    if (initialized) {
      return;
    }
    try {
      const stored = localStorage.getItem('isRequiredFeedback');
      if (stored !== null) {
        setIsRequiredFeedback(stored === 'true');
      }
    } catch {
      // ignore localStorage errors
    }
    setInitialized(true);
  }, [initialized, setIsRequiredFeedback]);
  const [wasSubmitting, setWasSubmitting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const conversationIdRef = useRef<string | null | undefined>(undefined);

  // Keep conversationId ref in sync; cancel pending timer on conversation change
  useEffect(() => {
    conversationIdRef.current = conversation?.conversationId;
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, [conversation?.conversationId]);

  // Detect isSubmitting transition: true → false (LLM response completed)
  useEffect(() => {
    console.log(`[Feedback] useEffect fired — isSubmitting=${isSubmitting}, wasSubmitting=${wasSubmitting}, convoId=${conversation?.conversationId}`);
    if (wasSubmitting && !isSubmitting) {
      const convoId = conversationIdRef.current;
      console.log(`[Feedback] Detected true→false transition, convoId=${convoId}`);
      if (!convoId || convoId === Constants.NEW_CONVO) {
        console.log(`[Feedback] Skipping — invalid convoId: ${convoId}`);
        setWasSubmitting(false);
        return;
      }
      // Cancel any previous pending timer
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(async () => {
        timerRef.current = null;
        console.log(`[Feedback] Timer fired — calling required-feedback API for conversation: ${convoId}`);
        const result = await requiresFeedbackFromConversation(convoId);
        console.log(`[Feedback] API returned: ${result} for conversation: ${convoId}`);
        localStorage.setItem('isRequiredFeedback', JSON.stringify(result));
        console.log(`[Feedback] Wrote to localStorage: isRequiredFeedback = ${result}`);
      }, 0);
    }
    setWasSubmitting(isSubmitting);
  }, [isSubmitting, wasSubmitting, setIsRequiredFeedback, conversation?.conversationId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);
  // --- End Feedback Tracker ---

  // --- Feedback Submission (Modal 1 / FeedbackReminderPanel) ---
  // PUT /api/messages/:conversationId/:messageId/feedback, keyed to the
  // conversation's last message — this reminder isn't tied to any one
  // message on screen, so it always records feedback against the most
  // recent message in the conversation (mirrors per-message feedback in
  // useMessageActions, which keys off the specific message being rated).
  const feedbackMutation = useUpdateFeedbackMutation(
    conversation?.conversationId ?? '',
    latestMessage?.messageId ?? '',
  );

  const submitFeedback = useCallback(
    ({ feedback }: { feedback?: TFeedback }) => {
      const normalizedFeedback = feedback
        ? {
            ...feedback,
            tag: typeof feedback.tag === 'string' ? getTagByKey(feedback.tag) : feedback.tag,
          }
        : undefined;
      const payload: TUpdateFeedbackRequest = {
        feedback: feedback ? toMinimalFeedback(normalizedFeedback) : undefined,
      };

      feedbackMutation.mutate(payload, {
        onError: (error) => {
          console.error('Failed to submit feedback:', error);
        },
      });
    },
    [feedbackMutation],
  );
  // --- End Feedback Submission ---

  /** Memoize conversation-related values */
  const conversationValues = useMemo(
    () => ({
      conversation,
      conversationId: conversation?.conversationId,
    }),
    [conversation],
  );

  /** Memoize submission states */
  const submissionStates = useMemo(
    () => ({
      abortScroll,
      isSubmitting,
      setAbortScroll,
      showFeedbackReminder,
    }),
    [isSubmitting, abortScroll, setAbortScroll, showFeedbackReminder],
  );

  /** Memoize message operations (these are typically stable references) */
  const messageOperations = useMemo(
    () => ({
      ask,
      regenerate,
      getMessages,
      setMessages,
      handleContinue,
    }),
    [ask, regenerate, handleContinue, getMessages, setMessages],
  );

  /** Memoize message state values */
  const messageState = useMemo(
    () => ({
      index,
      latestMessage,
      setLatestMessage,
    }),
    [index, latestMessage, setLatestMessage],
  );

  /** Memoize feedback operations */
  const feedbackOperations = useMemo(
    () => ({
      submitFeedback,
    }),
    [submitFeedback],
  );

  /** Combine all values into final context value */
  const contextValue = useMemo<MessagesViewContextValue>(
    () => ({
      ...conversationValues,
      ...submissionStates,
      ...messageOperations,
      ...messageState,
      ...feedbackOperations,
    }),
    [conversationValues, submissionStates, messageOperations, messageState, feedbackOperations],
  );

  return (
    <MessagesViewContext.Provider value={contextValue}>{children}</MessagesViewContext.Provider>
  );
}

export function useMessagesViewContext() {
  const context = useContext(MessagesViewContext);
  if (!context) {
    throw new Error('useMessagesViewContext must be used within MessagesViewProvider');
  }
  return context;
}

/** Hook for components that only need conversation data */
export function useMessagesConversation() {
  const { conversation, conversationId } = useMessagesViewContext();
  return useMemo(() => ({ conversation, conversationId }), [conversation, conversationId]);
}

/** Hook for components that only need submission states */
export function useMessagesSubmission() {
  const { isSubmitting, abortScroll, setAbortScroll } = useMessagesViewContext();
  return useMemo(
    () => ({ isSubmitting, abortScroll, setAbortScroll }),
    [isSubmitting, abortScroll, setAbortScroll],
  );
}

/** Hook for components that only need message operations */
export function useMessagesOperations() {
  const { ask, regenerate, handleContinue, getMessages, setMessages } = useMessagesViewContext();
  return useMemo(
    () => ({ ask, regenerate, handleContinue, getMessages, setMessages }),
    [ask, regenerate, handleContinue, getMessages, setMessages],
  );
}

/** Hook for components that only need message state */
export function useMessagesState() {
  const { index, latestMessage, setLatestMessage } = useMessagesViewContext();
  return useMemo(
    () => ({ index, latestMessage, setLatestMessage }),
    [index, latestMessage, setLatestMessage],
  );
}