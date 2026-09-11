import React, { memo, useState, useCallback, useEffect } from 'react';
import { useRecoilState, useSetRecoilState } from 'recoil';
import {
  Button,
  OGDialog,
  OGDialogContent,
  OGDialogTitle,
  DialogDescription,
} from '@librechat/client';
import { TFeedback, TConversation, TMessage } from 'librechat-data-provider';
import { MessageSquare } from 'lucide-react';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';
import store from '~/store';
import FeedbackDetailDialog from './FeedbackDetailDialog';

interface FeedbackReminderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feedback?: TFeedback;
  handleFeedback: ({ feedback }: { feedback: TFeedback | undefined }) => void;
  conversation?: TConversation | null;
  message?: TMessage | null;
}

/** Simple thumbs-up / thumbs-down face for the quick-rating modal */
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

const emojiConfig = {
  thumbsDown: {
    color: 'text-red-400',
    bg: 'bg-red-500/10 hover:bg-red-500/15 border-red-500/20',
    activeBg: 'bg-red-500/20 border-red-500/40',
    ring: 'ring-red-500/30',
    face: 'sad' as const,
  },
  thumbsUp: {
    color: 'text-green-400',
    bg: 'bg-green-500/10 hover:bg-green-500/15 border-green-500/20',
    activeBg: 'bg-green-500/20 border-green-500/40',
    ring: 'ring-green-500/30',
    face: 'happy' as const,
  },
};

function RatingCard({
  rating,
  selected,
  onClick,
}: {
  rating: 'thumbsUp' | 'thumbsDown';
  selected: boolean;
  onClick: () => void;
}) {
  const localize = useLocalize();
  const config = emojiConfig[rating];
  const labelKey = rating === 'thumbsUp' ? 'com_ui_feedback_positive' : 'com_ui_feedback_negative';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'flex flex-1 flex-col items-center gap-2 rounded-2xl border p-4 transition-all duration-200',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        config.bg,
        selected ? config.activeBg : '',
        selected ? `ring-2 ${config.ring}` : '',
      )}
    >
      <EmojiFace
        face={config.face}
        className={cn('transition-transform duration-200', selected && 'scale-110', config.color)}
      />
      <span className={cn('text-sm font-semibold', config.color)}>{localize(labelKey)}</span>
      {selected && (
        <span
          className={cn(
            'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-background',
            rating === 'thumbsUp' ? 'bg-green-400' : 'bg-red-400',
          )}
        >
          ✓
        </span>
      )}
    </button>
  );
}

const FeedbackReminderDialog = memo(
  ({
    open,
    onOpenChange,
    handleFeedback,
  }: FeedbackReminderDialogProps) => {
    const localize = useLocalize();
    const [, setIsRequiredFeedback] = useRecoilState(store.isRequiredFeedback);
    const setShowFeedbackReminder = useSetRecoilState(store.showFeedbackReminder);

    /** Which rating the user picked in Modal 1 (triggers Modal 2) */
    const [selectedRating, setSelectedRating] = useState<'thumbsUp' | 'thumbsDown' | null>(null);

    /** Whether Modal 2 (detail form) is open */
    const [detailOpen, setDetailOpen] = useState(false);

    /** Reset state whenever the quick-rating modal closes */
    useEffect(() => {
      if (!open) {
        setSelectedRating(null);
        setDetailOpen(false);
      }
    }, [open]);

    const handleRatingClick = useCallback((rating: 'thumbsUp' | 'thumbsDown') => {
      setSelectedRating(rating);
      setDetailOpen(true);
    }, []);

    const handleMaybeLater = useCallback(() => {
      setIsRequiredFeedback(false);
      onOpenChange(false);
    }, [setIsRequiredFeedback, onOpenChange]);

    /** Called when the user submits Modal 2 */
    const handleDetailSubmit = useCallback(
      (feedback: TFeedback) => {
        setIsRequiredFeedback(false);
        setShowFeedbackReminder(false);
        handleFeedback({ feedback });
        onOpenChange(false);
      },
      [handleFeedback, setIsRequiredFeedback, setShowFeedbackReminder, onOpenChange],
    );

    /** Called when the user clicks Delete in Modal 2 */
    const handleDetailClear = useCallback(() => {
      handleFeedback({ feedback: undefined });
    }, [handleFeedback]);

    return (
      <>
        {/* ── Modal 1: Quick rating (thumbs up / thumbs down) ── */}
        <OGDialog open={open} onOpenChange={onOpenChange}>
          <OGDialogContent className="max-w-md rounded-2xl border border-border-medium bg-surface-primary p-0 shadow-2xl">
            <div className="flex flex-col">
              {/* Top accent line */}
              <div className="h-1.5 w-full bg-green-500/80" />

              <div className="p-4 md:p-6">
                {/* Header */}
                <div className="mb-5 flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-500/10 text-green-400">
                    <MessageSquare size={20} />
                  </div>
                  <div className="flex-1">
                    <OGDialogTitle className="text-lg font-semibold text-text-primary">
                      {localize('com_ui_feedback_enforce_title')}
                    </OGDialogTitle>
                    <DialogDescription className="mt-1 text-sm leading-relaxed text-text-secondary">
                      {localize('com_ui_feedback_enforce_reminder')}
                    </DialogDescription>
                  </div>
                </div>

                {/* Question */}
                <p className="mb-4 text-sm font-medium text-text-primary">
                  {localize('com_ui_feedback_enforce_question')}
                </p>

                {/* Thumbs up / thumbs down cards */}
                <div className="mb-5 flex gap-3">
                  <RatingCard
                    rating="thumbsUp"
                    selected={selectedRating === 'thumbsUp'}
                    onClick={() => handleRatingClick('thumbsUp')}
                  />
                  <RatingCard
                    rating="thumbsDown"
                    selected={selectedRating === 'thumbsDown'}
                    onClick={() => handleRatingClick('thumbsDown')}
                  />
                </div>

                {/* Footer: maybe later */}
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleMaybeLater}
                    className="text-xs text-text-secondary hover:text-text-primary"
                  >
                    {localize('com_ui_feedback_enforce_later')}
                  </Button>
                </div>
              </div>
            </div>
          </OGDialogContent>
        </OGDialog>

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
  },
);

FeedbackReminderDialog.displayName = 'FeedbackReminderDialog';

export default FeedbackReminderDialog;