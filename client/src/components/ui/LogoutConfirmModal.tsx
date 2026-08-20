import { LogOut } from 'lucide-react';
import { OGDialog, OGDialogContent, OGDialogHeader, OGDialogTitle } from '@librechat/client';
import { useLocalize } from '~/hooks';

const LogoutConfirmModal = ({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onConfirm: () => void;
}) => {
  const localize = useLocalize();

  const handleConfirm = () => {
    onOpenChange(false);
    onConfirm();
  };

  return (
    <OGDialog open={open} onOpenChange={onOpenChange}>
      <OGDialogContent
        showCloseButton={false}
        onInteractOutside={(e) => e.preventDefault()}
        className="flex w-11/12 max-w-xs flex-col items-center p-5 text-center sm:max-w-sm sm:p-6"
      >
        <OGDialogHeader className="flex flex-col items-center space-y-0 text-center sm:text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-destructive/10 text-surface-destructive sm:h-14 sm:w-14">
            <LogOut className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden="true" />
          </div>
          <OGDialogTitle className="text-center text-base font-bold text-text-primary sm:text-lg">
            {localize('com_nav_log_out')}
          </OGDialogTitle>
        </OGDialogHeader>

        <p className="mb-5 mt-1 text-center text-sm text-text-secondary">
          {localize('com_nav_log_out_confirm_message')}
        </p>

        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-center sm:gap-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex w-full items-center justify-center rounded-full border border-border-heavy bg-surface-secondary px-5 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-surface-hover sm:w-auto"
          >
            {localize('com_ui_cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="inline-flex w-full items-center justify-center rounded-full bg-surface-destructive px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-surface-destructive-hover sm:w-auto"
          >
            {localize('com_nav_log_out')}
          </button>
        </div>
      </OGDialogContent>
    </OGDialog>
  );
};

export default LogoutConfirmModal;
