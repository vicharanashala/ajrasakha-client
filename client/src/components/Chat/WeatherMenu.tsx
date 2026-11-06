import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'framer-motion';
import type { PanInfo, Transition } from 'framer-motion';
import {
  ChevronDown,
  CloudOff,
  CloudRain,
  CloudSun,
  Droplets,
  MapPin,
  RefreshCw,
  Wind,
  X,
} from 'lucide-react';
import type { IFarmerProfile } from 'librechat-data-provider';
import { useWeather } from '~/hooks/useWeather';
import type { Weather } from '~/hooks/useWeather';
import { useAuthContext, useLocalize } from '~/hooks';
import { cn } from '~/utils';
import {
  AnimatedTemperature,
  LiveIndicator,
  ShakeOnMount,
  Shimmer,
  WeatherConditionIcon,
} from './WeatherStatus';

// Widest the desktop popover may be, and the gap kept from the viewport edges.
const POPOVER_WIDTH = 340;
const EDGE_GAP = 8;

// How far or how fast the bottom sheet must be swiped down before it closes.
const SHEET_DISMISS_OFFSET = 96;
const SHEET_DISMISS_VELOCITY = 500;

// Motion presets. Springs feel natural for the sheet, a short ease keeps the popover crisp.
const SHEET_TRANSITION: Transition = { type: 'spring', damping: 34, stiffness: 380, mass: 0.9 };
const POPOVER_TRANSITION: Transition = { duration: 0.16, ease: [0.16, 1, 0.3, 1] };
const BACKDROP_TRANSITION: Transition = { duration: 0.2, ease: 'easeOut' };
const INSTANT_TRANSITION: Transition = { duration: 0 };

// Rounds a Celsius temperature for display, e.g. 32.5 becomes 33°.
const formatTemperature = (value: number) => `${Math.round(value)}°`;

// Formats when the weather was last fetched, e.g. 10:30 AM.
const formatUpdatedTime = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

type WeatherStatProps = { icon: ReactNode; label: string; value: string };

// Shows one weather metric such as humidity or wind speed.
function WeatherStat({ icon, label, value }: WeatherStatProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-xl bg-surface-secondary p-3">
      <span className="flex items-center gap-1.5 text-xs text-text-secondary">
        {icon}
        {label}
      </span>
      <span className="truncate text-base font-semibold text-text-primary">{value}</span>
    </div>
  );
}

type WeatherDetailsProps = {
  weather?: Weather;
  isLoading: boolean;
  isError: boolean;
  isRefetching: boolean;
  updatedAt: number;
  locationLabel?: string;
  onRetry: () => void;
  onClose?: () => void;
};

// Renders the weather details shared by the desktop popover and the mobile bottom sheet.
function WeatherDetails({
  weather,
  isLoading,
  isError,
  isRefetching,
  updatedAt,
  locationLabel,
  onRetry,
  onClose,
}: WeatherDetailsProps) {
  const localize = useLocalize();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-text-primary">
              {localize('com_ui_weather_today')}
            </h2>
            {weather && !isError && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-700 duration-300 animate-in fade-in-0 motion-reduce:animate-none dark:text-green-400">
                <LiveIndicator />
                {localize('com_ui_weather_live')}
              </span>
            )}
          </div>
          {locationLabel && (
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs capitalize text-text-secondary">
              <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
              {locationLabel}
            </p>
          )}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={localize('com_ui_weather_close')}
            className="-mr-2 -mt-2 flex size-11 shrink-0 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        )}
      </div>

      {isLoading && !weather && (
        <div className="flex flex-col gap-3" aria-busy="true">
          <span className="sr-only">{localize('com_ui_weather_loading')}</span>
          <div className="flex items-center justify-between gap-3">
            <Shimmer className="h-12 w-32 rounded-lg" />
            <Shimmer className="size-10 rounded-full" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Shimmer className="h-16 rounded-xl" />
            <Shimmer className="h-16 rounded-xl" />
            <Shimmer className="h-16 rounded-xl" />
          </div>
        </div>
      )}

      {isError && !weather && (
        <ShakeOnMount
          className="flex flex-col items-center gap-3 rounded-xl bg-surface-secondary px-4 py-6 text-center"
          role="alert"
        >
          <CloudOff className="size-7 text-text-secondary" aria-hidden="true" />
          <p className="text-sm text-text-secondary">{localize('com_ui_weather_error')}</p>
          <button
            type="button"
            onClick={onRetry}
            disabled={isRefetching}
            className="flex min-h-11 items-center gap-2 rounded-full border border-border-medium px-4 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary disabled:opacity-60"
          >
            <RefreshCw
              className={cn('size-4', isRefetching && 'animate-spin motion-reduce:animate-none')}
              aria-hidden="true"
            />
            {localize('com_ui_retry')}
          </button>
        </ShakeOnMount>
      )}

      {weather && (
        <div className="flex flex-col gap-4 duration-300 animate-in fade-in-0 motion-reduce:animate-none">
          <div className="flex items-center justify-between gap-3">
            <span className="text-5xl font-bold leading-none text-text-primary">
              <span aria-hidden="true">
                <AnimatedTemperature value={weather.liveTemperature} suffix="°C" />
              </span>
              <span className="sr-only">{formatTemperature(weather.liveTemperature)}C</span>
            </span>
            <div className="flex min-w-0 items-center gap-2.5">
              <WeatherConditionIcon
                condition={weather.weatherCondition}
                className="size-10 shrink-0 text-green-600 dark:text-green-400"
              />
              <div className="min-w-0 text-right">
                <p className="truncate font-semibold text-text-primary">
                  {weather.weatherCondition}
                </p>
                <p className="text-xs text-text-secondary">
                  {localize('com_ui_weather_feels_like', {
                    0: `${formatTemperature(weather.feelsLikeTemperature)}C`,
                  })}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <WeatherStat
              icon={<Droplets className="size-3.5" aria-hidden="true" />}
              label={localize('com_ui_weather_humidity')}
              value={`${weather.humidity}%`}
            />
            <WeatherStat
              icon={<CloudRain className="size-3.5" aria-hidden="true" />}
              label={localize('com_ui_weather_rainfall')}
              value={`${weather.rainfall} mm`}
            />
            <WeatherStat
              icon={<Wind className="size-3.5" aria-hidden="true" />}
              label={localize('com_ui_weather_wind')}
              value={`${weather.windSpeed} km/h`}
            />
          </div>

          {updatedAt > 0 && (
            <p className="flex items-center gap-1.5 text-xs text-text-tertiary" aria-live="polite">
              {isRefetching && (
                <RefreshCw
                  className="size-3 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
              )}
              {/* Keyed on the fetch time so the label flashes softly whenever fresh data lands. */}
              <motion.span
                key={updatedAt}
                initial={{ opacity: 0.3 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              >
                {localize('com_ui_weather_updated', { 0: formatUpdatedTime(updatedAt) })}
              </motion.span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Weather segment of the header location pill. Opens a popover on desktop and a bottom sheet on phones.
export default function WeatherMenu({ isSmallScreen }: { isSmallScreen?: boolean }) {
  const localize = useLocalize();
  const { user, isAuthenticated } = useAuthContext();
  const profile = user?.farmerProfile as IFarmerProfile | undefined;
  const {
    data: weather,
    isLoading,
    isError,
    isRefetching,
    dataUpdatedAt,
    refetch,
  } = useWeather(isAuthenticated);

  const [open, setOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState({ top: 0, right: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const sheetDragControls = useDragControls();
  // Users who ask the OS for less motion get instant open and close instead of slides and springs.
  const prefersReducedMotion = useReducedMotion() ?? false;

  // Closes the panel. Focus goes back to the chip when the user closed it with the keyboard or a button.
  const closePanel = useCallback((restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus({ preventScroll: true });
  }, []);

  // Anchors the desktop popover under the chip, aligned to its right edge.
  useLayoutEffect(() => {
    if (!open || isSmallScreen || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPopoverPos({
      top: rect.bottom + EDGE_GAP,
      right: Math.max(EDGE_GAP, window.innerWidth - rect.right),
    });
  }, [open, isSmallScreen]);

  // Moves focus into the panel when it opens so keyboard and screen reader users land on it.
  useEffect(() => {
    if (open) panelRef.current?.focus({ preventScroll: true });
  }, [open]);

  // Stops the page behind the bottom sheet from scrolling while the sheet is open.
  useEffect(() => {
    if (!open || !isSmallScreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open, isSmallScreen]);

  // Closes the panel on an outside click, Escape, or a change of screen width.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      closePanel();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closePanel(true);
    };
    const openedWidth = window.innerWidth;
    const onResize = () => {
      if (window.innerWidth !== openedWidth) closePanel();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
    };
  }, [open, closePanel]);

  // Dismisses the bottom sheet after a long or quick downward swipe, otherwise it springs back.
  const handleSheetDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > SHEET_DISMISS_OFFSET || info.velocity.y > SHEET_DISMISS_VELOCITY) {
      closePanel();
    }
  };

  const locationLabel = [profile?.district, profile?.state].filter(Boolean).join(', ');

  // Accessible name for the chip, which only shows a number visually.
  let triggerLabel = localize('com_ui_weather_loading');
  if (weather) {
    triggerLabel = localize('com_ui_weather_show_details', {
      0: `${formatTemperature(weather.liveTemperature)}C`,
      1: weather.weatherCondition,
    });
  } else if (isError) {
    triggerLabel = localize('com_ui_weather_unavailable');
  }

  const details = (
    <WeatherDetails
      weather={weather}
      isLoading={isLoading}
      isError={isError}
      isRefetching={isRefetching}
      updatedAt={dataUpdatedAt}
      locationLabel={locationLabel}
      onRetry={() => refetch()}
      onClose={isSmallScreen ? () => closePanel(true) : undefined}
    />
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((isOpen) => !isOpen)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={triggerLabel}
        title={
          weather
            ? `${weather.weatherCondition}, ${localize('com_ui_weather_feels_like', {
                0: `${formatTemperature(weather.feelsLikeTemperature)}C`,
              })}`
            : undefined
        }
        className={cn(
          'group flex min-h-9 shrink-0 items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-2 transition-colors duration-200 ease-out hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary active:bg-surface-active motion-reduce:transition-none',
          open && 'bg-surface-hover',
        )}
      >
        <span className="relative flex size-7 shrink-0 items-center justify-center rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
          {isError && !weather && (
            <ShakeOnMount inline className="inline-flex">
              <CloudOff className="size-4" aria-hidden="true" />
            </ShakeOnMount>
          )}
          {!isError && !weather && (
            <CloudSun
              className={cn('size-4', isLoading && 'animate-pulse motion-reduce:animate-none')}
              aria-hidden="true"
            />
          )}
          {weather && (
            <WeatherConditionIcon condition={weather.weatherCondition} className="size-4" />
          )}
          {weather && !isError && <LiveIndicator className="absolute -right-0.5 -top-0.5" />}
        </span>
        {/* The key swaps the node when data arrives so the value fades in instead of popping. */}
        <span
          key={weather ? 'value' : 'placeholder'}
          className="font-semibold tabular-nums text-text-primary duration-300 animate-in fade-in-0 motion-reduce:animate-none"
        >
          {weather ? <AnimatedTemperature value={weather.liveTemperature} animateOnMount /> : '--°'}
        </span>
        {!isSmallScreen && weather && (
          <span className="max-w-[8rem] truncate text-text-secondary duration-300 animate-in fade-in-0 motion-reduce:animate-none">
            {weather.weatherCondition}
          </span>
        )}
        {!isSmallScreen && (
          <ChevronDown
            className={cn(
              'size-4 shrink-0 text-text-tertiary transition-transform duration-200 ease-out group-hover:text-text-primary motion-reduce:transition-none',
              open && 'rotate-180',
            )}
            aria-hidden="true"
          />
        )}
      </button>

      {createPortal(
        <AnimatePresence>
          {open && !isSmallScreen && (
            <motion.div
              key="weather-popover"
              ref={panelRef}
              role="dialog"
              aria-label={localize('com_ui_weather_today')}
              tabIndex={-1}
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: -4 }}
              transition={prefersReducedMotion ? INSTANT_TRANSITION : POPOVER_TRANSITION}
              style={{
                top: popoverPos.top,
                right: popoverPos.right,
                width: Math.min(POPOVER_WIDTH, window.innerWidth - EDGE_GAP * 2),
                transformOrigin: 'top right',
              }}
              className="fixed z-[110] rounded-2xl border border-border-light bg-surface-primary p-4 shadow-lg outline-none"
            >
              {details}
            </motion.div>
          )}

          {open && isSmallScreen && (
            <motion.div key="weather-sheet" className="fixed inset-0 z-[110]">
              <motion.div
                className="absolute inset-0 bg-black/50"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={prefersReducedMotion ? INSTANT_TRANSITION : BACKDROP_TRANSITION}
                onClick={() => closePanel()}
                aria-hidden="true"
              />
              <motion.div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label={localize('com_ui_weather_today')}
                tabIndex={-1}
                initial={prefersReducedMotion ? { opacity: 0 } : { y: '100%' }}
                animate={prefersReducedMotion ? { opacity: 1 } : { y: 0 }}
                exit={prefersReducedMotion ? { opacity: 0 } : { y: '100%' }}
                transition={prefersReducedMotion ? INSTANT_TRANSITION : SHEET_TRANSITION}
                drag={prefersReducedMotion ? false : 'y'}
                dragControls={sheetDragControls}
                dragListener={false}
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0, bottom: 0.6 }}
                onDragEnd={handleSheetDragEnd}
                className="absolute inset-x-0 bottom-0 rounded-t-3xl border border-border-light bg-surface-primary px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-lg outline-none will-change-transform"
              >
                {/* Swipe area. Dragging only starts here so taps on the content are never hijacked. */}
                <div
                  onPointerDown={(event) => sheetDragControls.start(event)}
                  className="-mx-5 flex cursor-grab touch-none justify-center pb-3 pt-3 active:cursor-grabbing"
                  aria-hidden="true"
                >
                  <div className="h-1.5 w-11 rounded-full bg-border-medium" />
                </div>
                {details}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
