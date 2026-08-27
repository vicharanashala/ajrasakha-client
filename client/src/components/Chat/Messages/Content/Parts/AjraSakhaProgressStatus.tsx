import { Lightbulb } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '~/utils';

/** The one line shown while the request is still young; after this the panel hands over to
 *  the rotating tips, which carry the "still working" signal along with the dots. */
export const AJRASAKHA_INITIAL_MESSAGE = "Preparing your response. It'll appear here automatically.";

/** Reassurance at the points where a wait starts to feel wrong. These interrupt the tips
 *  briefly rather than replacing them, so the user hears that the request is still alive and
 *  then goes back to reading something useful. */
export const AJRASAKHA_LONG_WAIT_UPDATES = [
  {
    delay: 30_000,
    message: "This is taking longer than usual — still preparing a better answer for you.",
  },
  {
    delay: 60_000,
    message:
      'Still working on it, pulling together information from several sources to get this right.',
  },
] as const;

export const AJRASAKHA_TIPS = [
  // Asking better questions
  'Ask in your own language — Hindi, Punjabi, Malayalam and more all work.',
  'Name your district and nearest mandi to get prices for your area.',
  'Mention the crop and its growth stage for a more specific answer.',
  'Describe symptoms in detail — leaf colour, spots, and which leaves are affected.',
  'Share your soil test values to get fertiliser advice matched to your field.',
  'Ask for quantities per acre or hectare so you can apply them directly.',
  'Give a time window for weather questions, like the next five days.',
  'Name a scheme directly, such as PMFBY, to get its details and eligibility.',
  'Mention whether your field is irrigated or rain-fed for better sowing advice.',
  'Say how large your plot is when asking about seed, water, or input quantities.',
  // Using the app
  'Tap the mic to ask by voice instead of typing.',
  'Use the Voice and Text switch above the box to change how you ask.',
  'Ask follow-up questions — the conversation is remembered.',
  'Tap the speaker icon under an answer to have it read aloud.',
  'Tap the copy icon under an answer to save it or share it with someone.',
  'Edit your own message to rephrase a question without starting over.',
  'Start a new chat when you move to a different topic or crop.',
  'Allow location access so weather and prices match where you farm.',
  'Use the arrow button to jump back to the newest message in a long answer.',
  // Getting the most out of it
  'Rate answers with the thumbs icons — it helps AjraSakha improve.',
  'AjraSakha is in development — check critical decisions with your local KVK.',
] as const;

/** How long the opening line holds before the tips take over. */
const INITIAL_MESSAGE_DURATION = 6_000;
/** How long each tip holds. Long enough to read one without rushing. */
const TIP_ROTATION_INTERVAL = 8_000;
/** How long a long-wait update holds before the tips resume. */
const LONG_WAIT_MESSAGE_DURATION = 8_000;

export default function AjraSakhaProgressStatus() {
  const [isShowingTip, setIsShowingTip] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);
  const [longWaitMessage, setLongWaitMessage] = useState<string | null>(null);

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
    AJRASAKHA_LONG_WAIT_UPDATES.forEach(({ delay, message }) => {
      timeouts.push(
        window.setTimeout(() => {
          setLongWaitMessage(message);
          // Pushed onto the same list so unmount clears it too, whichever stage it is at.
          timeouts.push(
            window.setTimeout(() => setLongWaitMessage(null), LONG_WAIT_MESSAGE_DURATION),
          );
        }, delay),
      );
    });
    return () => timeouts.forEach(window.clearTimeout);
  }, []);

  const tip = AJRASAKHA_TIPS[tipIndex];
  /** A long-wait update outranks everything; otherwise the opening line until the tips start. */
  const statusMessage = longWaitMessage ?? (isShowingTip ? null : AJRASAKHA_INITIAL_MESSAGE);
  const isTipVisible = statusMessage == null;

  return (
    <div
      className="flex w-full max-w-2xl items-start gap-2.5"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="mt-1.5 flex shrink-0 items-center gap-1 sm:mt-2" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="ajrasakha-progress-dot size-1.5 rounded-full bg-green-600 dark:bg-green-400"
            style={{ animationDelay: `${i * 0.16}s` }}
          />
        ))}
      </span>
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
