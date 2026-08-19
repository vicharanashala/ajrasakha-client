import { OGDialog, OGDialogContent, useToastContext } from '@librechat/client';
import { useAcceptSecondTermsMutation } from '~/data-provider';
import { useLocalize } from '~/hooks';

const ImportantNoticeModal = ({
  open,
  onOpenChange,
  onAccept,
  onDecline,
}: {
  open: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onAccept: () => void;
  onDecline: () => void;
}) => {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const acceptSecondTermsMutation = useAcceptSecondTermsMutation({
    onSuccess: () => {
      onAccept();
      onOpenChange(false);
    },
    onError: () => {
      showToast({ message: 'Failed to accept notice' });
    },
  });

  const handleAccept = () => {
    acceptSecondTermsMutation.mutate();
  };

  const handleDecline = () => {
    onDecline();
    onOpenChange(false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (open && !isOpen) {
      return;
    }
    onOpenChange(isOpen);
  };

  return (
    <OGDialog open={open} onOpenChange={handleOpenChange}>
      <OGDialogContent
        showCloseButton={false}
        onInteractOutside={(e) => e.preventDefault()}
        className="notice-modal-shell flex w-11/12 max-w-2xl flex-col overflow-y-hidden p-4 sm:w-3/4 sm:p-6 md:w-2/3 lg:w-1/2"
      >
        <section
          tabIndex={0}
          className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-border-light bg-surface-secondary p-4 sm:p-6"
        >
          <div className="prose dark:prose-invert w-full max-w-none !text-text-primary prose-sm sm:prose-base">
            {/* Icon */}
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-surface-destructive/10 text-surface-destructive sm:h-20 sm:w-20">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-8 w-8 sm:h-11 sm:w-11"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z"
                  clipRule="evenodd"
                />
              </svg>
            </div>

            {/* Heading */}
            <h2 className="!mt-0 mb-1 text-center text-lg font-bold text-surface-destructive sm:text-2xl">
              {localize('com_ui_important_notice').replace(/\s*\(.*\)$/, '')}
            </h2>
            <p className="mb-4 text-center text-xs !text-text-secondary sm:text-sm">
              {localize('com_ui_important_notice').match(/\((.*)\)/)?.[0] || ''}
            </p>

            <hr className="border-border-light" />

            <p>{localize('com_ui_important_notice_p1')}</p>
            <p>{localize('com_ui_important_notice_p2')}</p>
            <p>{localize('com_ui_important_notice_p3')}</p>
            <p>{localize('com_ui_important_notice_p4')}</p>
            <p>
              <strong>{localize('com_ui_important_notice_p5')}</strong>
            </p>
            <p>{localize('com_ui_important_notice_p6')}</p>
          </div>
        </section>

        <div className="mt-2 flex shrink-0 flex-col-reverse gap-2 border-t border-border-light px-1 pt-4 sm:flex-row sm:justify-end sm:gap-3">
          <button
            type="button"
            onClick={handleDecline}
            className="inline-flex w-full items-center justify-center rounded-lg bg-surface-destructive px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-surface-destructive-hover sm:w-auto"
          >
            {localize('com_ui_important_notice_decline')}
          </button>
          <button
            type="button"
            onClick={handleAccept}
            disabled={acceptSecondTermsMutation.isLoading}
            className="inline-flex w-full items-center justify-center rounded-lg bg-surface-submit px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-surface-submit-hover disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {acceptSecondTermsMutation.isLoading
              ? `${localize('com_ui_important_notice_agree')}...`
              : localize('com_ui_important_notice_agree')}
          </button>
        </div>
      </OGDialogContent>
    </OGDialog>
  );
};

export default ImportantNoticeModal;
