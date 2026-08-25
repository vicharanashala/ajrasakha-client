import { useCallback } from 'react';
import { ChevronRight, CloudSun, HelpCircle, IndianRupee, ShieldCheck, Sprout } from 'lucide-react';
import { useSubmitMessage } from '~/hooks';
import { cn } from '~/utils';
import { EXAMPLE_QUESTIONS } from './exampleQuestions.config';

/** Maps a question's `id` (from exampleQuestions.config.ts) to the icon shown on its tile.
 *  An id with no entry here still renders fine — it just falls back to HelpCircle/text-secondary. */
const ICONS_BY_ID: Record<string, React.ComponentType<{ className?: string }>> = {
  'wheat-yellow-rust': Sprout,
  'weather-forecast': CloudSun,
  'mandi-price-paddy': IndianRupee,
  'pmfby-info': ShieldCheck,
};

/** Per-icon accent color, so the tile row isn't all one flat gray — each topic gets a color
 *  that fits it (crop health green, sky blue for weather, money amber, trust blue for the
 *  insurance scheme). An id with no entry here falls back to the neutral secondary color.
 *  `chipBg` is the soft tinted circle the icon sits in on sm+ (see the desktop card below);
 *  it's sm-only since the icon stays plain/inline on the mobile row layout. */
const ICON_ACCENT_BY_ID: Record<string, { text: string; chipBg: string }> = {
  'wheat-yellow-rust': { text: 'text-amber-500', chipBg: 'sm:bg-amber-500/10' },
  'weather-forecast': { text: 'text-sky-500', chipBg: 'sm:bg-sky-500/10' },
  'mandi-price-paddy': { text: 'text-emerald-500', chipBg: 'sm:bg-emerald-500/10' },
  'pmfby-info': { text: 'text-blue-500', chipBg: 'sm:bg-blue-500/10' },
};
const DEFAULT_ICON_ACCENT = { text: 'text-text-secondary', chipBg: 'sm:bg-surface-tertiary' };

/** Tappable example-question tiles shown on the welcome/empty-chat screen, between the
 *  greeting heading and the message input. Tapping a tile sends that question right away —
 *  the same as typing it and hitting submit — rather than just populating the input box. */
export default function ExampleQuestionTiles() {
  const { submitMessage } = useSubmitMessage();

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
        'animate-fadeIn mb-4 grid w-full max-w-2xl grid-cols-1 gap-2.5 px-4 sm:mb-6 sm:grid-cols-2 sm:gap-3',
        /**
         * Landing's own wrapper carries a `pb-16` (64px) bottom padding, sized back when
         * ChatForm followed it directly. Now that these tiles sit between them, that padding
         * plus this grid's own top margin double up into a large gap — and since the mobile
         * layout bottom-anchors the whole Landing+tiles+ChatForm block (`justify-end`), that
         * extra height also pushes the greeting up toward the very top of the screen. Pulling
         * the tiles up with a negative margin on mobile only shrinks the gap to something
         * reasonable and, as a side effect of the bottom-anchoring, lowers the greeting back
         * toward the middle of the screen. Left untouched at sm+, where the layout is
         * `justify-center` instead and the wider gap already reads fine.
         */
        '-mt-8 sm:mt-6',
      )}
    >
      {EXAMPLE_QUESTIONS.map((question) => {
        const Icon = ICONS_BY_ID[question.id] ?? HelpCircle;
        const accent = ICON_ACCENT_BY_ID[question.id] ?? DEFAULT_ICON_ACCENT;
        return (
          <button
            key={question.id}
            type="button"
            onClick={() => handleSelect(question.text)}
            className={cn(
              'relative flex cursor-pointer items-center gap-2.5 rounded-2xl border border-border-medium py-2.5 pl-3 pr-8 text-start shadow-[0_0_2px_0_rgba(0,0,0,0.05),0_4px_6px_0_rgba(0,0,0,0.02)] transition-all duration-300 ease-out hover:bg-surface-tertiary',
              /**
               * Icon sits beside the text (same row) on mobile, where tile width is tight
               * and a question wraps to 2-3 lines — stacking the icon above it would waste
               * vertical space. On sm+ the tiles are wider and get the "premium card"
               * treatment: roomier padding, a softer resting border that darkens on hover,
               * and a lift + deeper shadow on hover (the smooth `transition-all` above is
               * what makes that lift/shadow change glide instead of snap). The tiny custom
               * shadow in the class above stays as the resting-state shadow; hover:shadow-lg
               * only kicks in on hover, so idle cards stay understated and only "wake up"
               * on interaction — this is what's meant to read as clickable/premium rather
               * than flat and static.
               */
              'sm:flex-col sm:items-start sm:gap-3 sm:border-border-light sm:p-4 sm:hover:-translate-y-1 sm:hover:border-border-heavy sm:hover:shadow-lg',
            )}
          >
            <span
              className={cn(
                'flex shrink-0 items-center justify-center sm:size-9 sm:rounded-xl sm:transition-colors sm:duration-300',
                accent.chipBg,
              )}
            >
              <Icon className={cn('size-4 shrink-0', accent.text)} aria-hidden="true" />
            </span>
            <span className="line-clamp-3 overflow-hidden text-balance break-words text-[13px] text-text-secondary sm:text-sm">
              {question.text}
            </span>
            {/* Mobile-only clickability cue: a plain chevron centered on the tile's right
                edge, not a button of its own — the whole tile is the tap target. Hidden on
                sm+, where the premium card treatment (icon chip, hover lift + shadow) already
                reads clearly as tappable, and a corner arrow there looked like clutter rather
                than an affordance. */}
            <ChevronRight
              className="absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-text-tertiary sm:hidden"
              aria-hidden="true"
            />
          </button>
        );
      })}
    </div>
  );
}
