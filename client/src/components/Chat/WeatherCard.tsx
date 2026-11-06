import { useId } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { CloudOff, CloudRain, Droplets, MapPin, RadioTower, RefreshCw, Wind } from 'lucide-react';
import type { IFarmerProfile } from 'librechat-data-provider';
import { isMissingLocationError, useWeather } from '~/hooks/useWeather';
import type { Weather } from '~/hooks/useWeather';
import { useAuthContext, useLocalize } from '~/hooks';
import { cn } from '~/utils';
import { LANDING_CARD_SURFACE } from './landingCardStyles';
import {
  AnimatedTemperature,
  LiveIndicator,
  ShakeOnMount,
  Shimmer,
  WeatherConditionIcon,
} from './WeatherStatus';

// Rounds a Celsius temperature for display, e.g. 32.5 becomes 33°.
const formatTemperature = (value: number) => `${Math.round(value)}°`;

// Formats a station reading with its unit, or a dash when the station did not report it.
const formatReading = (value: number | null, unit: string, decimals = 0) =>
  value === null ? '--' : `${Number(value.toFixed(decimals))}${unit}`;

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

type WeatherCardBodyProps = { weather: Weather; updatedAt: number; isRefetching: boolean };

// Loaded state: temperature, condition, stats and when the data was last refreshed.
function WeatherCardBody({ weather, updatedAt, isRefetching }: WeatherCardBodyProps) {
  const localize = useLocalize();
  return (
    <div className="flex flex-col gap-4 duration-300 animate-in fade-in-0 motion-reduce:animate-none">
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
            <p className="truncate font-semibold text-text-primary">{weather.weatherCondition}</p>
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
          value={formatReading(weather.rainfall, ' mm', 1)}
        />
        <WeatherCardStat
          icon={<Wind className="size-4" aria-hidden="true" />}
          label={localize('com_ui_weather_wind')}
          value={formatReading(weather.windSpeed, ' km/h', 1)}
        />
      </div>

      {updatedAt > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-text-tertiary">
          <p className="flex items-center gap-1.5" aria-live="polite">
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
              {/* The station's own reading time is shown when available, it is more accurate than the fetch time. */}
              {localize('com_ui_weather_updated', {
                0: weather.recordedAt ?? formatUpdatedTime(updatedAt),
              })}
            </motion.span>
          </p>
          {weather.stationName && (
            <p className="flex min-w-0 items-center gap-1" title={weather.stationName}>
              <RadioTower className="size-3 shrink-0" aria-hidden="true" />
              <span className="truncate">
                {weather.stationDistanceKm === null
                  ? weather.stationName
                  : localize('com_ui_weather_station', {
                      0: weather.stationName,
                      1: formatReading(weather.stationDistanceKm, '', 1),
                    })}
              </span>
            </p>
          )}
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

  if (!isAuthenticated) {
    return null;
  }

  const locationLabel = [profile?.district, profile?.state].filter(Boolean).join(', ');

  return (
    <section
      aria-labelledby={titleId}
      style={style}
      className={cn(
        'flex w-full flex-col gap-4 rounded-2xl p-4 text-start sm:p-5',
        // Same border, surface, gradient and shadow as the question cards so they read as one set.
        LANDING_CARD_SURFACE,
        'shadow-[0_2px_6px_0_rgba(0,0,0,0.09)] dark:shadow-[0_2px_8px_0_rgba(0,0,0,0.45)]',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h2 id={titleId} className="text-base font-semibold text-text-primary sm:text-lg">
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
          <p className="flex min-w-0 items-center gap-1 pt-0.5 text-xs capitalize text-text-secondary">
            <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{locationLabel}</span>
          </p>
        )}
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
        <WeatherCardBody weather={weather} updatedAt={dataUpdatedAt} isRefetching={isRefetching} />
      )}
    </section>
  );
}
