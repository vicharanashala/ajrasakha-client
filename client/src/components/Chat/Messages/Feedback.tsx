import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { TFeedback, TFeedbackTag, getTagsForRating } from 'librechat-data-provider';
import {
  Button,
  OGDialog,
  OGDialogContent,
  OGDialogTitle,
  ThumbUpIcon,
  ThumbDownIcon,
  DialogDescription,
} from '@librechat/client';
import { Mic, Square } from 'lucide-react';
import { useLocalize, useSpeechToText } from '~/hooks';
import { cn } from '~/utils';
import { FormProvider, useForm } from 'react-hook-form';
import { useRecoilState } from 'recoil';
import store from '~/store';

interface FeedbackProps {
  handleFeedback: ({ feedback }: { feedback: TFeedback | undefined }) => void;
  feedback?: TFeedback;
  isLast?: boolean;
}

interface FeedbackForm {
  text: string;
}

function FeedbackOptionButton({
  tag,
  active,
  onClick,
  name,
}: {
  tag: TFeedbackTag;
  active?: boolean;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  name: string;
}) {
  const localize = useLocalize();
  const label = localize(tag.label as Parameters<typeof localize>[0]);

  return (
    <button
      className={cn(
        'flex w-full items-center gap-3 rounded-xl border border-border-medium p-3 text-left',
        'transition-colors duration-200 hover:bg-surface-hover',
        active && 'bg-surface-hover',
      )}
      onClick={onClick}
      type="button"
      aria-label={label}
      aria-pressed={active}
    >
      <input type="radio" name={name} checked={active} readOnly className="h-4 w-4 shrink-0" />

      <span className={cn('text-text-secondary', active && 'font-semibold text-text-primary')}>
        {label}
      </span>
    </button>
  );
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
  const methods = useForm<FeedbackForm>({
    defaultValues: { text: '' },
  });
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const [, setIsFeedbackDialogOpen] = useRecoilState(store.isFeedbackDialogOpen);

  const { isListening, isLoading, startRecording, stopRecording } = useSpeechToText(
    (text) => {
      methods.setValue('text', text);
      setFeedback((prev) => (prev ? { ...prev, text } : prev));
    },
    (text) => {
      methods.setValue('text', text);
      setFeedback((prev) => (prev ? { ...prev, text } : prev));
    },
    openDialog,
  );

  const { ref: rhfRef, ...textRegister } = methods.register('text');

  useEffect(() => {
    setIsFeedbackDialogOpen(openDialog);
  }, [openDialog]);

  useEffect(() => {
    setFeedback(initialFeedback);
    methods.setValue('text', initialFeedback?.text || '');
  }, [initialFeedback, methods]);

  const propagateMinimal = useCallback(
    (fb: TFeedback | undefined) => {
      setFeedback(fb);
      handleFeedback({ feedback: fb });
    },
    [handleFeedback],
  );

  const handleButtonFeedback = useCallback(
    (fb: TFeedback | undefined) => {
      setOpenDialog(false);
      propagateMinimal(fb);
    },
    [propagateMinimal],
  );

  // const handleOtherOpen = useCallback(() => setOpenDialog(true), []);
  const handleDialogSave = useCallback(() => {
    const text = methods.getValues('text');
    const updatedFeedback = feedback
      ? {
          ...feedback,
          text,
        }
      : undefined;
    // handleFeedback({ feedback });
    propagateMinimal(updatedFeedback);
    setOpenDialog(false);
  }, [feedback, propagateMinimal, methods]);

  const handleDialogClear = useCallback(() => {
    methods.reset({ text: '' });
    setFeedback(undefined);
    handleFeedback({ feedback: undefined });
    setOpenDialog(false);
  }, [handleFeedback, methods]);

  useEffect(() => {
    if (!openDialog) {
      stopRecording();
    }
  }, [openDialog]);

  const [selectedRating, setSelectedRating] = useState<'thumbsUp' | 'thumbsDown' | null>(null);

  const feedbackOptions = useMemo(() => {
    if (!selectedRating) {
      return [];
    }
    return getTagsForRating(selectedRating);
  }, [selectedRating]);

  const handleThumbClick = useCallback(
    (rating: 'thumbsUp' | 'thumbsDown') => {
      setSelectedRating(rating);
      setFeedback(undefined);
      methods.reset({ text: '' });
      setOpenDialog(true);
    },
    [methods],
  );

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
            handleButtonFeedback(undefined);
          } else {
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
      <OGDialog open={openDialog} onOpenChange={setOpenDialog}>
        <FormProvider {...methods}>
          <OGDialogContent className="w-11/12 max-w-3xl">
            {' '}
            <OGDialogTitle className="text-token-text-primary text-lg font-semibold leading-6">
              {localize('com_ui_feedback_more_information')}
            </OGDialogTitle>
            <DialogDescription>
              {localize('com_ui_feedback_what_worked_what_not')}
            </DialogDescription>
            <div className="grid grid-cols-2 gap-3">
              {feedbackOptions.map((tag) => (
                <FeedbackOptionButton
                  key={tag.key}
                  tag={tag}
                  name="feedback-option"
                  active={feedback?.tag?.key === tag.key}
                  onClick={() => {
                    setFeedback({
                      rating: selectedRating!,
                      tag,
                      text: methods.getValues('text'),
                    });
                  }}
                />
              ))}
            </div>
            <textarea
              {...textRegister}
              onChange={(e) => {
                textRegister.onChange(e);
                setFeedback((prev) =>
                  prev
                    ? {
                        ...prev,
                        text: e.target.value,
                      }
                    : prev,
                );
              }}
              ref={(el) => {
                textAreaRef.current = el;
                rhfRef(el);
              }}
              className="w-full rounded-xl border bg-transparent p-2"
              rows={4}
              placeholder={localize('com_ui_feedback_placeholder')}
            />
            <div className="mt-3 flex justify-center">
              <button
                type="button"
                onClick={isListening ? stopRecording : startRecording}
                className={cn(
                  'flex items-center gap-2 rounded-full px-3 py-2',
                  isListening ? 'text-red-500' : 'hover:bg-surface-hover',
                )}
              >
                <div className="flex flex-col items-center justify-center">
                  {!isListening ? (
                    <Mic size="28" className="rounded-full" />
                  ) : (
                    <div
                      className={cn(
                        'flex h-full w-10 animate-pulse items-center justify-center rounded-full transition-all',
                      )}
                    >
                      <Square
                        className="text-red rounded-md bg-red-500 shadow-[0_0_0_10px_rgba(239,68,68,0.2)]"
                        size={30}
                      />
                    </div>
                  )}
                  <div className="mt-2.5 text-sm">
                    {isListening ? localize('com_ui_stop') : localize('com_ui_use_micrphone')}
                  </div>
                </div>
              </button>
            </div>
            <div className="mt-4 flex items-end justify-between gap-2">
              <Button className="w-full" variant="destructive" onClick={handleDialogClear}>
                {localize('com_ui_delete')}
              </Button>
              <Button
                className="w-full"
                variant="submit"
                onClick={handleDialogSave}
                disabled={!feedback?.tag && !feedback?.text?.trim()}
              >
                {localize('com_ui_save')}
              </Button>
            </div>
          </OGDialogContent>
        </FormProvider>
      </OGDialog>
    </>
  );
}
