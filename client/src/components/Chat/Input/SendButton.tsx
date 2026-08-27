import React, { forwardRef } from 'react';
import { useWatch } from 'react-hook-form';
import type { Control } from 'react-hook-form';
import { ArrowRight } from 'lucide-react';
import { TooltipAnchor } from '@librechat/client';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

type SendButtonProps = {
  disabled: boolean;
  control: Control<{ text: string }>;
  /** Size override; the composer shrinks its buttons in the expanded card layout. */
  className?: string;
};

const SubmitButton = React.memo(
  forwardRef(
    (
      props: { disabled: boolean; className?: string },
      ref: React.ForwardedRef<HTMLButtonElement>,
    ) => {
    const localize = useLocalize();
    return (
      <TooltipAnchor
        description={localize('com_nav_send_message')}
        render={
          <button
            ref={ref}
            aria-label={localize('com_nav_send_message')}
            id="send-button"
            disabled={props.disabled}
            className={cn(
              'flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-secondary text-text-primary md:size-[52px]',
              'transition-colors duration-200 hover:bg-surface-hover',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-medium',
              'disabled:cursor-not-allowed disabled:bg-surface-secondary disabled:text-text-secondary disabled:opacity-50 disabled:hover:bg-surface-secondary',
              props.className,
            )}
            data-testid="send-button"
            type="submit"
          >
            <ArrowRight className="size-5" aria-hidden="true" />
          </button>
        }
      />
      );
    },
  ),
);

const SendButton = React.memo(
  forwardRef((props: SendButtonProps, ref: React.ForwardedRef<HTMLButtonElement>) => {
    const data = useWatch({ control: props.control });
    /** Always render the button so the input row doesn't lose its send action while empty;
     *  disable it instead of hiding it until there's text to send. */
    return (
      <SubmitButton
        ref={ref}
        disabled={props.disabled || !data.text}
        className={props.className}
      />
    );
  }),
);

export default SendButton;
