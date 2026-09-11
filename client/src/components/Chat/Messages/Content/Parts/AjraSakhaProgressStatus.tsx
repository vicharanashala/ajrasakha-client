import { Lightbulb, Sprout } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { TranslationKeys } from '~/hooks';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

/** The one line shown while the request is still young; after this the panel hands over to
 *  the rotating tips, which carry the "still working" signal along with the dots.
 *  Holds a translation key rather than text, since useLocalize() can only be called from
 *  inside a component. */
export const AJRASAKHA_INITIAL_MESSAGE: TranslationKeys = 'com_ui_ajrasakha_initial_message';

/** Reassurance at the points where a wait starts to feel wrong. These interrupt the tips
 *  briefly rather than replacing them, so the user hears that the request is still alive and
 *  then goes back to reading something useful. */
export const AJRASAKHA_LONG_WAIT_UPDATES: ReadonlyArray<{
  delay: number;
  messageKey: TranslationKeys;
}> = [
  {
    delay: 30_000,
    messageKey: 'com_ui_ajrasakha_long_wait_taking_longer',
  },
  {
    delay: 60_000,
    messageKey: 'com_ui_ajrasakha_long_wait_pulling_together',
  },
] as const;

export const AJRASAKHA_TIPS: readonly TranslationKeys[] = [
  // Asking better questions
  'com_ui_ajrasakha_tip_own_language',
  'com_ui_ajrasakha_tip_mandi_price',
  'com_ui_ajrasakha_tip_crop_stage',
  'com_ui_ajrasakha_tip_symptoms',
  'com_ui_ajrasakha_tip_soil_test',
  'com_ui_ajrasakha_tip_quantities',
  'com_ui_ajrasakha_tip_weather_window',
  'com_ui_ajrasakha_tip_scheme_name',
  'com_ui_ajrasakha_tip_irrigation',
  'com_ui_ajrasakha_tip_plot_size',
  // Using the app
  'com_ui_ajrasakha_tip_voice_mic',
  'com_ui_ajrasakha_tip_voice_text_switch',
  'com_ui_ajrasakha_tip_follow_up',
  'com_ui_ajrasakha_tip_speaker_icon',
  'com_ui_ajrasakha_tip_copy_icon',
  'com_ui_ajrasakha_tip_edit_message',
  'com_ui_ajrasakha_tip_new_chat',
  'com_ui_ajrasakha_tip_location_access',
  'com_ui_ajrasakha_tip_jump_to_newest',
  // Getting the most out of it
  'com_ui_ajrasakha_tip_rate_answers',
  'com_ui_ajrasakha_tip_in_development',
] as const;

/** How long the opening line holds before the tips take over. */
const INITIAL_MESSAGE_DURATION = 6_000;
/** How long each tip holds. Long enough to read one without rushing. */
const TIP_ROTATION_INTERVAL = 8_000;
/** How long a long-wait update holds before the tips resume. */
const LONG_WAIT_MESSAGE_DURATION = 8_000;

export default function AjraSakhaProgressStatus() {
  const localize = useLocalize();
  const [isShowingTip, setIsShowingTip] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);
  const [longWaitMessageKey, setLongWaitMessageKey] = useState<TranslationKeys | null>(null);

  useEffect(() => {
    const handover = window.setTimeout(() => setIsShowingTip(true), INITIAL_MESSAGE_DURATION);
    return () => window.clearTimeout(handover);
  }, []);

  useEffect(() => {
    if (!isShowingTip) {
      return;
    }
    const rotation = window.setInterval(
      () => setTipIndex((current) => (current + 1) % AJRASAKHA_TIPS.length),
      TIP_ROTATION_INTERVAL,
    );
    return () => window.clearInterval(rotation);
  }, [isShowingTip]);

  useEffect(() => {
    const timeouts: number[] = [];
    AJRASAKHA_LONG_WAIT_UPDATES.forEach(({ delay, messageKey }) => {
      timeouts.push(
        window.setTimeout(() => {
          setLongWaitMessageKey(messageKey);
          // Pushed onto the same list so unmount clears it too, whichever stage it is at.
          timeouts.push(
            window.setTimeout(() => setLongWaitMessageKey(null), LONG_WAIT_MESSAGE_DURATION),
          );
        }, delay),
      );
    });
    return () => timeouts.forEach(window.clearTimeout);
  }, []);

  const tip = localize(AJRASAKHA_TIPS[tipIndex]);
  /** A long-wait update outranks everything; otherwise the opening line until the tips start. */
  const statusMessageKey = longWaitMessageKey ?? (isShowingTip ? null : AJRASAKHA_INITIAL_MESSAGE);
  const statusMessage = statusMessageKey ? localize(statusMessageKey) : null;
  const isTipVisible = statusMessage == null;

  return (
    <div
      className="flex w-full max-w-2xl items-start gap-2.5"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {/* The sprout belongs to the waiting message. A tip already carries its own lightbulb,
          and two markers on one line read as clutter. Top margins are per-breakpoint because
          the paragraph's line height changes with its type scale. */}
      {!isTipVisible && (
        <Sprout
          className={cn(
            'ajrasakha-progress-sprout shrink-0 text-green-600 dark:text-green-400',
            'mt-0.5 size-4 sm:mt-[3px] sm:size-[18px] md:mt-[5px]',
          )}
          aria-hidden="true"
        />
      )}
      <p
        key={isTipVisible ? `tip-${tipIndex}` : statusMessage}
        className={cn(
          'ajrasakha-progress-enter text-message min-w-0',
          'text-[13px] leading-5 sm:text-sm sm:leading-6 md:text-base md:leading-7',
          // The shimmer belongs to the waiting message; a tip is something to read, not a
          // progress signal, so it stays still and takes the quieter colour.
          isTipVisible
            ? 'text-text-secondary'
            : 'ajrasakha-progress-shimmer text-text-primary',
        )}
      >
        {isTipVisible ? (
          <>
            <Lightbulb
              className="mr-1.5 inline-block size-3.5 shrink-0 align-[-2px] text-green-600 dark:text-green-400 sm:size-4"
              aria-hidden="true"
            />
            <span className="font-medium text-text-primary">Tip: </span>
            {tip}
          </>
        ) : (
          statusMessage
        )}
      </p>
    </div>
  );
}
