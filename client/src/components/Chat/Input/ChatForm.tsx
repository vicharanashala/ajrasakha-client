import { memo, useRef, useMemo, useEffect, useLayoutEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Plus, X, Mic, Keyboard } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useWatch } from 'react-hook-form';
import { TextareaAutosize, useMediaQuery, Spinner } from '@librechat/client';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';
import { Constants, isAssistantsEndpoint, isAgentsEndpoint } from 'librechat-data-provider';
import {
  useChatContext,
  useChatFormContext,
  useAddedChatContext,
  useAssistantsMapContext,
} from '~/Providers';
import {
  useTextarea,
  useAutoSave,
  useLocalize,
  useRequiresKey,
  useHandleKeyUp,
  useQueryParams,
  useSubmitMessage,
  useFocusChatEffect,
} from '~/hooks';
import { mainTextareaId, BadgeItem, TAskProps } from '~/common';
import ModelSelector from '../Menus/Endpoints/ModelSelector';
import AttachFileChat from './Files/AttachFileChat';
import FileFormChat from './Files/FileFormChat';
import { useGetStartupConfig } from '~/data-provider';
import { cn, removeFocusRings } from '~/utils';
import TextareaHeader from './TextareaHeader';
import PromptsCommand from './PromptsCommand';
import AudioRecorder from './AudioRecorder';
import CollapseChat from './CollapseChat';
import StreamAudio from './StreamAudio';
import StopButton from './StopButton';
import SendButton from './SendButton';
import EditBadges from './EditBadges';
import BadgeRow from './BadgeRow';
import Mention from './Mention';
import store from '~/store';

/** Formats a whole number of seconds as mm:ss for the listening timer. */
const formatListeningDuration = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
};

type InputMode = 'voice' | 'type';

const INPUT_MODE_TABS: ReadonlyArray<{ mode: InputMode; label: string; Icon: typeof Mic }> = [
  { mode: 'voice', label: 'Voice', Icon: Mic },
  { mode: 'type', label: 'Text', Icon: Keyboard },
];

/** Segmented Voice/Text switch shown above the composer in both input modes. */
const InputModeToggle = memo(
  ({
    inputMode,
    setInputMode,
  }: {
    inputMode: InputMode;
    setInputMode: React.Dispatch<React.SetStateAction<InputMode>>;
  }) => (
    <div
      role="tablist"
      aria-label="Input mode"
      className="flex shrink-0 items-center gap-0.5 rounded-full bg-surface-secondary p-1"
    >
      {INPUT_MODE_TABS.map(({ mode, label, Icon }) => {
        const isActive = inputMode === mode;
        return (
          <button
            key={mode}
            type="button"
            role="tab"
            aria-selected={isActive}
            title={label}
            onClick={() => setInputMode(mode)}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium',
              'transition-colors duration-200 motion-reduce:transition-none',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-medium',
              isActive
                ? 'bg-surface-tertiary-alt text-green-500 shadow-sm dark:text-green-400'
                : 'text-text-secondary hover:text-text-primary',
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  ),
);

const ChatForm = memo(({ index = 0 }: { index?: number }) => {
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  useFocusChatEffect(textAreaRef);
  const localize = useLocalize();
  const { data: startupConfig } = useGetStartupConfig();
  const isSmallScreen = useMediaQuery('(max-width: 768px)');

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [, setIsScrollable] = useState(false);
  const [visualRowCount, setVisualRowCount] = useState(1);
  const [isTextAreaFocused, setIsTextAreaFocused] = useState(false);
  const [backupBadges, setBackupBadges] = useState<Pick<BadgeItem, 'id'>[]>([]);
  const [showLeftOptions, setShowLeftOptions] = useState(false);
  /** Which input mode is active by default: Voice on mobile, Type on larger screens.
   *  Still switches to Type once the user stops recording, on either size. */
  const [inputMode, setInputMode] = useState<InputMode>(() => (isSmallScreen ? 'voice' : 'type'));
  /** Whether the mic is actively listening, to drive the "speaking now" animation. */
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  /** Whether a transcript is still being produced (e.g. an external STT round-trip) after the
   *  user has stopped recording. Kept separate from isVoiceListening so the UI can show a
   *  distinct "converting speech to text" state instead of an empty Type tab. */
  const [isTranscribing, setIsTranscribing] = useState(false);
  /** Set when the user taps stop; the actual switch to Type mode waits for isTranscribing to
   *  clear, so we never land on an empty textarea before the transcript is ready. */
  const [pendingVoiceStop, setPendingVoiceStop] = useState(false);
  /** Elapsed seconds since listening started, shown as a running timer next to the equalizer. */
  const [listeningDuration, setListeningDuration] = useState(0);

  useEffect(() => {
    if (!isVoiceListening) {
      setListeningDuration(0);
      return;
    }
    const startedAt = Date.now();
    setListeningDuration(0);
    const interval = setInterval(() => {
      setListeningDuration(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [isVoiceListening]);

  useEffect(() => {
    if (pendingVoiceStop && !isTranscribing && inputMode === 'voice') {
      setPendingVoiceStop(false);
      setInputMode('type');
    }
  }, [pendingVoiceStop, isTranscribing, inputMode]);

  /**
   * Refs + measured-height state used to animate the Type/Voice panel swap smoothly. Both
   * panels stay mounted (absolutely positioned, stacked on top of each other) so they can
   * crossfade via opacity, while this wrapper's own height is set explicitly from the
   * ACTIVE panel's real `scrollHeight` and transitions between the old and new value. That
   * keeps each mode at its own natural height — Type stays as compact as it's always been,
   * Voice stays its own size — instead of the wrapper getting stuck at the height of
   * whichever panel is taller (which is what a CSS Grid overlap approach does, and why Type
   * mode looked taller than it should). A ResizeObserver keeps re-measuring the active
   * panel so its own internal height changes (the textarea growing as you type, the
   * equalizer/timer appearing while listening) also animate smoothly instead of jumping.
   */
  const typePanelRef = useRef<HTMLDivElement>(null);
  const voicePanelRef = useRef<HTMLDivElement>(null);
  const [panelsHeight, setPanelsHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const activeEl = inputMode === 'voice' ? voicePanelRef.current : typePanelRef.current;
    if (!activeEl) {
      return;
    }
    // Synchronous initial measurement (before paint) avoids a flash of the wrong height;
    // the ResizeObserver below then keeps it accurate as the active panel's content changes.
    setPanelsHeight(activeEl.scrollHeight);
    const observer = new ResizeObserver(() => {
      setPanelsHeight(activeEl.scrollHeight);
    });
    observer.observe(activeEl);
    return () => observer.disconnect();
  }, [inputMode]);

  // Location access state
  const [position, setPosition] = useState<TAskProps['position'] | null>(null);
  const [locationAllowed, setLocationAllowed] = useState(false);

  const SpeechToText = useRecoilValue(store.speechToText);
  const TextToSpeech = useRecoilValue(store.textToSpeech);
  const chatDirection = useRecoilValue(store.chatDirection);
  const automaticPlayback = useRecoilValue(store.automaticPlayback);
  const maximizeChatSpace = useRecoilValue(store.maximizeChatSpace);
  const centerFormOnLanding = useRecoilValue(store.centerFormOnLanding);
  const isTemporary = useRecoilValue(store.isTemporary);

  const [badges, setBadges] = useRecoilState(store.chatBadges);
  const [isEditingBadges, setIsEditingBadges] = useRecoilState(store.isEditingBadges);
  const [showStopButton, setShowStopButton] = useRecoilState(store.showStopButtonByIndex(index));
  const [showPlusPopover, setShowPlusPopover] = useRecoilState(store.showPlusPopoverFamily(index));
  const [showMentionPopover, setShowMentionPopover] = useRecoilState(
    store.showMentionPopoverFamily(index),
  );

  const { requiresKey } = useRequiresKey();
  const methods = useChatFormContext();
  const {
    files,
    setFiles,
    conversation,
    isSubmitting,
    filesLoading,
    newConversation,
    handleStopGenerating,
  } = useChatContext();
  const {
    generateConversation,
    conversation: addedConvo,
    setConversation: setAddedConvo,
  } = useAddedChatContext();
  const assistantMap = useAssistantsMapContext();

  const endpoint = useMemo(
    () => conversation?.endpointType ?? conversation?.endpoint,
    [conversation?.endpointType, conversation?.endpoint],
  );
  const conversationId = useMemo(
    () => conversation?.conversationId ?? Constants.NEW_CONVO,
    [conversation?.conversationId],
  );

  /**
   * Re-apply the screen-size default (Voice on mobile, Type on larger screens) whenever the
   * user lands back on a *new* chat — e.g. clicking "New chat" while sitting on an existing
   * conversation. The lazy useState initializer for inputMode only covers the very first
   * mount, so without this, switching to Type mid-conversation and then starting a new chat
   * would carry that Type choice over instead of resetting to the size-based default. Only
   * fires on an actual transition INTO the new-chat state (tracked via the ref below), not on
   * every render while already there, so it never fights a manual tab switch mid-composition.
   */
  const prevConversationIdRef = useRef(conversationId);
  useEffect(() => {
    if (prevConversationIdRef.current !== conversationId) {
      if (conversationId === Constants.NEW_CONVO) {
        setInputMode(isSmallScreen ? 'voice' : 'type');
      }
      prevConversationIdRef.current = conversationId;
    }
  }, [conversationId, isSmallScreen]);

  const isRTL = useMemo(
    () => (chatDirection != null ? chatDirection?.toLowerCase() === 'rtl' : false),
    [chatDirection],
  );
  const invalidAssistant = useMemo(
    () =>
      isAssistantsEndpoint(endpoint) &&
      (!(conversation?.assistant_id ?? '') ||
        !assistantMap?.[endpoint ?? '']?.[conversation?.assistant_id ?? '']),
    [conversation?.assistant_id, endpoint, assistantMap],
  );
  const disableInputs = useMemo(
    () => requiresKey || invalidAssistant,
    [requiresKey, invalidAssistant],
  );

  const handleContainerClick = useCallback(() => {
    /** Check if the device is a touchscreen */
    if (window.matchMedia?.('(pointer: coarse)').matches) {
      return;
    }
    textAreaRef.current?.focus();
  }, []);

  const handleFocusOrClick = useCallback(() => {
    if (isCollapsed) {
      setIsCollapsed(false);
    }
  }, [isCollapsed]);

  useAutoSave({
    files,
    setFiles,
    textAreaRef,
    conversationId,
    isSubmitting,
  });

  const [mobileNavPortal, setMobileNavPortal] = useState<Element | null>(null);

  useEffect(() => {
    const node = document.getElementById('mobile-nav-model-selector-portal');
    if (node) setMobileNavPortal(node);
    const observer = new MutationObserver(() => {
      const p = document.getElementById('mobile-nav-model-selector-portal');
      if (p !== mobileNavPortal) setMobileNavPortal(p);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [mobileNavPortal]);

  const { submitMessage, submitPrompt } = useSubmitMessage();

  const location = useLocation();
  const autoQuestionRef = useRef<string>('');
  useEffect(() => {
    const state = location.state as { autoQuestion?: string } | null;
    const autoQuestion = state?.autoQuestion;
    if (!autoQuestion || autoQuestionRef.current === autoQuestion) return;
    autoQuestionRef.current = autoQuestion;
    // Clear the state so refreshing doesn't resubmit
    window.history.replaceState({ ...window.history.state, usr: null }, '');
    // Set DOM value directly so it visually appears in the textarea
    if (textAreaRef.current) {
      textAreaRef.current.value = autoQuestion;
    }
    methods.setValue('text', autoQuestion, { shouldValidate: true });
    // Trigger the submit button click (same path as manual send)
    const timer = setTimeout(() => submitButtonRef.current?.click(), 800);
    return () => clearTimeout(timer);
  }, [location.state, methods]);

  const handleKeyUp = useHandleKeyUp({
    index,
    textAreaRef,
    setShowPlusPopover,
    setShowMentionPopover,
  });
  const {
    isNotAppendable,
    handlePaste,
    handleKeyDown,
    handleCompositionStart,
    handleCompositionEnd,
  } = useTextarea({
    textAreaRef,
    submitButtonRef,
    setIsScrollable,
    disabled: disableInputs,
  });

  useQueryParams({ textAreaRef });

  const { ref, ...registerProps } = methods.register('text', {
    required: true,
    onChange: useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) =>
        methods.setValue('text', e.target.value, { shouldValidate: true }),
      [methods],
    ),
  });

  const textValue = useWatch({ control: methods.control, name: 'text' });

  /** Trigger feedback reminder panel when user focuses textarea or starts typing */
  const setIsRequiredFeedback = useSetRecoilState(store.isRequiredFeedback);
  useEffect(() => {
    if (!isTextAreaFocused && (!textValue || textValue.length === 0)) {
      return;
    }
    try {
      const stored = localStorage.getItem('isRequiredFeedback');
      if (stored === 'true') {
        setIsRequiredFeedback(true);
      }
    } catch {
      // ignore localStorage errors
    }
  }, [isTextAreaFocused, textValue, setIsRequiredFeedback]);

  useEffect(() => {
    if (textAreaRef.current) {
      const style = window.getComputedStyle(textAreaRef.current);
      const lineHeight = parseFloat(style.lineHeight);
      setVisualRowCount(Math.floor(textAreaRef.current.scrollHeight / lineHeight));
    }
  }, [textValue]);

  useEffect(() => {
    if (isEditingBadges && backupBadges.length === 0) {
      setBackupBadges([...badges]);
    }
  }, [isEditingBadges, badges, backupBadges.length]);

  const handleSaveBadges = useCallback(() => {
    setIsEditingBadges(false);
    setBackupBadges([]);
  }, [setIsEditingBadges, setBackupBadges]);

  const handleCancelBadges = useCallback(() => {
    if (backupBadges.length > 0) {
      setBadges([...backupBadges]);
    }
    setIsEditingBadges(false);
    setBackupBadges([]);
  }, [backupBadges, setBadges, setIsEditingBadges]);

  const isMoreThanThreeRows = visualRowCount > 3;

  const baseClasses = useMemo(
    () =>
      cn(
        'm-0 w-full min-w-0 flex-1 resize-none bg-transparent py-[10px] placeholder-text-secondary md:py-[14px]',
        isCollapsed ? 'max-h-[52px]' : 'max-h-[45vh] md:max-h-[55vh]',
        isMoreThanThreeRows ? 'pl-5' : 'px-5',
      ),
    [isCollapsed, isMoreThanThreeRows],
  );

  // Location permission
  useEffect(() => {
    // Request location only if not already allowed
    if (!locationAllowed) {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            try {
              const { latitude, longitude } = pos.coords;
              setPosition({ latitude, longitude });
              setLocationAllowed(true);
            } catch (err) {
              console.error('Error fetching location data:', err);
            }
          },
          (error) => {
            console.error('Geolocation error:', error);
            setLocationAllowed(false);
          },
        );
      } else {
        console.warn('Geolocation is not supported by your browser.');
      }
    }
  }, [locationAllowed]);

  const [isFeedbackDialogOpen, setIsFeedbackDialogOpen] = useRecoilState(
    store.isFeedbackDialogOpen,
  );
  const [showFeedbackReminder] = useRecoilState(
    store.showFeedbackReminder,
  );
  const [shakeCount] = useRecoilState(store.feedbackShake);

  const handleMessageSubmit = methods.handleSubmit(async (data) => {
    submitMessage(data, position ?? undefined);
  });

  return (
    <form
      onSubmit={handleMessageSubmit}
      className={cn(
        'mx-auto flex w-full flex-row gap-3 px-2 transition-[max-width] duration-300',
        maximizeChatSpace ? 'max-w-full' : 'md:max-w-3xl xl:max-w-4xl',
        centerFormOnLanding &&
          (conversationId == null || conversationId === Constants.NEW_CONVO) &&
          !isSubmitting &&
          conversation?.messages?.length === 0
          ? 'transition-all duration-200 mb-2 sm:mb-28'
          : 'mb-2 sm:mb-10',
      )}
    >
      <div className="relative flex h-full flex-1 items-stretch md:flex-col">
        <div className={cn('flex w-full items-center', isRTL && 'flex-row-reverse')}>
          {showPlusPopover && !isAssistantsEndpoint(endpoint) && (
            <Mention
              conversation={conversation}
              setShowMentionPopover={setShowPlusPopover}
              newConversation={generateConversation}
              textAreaRef={textAreaRef}
              commandChar="+"
              placeholder="com_ui_add_model_preset"
              includeAssistants={false}
            />
          )}
          {showMentionPopover && (
            <Mention
              conversation={conversation}
              setShowMentionPopover={setShowMentionPopover}
              newConversation={newConversation}
              textAreaRef={textAreaRef}
            />
          )}
          <PromptsCommand index={index} textAreaRef={textAreaRef} submitPrompt={submitPrompt} />
          <div
            onClick={handleContainerClick}
            className={cn(
              // `border` (1px, transparent by default) stays on at all times, in both
              // modes — only its color and the background/shadow change. If the border
              // utility itself were added/removed between modes, its width would animate
              // 0 -> 1px at the same time as the color, and for a frame or two mid-transition
              // the browser paints the preflight default border color (currentColor, i.e.
              // white text) before the real color catches up — a white flash on every
              // switch. Keeping the width constant and only crossfading border-color (often
              // to/from transparent) avoids that entirely.
              // The composer sits directly on the page background in both modes: the rounded
              // input pill (Text mode) and the mic button (Voice mode) carry the visual
              // weight instead of an outer boxed panel. Temporary chat keeps its violet tint
              // as a subtle mode indicator.
              'relative flex w-full flex-grow flex-col overflow-hidden rounded-3xl border border-transparent bg-transparent pb-2 text-text-primary transition-all duration-200 sm:pb-0',
              isTemporary && 'bg-violet-950/10',
              shakeCount > 0 && 'shake',
            )}
          >
            <TextareaHeader addedConvo={addedConvo} setAddedConvo={setAddedConvo} />
            {/* WIP */}
            <EditBadges
              isEditingChatBadges={isEditingBadges}
              handleCancelBadges={handleCancelBadges}
              handleSaveBadges={handleSaveBadges}
              setBadges={setBadges}
            />
            <FileFormChat conversation={conversation} />
            {endpoint && (
              /**
               * Both panels stay mounted, absolutely stacked on top of each other, so they
               * can crossfade via opacity/transform. This wrapper's own height is driven by
               * the `panelsHeight` state (measured from whichever panel is active — see the
               * useLayoutEffect above) and transitions smoothly between values, so each mode
               * keeps its own natural height instead of both being stuck at the taller one.
               */
              <div
                className="relative overflow-hidden transition-[height] duration-[600ms] ease-[cubic-bezier(0.65,0,0.35,1)] motion-reduce:transition-none [will-change:height]"
                style={panelsHeight != null ? { height: panelsHeight } : undefined}
              >
                <div
                  ref={typePanelRef}
                  className={cn(
                    'absolute inset-x-0 top-0 flex flex-col gap-2 px-1 pb-1',
                    /**
                     * Deliberately shorter than the wrapper's height transition (see the
                     * outer div above). If content faded at the same pace as the height
                     * animation, then on the shrink direction (voice -> type) the taller
                     * outgoing Voice panel would still be partway through fading out while
                     * the wrapper is still tall — leaving its tail end (mic/equalizer)
                     * visibly peeking out below the now-shorter Type box until the wrapper
                     * finally clips it away, which reads as a snap. Fading content out fast
                     * means it's fully invisible well before the gap below it would be
                     * visible, so the wrapper just quietly collapses over empty space.
                     */
                    'transition-[opacity,transform] duration-[280ms] ease-[cubic-bezier(0,0,0.2,1)] motion-reduce:transition-none [will-change:opacity,transform]',
                    inputMode === 'voice'
                      ? 'pointer-events-none translate-y-3 opacity-0 z-0'
                      : 'translate-y-0 opacity-100 z-10',
                  )}
                  aria-hidden={inputMode === 'voice'}
                >
                {/* Mode switch centred above the composer. */}
                <div className="flex min-h-9 w-full items-center justify-center">
                  <InputModeToggle inputMode={inputMode} setInputMode={setInputMode} />
                </div>
                {/* Attachments and tool badges expand in place above the input row rather
                    than floating, since both the panel wrapper and the composer clip
                    overflow for the mode-swap height animation. */}
                {showLeftOptions && (
                  <div
                    className={cn(
                      '@container flex flex-wrap items-center gap-1.5 rounded-2xl border border-border-light bg-surface-chat p-2 shadow-sm',
                      isRTL ? 'flex-row-reverse' : 'flex-row',
                    )}
                  >
                    <AttachFileChat conversation={conversation} disableInputs={disableInputs} />
                    <BadgeRow
                      showEphemeralBadges={
                        !isAgentsEndpoint(endpoint) && !isAssistantsEndpoint(endpoint)
                      }
                      isSubmitting={isSubmitting}
                      conversationId={conversationId}
                      onChange={setBadges}
                      isInChat={
                        Array.isArray(conversation?.messages) && conversation.messages.length >= 1
                      }
                    />
                  </div>
                )}
                <div
                  className={cn(
                    'flex w-full items-end gap-2',
                    isRTL ? 'flex-row-reverse' : 'flex-row',
                  )}
                >
                  <button
                    type="button"
                    aria-label={showLeftOptions ? 'Close options' : 'Open options'}
                    aria-expanded={showLeftOptions}
                    onClick={() => setShowLeftOptions((prev) => !prev)}
                    className={cn(
                      'flex size-11 shrink-0 items-center justify-center rounded-full text-text-primary md:size-[52px]',
                      'transition-colors duration-200 hover:bg-surface-hover',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-medium',
                      showLeftOptions ? 'bg-surface-hover' : 'bg-surface-secondary',
                    )}
                  >
                    <Plus
                      className={cn(
                        'size-5 transition-transform duration-200',
                        showLeftOptions && 'rotate-45',
                      )}
                      aria-hidden="true"
                    />
                  </button>
                  <div
                    className={cn(
                      'relative flex min-w-0 flex-1 items-end overflow-hidden border bg-surface-chat',
                      'transition-colors duration-200',
                      isMoreThanThreeRows ? 'rounded-3xl' : 'rounded-full',
                      isTextAreaFocused ? 'border-border-medium' : 'border-border-light',
                    )}
                  >
                  <TextareaAutosize
                    {...registerProps}
                    ref={(e) => {
                      ref(e);
                      (textAreaRef as React.MutableRefObject<HTMLTextAreaElement | null>).current =
                        e;
                    }}
                    disabled={disableInputs || isNotAppendable}
                    onPaste={handlePaste}
                    onKeyDown={handleKeyDown}
                    onKeyUp={handleKeyUp}
                    onCompositionStart={handleCompositionStart}
                    onCompositionEnd={handleCompositionEnd}
                    id={mainTextareaId}
                    tabIndex={0}
                    data-testid="text-input"
                    rows={1}
                    onFocus={() => {
                      handleFocusOrClick();
                      setIsTextAreaFocused(true);
                    }}
                    onBlur={setIsTextAreaFocused.bind(null, false)}
                    aria-label={localize('com_ui_message_input')}
                    onClick={handleFocusOrClick}
                    style={{ height: 44, overflowY: 'auto' }}
                    className={cn(
                      baseClasses,
                      removeFocusRings,
                      'scrollbar-hover transition-[max-height] duration-200 disabled:cursor-not-allowed',
                    )}
                  />
                  {isCollapsed && (
                    <div
                      className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 transition-all duration-200"
                      style={{
                        backdropFilter: 'blur(2px)',
                        WebkitMaskImage: 'linear-gradient(to top, black 15%, transparent 75%)',
                        maskImage: 'linear-gradient(to top, black 15%, transparent 75%)',
                      }}
                    />
                  )}
                  {isMoreThanThreeRows && (
                    <div className="flex items-center justify-center pb-3 pr-2">
                      <CollapseChat
                        isCollapsed={isCollapsed}
                        isScrollable={isMoreThanThreeRows}
                        setIsCollapsed={setIsCollapsed}
                      />
                    </div>
                  )}
                  {!isSmallScreen && (
                    <div className="flex max-w-[45%] shrink-0 items-center pb-2 pr-2">
                      <ModelSelector startupConfig={startupConfig} />
                    </div>
                  )}
                  </div>
                  <div className="shrink-0">
                    {isSubmitting && showStopButton ? (
                      <StopButton
                        stop={handleStopGenerating}
                        setShowStopButton={setShowStopButton}
                      />
                    ) : (
                      <SendButton
                        ref={submitButtonRef}
                        control={methods.control}
                        disabled={
                          filesLoading || isSubmitting || disableInputs || isNotAppendable
                        }
                      />
                    )}
                  </div>
                </div>
                </div>
                <div
                  ref={voicePanelRef}
                  className={cn(
                    'absolute inset-x-0 top-0 flex flex-col items-center justify-center gap-1 px-4 pb-1 pt-2 text-center text-text-secondary sm:pb-1.5 sm:pt-2.5',
                    // See the matching comment on the Type panel above — content fades
                    // faster than the wrapper's height settles, on purpose.
                    'transition-[opacity,transform] duration-[280ms] ease-[cubic-bezier(0,0,0.2,1)] motion-reduce:transition-none [will-change:opacity,transform]',
                    inputMode === 'voice'
                      ? 'translate-y-0 opacity-100 z-10'
                      : 'pointer-events-none translate-y-3 opacity-0 z-0',
                  )}
                  aria-hidden={inputMode !== 'voice'}
                >
                {/* Voice/Text selector, stacked in normal flow above the mic button
                    (the panel is a centered flex column, so this just becomes its first
                    child) instead of pinned to a corner. */}
                <InputModeToggle inputMode={inputMode} setInputMode={setInputMode} />
                {/* The actual mic button lives here (not just a decorative icon), so
                    tapping it directly starts/stops recording. Its own pulse animation
                    (see AudioRecorder.tsx) is the main "listening" indicator; this layer
                    just adds a faint outer ring counter-rotating slowly, in the same
                    emerald tone as the button, for a subtle parallax/machinery feel
                    rather than a flat, static ring. */}
                <div
                  className="relative flex size-20 items-center justify-center"
                  {...(isVoiceListening ? { role: 'status', 'aria-label': 'Listening' } : {})}
                >
                  {isVoiceListening && (
                    <>
                      <style>{`
                        @keyframes voice-orb-ring-outer { to { transform: rotate(-360deg); } }
                      `}</style>
                      <span
                        className="absolute inline-block size-20 rounded-full opacity-40"
                        style={{
                          background:
                            'conic-gradient(from 90deg, transparent, #75D7B2, transparent 60%)',
                          WebkitMask:
                            'radial-gradient(farthest-side, transparent calc(100% - 1.5px), #000 calc(100% - 1.5px))',
                          mask: 'radial-gradient(farthest-side, transparent calc(100% - 1.5px), #000 calc(100% - 1.5px))',
                          animation: 'voice-orb-ring-outer 4s linear infinite',
                        }}
                      />
                    </>
                  )}
                  {SpeechToText ? (
                    <AudioRecorder
                      methods={methods}
                      ask={submitMessage}
                      textAreaRef={textAreaRef}
                      disabled={disableInputs || isNotAppendable}
                      isSubmitting={isSubmitting}
                      enabled={!isFeedbackDialogOpen}
                      // Don't jump to the Type tab the instant stop is tapped — the
                      // transcript (especially from an external STT round-trip) can take a
                      // second or two to arrive. Mark the switch as pending instead; the
                      // effect above fires it once isTranscribing actually clears, so the
                      // user never lands on an empty textarea before the text is ready.
                      onStopRecording={() => setPendingVoiceStop(true)}
                      onListeningChange={setIsVoiceListening}
                      onLoadingChange={setIsTranscribing}
                    />
                  ) : (
                    <Mic className="relative size-6" aria-hidden="true" />
                  )}
                </div>
                <span className="text-xs font-medium sm:text-sm">
                  {isVoiceListening
                    ? `Listening… ${formatListeningDuration(listeningDuration)}`
                    : isTranscribing
                      ? 'Converting your speech to text…'
                      : 'Tap to speak'}
                </span>
                {isTranscribing && !isVoiceListening && (
                  <div className="flex items-center justify-center gap-1.5 text-emerald-400">
                    <Spinner size={14} />
                  </div>
                )}
              </div>
              </div>
            )}
            {/* Mobile model selector: portaled to the top mobile nav bar, and kept
                independent of the row below so it stays visible even in Voice mode (where
                that row hides itself). On desktop the selector lives inline inside the row
                instead, so it still hides along with everything else there in Voice mode. */}
            {isSmallScreen &&
              mobileNavPortal &&
              createPortal(<ModelSelector startupConfig={startupConfig} />, mobileNavPortal)}
            {/* Voice mode has no action row of its own; Stop still needs to be reachable
                there while a response is generating. In Text mode the Send/Stop button lives
                inline at the end of the input row instead. */}
            {inputMode === 'voice' && isSubmitting && showStopButton && (
              <div className="flex justify-center pb-2">
                <StopButton stop={handleStopGenerating} setShowStopButton={setShowStopButton} />
              </div>
            )}
            {TextToSpeech && automaticPlayback && <StreamAudio index={index} />}
          </div>
        </div>
      </div>
    </form>
  );
});

export default ChatForm;
