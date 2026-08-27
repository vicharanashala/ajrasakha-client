import { useCallback } from 'react';
import {
  BadgeCheck,
  ChevronRight,
  CloudSun,
  HelpCircle,
  IndianRupee,
  Languages,
  Mic,
  ShieldCheck,
  Sprout,
} from 'lucide-react';
import { useLocalize, useSubmitMessage } from '~/hooks';
import { cn } from '~/utils';
import { EXAMPLE_QUESTIONS } from './exampleQuestions.config';


/** One capability pill under the tagline. Icon plus a short label, nothing tappable — these
 *  describe what AjraSakha offers rather than acting as controls. */
function CapabilityChip({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <li className="flex items-center gap-1.5 rounded-full border border-green-600/30 bg-green-500/10 px-3.5 py-1.5 text-xs font-medium text-green-700 dark:border-green-400/30 dark:bg-green-400/10 dark:text-green-400 sm:gap-2 sm:px-4 sm:py-2 sm:text-sm">
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {label}
    </li>
  );
}

/** Maps a question's `id` (from exampleQuestions.config.ts) to the icon shown on its card.
 *  An id with no entry here still renders fine — it just falls back to HelpCircle. */
const ICONS_BY_ID: Record<string, React.ComponentType<{ className?: string }>> = {
  'wheat-yellow-rust': Sprout,
  'weather-forecast': CloudSun,
  'mandi-price-paddy': IndianRupee,
  'pmfby-info': ShieldCheck,
};

/**
 * Per-topic accent for the icon tile: a soft tint behind a saturated glyph, so the column
 * reads as a set rather than four identical rows (crop health green, sky blue for weather,
 * money amber, trust purple for the insurance scheme). Written as opacity tints of the solid
 * colour rather than the 100/200 steps of each ramp, because this theme collapses its green
 * ramp onto two brand shades — a `bg-green-100` here would come out fully saturated.
 */
const ICON_ACCENT_BY_ID: Record<string, { tile: string; hover: string }> = {
  'wheat-yellow-rust': {
    tile: 'bg-green-500/15 text-green-600 dark:text-green-400',
    hover: 'hover:border-green-500/40 dark:hover:border-green-400/40',
  },
  'weather-forecast': {
    tile: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
    hover: 'hover:border-blue-500/40 dark:hover:border-blue-400/40',
  },
  'mandi-price-paddy': {
    tile: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    hover: 'hover:border-amber-500/40 dark:hover:border-amber-400/40',
  },
  'pmfby-info': {
    tile: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
    hover: 'hover:border-purple-500/40 dark:hover:border-purple-400/40',
  },
};
const DEFAULT_ICON_ACCENT = {
  tile: 'bg-surface-tertiary text-text-secondary',
  hover: 'hover:border-border-heavy',
};

/** Tappable example-question cards shown on the welcome/empty-chat screen, between the
 *  greeting heading and the message input. Tapping one sends that question right away —
 *  the same as typing it and hitting submit — rather than just populating the input box. */
export default function ExampleQuestionTiles() {
  const { submitMessage } = useSubmitMessage();
  const localize = useLocalize();

  const handleSelect = useCallback(
    (text: string) => {
      submitMessage({ text });
    },
    [submitMessage],
  );

  if (!EXAMPLE_QUESTIONS.length) {
    return null;
  }

  return (
    <div
      className={cn(
        'animate-fadeIn flex w-full max-w-xl flex-col items-center px-4 md:max-w-3xl',
        // Spacing widens as the sections get further apart: greeting to tagline, tagline to
        // cards (below), then cards to the composer. The bottom margin doubles as what lifts
        // the whole block clear of the composer, since the landing column is bottom-aligned
        // from sm up. Landing drops its own bottom padding and margin when these render (its
        // `hasContentBelow` prop), so `mt` here is the entire gap under the greeting.
        'mb-6 mt-4 sm:mb-0 sm:mt-7',
      )}
    >
      {/* Tagline and capability pills live here rather than in Landing: Landing collapses to
          `sm:max-h-0` when centerFormOnLanding is on, so anything added there contributes no
          layout height and its overflow lands on top of these cards. */}
      <div className="mb-9 flex flex-col items-center gap-3 sm:mb-9 sm:gap-4">
        <p className="text-balance text-center text-[15px] font-normal leading-snug text-text-secondary sm:max-w-sm sm:text-base">
          {localize('com_ui_landing_tagline')}
        </p>
        <ul className="flex max-w-[360px] flex-wrap items-center justify-center gap-2.5 sm:gap-3">
          <CapabilityChip icon={Languages} label={localize('com_ui_landing_chip_multilingual')} />
          <CapabilityChip
            icon={BadgeCheck}
            label={localize('com_ui_landing_chip_expert_verified')}
          />
          <CapabilityChip icon={Mic} label={localize('com_ui_landing_chip_voice')} />
        </ul>
      </div>
      {/* One column while the chat column is narrow, two from md up — four full-width rows
          stacked on a desktop viewport is taller than the landing area can hold. The card
          itself keeps the same row layout at both widths. */}
      <div className="grid w-full grid-cols-1 gap-2 sm:gap-3 md:grid-cols-2">
      {EXAMPLE_QUESTIONS.map((question, index) => {
        const Icon = ICONS_BY_ID[question.id] ?? HelpCircle;
        const accent = ICON_ACCENT_BY_ID[question.id] ?? DEFAULT_ICON_ACCENT;
        return (
          <button
            key={question.id}
            type="button"
            onClick={() => handleSelect(question.text)}
            className={cn(
              'group flex h-full w-full cursor-pointer items-center text-start',
              // Short viewports (an iPhone SE is 667px tall) cannot fit four of these
              // above the composer, and the overflow runs underneath it. Showing three
              // keeps the screen whole.
              index >= 3 && '[@media(max-height:700px)]:hidden',
              'gap-2.5 rounded-xl p-2 pr-2.5 sm:gap-3.5 sm:rounded-2xl sm:p-3 sm:pr-4',
              // `border-light` is nearly invisible against the dark surfaces, so dark mode
              // gets a translucent white hairline instead.
              'border border-border-light bg-surface-chat dark:border-white/10',
              'shadow-[0_1px_2px_0_rgba(0,0,0,0.04),0_4px_12px_0_rgba(0,0,0,0.03)]',
              'transition-[background-color,border-color,box-shadow,transform] duration-200 ease-out',
              'hover:bg-surface-tertiary hover:shadow-md active:scale-[0.99]',
              // The border picks up the card's own accent on hover, so each one lights up in
              // its own colour rather than all four going the same grey.
              accent.hover,
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-medium',
              'motion-reduce:transition-none',
            )}
          >
            <span
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-xl sm:size-11 sm:rounded-2xl',
                'transition-transform duration-200 ease-out group-hover:scale-105',
                'motion-reduce:transition-none motion-reduce:group-hover:scale-100',
                accent.tile,
              )}
            >
              <Icon className="size-4 shrink-0 sm:size-5" aria-hidden="true" />
            </span>
            <span className="line-clamp-3 min-w-0 flex-1 text-balance break-words text-[13px] font-medium leading-snug text-text-primary sm:text-[15px]">
              {question.text}
            </span>
            <ChevronRight
              className="size-4 shrink-0 text-text-tertiary transition-[transform,color] duration-200 group-hover:translate-x-0.5 group-hover:text-text-secondary motion-reduce:transition-none sm:size-5"
              aria-hidden="true"
            />
          </button>
        );
      })}
      </div>
    </div>
  );
}
