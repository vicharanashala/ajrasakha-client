import React, { memo, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  Button,
  OGDialog,
  OGDialogContent,
  OGDialogTitle,
  DialogDescription,
  useToastContext,
} from '@librechat/client';
import { TFeedback, TFeedbackTag, getTagsForRating } from 'librechat-data-provider';
import { Mic, Square } from 'lucide-react';
import { useLocalize, useSpeechToText } from '~/hooks';
import { useForm } from 'react-hook-form';
import { cn } from '~/utils';

interface FeedbackDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rating: 'thumbsUp' | 'thumbsDown';
  onSubmit: (feedback: TFeedback) => void;
  onClear: () => void;
}

interface FeedbackForm {
  text: string;
}

function FeedbackOptionButton({
  tag,
  active,
  rating,
  onClick,
}: {
  tag: TFeedbackTag;
  active?: boolean;
  rating: 'thumbsUp' | 'thumbsDown';
  onClick: () => void;
}) {
  const localize = useLocalize();
  const label = localize(tag.label as Parameters<typeof localize>[0]);
  const isPositive = rating === 'thumbsUp';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200',
        'border focus:outline-none focus-visible:ring-2',
        active
          ? isPositive
            ? 'border-green-500/50 bg-green-500/15 text-green-300 focus-visible:ring-green-500/20'
            : 'border-rose-500/50 bg-rose-500/15 text-rose-300 focus-visible:ring-rose-500/20'
          : 'border-border-medium bg-surface-secondary text-text-secondary hover:bg-surface-hover hover:text-text-primary focus-visible:ring-green-500/20',
      )}
    >
      {label}
    </button>
  );
}

const FeedbackDetailDialog = memo(
  ({ open, onOpenChange, rating, onSubmit, onClear }: FeedbackDetailDialogProps) => {
    const localize = useLocalize();
    const { showToast } = useToastContext();
    const methods = useForm<FeedbackForm>({ defaultValues: { text: '' } });
    const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
    const { ref: rhfRef, ...textRegister } = methods.register('text');

    const [selectedTag, setSelectedTag] = useState<TFeedbackTag | undefined>(undefined);
    const [submittedFeedback, setSubmittedFeedback] = useState<TFeedback | undefined>(undefined);

    const { isListening, startRecording, stopRecording, error } = useSpeechToText(
      (text) => {
        methods.setValue('text', text);
        setSubmittedFeedback((prev) => (prev ? { ...prev, text } : prev));
      },
      (text) => {
        methods.setValue('text', text);
        setSubmittedFeedback((prev) => (prev ? { ...prev, text } : prev));
      },
      open,
    );

    useEffect(() => {
      if (!open) {
        setSelectedTag(undefined);
        setSubmittedFeedback(undefined);
        methods.reset({ text: '' });
        stopRecording();
      }
    }, [open, methods, stopRecording]);

    const feedbackOptions = useMemo(() => getTagsForRating(rating), [rating]);

    const handleTagClick = useCallback((tag: TFeedbackTag) => {
      setSelectedTag(tag);
    }, []);

    const handleSave = useCallback(() => {
      const text = methods.getValues('text').trim();
      const feedback: TFeedback = {
        rating,
        tag: selectedTag,
        text,
      };
      setSubmittedFeedback(feedback);
      onSubmit(feedback);
      onOpenChange(false);
      showToast({ message: localize('com_ui_feedback_thank_you'), status: 'success' });
    }, [rating, selectedTag, methods, onSubmit, onOpenChange, showToast, localize]);

    const handleClear = useCallback(() => {
      methods.reset({ text: '' });
      setSelectedTag(undefined);
      setSubmittedFeedback(undefined);
      onClear();
      onOpenChange(false);
    }, [methods, onClear, onOpenChange]);

    const canSave = selectedTag !== undefined || methods.getValues('text').trim().length > 0;

    return (
      <OGDialog open={open} onOpenChange={onOpenChange}>
        <OGDialogContent className="w-11/12 max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-border-medium bg-surface-primary p-0 shadow-2xl">
          <div className="flex flex-col">
            {/* Top accent line — green for thumbsUp, red for thumbsDown */}
            <div
              className={cn(
                'h-1.5 w-full',
                rating === 'thumbsUp' ? 'bg-green-500/80' : 'bg-red-500/80',
              )}
            />

            <div className="p-4 md:p-6">
              {/* Header */}
              <OGDialogTitle className="text-lg font-semibold text-text-primary">
                {rating === 'thumbsUp'
                  ? localize('com_ui_feedback_detail_positive_title')
                  : localize('com_ui_feedback_detail_negative_title')}
              </OGDialogTitle>
              <DialogDescription className="mt-1 text-sm leading-relaxed text-text-secondary">
                {rating === 'thumbsUp'
                  ? localize('com_ui_feedback_detail_positive_desc')
                  : localize('com_ui_feedback_detail_negative_desc')}
              </DialogDescription>

              {/* Tag options */}
              <div className="mt-4 flex flex-wrap gap-2">
                {feedbackOptions.map((tag) => (
                  <FeedbackOptionButton
                    key={tag.key}
                    tag={tag}
                    rating={rating}
                    active={selectedTag?.key === tag.key}
                    onClick={() => handleTagClick(tag)}
                  />
                ))}
              </div>

              {/* Textarea with mic suffix */}
              <div className="relative mt-4">
                <textarea
                  {...textRegister}
                  onChange={(e) => {
                    textRegister.onChange(e);
                    setSubmittedFeedback((prev) => ({
                      rating,
                      tag: prev?.tag,
                      text: e.target.value,
                    }));
                  }}
                  ref={(el) => {
                    textAreaRef.current = el;
                    rhfRef(el);
                  }}
                  className={cn(
                    'w-full resize-none rounded-xl border border-border-medium bg-surface-secondary p-3 pr-10 text-sm text-text-primary',
                    'placeholder:text-text-secondary/60',
                    rating === 'thumbsUp'
                      ? 'focus:border-green-500/50 focus:ring-green-500/20'
                      : 'focus:border-rose-500/50 focus:ring-rose-500/20',
                    'transition-colors duration-200',
                  )}
                  rows={3}
                  placeholder={localize('com_ui_feedback_placeholder') + ' (optional)'}
                />
                <button
                  type="button"
                  onClick={isListening ? stopRecording : startRecording}
                  className={cn(
                    'absolute bottom-2.5 right-2.5 flex items-center justify-center rounded-full p-1.5 transition-all duration-200',
                    isListening
                      ? 'text-red-400'
                      : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
                  )}
                  title={isListening ? localize('com_ui_stop') : localize('com_ui_use_micrphone')}
                >
                  {isListening ? (
                    <Square className="rounded-sm bg-red-500" size={16} />
                  ) : (
                    <Mic size={18} />
                  )}
                </button>
              </div>

              {error && (
                <div className="mt-2 text-center text-sm font-medium text-red-400">{error}</div>
              )}

              {/* Save / Delete */}
              <div className="mt-4 flex gap-3">
                <Button className="flex-1" variant="outline" onClick={handleClear}>
                  {localize('com_ui_delete')}
                </Button>
                <Button
                  className="flex-1"
                  variant="submit"
                  onClick={handleSave}
                  disabled={!canSave}
                >
                  {localize('com_ui_save')}
                </Button>
              </div>
            </div>
          </div>
        </OGDialogContent>
      </OGDialog>
    );
  },
);

FeedbackDetailDialog.displayName = 'FeedbackDetailDialog';

export default FeedbackDetailDialog;