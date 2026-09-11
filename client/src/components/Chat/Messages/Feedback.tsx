import React, { useState, useCallback, useEffect } from 'react';
import { TFeedback } from 'librechat-data-provider';
import { ThumbUpIcon, ThumbDownIcon } from '@librechat/client';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';
import { useRecoilState } from 'recoil';
import FeedbackDetailDialog from './FeedbackDetailDialog';
import store from '~/store';

interface FeedbackProps {
  handleFeedback: ({ feedback }: { feedback: TFeedback | undefined }) => void;
  feedback?: TFeedback;
  isLast?: boolean;
}

function FeedbackButtons({
  isLast,
  feedback,
  onThumbClick,
}: {
  isLast: boolean;
  feedback?: TFeedback;
  onThumbClick: (rating: 'thumbsUp' | 'thumbsDown') => void;
}) {
  const localize = useLocalize();

  return (
    <>
      <button
        className={buttonClasses(feedback?.rating === 'thumbsUp', isLast)}
        onClick={() => onThumbClick('thumbsUp')}
        type="button"
        title={localize('com_ui_feedback_positive')}
        aria-pressed={feedback?.rating === 'thumbsUp'}
      >
        <ThumbUpIcon size="19" bold={feedback?.rating === 'thumbsUp'} />
      </button>

      <button
        className={buttonClasses(feedback?.rating === 'thumbsDown', isLast)}
        onClick={() => onThumbClick('thumbsDown')}
        type="button"
        title={localize('com_ui_feedback_negative')}
        aria-pressed={feedback?.rating === 'thumbsDown'}
      >
        <ThumbDownIcon size="19" bold={feedback?.rating === 'thumbsDown'} />
      </button>
    </>
  );
}

function buttonClasses(isActive: boolean, isLast: boolean) {
  return cn(
    'hover-button rounded-lg p-1.5 text-text-secondary-alt',
    'hover:text-text-primary hover:bg-surface-hover',
    'md:group-hover:visible md:group-focus-within:visible md:group-[.final-completion]:visible',
    !isLast && 'md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100',
    'focus-visible:ring-2 focus-visible:ring-black dark:focus-visible:ring-white focus-visible:outline-none',
    isActive && 'active text-text-primary bg-surface-hover',
  );
}

export default function Feedback({
  isLast = false,
  handleFeedback,
  feedback: initialFeedback,
}: FeedbackProps) {
  const localize = useLocalize();
  const [openDialog, setOpenDialog] = useState(false);
  const [feedback, setFeedback] = useState<TFeedback | undefined>(initialFeedback);
  const [selectedRating, setSelectedRating] = useState<'thumbsUp' | 'thumbsDown' | null>(null);
  const [, setIsFeedbackDialogOpen] = useRecoilState(store.isFeedbackDialogOpen);

  useEffect(() => {
    setIsFeedbackDialogOpen(openDialog);
  }, [openDialog, setIsFeedbackDialogOpen]);

  useEffect(() => {
    setFeedback(initialFeedback);
  }, [initialFeedback]);

  const propagateMinimal = useCallback(
    (fb: TFeedback | undefined) => {
      setFeedback(fb);
      handleFeedback({ feedback: fb });
    },
    [handleFeedback],
  );

  const handleDetailSubmit = useCallback(
    (fb: TFeedback) => {
      propagateMinimal(fb);
    },
    [propagateMinimal],
  );

  const handleDetailClear = useCallback(() => {
    propagateMinimal(undefined);
  }, [propagateMinimal]);

  const handleThumbClick = useCallback((rating: 'thumbsUp' | 'thumbsDown') => {
    setSelectedRating(rating);
    setOpenDialog(true);
  }, []);

  const renderSingleFeedbackButton = () => {
    if (!feedback) return null;
    const isThumbsUp = feedback.rating === 'thumbsUp';
    const Icon = isThumbsUp ? ThumbUpIcon : ThumbDownIcon;
    const label = isThumbsUp
      ? localize('com_ui_feedback_positive')
      : localize('com_ui_feedback_negative');
    return (
      <button
        className={buttonClasses(true, isLast)}
        onClick={() => {
          if (isThumbsUp) {
            propagateMinimal(undefined);
          } else {
            setSelectedRating('thumbsDown');
            setOpenDialog(true);
          }
        }}
        type="button"
        title={label}
        aria-pressed="true"
      >
        <Icon size="19" bold />
      </button>
    );
  };

  return (
    <>
      {feedback ? (
        renderSingleFeedbackButton()
      ) : (
        <FeedbackButtons isLast={isLast} feedback={feedback} onThumbClick={handleThumbClick} />
      )}
      {/* Same detail modal used by the feedback reminder flow (tags + textarea
          + mic), kept consistent across both entry points instead of this
          component maintaining its own separate dialog implementation. */}
      {selectedRating && (
        <FeedbackDetailDialog
          open={openDialog}
          onOpenChange={setOpenDialog}
          rating={selectedRating}
          onSubmit={handleDetailSubmit}
          onClear={handleDetailClear}
        />
      )}
    </>
  );
}
