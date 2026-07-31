import React, { memo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  OGDialog,
  OGDialogContent,
  OGDialogTitle,
  DialogDescription,
} from '@librechat/client';
import type { TFeedback, TConversation, TMessage } from 'librechat-data-provider';
import { useLocalize } from '~/hooks';
import Feedback from './Feedback';

interface FeedbackReminderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feedback?: TFeedback;
  handleFeedback: ({ feedback }: { feedback: TFeedback | undefined }) => void;
  conversation?: TConversation | null;
  message?: TMessage | null;
}

const FeedbackReminderDialog = memo(
  ({ open, onOpenChange, feedback, handleFeedback, conversation, message }: FeedbackReminderDialogProps) => {
    const localize = useLocalize();
    const navigate = useNavigate();

    const onFeedback = ({ feedback }: { feedback: TFeedback | undefined }) => {
      handleFeedback({ feedback });

      if (feedback) {
        onOpenChange(false);
      }
    };

    const handleGoToConversation = useCallback((e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('----handleGoToConversation called----', conversation?.conversationId);
      if (conversation?.conversationId) {
        const targetPath = `/c/${conversation.conversationId}`;
        console.log('----navigating to----', targetPath);
        window.location.href = targetPath;
      }
    }, [conversation]);

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

          {conversation?.conversationId && (
            <div className="mt-2 text-center">
              <p className="text-xs text-text-secondary mb-1">
                {localize('com_ui_conversation') || 'Conversation'}:
              </p>
              <a
                href={`/c/${conversation.conversationId}`}
                className="text-sm text-blue-500 hover:underline break-all"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  window.location.href = `/c/${conversation.conversationId}`;
                }}
              >
                {window.location.origin}/c/{conversation.conversationId}
              </a>
            </div>
          )}

          <div className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
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
