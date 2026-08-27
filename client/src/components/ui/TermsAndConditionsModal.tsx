import { useMemo } from 'react';
import { OGDialog, OGDialogContent, OGDialogHeader, OGDialogTitle, useToastContext } from '@librechat/client';
import type { TTermsOfService } from 'librechat-data-provider';
import MarkdownLite from '~/components/Chat/Messages/Content/MarkdownLite';
import { useAcceptTermsMutation } from '~/data-provider';
import { useLocalize } from '~/hooks';

/**
 * Acceptance dialog shown during onboarding. In `readOnly` mode it renders the same content
 * for later review from the account menu: dismissable, with no accept/decline mutation.
 */
const TermsAndConditionsModal = ({
  open,
  onOpenChange,
  onAccept,
  onDecline,
  title,
  modalContent,
  readOnly = false,
}: {
  open: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onAccept?: () => void;
  onDecline?: () => void;
  title?: string;
  contentUrl?: string;
  modalContent?: TTermsOfService['modalContent'];
  readOnly?: boolean;
}) => {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const acceptTermsMutation = useAcceptTermsMutation({
    onSuccess: () => {
      onAccept?.();
      onOpenChange(false);
    },
    onError: () => {
      showToast({ message: 'Failed to accept terms' });
    },
  });

  const handleAccept = () => {
    acceptTermsMutation.mutate();
  };

  const handleDecline = () => {
    onDecline?.();
    onOpenChange(false);
  };

  // Onboarding requires an explicit choice, so dismissal is blocked there; reviewing the
  // terms later can be closed normally.
  const handleOpenChange = (isOpen: boolean) => {
    if (!readOnly && open && !isOpen) {
      return;
    }
    onOpenChange(isOpen);
  };

  const content = useMemo(() => {
    const localizedContent = localize('com_ui_terms_modal_content_markdown');
    if (localizedContent && localizedContent !== 'com_ui_terms_modal_content_markdown') {
      return localizedContent;
    }

    if (typeof modalContent === 'string') {
      return modalContent;
    }

    if (Array.isArray(modalContent)) {
      return modalContent.join('\n');
    }

    return '';
  }, [modalContent, localize]);

  return (
    <OGDialog open={open} onOpenChange={handleOpenChange}>
      <OGDialogContent
        showCloseButton={readOnly}
        onInteractOutside={readOnly ? undefined : (e) => e.preventDefault()}
        className="terms-modal-shell flex w-11/12 max-w-2xl flex-col overflow-y-hidden p-4 sm:w-3/4 sm:p-6 md:w-2/3 lg:w-1/2"
      >
        <OGDialogHeader>
          <OGDialogTitle className="text-sm font-bold leading-snug text-text-primary sm:text-lg">
            {title ?? localize('com_ui_terms_and_conditions')}
          </OGDialogTitle>
        </OGDialogHeader>

        <section
          // Motivation: This is a dialog, so its content should be focusable
          tabIndex={0}
          className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-border-light bg-surface-secondary p-4 sm:p-5"
          aria-label={localize('com_ui_terms_and_conditions')}
        >
          <div className="terms-content-prose prose dark:prose-invert w-full max-w-none !text-text-primary prose-sm sm:prose-base">
            {content !== '' ? (
              <MarkdownLite content={content} />
            ) : (
              <p>{localize('com_ui_no_terms_content')}</p>
            )}
          </div>
        </section>

        <div className="mt-2 flex shrink-0 flex-col-reverse gap-2 border-t border-border-light px-1 pt-4 sm:flex-row sm:justify-end sm:gap-3">
          {readOnly ? (
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex w-full items-center justify-center rounded-lg border border-border-heavy bg-surface-secondary px-6 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-surface-hover sm:w-auto"
            >
              {localize('com_ui_close')}
            </button>
          ) : (
            <>
          <button
            type="button"
            onClick={handleDecline}
            className="inline-flex w-full items-center justify-center rounded-lg border border-border-heavy bg-surface-secondary px-6 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-surface-hover sm:w-auto"
          >
            {localize('com_ui_decline')}
          </button>
          <button
            type="button"
            onClick={handleAccept}
            disabled={acceptTermsMutation.isLoading}
            className="inline-flex w-full items-center justify-center rounded-lg bg-surface-submit px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {acceptTermsMutation.isLoading
              ? `${localize('com_ui_accept')}...`
              : localize('com_ui_accept')}
          </button>
            </>
          )}
        </div>
      </OGDialogContent>
    </OGDialog>
  );
};

export default TermsAndConditionsModal;
