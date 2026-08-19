import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';
import { GripVertical, X } from 'lucide-react';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';
import store from '~/store';
import FeedbackDetailDialog from './FeedbackDetailDialog';
import { useMessagesViewContext } from '~/Providers/MessagesViewContext';
import { TFeedback } from 'librechat-data-provider';

interface FeedbackReminderPanelProps {
  /** Called when user completes the two-step feedback flow or dismisses */
  onSubmitFeedback: (feedback: TFeedback | undefined) => void;
}

const emojiConfig = {
  thumbsDown: {
    idleBg: 'bg-red-500/5 border-red-500/20 hover:bg-red-500/10',
    activeBg: 'bg-red-500/15 border-red-500/40 ring-2 ring-red-500/30',
    text: 'text-red-400',
    face: 'sad' as const,
    ring: '',
  },
  thumbsUp: {
    idleBg: 'bg-green-500/5 border-green-500/20 hover:bg-green-500/10',
    activeBg: 'bg-green-500/15 border-green-500/40 ring-2 ring-green-500/30',
    text: 'text-green-400',
    face: 'happy' as const,
    ring: '',
  },
};

function EmojiFace({ face, className }: { face: 'happy' | 'sad'; className?: string }) {
  const isHappy = face === 'happy';
  return (
    <svg
      viewBox="0 0 48 48"
      className={cn('h-10 w-10', className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="24" cy="24" r="22" fill="currentColor" fillOpacity="0.15" />
      <circle cx="17" cy="20" r="3" fill="currentColor" />
      <circle cx="31" cy="20" r="3" fill="currentColor" />
      {isHappy ? (
        <path
          d="M14 29c2.5 4.5 6.5 7 10 7s7.5-2.5 10-7"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      ) : (
        <path
          d="M14 34c2.5-4.5 6.5-7 10-7s7.5 2.5 10 7"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

const FeedbackReminderPanel = memo(({ onSubmitFeedback }: FeedbackReminderPanelProps) => {
  const localize = useLocalize();
  const { submitFeedback } = useMessagesViewContext();
  const setIsRequiredFeedback = useSetRecoilState(store.isRequiredFeedback);
  const setFeedbackSkipCount = useSetRecoilState(store.feedbackSkipCount);

  const [showFeedbackReminder, setShowFeedbackReminder] = useRecoilState(store.showFeedbackReminder);
  const [isRequiredFeedback] = useRecoilState(store.isRequiredFeedback);
  const [selectedRating, setSelectedRating] = useState<'thumbsUp' | 'thumbsDown' | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dismissedText, setDismissedText] = useState(false);

  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);
  const panelSizeRef = useRef({ width: 288, height: 192 });

  // Mount/unmount animation — replay when isRequiredFeedback becomes true again
  useEffect(() => {
    if (!isRequiredFeedback) {
      return;
    }
    // Reset UI state for the new panel instance
    setDismissed(false);
    setDismissedText(false);
    setMounted(false);
    // Always reset the count when isRequiredFeedback becomes true — this handles
    // both fresh sessions and page reloads (where the count was restored from localStorage)
    setFeedbackSkipCount(0);
    requestAnimationFrame(() => setMounted(true));
  }, [isRequiredFeedback]);

  const feedbackSkipCount = useRecoilValue(store.feedbackSkipCount);
  // Tracks the count from the previous render — updated at the START of each effect
  // so comparisons see the old value, not the current one.
  const prevCountRef = useRef(feedbackSkipCount);
  // Tracks whether we've already shown the shake for count=1 in this session;
  // reset by explicit user actions (submit / clear / dismiss).
  const shakeShownRef = useRef(false);

  // First click (count 0→1): shake. Second+ click (count >= 2): auto-dismiss.
  useEffect(() => {
    if (!showFeedbackReminder) {
      return;
    }
    const prev = prevCountRef.current;
    const cur = feedbackSkipCount;

    // Update the ref FIRST so next render sees the correct previous value
    prevCountRef.current = cur;

    // Only act when the count has actually increased from the previous render
    if (cur <= prev) {
      return;
    }

    if (cur >= 2) {
      // Second+ click — show "Reminder is closed", then auto-dismiss
      setDismissedText(true);
      setDismissed(true);
      const timer = setTimeout(() => {
        setIsRequiredFeedback(false);
        setShowFeedbackReminder(false);
      }, 600);
      return () => clearTimeout(timer);
    }

    // cur === 1 and prev === 0 — first send click
    if (!shakeShownRef.current) {
      shakeShownRef.current = true;
      const timer = setTimeout(() => setDismissedText(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [showFeedbackReminder, feedbackSkipCount, setIsRequiredFeedback, setShowFeedbackReminder]);

  /** Keep panelSizeRef in sync with the actual DOM size (responsive width) */
  useEffect(() => {
    if (!panelRef.current) {
      return;
    }
    const ro = new ResizeObserver(([entry]) => {
      const { offsetWidth, offsetHeight } = entry.target as HTMLDivElement;
      panelSizeRef.current = { width: offsetWidth, height: offsetHeight };
    });
    ro.observe(panelRef.current);
    panelSizeRef.current = {
      width: panelRef.current.offsetWidth,
      height: panelRef.current.offsetHeight,
    };
    return () => ro.disconnect();
  }, []);

  const startDrag = useCallback((clientX: number, clientY: number) => {
    if (!panelRef.current) {
      return;
    }
    isDraggingRef.current = true;
    setIsDragging(true);
    const rect = panelRef.current.getBoundingClientRect();
    dragOffsetRef.current = {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
    panelRef.current.style.transition = 'none';
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-drag-handle]')) {
      e.preventDefault();
      startDrag(e.clientX, e.clientY);
    }
  }, [startDrag]);

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    if ((e.target as HTMLElement).closest('[data-drag-handle]')) {
      startDrag(touch.clientX, touch.clientY);
    }
  }, [startDrag]);

  const moveDrag = useCallback((clientX: number, clientY: number) => {
    if (!isDraggingRef.current || !panelRef.current) {
      return;
    }
    const { width, height } = panelSizeRef.current;
    const maxLeft = window.innerWidth - width;
    const maxTop = window.innerHeight - height;
    const newLeft = Math.min(Math.max(0, clientX - dragOffsetRef.current.x), maxLeft);
    const newTop = Math.min(Math.max(0, clientY - dragOffsetRef.current.y), maxTop);
    panelRef.current.style.left = `${newLeft}px`;
    panelRef.current.style.top = `${newTop}px`;
    panelRef.current.style.right = 'auto';
    panelRef.current.style.bottom = 'auto';
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    moveDrag(e.clientX, e.clientY);
  }, [moveDrag]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDraggingRef.current) {
      return;
    }
    e.preventDefault();
    moveDrag(e.touches[0].clientX, e.touches[0].clientY);
  }, [moveDrag]);

  const endDrag = useCallback(() => {
    if (!isDraggingRef.current) {
      return;
    }
    isDraggingRef.current = false;
    setIsDragging(false);
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    if (panelRef.current) {
      panelRef.current.style.transition = '';
      setPosition({
        left: parseFloat(panelRef.current.style.left),
        top: parseFloat(panelRef.current.style.top),
      });
    }
  }, []);

  const handleMouseUp = useCallback(endDrag, [endDrag]);
  const handleTouchEnd = useCallback(endDrag, [endDrag]);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  /* Position is applied to DOM directly by moveDrag — no state-driven useEffect needed */

  /* ── Click handlers ────────────────────────────────────────────── */

  const handleRatingClick = useCallback((rating: 'thumbsUp' | 'thumbsDown') => {
    setSelectedRating(rating);
    setDetailOpen(true);
  }, []);

  const handleMaybeLater = useCallback(() => {
    setIsRequiredFeedback(false);
    setShowFeedbackReminder(false);
    setFeedbackSkipCount(0);
    setDismissedText(false);
    setDismissed(true);
  }, [setIsRequiredFeedback, setShowFeedbackReminder, setFeedbackSkipCount]);

  /* Called when the user submits Modal 2 (detail form) */
  const handleDetailSubmit = useCallback(
    (feedback: TFeedback) => {
      setIsRequiredFeedback(false);
      setShowFeedbackReminder(false);
      setFeedbackSkipCount(0);
      if (submitFeedback) {
        submitFeedback({ feedback });
      }
      onSubmitFeedback(feedback);
    },
    [setIsRequiredFeedback, setShowFeedbackReminder, setFeedbackSkipCount, submitFeedback, onSubmitFeedback],
  );

  /* Called when the user clicks Delete in Modal 2 */
  const handleDetailClear = useCallback(() => {
    setIsRequiredFeedback(false);
    setShowFeedbackReminder(false);
    setFeedbackSkipCount(0);
    onSubmitFeedback(undefined);
  }, [setIsRequiredFeedback, setShowFeedbackReminder, setFeedbackSkipCount, onSubmitFeedback]);

  /* ── Render guard — isRequiredFeedback controls visibility; dismissed drives exit animation ── */
  if (!isRequiredFeedback) {
    return null;
  }

  return (
    <>
      {/* ── Draggable panel ── */}
      <div
        ref={panelRef}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        role="dialog"
        aria-label={localize('com_ui_feedback_enforce_question')}
        aria-modal="false"
        data-pulsing={feedbackSkipCount > 0 && !dismissedText ? 'true' : undefined}
        className={cn(
          'fixed z-50 select-none overflow-hidden rounded-2xl border',
          'w-[calc(100vw-32px)] max-w-72',
          'bg-[var(--surface-primary-alt)]',
          'border-[var(--border-medium)]',
          'shadow-[0_8px_28px_-6px_rgba(0,0,0,0.12),0_4px_12px_-4px_rgba(0,0,0,0.08)]',
          'ease-[cubic-bezier(0.16,1,0.3,1)] transition-[opacity,bottom,transform,box-shadow] duration-300',
          'motion-reduce:transition-none motion-reduce:duration-0',
          mounted ? 'opacity-100' : 'opacity-0',
          isDragging
            ? 'scale-[1.02] shadow-[0_20px_40px_-8px_rgba(0,0,0,0.18)]'
            : 'hover:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.14)]',
          feedbackSkipCount === 1 ? 'shake' : '',
        )}
        style={{
          height: '192px',
          left: position !== null ? position.left : undefined,
          right: position === null ? 16 : undefined,
          top: position !== null ? position.top : undefined,
          bottom: position === null ? '80px' : undefined,
          transform: mounted ? undefined : 'translateY(100vh) scale(0.97)',
        }}
      >
        {/* Top accent line */}
        <div
          className="h-[3px] w-full"
          style={{
            background:
              selectedRating === 'thumbsDown'
                ? 'linear-gradient(90deg, rgb(244 63 94 / 0.75), rgb(244 63 94 / 0.25))'
                : selectedRating === 'thumbsUp'
                  ? 'linear-gradient(90deg, rgb(16 185 129 / 0.75), rgb(16 185 129 / 0.25))'
                  : 'linear-gradient(90deg, rgb(16 185 129 / 0.55), rgb(244 63 94 / 0.55))',
          }}
        />

        {/* Drag handle */}
        <div
          data-drag-handle="true"
          className="group/handle flex cursor-grab items-center justify-center py-1.5 active:cursor-grabbing"
        >
          <GripVertical
            data-drag-handle
            size={14}
            className="text-[var(--text-tertiary)] transition-colors group-hover/handle:text-[var(--text-secondary)]"
          />
        </div>

        {/* Close button */}
        <button
          type="button"
          onClick={handleMaybeLater}
          className={cn(
            'absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full',
            'text-[var(--text-tertiary)] transition-all duration-150',
            'hover:rotate-90 hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
          )}
          title={localize('com_ui_feedback_enforce_later')}
        >
          <X size={13} strokeWidth={2.5} />
        </button>

        <div className="px-4 pb-4 pt-1">
          {/* Logo + Question on same line */}
          <div className="mb-3 flex items-center gap-2 pr-5">
            <img
              src="/assets/annam-logo.png"
              alt="logo"
              className="h-6 w-auto object-contain flex-shrink-0"
            />
            {dismissedText ? (
              <p className="text-[13px] font-medium leading-relaxed text-[var(--text-secondary)]">
                {localize('com_ui_feedback_enforce_skipped')}
              </p>
            ) : (
              <p className="text-[13px] font-medium leading-relaxed text-[var(--text-primary)]">
                {localize('com_ui_feedback_enforce_question')}
              </p>
            )}
          </div>

          {/* Rating options */}
          <div className="group flex gap-2.5">
            {(['thumbsUp', 'thumbsDown'] as const).map((rating) => {
              const config = emojiConfig[rating];
              const isSelected = selectedRating === rating;
              return (
                <button
                  key={rating}
                  type="button"
                  onClick={() => handleRatingClick(rating)}
                  className={cn(
                    'relative flex flex-1 flex-col items-center gap-1 rounded-xl border p-3',
                    'transition-all duration-200 ease-out',
                    'hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97]',
                    'focus:outline-none focus-visible:ring-2',
                    config.ring,
                    isSelected ? config.activeBg : config.idleBg,
                  )}
                >
                  {/* Emoji: large default, shrinks on hover to make room for text */}
                  <div className="min-h-12">
                    <EmojiFace
                      face={config.face}
                      className={cn(
                        'transition-transform duration-200 ease-out',
                        'group-hover:scale-75',
                        isSelected && 'scale-110',
                        config.text,
                      )}
                    />
                  </div>
                  {/* Text: zero height by default, expands on hover — both buttons expand together */}
                  <span
                    className={cn(
                      'text-[11px] font-medium leading-tight overflow-hidden transition-all duration-200',
                      'h-0 opacity-0 group-hover:min-h-5 group-hover:h-auto group-hover:opacity-100',
                      isSelected ? 'min-h-5 h-auto opacity-100' : '',
                      config.text,
                      'whitespace-normal',
                    )}
                  >
                    {rating === 'thumbsUp'
                      ? localize('com_ui_feedback_positive')
                      : localize('com_ui_feedback_negative')}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Modal 2: Detail form (tag options + textarea + mic) ── */}
      {selectedRating && (
        <FeedbackDetailDialog
          open={detailOpen}
          onOpenChange={setDetailOpen}
          rating={selectedRating}
          onSubmit={handleDetailSubmit}
          onClear={handleDetailClear}
        />
      )}
    </>
  );
});

FeedbackReminderPanel.displayName = 'FeedbackReminderPanel';

export default FeedbackReminderPanel;