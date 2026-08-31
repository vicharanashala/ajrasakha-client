import {
  OGDialog,
  OGDialogContent,
  OGDialogDescription,
  OGDialogHeader,
  OGDialogTitle,
} from '@librechat/client';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

/** Shared shape for both actions so the pair reads as one control group, full width when
 *  they stack on a phone and side by side from sm up. */
const ACTION_BUTTON_BASE = cn(
  'inline-flex w-full items-center justify-center rounded-full px-5 py-2.5 text-sm',
  'transition-[background-color,box-shadow,transform] duration-200',
  'focus-visible:outline-none focus-visible:ring-2',
  'motion-reduce:transition-none',
  'sm:w-auto sm:min-w-[7rem]',
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
        className="w-11/12 max-w-sm gap-0 p-5 text-left sm:p-6"
      >
        {/* Mark and copy sit side by side rather than stacked and centred: the dialog stays
            short, and the eye runs straight from the logo into the title. */}
        <OGDialogHeader className="flex flex-row items-start gap-3.5 space-y-0 text-left sm:gap-4 sm:text-left">
          {/* The app mark rather than a generic sign-out glyph: signing out ends a session
              without losing anything, so the moment stays on-brand instead of alarming. */}
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-green-500/10 dark:bg-green-400/10 sm:size-12">
            <img
              src="/assets/annam-logo.png"
              alt=""
              aria-hidden="true"
              className="size-6 object-contain sm:size-7"
            />
          </span>
          <div className="flex min-w-0 flex-col gap-1.5">
            <OGDialogTitle className="text-left text-base font-semibold text-text-primary sm:text-lg">
              {localize('com_nav_log_out')}
            </OGDialogTitle>
            {/* The dialog's own description element, so screen readers announce it with the
                title instead of it being a loose paragraph. */}
            <OGDialogDescription className="text-left text-sm leading-relaxed text-text-secondary">
              {localize('com_nav_log_out_confirm_message')}
            </OGDialogDescription>
          </div>
        </OGDialogHeader>

        {/* Full width and stacked on a phone, where thumb reach matters more than economy;
            a right-aligned pair from sm up, which is where a confirm dialog expects them. */}
        <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end sm:gap-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className={cn(
              ACTION_BUTTON_BASE,
              'border border-border-medium bg-transparent font-medium text-text-primary',
              'hover:bg-surface-hover focus-visible:ring-border-heavy',
            )}
          >
            {localize('com_ui_cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
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
            {localize('com_nav_log_out')}
          </button>
        </div>
      </OGDialogContent>
    </OGDialog>
  );
};

export default LogoutConfirmModal;
