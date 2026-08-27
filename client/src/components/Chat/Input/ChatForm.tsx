import { memo, useRef, useMemo, useEffect, useLayoutEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import * as Ariakit from '@ariakit/react';
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

/**
 * Segmented Voice/Text switch shown above the composer in both input modes. It yields the
 * spot to the scroll-to-bottom arrow, which floats directly above the composer: while that
 * arrow is up the switch fades out. It stays mounted rather than unmounting so the composer
 * keeps its height and focus is not dropped mid-interaction; its tabs leave the tab order
 * while hidden so nothing invisible can be focused.
 */
const InputModeToggle = memo(
  ({
    inputMode,
    setInputMode,
  }: {
    inputMode: InputMode;
    setInputMode: React.Dispatch<React.SetStateAction<InputMode>>;
  }) => {
    const isScrollButtonVisible = useRecoilValue(store.isScrollToBottomVisible);
    return (
    <div
      role="tablist"
      aria-label="Input mode"
      aria-hidden={isScrollButtonVisible}
      className={cn(
        'flex shrink-0 items-center gap-0.5 rounded-full bg-surface-secondary p-1',
        'transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none',
        isScrollButtonVisible
          ? 'pointer-events-none scale-95 opacity-0'
          : 'scale-100 opacity-100',
      )}
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
            tabIndex={isScrollButtonVisible ? -1 : 0}
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
    );
  },
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
  /** The composer's action row; watched for width changes so the line count stays accurate. */
  const inputRowRef = useRef<HTMLDivElement>(null);
  /** The draft has outgrown the textarea's max height and is scrolling inside it. */
  const [isTextAreaScrollable, setIsTextAreaScrollable] = useState(false);
  /** Mirrors visualRowCount for the measuring effect, which needs the previous value without
   *  re-subscribing, plus the row width and text length the last measurement ran against. */
  const visualRowCountRef = useRef(1);
  const measuredWidthRef = useRef(0);
  const expandedAtLengthRef = useRef<number | null>(null);
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

  // The "+" menu is anchored to a button that only exists in Text mode; close it on the way
  // into Voice mode so it can't be left floating over the mic.
  useEffect(() => {
    if (inputMode === 'voice') {
      setShowLeftOptions(false);
    }
  }, [inputMode]);

  // Its entries share one "which dropdown is open" atom, so clear that when the menu closes.
  const setActiveComposerMenu = useSetRecoilState(store.activeComposerMenu);
  useEffect(() => {
    if (!showLeftOptions) {
      setActiveComposerMenu(null);
    }
  }, [showLeftOptions, setActiveComposerMenu]);

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

  /**
   * How many visual lines the textarea is currently showing, which decides whether the
   * composer stays a compact pill or becomes the expanded card.
   *
   * `scrollHeight` includes the textarea's vertical padding, so that has to come off before
   * dividing by the line height — otherwise an empty textarea measures as two lines wherever
   * the padding is tall enough (this composer uses `py-[10px] md:py-[14px]`, so desktop read
   * 52/24 = 2 and started out expanded while mobile read 44/24 = 1 and looked right).
   *
   * Re-measured on width changes as well as on edits: the same text wraps differently as the
   * composer gets narrower, and keying this off the text alone left the old shape in place
   * until the next keystroke or a reload. The observer watches the row container rather than
   * the textarea itself, because the textarea's own width changes as a *result* of switching
   * layouts — observing that would let a measurement re-trigger itself.
   */
  useEffect(() => {
    const textArea = textAreaRef.current;
    if (!textArea) {
      return;
    }
    const measure = () => {
      const style = window.getComputedStyle(textArea);
      const lineHeight = parseFloat(style.lineHeight);
      if (!lineHeight) {
        return;
      }
      const verticalPadding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      const contentHeight = textArea.scrollHeight - verticalPadding;
      let rows = Math.max(1, Math.round(contentHeight / lineHeight));

      /**
       * Expanding gives the textarea the full row width, since the buttons move off its line.
       * Text that needed two lines in the compact layout can therefore fit on one once
       * expanded, which would collapse it, re-narrow it, and wrap again — a loop, very visible
       * with one long unbroken word. So the layout only collapses back when the draft is
       * actually shorter than it was when it expanded; growing text never triggers it.
       */
      const length = textArea.value.length;
      if (rows > 1) {
        if (visualRowCountRef.current <= 1) {
          expandedAtLengthRef.current = length;
        }
      } else if (
        visualRowCountRef.current > 1 &&
        expandedAtLengthRef.current != null &&
        length >= expandedAtLengthRef.current
      ) {
        rows = visualRowCountRef.current;
      } else {
        expandedAtLengthRef.current = null;
      }

      visualRowCountRef.current = rows;
      setVisualRowCount(rows);
      setIsTextAreaScrollable(textArea.scrollHeight - textArea.clientHeight > 1);
    };
    measure();

    const row = inputRowRef.current;
    if (!row || typeof ResizeObserver === 'undefined') {
      return;
    }
    // Width only. The row's height changes as a direct result of switching layouts, so
    // re-measuring on that would let every switch trigger the next one.
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (Math.abs(width - measuredWidthRef.current) < 1) {
        return;
      }
      measuredWidthRef.current = width;
      measure();
    });
    observer.observe(row);
    return () => observer.disconnect();
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
  /** Once the textarea grows past a single line the composer stops being one compact row and
   *  becomes a card: the input takes the full width and the action buttons wrap onto their own
   *  line beneath it, so they never fight the growing text for horizontal space. */
  const isExpandedComposer = visualRowCount > 1;

  const baseClasses = useMemo(
    () =>
      cn(
        'm-0 w-full min-w-0 flex-1 resize-none bg-transparent py-[10px] placeholder-text-secondary md:py-[14px]',
        // Capped well short of the viewport so a long draft scrolls inside the composer
        // instead of pushing the conversation off screen. Tightest on phones, where the
        // composer strip is fixed to the bottom and shares the screen with the mode toggle
        // and the notice line below it.
        isCollapsed ? 'max-h-[52px]' : 'max-h-[20vh] sm:max-h-[30vh] md:max-h-[40vh]',
        // Expanded, the input is flush inside the card and lines up with the buttons below it;
        // compact, it keeps the roomier padding that suits a pill.
        isExpandedComposer ? 'px-2.5 sm:px-3' : 'px-5',
      ),
    [isCollapsed, isExpandedComposer],
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

  /**
   * Desktop-only model selector. It sits inside the input pill while the composer is compact,
   * and moves into the action row once it expands — there the pill's border has moved out to
   * the card, so the action row is inside the input box too, and bottom-aligning it against a
   * tall multi-line textarea is what made it look out of place before. Mobile portals its own
   * copy into the top nav instead (see the portal above).
   */
  const modelSelectorNode = !isSmallScreen ? (
    <div className="flex min-w-0 max-w-[10rem] items-center lg:max-w-[13rem]">
      <ModelSelector startupConfig={startupConfig} />
    </div>
  ) : null;

  const handleMessageSubmit = methods.handleSubmit(async (data) => {
    submitMessage(data, position ?? undefined);
  });

  return (
    <form
      onSubmit={handleMessageSubmit}
      className={cn(
        'mx-auto flex w-full flex-row gap-3 px-2 transition-[max-width] duration-300',
        maximizeChatSpace ? 'max-w-full' : 'md:max-w-3xl xl:max-w-4xl',
        // The welcome screen used to hold the composer 112px clear of the bottom, which left a
        // wide gap between it and the in-development notice below. It now keeps the same
        // spacing as a live conversation, so the composer and its Voice/Text switch sit
        // directly above that notice.
        centerFormOnLanding &&
          (conversationId == null || conversationId === Constants.NEW_CONVO) &&
          !isSubmitting &&
          conversation?.messages?.length === 0
          ? 'transition-all duration-200 mb-2 sm:mb-10'
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
                <div
                  ref={inputRowRef}
                  className={cn(
                    'flex w-full gap-1.5 transition-[border-color,padding] duration-200 sm:gap-2',
                    isRTL ? 'flex-row-reverse' : 'flex-row',
                    isExpandedComposer
                      ? cn(
                          'flex-wrap items-center rounded-3xl border bg-surface-chat p-1.5 sm:p-2',
                          isTextAreaFocused ? 'border-border-medium' : 'border-border-light',
                        )
                      : 'items-end border border-transparent',
                  )}
                >
                  {/* Attachments and tool badges open as a column anchored to this button
                      rather than as a row inside the composer: the composer and the panel
                      wrapper both clip overflow for the mode-swap height animation, so an
                      in-flow panel would either be cut off or push the input down. Ariakit
                      portals it out and handles placement, outside-click and Escape. */}
                  <Ariakit.PopoverProvider
                    open={showLeftOptions}
                    setOpen={setShowLeftOptions}
                    placement={isRTL ? 'top-end' : 'top-start'}
                  >
                    <Ariakit.PopoverDisclosure
                      render={
                        <button
                          type="button"
                          aria-label={showLeftOptions ? 'Close options' : 'Open options'}
                          className={cn(
                            'flex shrink-0 items-center justify-center rounded-full text-text-primary',
                            isExpandedComposer ? 'order-2 size-9 sm:size-10' : 'size-11 md:size-[52px]',
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
                      }
                    />
                    <Ariakit.Popover
                      portal
                      unmountOnHide
                      gutter={8}
                      overflowPadding={12}
                      className={cn(
                        // No min-width: the items are icon-only here (Badge only reveals its
                        // label inside a 600px-wide @container), so the menu hugs them.
                        'z-30 flex w-max max-w-[calc(100vw-2rem)] flex-col items-stretch gap-0.5',
                        'rounded-2xl border border-border-light bg-surface-chat p-1.5 shadow-lg outline-none',
                        'origin-bottom translate-y-1 scale-95 opacity-0 transition-[opacity,transform] duration-200 ease-out',
                        'data-[enter]:translate-y-0 data-[enter]:scale-100 data-[enter]:opacity-100',
                        'motion-reduce:transition-none',
                      )}
                    >
                      <AttachFileChat conversation={conversation} disableInputs={disableInputs} />
                      <BadgeRow
                        vertical
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
                    </Ariakit.Popover>
                  </Ariakit.PopoverProvider>
                  <div
                    className={cn(
                      'relative flex min-w-0 items-end overflow-hidden transition-colors duration-200',
                      isExpandedComposer
                        ? // Full width on its own line; the card around it draws the border now.
                          'order-1 w-full basis-full'
                        : cn(
                            'flex-1 rounded-full border bg-surface-chat',
                            isTextAreaFocused ? 'border-border-medium' : 'border-border-light',
                          ),
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
                  {/* Marks that there's more text below the fold. A gradient fading into the
                      composer's own background, the same treatment the composer uses over the
                      message list — the blur this replaced smeared the last line rather than
                      letting it dissolve. */}
                  {(isCollapsed || isTextAreaScrollable) && (
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-surface-chat via-surface-chat/70 to-transparent transition-opacity duration-200"
                    />
                  )}
                  {!isExpandedComposer && (
                    <div className="flex shrink-0 items-center pb-2 pr-2">{modelSelectorNode}</div>
                  )}
                  </div>
                  {/* Trailing controls. Compact, they sit at the end of the single row beside
                      the input; expanded, the row wraps and this group takes the far end of the
                      line below the input, opposite the "+" button. Keeping them in one group
                      across both layouts means the model selector and textarea never remount
                      when the composer changes shape. */}
                  <div
                    className={cn(
                      'flex shrink-0 items-center gap-1.5 sm:gap-2',
                      isExpandedComposer && cn('order-3', isRTL ? 'mr-auto' : 'ml-auto'),
                    )}
                  >
                    <CollapseChat
                      isCollapsed={isCollapsed}
                      isScrollable={isMoreThanThreeRows}
                      setIsCollapsed={setIsCollapsed}
                    />
                    {isExpandedComposer && modelSelectorNode}
                    {isSubmitting && showStopButton ? (
                      <StopButton
                        stop={handleStopGenerating}
                        setShowStopButton={setShowStopButton}
                        className={isExpandedComposer ? 'size-9 sm:size-10 md:size-10' : undefined}
                      />
                    ) : (
                      <SendButton
                        ref={submitButtonRef}
                        control={methods.control}
                        className={isExpandedComposer ? 'size-9 sm:size-10 md:size-10' : undefined}
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
              createPortal(
                <ModelSelector
                  startupConfig={startupConfig}
                  // Sits on the bare nav bar rather than inside the input, so it needs its own
                  // surface to read as a control. Borrows the composer pill's treatment —
                  // same radius, border token and chat surface — so the two read as one family.
                  triggerClassName="justify-start gap-2 rounded-full border border-border-light bg-surface-chat px-3 shadow-sm transition-colors hover:border-border-medium hover:bg-surface-hover"
                />,
                mobileNavPortal,
              )}
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
