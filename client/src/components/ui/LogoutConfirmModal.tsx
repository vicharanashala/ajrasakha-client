import {
  OGDialog,
  OGDialogContent,
  OGDialogDescription,
  OGDialogHeader,
  OGDialogTitle,
} from '@librechat/client';
import { LogOut } from 'lucide-react';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

/** Shared shape for both actions so the pair reads as one control group, full width when
 *  they stack on a phone and side by side from sm up. */
const ACTION_BUTTON_BASE = cn(
  'inline-flex w-full items-center justify-center rounded-full px-5 py-2.5 text-sm',
  'transition-[background-color,box-shadow,transform] duration-200',
  'focus-visible:outline-none focus-visible:ring-2',
  'motion-reduce:transition-none',
  'sm:flex-1',
);

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
        className="w-11/12 max-w-sm gap-0 overflow-hidden p-0 text-center"
      >
        {/* Soft brand-tinted top area so the dialog feels part of the app, not a system prompt. */}
        <div className="bg-gradient-to-b from-green-500/10 to-transparent px-6 pb-2 pt-8 dark:from-green-400/10">
          <OGDialogHeader className="flex flex-col items-center gap-4 space-y-0 text-center sm:text-center">
            {/* App mark with a small sign-out badge: signing out ends a session without
                losing anything, so the moment stays on-brand instead of alarming. */}
            <span className="relative flex size-16 items-center justify-center rounded-2xl bg-surface-primary shadow-md ring-1 ring-green-600/20 dark:ring-green-400/20">
              <img
                src="/assets/annam-logo.png"
                alt=""
                aria-hidden="true"
                className="size-9 object-contain"
              />
              <span className="absolute -bottom-1.5 -right-1.5 flex size-6 items-center justify-center rounded-full bg-green-600 text-white ring-2 ring-surface-primary">
                <LogOut className="size-3.5" aria-hidden="true" />
              </span>
            </span>
            <div className="flex min-w-0 flex-col gap-1.5">
              <OGDialogTitle className="text-center text-lg font-semibold text-text-primary sm:text-xl">
                {localize('com_nav_log_out')}
              </OGDialogTitle>
              {/* The dialog's own description element, so screen readers announce it with the
                  title instead of it being a loose paragraph. */}
              <OGDialogDescription className="text-center text-sm leading-relaxed text-text-secondary">
                {localize('com_nav_log_out_confirm_message')}
              </OGDialogDescription>
            </div>
          </OGDialogHeader>
        </div>

        {/* Full width and stacked on a phone, where thumb reach matters more than economy;
            a right-aligned pair from sm up, which is where a confirm dialog expects them. */}
        <div className="mt-4 flex flex-col gap-2.5 border-t border-border-light p-5 sm:flex-row sm:gap-3 sm:px-6">
          {/* Cancel is the highlighted, focused default so a stray Enter keeps the session. */}
          <button
            type="button"
            autoFocus
            onClick={() => onOpenChange(false)}
            className={cn(
              ACTION_BUTTON_BASE,
              'bg-green-600 font-semibold text-white',
              'shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_2px_8px_-2px_rgba(25,135,84,0.5)]',
              'dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_2px_10px_-2px_rgba(117,215,178,0.3)]',
              'hover:-translate-y-px hover:opacity-90',
              'hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_6px_16px_-3px_rgba(25,135,84,0.55)]',
              'dark:hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_6px_18px_-3px_rgba(117,215,178,0.38)]',
              'active:translate-y-0 active:scale-[0.97]',
              'motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100',
              'focus-visible:ring-green-600/50',
            )}
          >
            {localize('com_ui_cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className={cn(
              ACTION_BUTTON_BASE,
              'border border-border-medium bg-transparent font-medium text-text-secondary',
              'hover:bg-surface-hover hover:text-text-primary focus-visible:ring-border-heavy',
            )}
          >
            {localize('com_nav_log_out')}
          </button>
        </div>
      </OGDialogContent>
    </OGDialog>
  );
};

export default LogoutConfirmModal;
