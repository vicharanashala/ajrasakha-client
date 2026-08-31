import React, { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import { useWatch } from 'react-hook-form';
import type { Control } from 'react-hook-form';
import { Send } from 'lucide-react';
import { TooltipAnchor } from '@librechat/client';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

type SendButtonProps = {
  disabled: boolean;
  control: Control<{ text: string }>;
  /** Size override; the composer shrinks its buttons in the expanded card layout. */
  className?: string;
};

/** Runs the launch animation for a single submit, then clears the flag so the next tap
 *  replays it. The timer is cleared on unmount and on a rapid second tap. */
function useSendLaunch(durationMs = 420) {
  const [isLaunching, setIsLaunching] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  const launch = useCallback(() => {
    clearTimeout(timeoutRef.current);
    setIsLaunching(true);
    timeoutRef.current = setTimeout(() => setIsLaunching(false), durationMs);
  }, [durationMs]);

  return { isLaunching, launch };
}

const SubmitButton = React.memo(
  forwardRef(
    (
      props: { disabled: boolean; className?: string },
      ref: React.ForwardedRef<HTMLButtonElement>,
    ) => {
    const localize = useLocalize();
    const { isLaunching, launch } = useSendLaunch();
    return (
      <TooltipAnchor
        description={localize('com_nav_send_message')}
        render={
          <button
            ref={ref}
            aria-label={localize('com_nav_send_message')}
            id="send-button"
            disabled={props.disabled}
            onClick={launch}
            // Brand green once there is something to send — the button is disabled while the
            // box is empty, so the `disabled:` overrides carry the neutral resting look and
            // the base carries the active one. Same green as the mic, so the composer's two
            // primary actions match.
            className={cn(
              'flex size-11 shrink-0 items-center justify-center rounded-full bg-green-600 text-white md:size-[52px]',
              // Depth, in two parts: a hairline highlight along the top edge so the circle
              // reads as a raised surface rather than a flat disc, and a drop shadow tinted
              // with the button's own green instead of neutral black, matching the glow the
              // mic already casts. Dark mode takes the lighter brand green at lower opacity,
              // since a dark-green shadow is invisible against a dark page.
              'shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_2px_8px_-2px_rgba(25,135,84,0.5)]',
              'dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_2px_10px_-2px_rgba(117,215,178,0.3)]',
              'transition-[background-color,opacity,box-shadow,transform] duration-200',
              // Lifts a pixel and casts further on hover, then presses back in on click.
              'hover:-translate-y-px hover:opacity-90',
              'hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_6px_16px_-3px_rgba(25,135,84,0.55)]',
              'dark:hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_6px_18px_-3px_rgba(117,215,178,0.38)]',
              'active:translate-y-0 active:scale-[0.97]',
              'motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600/50',
              // Nothing to send, nothing to lift: the resting neutral state stays flat.
              'disabled:cursor-not-allowed disabled:bg-surface-secondary disabled:text-text-secondary disabled:opacity-50 disabled:shadow-none disabled:hover:translate-y-0 disabled:hover:opacity-50 disabled:hover:shadow-none',
              props.className,
            )}
            data-testid="send-button"
            type="submit"
          >
            <Send
              className={cn('size-5', isLaunching && 'animate-sendLaunch')}
              aria-hidden="true"
            />
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
