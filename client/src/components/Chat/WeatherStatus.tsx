import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AnimatePresence, animate, motion, useReducedMotion } from 'framer-motion';
import type { TargetAndTransition } from 'framer-motion';
import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Sun,
  Wind,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '~/utils';

// Looping motions for each kind of weather. Offsets stay small so they read as calm at icon size.
const SPIN: TargetAndTransition = {
  rotate: 360,
  transition: { duration: 14, ease: 'linear', repeat: Infinity },
};
const FLOAT: TargetAndTransition = {
  y: [0, -1.5, 0],
  transition: { duration: 3.2, ease: 'easeInOut', repeat: Infinity },
};
const DRIFT: TargetAndTransition = {
  x: [-1.5, 1.5, -1.5],
  transition: { duration: 4, ease: 'easeInOut', repeat: Infinity },
};
const FALL: TargetAndTransition = {
  y: [0, 1.5, 0],
  transition: { duration: 1.1, ease: 'easeInOut', repeat: Infinity },
};
const SWAY: TargetAndTransition = {
  rotate: [-8, 8, -8],
  transition: { duration: 2.4, ease: 'easeInOut', repeat: Infinity },
};
const FLASH: TargetAndTransition = {
  opacity: [1, 1, 0.45, 1, 0.6, 1],
  transition: { duration: 2.6, times: [0, 0.6, 0.64, 0.68, 0.72, 1], repeat: Infinity },
};

type ConditionVisual = { icon: LucideIcon; loop: TargetAndTransition };

// Ordered so the most specific conditions win, e.g. "Thundery rain" shows lightning.
const CONDITION_VISUALS: Array<{ keywords: string[]; visual: ConditionVisual }> = [
  { keywords: ['thunder', 'storm', 'lightning'], visual: { icon: CloudLightning, loop: FLASH } },
  { keywords: ['rain', 'drizzle', 'shower'], visual: { icon: CloudRain, loop: FALL } },
  { keywords: ['snow', 'sleet', 'hail'], visual: { icon: CloudSnow, loop: FLOAT } },
  { keywords: ['fog', 'mist', 'haze', 'smoke', 'dust'], visual: { icon: CloudFog, loop: DRIFT } },
  { keywords: ['wind', 'breez', 'gust'], visual: { icon: Wind, loop: SWAY } },
  { keywords: ['partly', 'partial'], visual: { icon: CloudSun, loop: FLOAT } },
  { keywords: ['cloud', 'overcast'], visual: { icon: Cloud, loop: DRIFT } },
  { keywords: ['clear', 'sun'], visual: { icon: Sun, loop: SPIN } },
];

const DEFAULT_VISUAL: ConditionVisual = { icon: CloudSun, loop: FLOAT };

// Picks the icon and looping motion that match a weather condition label from the API.
export function resolveConditionVisual(condition: string): ConditionVisual {
  const normalized = condition.toLowerCase();
  const match = CONDITION_VISUALS.find(({ keywords }) =>
    keywords.some((keyword) => normalized.includes(keyword)),
  );
  return match?.visual ?? DEFAULT_VISUAL;
}

type WeatherConditionIconProps = { condition: string; className?: string };

// Weather icon that gently animates to match the current condition.
export function WeatherConditionIcon({ condition, className }: WeatherConditionIconProps) {
  const prefersReducedMotion = useReducedMotion();
  const { icon: Icon, loop } = resolveConditionVisual(condition);
  // The entrance and the loop sit on separate spans. Sharing one span made the endless loop
  // transition replay the fade in too, so the icon blinked out at the start of every cycle.
  return (
    <motion.span
      key={condition}
      className="inline-flex shrink-0"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      aria-hidden="true"
    >
      <motion.span className="inline-flex" animate={prefersReducedMotion ? undefined : loop}>
        <Icon className={className} aria-hidden="true" />
      </motion.span>
    </motion.span>
  );
}

// Small pulsing dot that signals the shown weather is current.
export function LiveIndicator({ className }: { className?: string }) {
  return (
    <span className={cn('relative flex size-2 shrink-0', className)} aria-hidden="true">
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-500 opacity-75 motion-reduce:hidden" />
      <span className="relative inline-flex size-2 rounded-full bg-green-500 ring-2 ring-surface-primary" />
    </span>
  );
}

type AnimatedTemperatureProps = {
  value: number;
  suffix?: string;
  // Counts up from zero on first render. Otherwise only later value changes are animated.
  animateOnMount?: boolean;
};

// Temperature that counts smoothly to its new value whenever the reading changes.
export function AnimatedTemperature({
  value,
  suffix = '°',
  animateOnMount = false,
}: AnimatedTemperatureProps) {
  const prefersReducedMotion = useReducedMotion();
  const startValue = animateOnMount && !prefersReducedMotion ? 0 : value;
  const [display, setDisplay] = useState(startValue);
  const previousValueRef = useRef(startValue);

  useEffect(() => {
    const from = previousValueRef.current;
    previousValueRef.current = value;
    if (prefersReducedMotion || from === value) {
      setDisplay(value);
      return;
    }
    const controls = animate(from, value, {
      duration: 0.8,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: setDisplay,
    });
    return () => controls.stop();
  }, [value, prefersReducedMotion]);

  return (
    <span className="tabular-nums">
      {Math.round(display)}
      {suffix}
    </span>
  );
}

// Placeholder block with a soft light sweep, shown while weather is loading.
export function Shimmer({ className }: { className?: string }) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <div className={cn('relative overflow-hidden bg-surface-secondary', className)}>
      {!prefersReducedMotion && (
        <motion.span
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent dark:via-white/10"
          initial={{ x: '-100%' }}
          animate={{ x: '100%' }}
          transition={{ duration: 1.4, ease: 'easeInOut', repeat: Infinity }}
        />
      )}
    </div>
  );
}

type ShakeOnMountProps = {
  children: ReactNode;
  className?: string;
  // Renders a span so it can sit inside inline content such as a button.
  inline?: boolean;
  role?: string;
};

// Plays one short horizontal shake when it appears, used to draw attention to an error.
export function ShakeOnMount({ children, className, inline = false, role }: ShakeOnMountProps) {
  const prefersReducedMotion = useReducedMotion();
  const shake = prefersReducedMotion ? undefined : { x: [0, -6, 6, -4, 4, -2, 0] };
  const transition = { duration: 0.5, ease: 'easeInOut' as const };
  if (inline) {
    return (
      <motion.span className={className} animate={shake} transition={transition} role={role}>
        {children}
      </motion.span>
    );
  }
  return (
    <motion.div className={className} animate={shake} transition={transition} role={role}>
      {children}
    </motion.div>
  );
}

// Slim bar that sweeps along the top edge of a card while its data refreshes.
// The parent needs `relative overflow-hidden` so the bar sits on its edge and follows its corners.
export function RefreshProgressBar({ active }: { active: boolean }) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="refresh-progress"
          className="pointer-events-none absolute inset-x-0 top-0 h-0.5 overflow-hidden bg-green-500/15"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          aria-hidden="true"
        >
          {/* The segment is 40% wide, so moving it from -100% to 250% of its own width crosses the card. */}
          <motion.span
            className="absolute inset-y-0 left-0 w-2/5 rounded-full bg-green-500 dark:bg-green-400"
            initial={{ x: prefersReducedMotion ? '75%' : '-100%' }}
            animate={{ x: prefersReducedMotion ? '75%' : '250%' }}
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : { duration: 1.1, ease: 'easeInOut', repeat: Infinity }
            }
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
