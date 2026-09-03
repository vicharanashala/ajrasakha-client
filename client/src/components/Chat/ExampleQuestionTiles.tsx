import { useCallback, useMemo } from 'react';
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
  Sun,
} from 'lucide-react';
import { useLocalize, useSubmitMessage } from '~/hooks';
import { useAuthContext } from '~/hooks/AuthContext';
import { useUserTermsQuery } from '~/data-provider';
import { cn } from '~/utils';
import { EXAMPLE_QUESTIONS, STATE_EXAMPLE_QUESTION_OVERRIDES } from './exampleQuestions.config';


/** One capability label under the tagline. A small tinted icon dot plus a short caption,
 *  nothing tappable — these describe what AjraSakha offers rather than acting as controls.
 *  The colour lives only on the icon's dot (same soft-tint style as the question cards'
 *  icon tiles below, just circular and smaller); the label text itself stays plain/muted,
 *  with no pill fill or border around it, so the row doesn't read as a set of buttons. */
function CapabilityChip({
  icon: Icon,
  label,
  accentClass,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  accentClass: string;
}) {
  return (
    <li className="flex min-w-0 items-center gap-1.5 whitespace-nowrap text-xs font-normal text-text-secondary sm:gap-2 sm:text-sm">
      <span
        className={cn(
          'flex size-5 shrink-0 items-center justify-center rounded-full sm:size-6',
          accentClass,
        )}
      >
        <Icon className="size-3 shrink-0 sm:size-3.5" aria-hidden="true" />
      </span>
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
  'pmkusum-info': Sun,
};

/**
 * One shared accent for every icon tile — a soft tint behind a saturated glyph, using the
 * app's own brand green rather than a different hue per topic. A rainbow of unrelated colors
 * (crop-health green, weather blue, money amber, scheme purple/yellow) reads as decorative
 * noise once there are five topics instead of four (see the Punjab pmkusum-info override in
 * exampleQuestions.config.ts) — a single consistent accent keeps new topics from ever
 * clashing, and the glyph shape still tells the cards apart. Written as an opacity tint of
 * the solid colour rather than the 100/200 steps of the ramp, because this theme collapses
 * its green ramp onto two brand shades — a `bg-green-100` here would come out fully
 * saturated instead of a soft tint.
 */
const ICON_ACCENT = {
  tile: 'bg-green-500/15 text-green-600 dark:text-green-400',
  hover: 'hover:border-green-500/40 dark:hover:border-green-400/40',
};

/** Entrance timing for the landing block. The greeting animates per character above this
 *  component, so the tagline starts after it has had a moment and the cards follow in turn. */
const TAGLINE_ENTRANCE_DELAY_MS = 120;
const CARD_ENTRANCE_BASE_DELAY_MS = 260;
const CARD_ENTRANCE_STEP_MS = 70;

/** Tappable example-question cards shown on the welcome/empty-chat screen, between the
 *  greeting heading and the message input. Tapping one sends that question right away —
 *  the same as typing it and hitting submit — rather than just populating the input box. */
export default function ExampleQuestionTiles() {
  const { submitMessage } = useSubmitMessage();
  const localize = useLocalize();
  const { user } = useAuthContext();
  // Same query useSubmitMessage.ts reads the farmer's state from — same query key, so it
  // dedupes against that cache once either has fetched. Only used here to pick which example
  // question to show; it plays no part in what gets sent when a card is tapped.
  const { data: termsData } = useUserTermsQuery({ enabled: !!user });
  const farmerState = termsData?.farmerProfile?.state;

  const questions = useMemo(() => {
    const overrides = farmerState
      ? STATE_EXAMPLE_QUESTION_OVERRIDES[farmerState.trim().toLowerCase()]
      : undefined;
    if (!overrides) {
      return EXAMPLE_QUESTIONS;
    }
    return EXAMPLE_QUESTIONS.map((question) => overrides[question.id] ?? question);
  }, [farmerState]);

  const handleSelect = useCallback(
    (text: string) => {
      submitMessage({ text, isExampleQuestion: true });
    },
    [submitMessage],
  );

  if (!questions.length) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex w-full max-w-xl flex-col items-center px-4 md:max-w-3xl',
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
      <div
        className="animate-riseIn mb-9 flex flex-col items-center gap-3 sm:mb-9 sm:gap-4"
        style={{ animationDelay: `${TAGLINE_ENTRANCE_DELAY_MS}ms` }}
      >
        <p className="text-balance text-center text-[15px] font-normal leading-snug text-text-secondary sm:max-w-sm sm:text-base">
          {localize('com_ui_landing_tagline')}
        </p>
        {/* Generously spaced rather than clustered tight — reads as one aligned row instead of
            a floating cluster of tags. `justify-center` (not `justify-between`) plus
            `flex-wrap`: labels are translated into 59 locales and some run much longer than the
            English originals (e.g. Malayalam), so on a narrow screen the third item drops to
            its own centred line instead of overflowing off the edge — `justify-between` would
            leave that lone wrapped item stranded at the left edge instead of centred. */}
        <ul className="flex w-full max-w-sm flex-wrap items-center justify-center gap-x-5 gap-y-1.5 sm:max-w-md sm:gap-x-6">
          <CapabilityChip
            icon={Languages}
            label={localize('com_ui_landing_chip_multilingual')}
            accentClass="bg-green-500/15 text-green-600 dark:text-green-400"
          />
          <CapabilityChip
            icon={BadgeCheck}
            label={localize('com_ui_landing_chip_expert_verified')}
            accentClass="bg-blue-500/15 text-blue-600 dark:text-blue-400"
          />
          <CapabilityChip
            icon={Mic}
            label={localize('com_ui_landing_chip_voice')}
            accentClass="bg-amber-500/15 text-amber-600 dark:text-amber-400"
          />
        </ul>
      </div>
      {/* One column while the chat column is narrow, two from md up — four full-width rows
          stacked on a desktop viewport is taller than the landing area can hold. The card
          itself keeps the same row layout at both widths. */}
      <div className="grid w-full grid-cols-1 gap-2 sm:gap-3 md:grid-cols-2">
      {questions.map((question, index) => {
        const Icon = ICONS_BY_ID[question.id] ?? HelpCircle;
        const questionText = localize(question.textKey);
        return (
          <button
            key={question.id}
            type="button"
            onClick={() => handleSelect(questionText)}
            // Cards rise in one after another, picking up where the tagline leaves off.
            style={{
              animationDelay: `${CARD_ENTRANCE_BASE_DELAY_MS + index * CARD_ENTRANCE_STEP_MS}ms`,
            }}
            className={cn(
              'animate-riseIn',
              'group flex h-full w-full cursor-pointer items-center text-start',
              // Short viewports (an iPhone SE is 667px tall) cannot fit four of these
              // above the composer, and the overflow runs underneath it. Showing three
              // keeps the screen whole.
              index >= 3 && '[@media(max-height:700px)]:hidden',
              'gap-2.5 rounded-xl p-2 pr-2.5 sm:gap-3.5 sm:rounded-2xl sm:p-3 sm:pr-4',
              // Fixed to the height of the longest a card can get (the 3-line clamp below,
              // plus this padding) so every card is the same size regardless of how short its
              // own question text is — otherwise a one-line question sits in a visibly
              // smaller card than a neighbour that wraps to three, and that gap shifts by
              // locale (some of the 59 translations run much longer than others).
              'min-h-[72px] sm:min-h-[88px]',
              // No resting border — the card reads from its shadow alone. Kept as a
              // transparent 1px border (rather than dropping border entirely) so the hover
              // accent colour below still has a border to reveal instead of shifting layout.
              'border border-transparent bg-surface-chat',
              // `surface-chat` (#0d0d0d) is barely distinguishable from the page background
              // (#0a0a0a) in dark mode, so a shadow alone can't read as elevation there — it
              // just looks like a stray glow. `surface-secondary` (#171717) gives the card an
              // actual lift, and the shadow underneath it can stay a normal neutral dark
              // shadow instead of a white-tinted one.
              'dark:bg-surface-secondary',
              'shadow-[0_2px_6px_0_rgba(0,0,0,0.09)] dark:shadow-[0_2px_8px_0_rgba(0,0,0,0.45)]',
              'transition-[background-color,border-color,box-shadow,transform] duration-200 ease-out',
              'hover:bg-surface-tertiary hover:shadow-md active:scale-[0.99]',
              // The border picks up the shared accent colour on hover instead of a plain grey.
              ICON_ACCENT.hover,
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-medium',
              'motion-reduce:transition-none',
            )}
          >
            <span
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-xl sm:size-11 sm:rounded-2xl',
                'transition-transform duration-200 ease-out group-hover:scale-105',
                'motion-reduce:transition-none motion-reduce:group-hover:scale-100',
                ICON_ACCENT.tile,
              )}
            >
              <Icon className="size-4 shrink-0 sm:size-5" aria-hidden="true" />
            </span>
            <span className="line-clamp-3 min-w-0 flex-1 text-balance break-words text-[13px] font-medium leading-snug text-text-primary sm:text-[15px]">
              {questionText}
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
