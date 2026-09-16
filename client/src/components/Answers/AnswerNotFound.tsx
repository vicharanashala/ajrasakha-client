import { useNavigate } from 'react-router-dom';
import { Button } from '@librechat/client';
import { FileQuestion, Home, RotateCw, TriangleAlert } from 'lucide-react';
import { useLocalize } from '~/hooks';

interface AnswerNotFoundProps {
  /** `not-found` is used when the answer does not exist, `error` when fetching failed. */
  variant?: 'not-found' | 'error';
  onRetry?: () => void;
}

// Renders the empty and error states of the answer page using the app theme tokens.
export default function AnswerNotFound({ variant = 'not-found', onRetry }: AnswerNotFoundProps) {
  const navigate = useNavigate();
  const localize = useLocalize();

  const isError = variant === 'error';
  const StatusIcon = isError ? TriangleAlert : FileQuestion;
  const title = isError
    ? localize('com_ui_failed_to_fetch_answer')
    : localize('com_ui_answer_not_found');
  const description = isError
    ? localize('com_ui_failed_to_fetch_answer_description')
    : localize('com_ui_answer_not_found_description');

  return (
    <div
      role="alert"
      aria-live="polite"
      className="flex h-full w-full items-center justify-center overflow-y-auto bg-surface-primary px-4 py-10 sm:px-6"
    >
      <div className="flex w-full max-w-md flex-col items-center text-center">
        {/* The app mark carries the state icon so the page stays on-brand while the
            small badge still says which state the user landed in. */}
        <div className="relative">
          <span className="flex size-14 items-center justify-center rounded-full bg-green-500/10 dark:bg-green-400/10 sm:size-16">
            <img
              src="/assets/annam-logo.png"
              alt=""
              aria-hidden="true"
              className="size-7 object-contain sm:size-8"
            />
          </span>
          <span className="absolute -bottom-0.5 -right-0.5 flex size-6 items-center justify-center rounded-full border border-border-light bg-surface-primary sm:size-7">
            <StatusIcon className="size-3.5 text-text-secondary sm:size-4" aria-hidden="true" />
          </span>
        </div>

        <h1 className="mt-5 text-lg font-semibold text-text-primary sm:text-xl">{title}</h1>
        <p className="mt-2 text-sm text-text-secondary sm:text-base">{description}</p>

        <div className="mt-6 flex w-full flex-col-reverse items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Button variant="outline" onClick={() => navigate('/')} className="w-full sm:w-auto">
            <Home className="size-4" aria-hidden="true" />
            {localize('com_ui_go_back_home')}
          </Button>
          {isError && onRetry && (
            <Button variant="submit" onClick={onRetry} className="w-full sm:w-auto">
              <RotateCw className="size-4" aria-hidden="true" />
              {localize('com_ui_retry')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
