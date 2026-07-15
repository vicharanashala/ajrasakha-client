import React, { memo } from 'react';
import {
  Button,
  OGDialog,
  OGDialogContent,
  OGDialogTitle,
  DialogDescription,
} from '@librechat/client';
import type { TFeedback } from 'librechat-data-provider';
import { useLocalize } from '~/hooks';
import Feedback from './Feedback';

interface FeedbackReminderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feedback?: TFeedback;
  handleFeedback: ({ feedback }: { feedback: TFeedback | undefined }) => void;
}

const FeedbackReminderDialog = memo(
  ({ open, onOpenChange, feedback, handleFeedback }: FeedbackReminderDialogProps) => {
    const localize = useLocalize();

    const onFeedback = ({ feedback }: { feedback: TFeedback | undefined }) => {
      handleFeedback({ feedback });

      if (feedback) {
        onOpenChange(false);
      }
    };

    return (
      <OGDialog open={open} onOpenChange={onOpenChange}>
        <OGDialogContent className="w-11/12 max-w-md">
          <OGDialogTitle className="text-token-text-primary text-lg font-semibold leading-6">
            {localize('com_ui_feedback_enforce_title')}
          </OGDialogTitle>

          <DialogDescription>{localize('com_ui_feedback_enforce_reminder')}</DialogDescription>

          <div className="mt-4 rounded-xl border border-border-medium bg-surface-secondary p-4">
            <p className="text-center text-sm text-text-secondary">
              {localize('com_ui_feedback_enforce_question')}
            </p>

            <div className="mt-4 flex items-center justify-center gap-4">
              <Feedback handleFeedback={onFeedback} feedback={feedback} isLast />
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {localize('com_ui_feedback_enforce_later')}
            </Button>
          </div>
        </OGDialogContent>
      </OGDialog>
    );
  },
);

FeedbackReminderDialog.displayName = 'FeedbackReminderDialog';

export default FeedbackReminderDialog;
