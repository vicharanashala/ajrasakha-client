import { useEffect, useId, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useRecoilValue } from 'recoil';
import {
  ArrowRight,
  CloudOff,
  CloudRain,
  Droplets,
  MapPin,
  RadioTower,
  RefreshCw,
  Wind,
} from 'lucide-react';
import type { IFarmerProfile } from 'librechat-data-provider';
import { isMissingLocationError, useWeather } from '~/hooks/useWeather';
import type { Weather } from '~/hooks/useWeather';
import { useAuthContext, useLocalize } from '~/hooks';
import type { TranslationKeys } from '~/hooks';
import { cn } from '~/utils';
import store from '~/store';
import { LANDING_CARD_SURFACE } from './landingCardStyles';
import {
  AnimatedTemperature,
  RefreshProgressBar,
  ShakeOnMount,
  Shimmer,
  WeatherConditionIcon,
} from './WeatherStatus';

// Rounds a Celsius temperature for display, e.g. 32.5 becomes 33°.
const formatTemperature = (value: number) => `${Math.round(value)}°`;

// Shown in place of a reading the station did not report.
const MISSING_READING = '--';

// Rounds a reading and drops trailing zeros, e.g. 12.40 becomes 12.4.
const formatNumber = (value: number, decimals = 0) => String(Number(value.toFixed(decimals)));

// Formats a station reading with its unit, or a dash when the station did not report it.
const formatReading = (value: number | null, unit: string, decimals = 0) =>
  value === null ? MISSING_READING : `${formatNumber(value, decimals)}${unit}`;

// Condition labels the weather service sends, mapped to translation keys. Matching ignores case.
// A label not listed here is shown exactly as the service sent it.
const CONDITION_LABEL_KEYS: Record<string, TranslationKeys> = {
  clear: 'com_ui_weather_condition_clear',
  sunny: 'com_ui_weather_condition_sunny',
  'partly cloudy': 'com_ui_weather_condition_partly_cloudy',
  cloudy: 'com_ui_weather_condition_cloudy',
  overcast: 'com_ui_weather_condition_overcast',
  mist: 'com_ui_weather_condition_mist',
  fog: 'com_ui_weather_condition_fog',
  haze: 'com_ui_weather_condition_haze',
  drizzle: 'com_ui_weather_condition_drizzle',
  'light rain': 'com_ui_weather_condition_light_rain',
  rain: 'com_ui_weather_condition_rain',
  'heavy rain': 'com_ui_weather_condition_heavy_rain',
  thunderstorm: 'com_ui_weather_condition_thunderstorm',
};

// Shortest time the refresh icon spins after a tap, so a fast reply still reads as a refresh
// instead of a flicker.
const MIN_REFRESH_SPIN_MS = 700;
// How long the refresh button stays disabled after a tap-driven refresh finishes, so repeated
// taps cannot flood the weather service.
const REFRESH_COOLDOWN_MS = 10000;

// Resolves after the given number of milliseconds.
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Formats when the weather was last fetched, e.g. 10:30 AM.
const formatUpdatedTime = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

type WeatherCardStatProps = { icon: ReactNode; label: string; value: string };

// One metric in the stats row, such as humidity or wind speed.
function WeatherCardStat({ icon, label, value }: WeatherCardStatProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 px-3 first:pl-0 last:pr-0 sm:flex-row sm:items-center sm:gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-green-500/20 to-green-500/5 text-green-600 dark:from-green-400/25 dark:to-green-400/5 dark:text-green-400">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs text-text-secondary">{label}</p>
        <p className="truncate text-sm font-semibold text-text-primary sm:text-base">{value}</p>
      </div>
    </div>
  );
}

// Placeholder with the same shape as the loaded card, so nothing jumps when data arrives.
function WeatherCardSkeleton({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <span className="sr-only">{label}</span>
      <div className="flex items-center justify-between gap-4">
        <Shimmer className="h-14 w-32 rounded-lg" />
        <Shimmer className="h-12 w-36 rounded-lg" />
      </div>
      <div className="grid grid-cols-3 gap-3 border-t border-border-light pt-4">
        <Shimmer className="h-10 rounded-lg" />
        <Shimmer className="h-10 rounded-lg" />
        <Shimmer className="h-10 rounded-lg" />
      </div>
    </div>
  );
}

type WeatherCardErrorProps = {
  message: string;
  retryLabel: string;
  isRetrying: boolean;
  // Left out when retrying cannot help, such as when the farmer has no saved location.
  onRetry?: () => void;
};

// Inline error with an optional retry action. Shakes once when it appears.
function WeatherCardError({ message, retryLabel, isRetrying, onRetry }: WeatherCardErrorProps) {
  return (
    <ShakeOnMount
      role="alert"
      className="bg-surface-tertiary/60 flex flex-col items-center gap-3 rounded-xl px-4 py-5 text-center sm:flex-row sm:text-start"
    >
      <CloudOff className="size-6 shrink-0 text-text-secondary" aria-hidden="true" />
      <p className="flex-1 text-sm text-text-secondary">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={isRetrying}
          className="flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-border-medium px-4 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary disabled:opacity-60 motion-reduce:transition-none"
        >
          <RefreshCw
            className={cn('size-4', isRetrying && 'animate-spin motion-reduce:animate-none')}
            aria-hidden="true"
          />
          {retryLabel}
        </button>
      )}
    </ShakeOnMount>
  );
}

// Drops the station id the service appends, e.g. "Kotakpura tehsil (Annam AWS: #67)" becomes
// "Kotakpura tehsil". The full name is still shown on hover.
const getStationDisplayName = (name: string) => name.replace(/\s*\([^)]*\)\s*$/, '').trim() || name;

type StationSourceProps = { name: string; distanceKm: number | null };

// Source line naming the weather station the reading came from and how far it is from the farm.
// Sits under the update time so both details about where the data came from read together.
function StationSource({ name, distanceKm }: StationSourceProps) {
  const localize = useLocalize();
  const displayName = getStationDisplayName(name);
  return (
    <p title={name} className="flex min-w-0 items-start gap-1.5">
      {/* The line wraps on narrow screens, so the icon is pinned to the first line. */}
      <RadioTower
        className="mt-px size-3.5 shrink-0 text-green-600 dark:text-green-400"
        aria-hidden="true"
      />
      <span className="min-w-0 break-words">
        {distanceKm === null
          ? displayName
          : localize('com_ui_weather_station', {
              0: displayName,
              1: formatReading(distanceKm, '', 1),
            })}
      </span>
    </p>
  );
}

// Forecast link placeholder in the brand colour. Disabled until the forecast page exists, with a coming soon badge.
function ForecastButton() {
  const localize = useLocalize();
  return (
    <button
      type="button"
      disabled
      className="relative inline-flex min-h-9 shrink-0 cursor-not-allowed items-center gap-2 rounded-full bg-green-500/10 px-3 py-1 text-xs font-semibold text-green-700 ring-1 ring-green-500/30 dark:bg-green-400/10 dark:text-green-400 dark:ring-green-400/30"
    >
      {localize('com_ui_weather_view_forecast')}
      <ArrowRight className="size-3.5 shrink-0" aria-hidden="true" />
      {/* Floats over the top right corner. A solid fill keeps it readable over the outline, and the
          ring in the card colour separates it from the button edge. */}
      <span className="absolute -right-2 -top-2.5 whitespace-nowrap rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold leading-none text-amber-950 shadow-sm ring-2 ring-surface-chat">
        {localize('com_ui_weather_coming_soon')}
      </span>
    </button>
  );
}

// How often relative labels such as "2 minutes ago" are recalculated.
const RELATIVE_TIME_TICK_MS = 30000;

// Builds a relative time formatter for the app language. Some app language codes, such as
// as2-IN, are not valid locale tags, so it falls back to the base language and then English.
function getRelativeTimeFormat(lang: string) {
  const candidates = [lang, lang.split('-')[0].replace(/\d+$/, ''), 'en'];
  for (const candidate of candidates) {
    try {
      return new Intl.RelativeTimeFormat(candidate, { numeric: 'auto', style: 'long' });
    } catch {
      // Not a valid locale tag, the next candidate is tried.
    }
  }
  return new Intl.RelativeTimeFormat('en');
}

// Describes how long ago a timestamp was, e.g. "2 minutes ago", or null when under a minute.
function formatTimeAgo(timestamp: number, now: number, formatter: Intl.RelativeTimeFormat) {
  const minutes = Math.floor((now - timestamp) / 60000);
  if (minutes < 1) {
    return null;
  }
  if (minutes < 60) {
    return formatter.format(-minutes, 'minute');
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return formatter.format(-hours, 'hour');
  }
  return formatter.format(-Math.floor(hours / 24), 'day');
}

// Current time that updates on an interval, so relative labels stay accurate while the page is open.
function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

// Muted "Refreshed 2 minutes ago" label under the refresh button, faded in only while the button
// is disabled. Its space is always kept so the header does not jump as it appears and hides.
// It recalculates on its own every half minute and is not a live region, so screen readers are
// not interrupted by it.
function RefreshedAgo({ updatedAt, visible }: { updatedAt: number; visible: boolean }) {
  const localize = useLocalize();
  const lang = useRecoilValue(store.lang);
  const relativeTimeFormat = useMemo(() => getRelativeTimeFormat(lang), [lang]);
  const now = useNow(RELATIVE_TIME_TICK_MS);
  const refreshedAgo = formatTimeAgo(updatedAt, now, relativeTimeFormat);
  return (
    <span
      aria-hidden={!visible}
      className={cn(
        'whitespace-nowrap text-[11px] leading-none text-text-tertiary transition-opacity duration-300 motion-reduce:transition-none',
        visible ? 'opacity-100' : 'invisible opacity-0',
      )}
    >
      {refreshedAgo
        ? localize('com_ui_weather_refreshed', { 0: refreshedAgo })
        : localize('com_ui_weather_refreshed_just_now')}
    </span>
  );
}

type WeatherCardBodyProps = { weather: Weather; updatedAt: number; isRefreshing: boolean };

// Loaded state: temperature, condition, stats and when the data was last refreshed.
// The values dim slightly while a refresh is in flight so it is clear they are about to change.
function WeatherCardBody({ weather, updatedAt, isRefreshing }: WeatherCardBodyProps) {
  const localize = useLocalize();
  // The icon still matches on the service's English label, only the text shown is translated.
  const conditionKey = CONDITION_LABEL_KEYS[weather.weatherCondition.trim().toLowerCase()];
  const conditionLabel = conditionKey ? localize(conditionKey) : weather.weatherCondition;
  return (
    <div
      className={cn(
        'flex flex-col gap-4 transition-opacity duration-300 animate-in fade-in-0 motion-reduce:animate-none motion-reduce:transition-none',
        isRefreshing && 'opacity-60',
      )}
      aria-busy={isRefreshing}
    >
      <div className="flex items-center justify-between gap-4">
        <p className="text-5xl font-bold leading-none tracking-tight text-text-primary sm:text-6xl">
          <span aria-hidden="true">
            <AnimatedTemperature value={weather.liveTemperature} suffix="°C" animateOnMount />
          </span>
          <span className="sr-only">{formatTemperature(weather.liveTemperature)}C</span>
        </p>
        <div className="flex min-w-0 items-center gap-3">
          <WeatherConditionIcon
            condition={weather.weatherCondition}
            className="size-10 shrink-0 text-green-600 dark:text-green-400 sm:size-12"
          />
          <div className="min-w-0">
            <p className="truncate font-semibold text-text-primary">{conditionLabel}</p>
            {weather.feelsLikeTemperature !== null && (
              <p className="text-xs text-text-secondary">
                {localize('com_ui_weather_feels_like', {
                  0: `${formatTemperature(weather.feelsLikeTemperature)}C`,
                })}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 divide-x divide-border-light border-t border-border-light pt-4">
        <WeatherCardStat
          icon={<Droplets className="size-4" aria-hidden="true" />}
          label={localize('com_ui_weather_humidity')}
          value={formatReading(weather.humidity, '%')}
        />
        <WeatherCardStat
          icon={<CloudRain className="size-4" aria-hidden="true" />}
          label={localize('com_ui_weather_rainfall')}
          value={
            weather.rainfall === null
              ? MISSING_READING
              : localize('com_ui_weather_rainfall_value', { 0: formatNumber(weather.rainfall, 1) })
          }
        />
        <WeatherCardStat
          icon={<Wind className="size-4" aria-hidden="true" />}
          label={localize('com_ui_weather_wind')}
          value={
            weather.windSpeed === null
              ? MISSING_READING
              : localize('com_ui_weather_wind_value', { 0: formatNumber(weather.windSpeed, 1) })
          }
        />
      </div>

      {updatedAt > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 text-xs text-text-tertiary">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="flex items-center gap-1.5" aria-live="polite">
              {/* Keyed on the fetch time so the label flashes softly whenever fresh data lands. */}
              <motion.span
                key={updatedAt}
                initial={{ opacity: 0.3 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              >
                {/* The station's own reading time is shown when available, it is more accurate than the fetch time. */}
                {localize('com_ui_weather_updated', {
                  0: weather.recordedAt ?? formatUpdatedTime(updatedAt),
                })}
              </motion.span>
            </p>
            {weather.stationName && (
              <StationSource name={weather.stationName} distanceKm={weather.stationDistanceKm} />
            )}
          </div>
          <ForecastButton />
        </div>
      )}
    </div>
  );
}

type WeatherCardProps = { className?: string; style?: CSSProperties };

// Today's weather for the farmer's location, shown on the new chat screen above the example questions.
export default function WeatherCard({ className, style }: WeatherCardProps) {
  const localize = useLocalize();
  const titleId = useId();
  const { user, isAuthenticated } = useAuthContext();
  const profile = user?.farmerProfile as IFarmerProfile | undefined;
  const {
    data: weather,
    isLoading,
    isError,
    error,
    isRefetching,
    dataUpdatedAt,
    refetch,
  } = useWeather(isAuthenticated);
  const isLocationMissing = isMissingLocationError(error);
  // True from a refresh tap until the new reading is in and the minimum spin has played.
  const [isManualRefresh, setIsManualRefresh] = useState(false);
  // Covers taps on the refresh button and background refetches such as after a location change.
  const isRefreshing = !!weather && (isManualRefresh || isRefetching);
  // When the rest after a tap-driven refresh ends, as a timestamp. Zero when the button is not resting.
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const isCoolingDown = cooldownUntil > 0;

  // Ends the rest when its time is up. The timer lives in this effect and is derived from the stored
  // end time, so if the effect is cleaned up and run again (hot reload, strict mode) the timer is
  // simply scheduled again and the button can never stay disabled.
  useEffect(() => {
    if (!cooldownUntil) {
      return;
    }
    const remaining = cooldownUntil - Date.now();
    if (remaining <= 0) {
      setCooldownUntil(0);
      return;
    }
    const timer = window.setTimeout(() => setCooldownUntil(0), remaining);
    return () => window.clearTimeout(timer);
  }, [cooldownUntil]);

  // Fetches fresh weather on demand, then rests the button for a few seconds.
  // Ignores taps while a refresh is running or the button is resting.
  const handleRefresh = async () => {
    if (isRefreshing || isCoolingDown) {
      return;
    }
    setIsManualRefresh(true);
    try {
      await Promise.all([refetch(), wait(MIN_REFRESH_SPIN_MS)]);
    } finally {
      setIsManualRefresh(false);
      setCooldownUntil(Date.now() + REFRESH_COOLDOWN_MS);
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  const locationLabel = [profile?.district, profile?.state].filter(Boolean).join(', ');

  return (
    <section
      aria-labelledby={titleId}
      style={style}
      className={cn(
        'relative flex w-full flex-col gap-4 overflow-hidden rounded-2xl p-4 text-start sm:p-5',
        // Same border, surface, gradient and shadow as the question cards so they read as one set.
        LANDING_CARD_SURFACE,
        'shadow-[0_2px_6px_0_rgba(0,0,0,0.09)] dark:shadow-[0_2px_8px_0_rgba(0,0,0,0.45)]',
        className,
      )}
    >
      <RefreshProgressBar active={isRefreshing} />
      <div className="flex items-start justify-between gap-3">
        <h2 id={titleId} className="shrink-0 text-base font-semibold text-text-primary sm:text-lg">
          {localize('com_ui_weather_today')}
        </h2>
        <div className="flex min-w-0 flex-col items-end gap-1">
          <div className="flex min-w-0 max-w-full items-center gap-1">
            {locationLabel && (
              <p className="flex min-w-0 items-center gap-1 text-xs capitalize text-text-secondary">
                <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{locationLabel}</span>
              </p>
            )}
            {weather && (
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing || isCoolingDown}
                aria-label={localize('com_ui_weather_refresh')}
                title={localize('com_ui_weather_refresh')}
                className="-my-2 -mr-2 flex size-10 shrink-0 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary disabled:cursor-default disabled:hover:bg-transparent motion-reduce:transition-none"
              >
                <RefreshCw
                  className={cn(
                    'size-4 transition-[color,opacity] duration-300',
                    isCoolingDown && !isRefreshing && 'opacity-40',
                    isRefreshing &&
                      'animate-spin text-green-600 motion-reduce:animate-none dark:text-green-400',
                  )}
                  aria-hidden="true"
                />
              </button>
            )}
          </div>
          {/* Shown only while the button is disabled, to explain why it cannot be tapped right now. */}
          {weather && dataUpdatedAt > 0 && (
            <RefreshedAgo updatedAt={dataUpdatedAt} visible={isRefreshing || isCoolingDown} />
          )}
        </div>
      </div>

      {isLoading && !weather && <WeatherCardSkeleton label={localize('com_ui_weather_loading')} />}
      {isError && !weather && (
        <WeatherCardError
          message={localize(
            isLocationMissing ? 'com_ui_weather_no_location' : 'com_ui_weather_error',
          )}
          retryLabel={localize('com_ui_retry')}
          isRetrying={isRefetching}
          onRetry={isLocationMissing ? undefined : () => refetch()}
        />
      )}
      {weather && (
        <WeatherCardBody weather={weather} updatedAt={dataUpdatedAt} isRefreshing={isRefreshing} />
      )}
    </section>
  );
}
