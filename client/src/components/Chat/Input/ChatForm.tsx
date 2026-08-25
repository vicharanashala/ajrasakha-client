import { memo, useRef, useMemo, useEffect, useState, useCallback } from 'react';
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
  const [inputMode, setInputMode] = useState<'voice' | 'type'>(() =>
    isSmallScreen ? 'voice' : 'type',
  );
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
        'md:py-3.5 m-0 w-full resize-none py-[13px] placeholder-black/50 bg-transparent dark:placeholder-white/50 [&:has(textarea:focus)]:shadow-[0_2px_6px_rgba(0,0,0,.05)]',
        isCollapsed ? 'max-h-[52px]' : 'max-h-[45vh] md:max-h-[55vh]',
        isMoreThanThreeRows ? 'pl-4 sm:pl-5' : 'px-4 sm:px-5',
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
              'relative flex w-full flex-grow flex-col overflow-hidden rounded-3xl border pb-2 text-text-primary transition-all duration-200 sm:pb-0',
              isTextAreaFocused ? 'shadow-lg' : 'shadow-md',
              isTemporary
                ? 'border-violet-800/60 bg-violet-950/10'
                : 'border-border-light bg-surface-chat',
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
              <div
                className={cn(
                  'flex',
                  isRTL ? 'flex-row-reverse' : 'flex-row',
                  /**
                   * Collapse instead of `display: none` when hidden: a fully undisplayed
                   * textarea can't be measured by the autosize logic, so it would briefly
                   * render at the wrong height (clipping the placeholder text against the
                   * rounded corners) once switched back to the Type tab. `invisible h-0
                   * overflow-hidden` keeps it laid out (and therefore measurable) while
                   * taking up no visible space and staying out of the tab/focus order.
                   */
                  inputMode === 'voice' && 'invisible h-0 overflow-hidden',
                )}
              >
                <div className="relative flex-1">
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
                </div>
                <div className="flex flex-col items-start justify-start pr-2.5 pt-1.5">
                  <CollapseChat
                    isCollapsed={isCollapsed}
                    isScrollable={isMoreThanThreeRows}
                    setIsCollapsed={setIsCollapsed}
                  />
                </div>
              </div>
            )}
            {endpoint && inputMode === 'voice' && (
              <div className="relative flex flex-col items-center justify-center gap-3 px-4 pb-2 pt-5 text-center text-text-secondary sm:pb-3 sm:pt-6">
                {/* Voice/Type selector, pinned to the top corner of this panel instead of
                    down in the bottom icon row. */}
                <div
                  className={cn(
                    'absolute top-2 sm:top-3',
                    isRTL ? 'right-2 sm:right-3' : 'left-2 sm:left-3',
                  )}
                >
                  <div
                    role="tablist"
                    aria-label="Input mode"
                    className="relative flex shrink-0 items-center rounded-full border border-border-light/60 bg-surface-secondary/80 p-0.5 shadow-sm backdrop-blur-sm"
                  >
                    {/* sliding active-tab indicator */}
                    <span
                      aria-hidden="true"
                      className={cn(
                        'absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-full bg-emerald-600',
                        'shadow-[0_1px_2px_rgba(0,0,0,0.18)]',
                        'transition-transform duration-300 ease-out',
                        inputMode === 'type' ? 'translate-x-full' : 'translate-x-0',
                      )}
                    />
                    <button
                      type="button"
                      role="tab"
                      aria-selected={inputMode === 'voice'}
                      aria-label="Voice"
                      title="Voice"
                      onClick={() => setInputMode('voice')}
                      className={cn(
                        'relative z-10 flex flex-1 items-center justify-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors duration-300 sm:px-3',
                        inputMode === 'voice'
                          ? 'text-white'
                          : 'text-text-secondary hover:text-text-primary',
                      )}
                    >
                      <Mic className="size-3.5 shrink-0" aria-hidden="true" />
                      <span className="hidden sm:inline">Voice</span>
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={inputMode === 'type'}
                      aria-label="Type"
                      title="Type"
                      onClick={() => setInputMode('type')}
                      className={cn(
                        'relative z-10 flex flex-1 items-center justify-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors duration-300 sm:px-3',
                        inputMode === 'type'
                          ? 'text-white'
                          : 'text-text-secondary hover:text-text-primary',
                      )}
                    >
                      <Keyboard className="size-3.5 shrink-0" aria-hidden="true" />
                      <span className="hidden sm:inline">Type</span>
                    </button>
                  </div>
                </div>
                {/* The actual mic button lives here (not just a decorative icon), so
                    tapping it directly starts/stops recording. Its own pulse animation
                    (see AudioRecorder.tsx) is the main "listening" indicator; this layer
                    just adds a faint outer ring counter-rotating slowly, in the same
                    emerald tone as the button, for a subtle parallax/machinery feel
                    rather than a flat, static ring. */}
                <div
                  className="relative flex size-16 items-center justify-center"
                  {...(isVoiceListening ? { role: 'status', 'aria-label': 'Listening' } : {})}
                >
                  {isVoiceListening && (
                    <>
                      <style>{`
                        @keyframes voice-orb-ring-outer { to { transform: rotate(-360deg); } }
                      `}</style>
                      <span
                        className="absolute inline-block size-16 rounded-full opacity-40"
                        style={{
                          background:
                            'conic-gradient(from 90deg, transparent, #34d399, transparent 60%)',
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
                    <Mic className="relative size-8" aria-hidden="true" />
                  )}
                </div>
                <span className="text-xs sm:text-sm">
                  {isVoiceListening
                    ? 'Listening… tap the microphone above to stop'
                    : isTranscribing
                      ? 'Converting your speech to text…'
                      : 'Tap the microphone above to start speaking'}
                </span>
                {isTranscribing && !isVoiceListening && (
                  <div className="flex items-center justify-center gap-1.5 text-emerald-400">
                    <Spinner size={14} />
                  </div>
                )}
                {isVoiceListening && (
                  <div className="flex items-center justify-center gap-2">
                    <style>{`
                      @keyframes voice-eq-bar {
                        0%, 100% { transform: scaleY(0.35); }
                        50% { transform: scaleY(1); }
                      }
                    `}</style>
                    {/* Small equalizer-style bars, each bouncing on its own timing for a
                        lively, non-uniform waveform while the mic is listening. */}
                    <div className="flex h-3.5 items-end gap-0.5" aria-hidden="true">
                      {[0.6, 0.85, 0.7, 0.9, 0.65].map((durationScale, i) => (
                        <span
                          key={i}
                          className="w-0.5 rounded-full bg-emerald-600"
                          style={{
                            height: '100%',
                            transformOrigin: 'bottom',
                            animation: `voice-eq-bar ${0.7 * durationScale}s ease-in-out infinite`,
                            animationDelay: `${i * 0.1}s`,
                          }}
                        />
                      ))}
                    </div>
                    <span className="font-mono text-[11px] tabular-nums text-text-secondary">
                      {formatListeningDuration(listeningDuration)}
                    </span>
                  </div>
                )}
              </div>
            )}
            <div
              className={cn(
                '@container items-between flex flex-wrap gap-1.5 pb-2 sm:gap-2',
                isRTL ? 'flex-row-reverse' : 'flex-row',
              )}
            >
              {inputMode !== 'voice' && (
                <div className={`${isRTL ? 'mr-1.5 sm:mr-2' : 'ml-1.5 sm:ml-2'}`}>
                  <button
                    type="button"
                    aria-label={showLeftOptions ? 'Close options' : 'Open options'}
                    onClick={() => setShowLeftOptions((prev) => !prev)}
                    className={cn(
                      'flex size-9 items-center justify-center rounded-full p-1 transition-all duration-200',
                      'hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-opacity-50',
                      showLeftOptions && 'bg-surface-hover',
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
                </div>
              )}
              {/* In Voice mode the selector is shown up top, parallel to the mic button,
                  instead of here in the bottom row. */}
              {inputMode !== 'voice' && !showLeftOptions && (
                <div
                  role="tablist"
                  aria-label="Input mode"
                  className="relative flex shrink-0 items-center rounded-full border border-border-light/60 bg-surface-secondary/80 p-0.5 shadow-sm backdrop-blur-sm"
                >
                  {/* sliding active-tab indicator */}
                  <span
                    aria-hidden="true"
                    className={cn(
                      'absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-full bg-emerald-600',
                      'shadow-[0_1px_2px_rgba(0,0,0,0.18)]',
                      'transition-transform duration-300 ease-out',
                      inputMode === 'type' ? 'translate-x-full' : 'translate-x-0',
                    )}
                  />
                  <button
                    type="button"
                    role="tab"
                    aria-selected={inputMode === 'voice'}
                    aria-label="Voice"
                    title="Voice"
                    onClick={() => setInputMode('voice')}
                    className={cn(
                      'relative z-10 flex flex-1 items-center justify-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors duration-300 sm:px-3',
                      inputMode === 'voice'
                        ? 'text-white'
                        : 'text-text-secondary hover:text-text-primary',
                    )}
                  >
                    <Mic className="size-3.5 shrink-0" aria-hidden="true" />
                    <span className="hidden sm:inline">Voice</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={inputMode === 'type'}
                    aria-label="Type"
                    title="Type"
                    onClick={() => setInputMode('type')}
                    className={cn(
                      'relative z-10 flex flex-1 items-center justify-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors duration-300 sm:px-3',
                      inputMode === 'type'
                        ? 'text-white'
                        : 'text-text-secondary hover:text-text-primary',
                    )}
                  >
                    <Keyboard className="size-3.5 shrink-0" aria-hidden="true" />
                    <span className="hidden sm:inline">Type</span>
                  </button>
                </div>
              )}
              {showLeftOptions && (
                <>
                  <div>
                    <AttachFileChat conversation={conversation} disableInputs={disableInputs} />
                  </div>
                  <BadgeRow
                    showEphemeralBadges={!isAgentsEndpoint(endpoint) && !isAssistantsEndpoint(endpoint)}
                    isSubmitting={isSubmitting}
                    conversationId={conversationId}
                    onChange={setBadges}
                    isInChat={
                      Array.isArray(conversation?.messages) && conversation.messages.length >= 1
                    }
                  />
                </>
              )}
              <div className="mx-auto flex" />
              {/* On mobile, portal the model selector to the top mobile nav bar.
                  On desktop, render it inline in the chat input. Hidden entirely
                  in Voice mode, where there's no need to pick a model inline. */}
              {inputMode !== 'voice' &&
                (isSmallScreen ? (
                  mobileNavPortal ? (
                    createPortal(<ModelSelector startupConfig={startupConfig} />, mobileNavPortal)
                  ) : null
                ) : (
                  <ModelSelector startupConfig={startupConfig} />
                ))}
              <div className={`${isRTL ? 'ml-1.5 sm:ml-2' : 'mr-1.5 sm:mr-2'}`}>
                {isSubmitting && showStopButton ? (
                  <StopButton stop={handleStopGenerating} setShowStopButton={setShowStopButton} />
                ) : (
                  endpoint &&
                  inputMode === 'type' && (
                    <SendButton
                      ref={submitButtonRef}
                      control={methods.control}
                      disabled={filesLoading || isSubmitting || disableInputs || isNotAppendable}
                    />
                  )
                )}
              </div>
            </div>
            {TextToSpeech && automaticPlayback && <StreamAudio index={index} />}
          </div>
        </div>
      </div>
    </form>
  );
});

export default ChatForm;
