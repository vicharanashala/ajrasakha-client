import { useEffect, useState } from 'react';

export const AJRASAKHA_PROGRESS_UPDATES = [
  {
    delay: 0,
    message: '⏳ Your request is being processed. This usually takes around 10–20 seconds.',
  },
  {
    delay: 5_000,
    message: '🧠 Still working on your request. Thanks for your patience.',
  },
  {
    delay: 10_000,
    message:
      "⚙️ Your response is still being generated. It'll be sent automatically as soon as it's ready.",
  },
  {
    delay: 15_000,
    message: '✨ Almost there. Some requests take a little longer depending on their complexity.',
  },
  {
    delay: 20_000,
    message: '⏳ This is taking longer than usual, but your request is still being processed.',
  },
  {
    delay: 25_000,
    message: "🚀 Thanks for waiting. I'm still working on your response.",
  },
  {
    delay: 30_000,
    message:
      "📄 The response is still being generated. No action is needed—I'll send it automatically once it's ready.",
  },
  {
    delay: 45_000,
    message:
      '⏱️ This request is taking longer than expected, but it\'s still progressing. Thanks for your patience.',
  },
  {
    delay: 60_000,
    message:
      "🔄 I'm still processing your request. Complex requests can occasionally take up to a minute or more.",
  },
] as const;

export const AJRASAKHA_REPEATING_PROGRESS_MESSAGE =
  "⏳ Still working on your request. I'll send the response automatically once it's ready.";

const REPEAT_PROGRESS_DELAY = 90_000;
const REPEAT_PROGRESS_INTERVAL = 30_000;

export default function AjraSakhaProgressStatus() {
  const [message, setMessage] = useState(AJRASAKHA_PROGRESS_UPDATES[0].message);

  useEffect(() => {
    const timeouts = AJRASAKHA_PROGRESS_UPDATES.slice(1).map(({ delay, message }) =>
      window.setTimeout(() => setMessage(message), delay),
    );
    let repeatInterval: ReturnType<typeof window.setInterval> | undefined;
    const repeatTimeout = window.setTimeout(() => {
      setMessage(AJRASAKHA_REPEATING_PROGRESS_MESSAGE);
      repeatInterval = window.setInterval(
        () => setMessage(AJRASAKHA_REPEATING_PROGRESS_MESSAGE),
        REPEAT_PROGRESS_INTERVAL,
      );
    }, REPEAT_PROGRESS_DELAY);

    return () => {
      timeouts.forEach(window.clearTimeout);
      window.clearTimeout(repeatTimeout);
      if (repeatInterval !== undefined) {
        window.clearInterval(repeatInterval);
      }
    };
  }, []);

  return (
    <div
      className="flex max-w-2xl items-center gap-2"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="flex shrink-0 items-center gap-1" aria-hidden="true">
        <span className="size-1.5 animate-bounce rounded-full bg-emerald-500 motion-reduce:animate-none" />
        <span className="size-1.5 animate-bounce rounded-full bg-emerald-500 [animation-delay:150ms] motion-reduce:animate-none" />
        <span className="size-1.5 animate-bounce rounded-full bg-emerald-500 [animation-delay:300ms] motion-reduce:animate-none" />
      </div>
      <p
        key={message}
        className="ajrasakha-progress-enter ajrasakha-progress-shimmer text-message min-w-0 text-base leading-7 text-text-primary"
        data-progress-message={message}
      >
        {message}
      </p>
    </div>
  );
}
