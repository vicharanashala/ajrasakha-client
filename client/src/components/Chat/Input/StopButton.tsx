import { TooltipAnchor } from '@librechat/client';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

export default function StopButton({ stop, setShowStopButton, className = '' }) {
  const localize = useLocalize();

  return (
    <TooltipAnchor
      description={localize('com_nav_stop_generating')}
      render={
        <button
          type="button"
          // Same neutral circle as the send button it replaces, rather than a filled
          // `bg-text-primary` one: that fill inverts with the theme, so in dark mode it
          // turned into a white disc that read as a different control entirely.
          className={cn(
            'flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-secondary text-text-primary md:size-[52px]',
            'transition-colors duration-200 hover:bg-surface-hover',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-medium',
            className,
          )}
          aria-label={localize('com_nav_stop_generating')}
          onClick={(e) => {
            setShowStopButton(false);
            stop(e);
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="size-5"
          >
            <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"></rect>
          </svg>
        </button>
      }
    ></TooltipAnchor>
  );
}
