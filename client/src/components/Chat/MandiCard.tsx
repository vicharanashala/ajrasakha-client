import { useId } from 'react';
import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, MapPin, SearchX, Store, WifiOff } from 'lucide-react';
import { isMissingLocationError } from '~/hooks/useWeather';
import { useMandiPrices, useNearbyMandis } from '~/hooks/useMandi';
import type { MandiPrice, NearbyMandi } from '~/hooks/useMandi';
import { useAuthContext, useLocalize } from '~/hooks';
import { CropIcon, MandiStateMessage, useDistanceLabel } from '~/components/Mandi/MandiShared';
import {
  formatMandiName,
  formatPriceNumber,
  formatReportDate,
  toTitleCase,
} from '~/components/Mandi/mandiFormat';
import { cn } from '~/utils';
import { LANDING_CARD_SURFACE } from './landingCardStyles';
import { RefreshProgressBar, Shimmer } from './WeatherStatus';
import { IconBadge } from './WeatherCard';

// Number of crop prices shown on the landing card.
const FEATURED_PRICE_COUNT = 3;

// Picks the nearest mandi that has reported prices recently, or the nearest one when none has.
const pickFeaturedMandi = (mandis: NearbyMandi[]) =>
  mandis.find((mandi) => mandi.updatedDate) ?? mandis[0];

// Picks the prices to feature, preferring current prices over stale ones.
const pickFeaturedPrices = (prices: MandiPrice[]) =>
  [...prices.filter((price) => !price.stale), ...prices.filter((price) => price.stale)].slice(
    0,
    FEATURED_PRICE_COUNT,
  );

// Placeholder with the same shape as the loaded card, so nothing jumps when data arrives.
function MandiCardSkeleton({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true">
      <span className="sr-only">{label}</span>
      <Shimmer className="h-4 w-48 rounded-md" />
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Shimmer className="h-16 rounded-xl" />
        <Shimmer className="h-16 rounded-xl" />
        <Shimmer className="h-16 rounded-xl" />
      </div>
    </div>
  );
}

// One featured crop price, e.g. Wheat ₹2,275/q. Stacks on phones and sits in a row on wider screens.
function PriceTile({ price }: { price: MandiPrice }) {
  const localize = useLocalize();
  return (
    <li className="bg-surface-primary/40 flex min-w-0 flex-col gap-1.5 rounded-xl border border-border-light p-2.5 sm:flex-row sm:items-center sm:gap-2.5 sm:p-3">
      <IconBadge className="size-8">
        <CropIcon crop={price.crop} className="size-4" />
      </IconBadge>
      <div className="min-w-0">
        <p className="truncate text-xs text-text-secondary" title={toTitleCase(price.crop)}>
          {toTitleCase(price.crop)}
        </p>
        <p className="truncate text-sm font-semibold tabular-nums text-text-primary">
          {localize('com_ui_mandi_price_per_quintal', { 0: formatPriceNumber(price.modal) })}
        </p>
      </div>
    </li>
  );
}

type FeaturedMandiProps = { mandi: NearbyMandi };

// Featured mandi with its latest prices, or a message when it has none to show.
function FeaturedMandi({ mandi }: FeaturedMandiProps) {
  const localize = useLocalize();
  const getDistanceLabel = useDistanceLabel();
  const { data, isLoading, isError, isRefetching, refetch } = useMandiPrices(mandi.id);
  const prices = pickFeaturedPrices(data?.pages[0]?.data ?? []);
  const distanceLabel = getDistanceLabel(mandi.distanceKm);
  const reportDate = formatReportDate(mandi.updatedDate);
  const details = [distanceLabel, reportDate && localize('com_ui_mandi_updated', { 0: reportDate })]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="flex flex-col gap-3">
      <div className="flex min-w-0 items-start gap-2 text-xs text-text-secondary">
        <MapPin
          className="mt-0.5 size-3.5 shrink-0 text-green-600 dark:text-green-400"
          aria-hidden="true"
        />
        <p className="min-w-0">
          <span className="font-semibold text-text-primary">{formatMandiName(mandi.name)}</span>
          {details && <span> · {details}</span>}
        </p>
      </div>
      {isLoading && <MandiCardSkeleton label={localize('com_ui_mandi_loading')} />}
      {isError && !data && (
        <MandiStateMessage
          tone="error"
          icon={<WifiOff className="size-6" aria-hidden="true" />}
          message={localize('com_ui_mandi_error')}
          retryLabel={localize('com_ui_retry')}
          isRetrying={isRefetching}
          onRetry={() => refetch()}
        />
      )}
      {data && prices.length === 0 && (
        <MandiStateMessage
          tone="empty"
          icon={<SearchX className="size-6" aria-hidden="true" />}
          message={localize('com_ui_mandi_no_prices')}
        />
      )}
      {prices.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 animate-in fade-in-0 motion-reduce:animate-none sm:gap-3">
          {prices.map((price) => (
            <PriceTile key={price.productId} price={price} />
          ))}
        </ul>
      )}
    </div>
  );
}

type MandiCardProps = { className?: string; style?: CSSProperties };

// Latest prices at the nearest mandi, shown on the new chat screen under the weather card.
export default function MandiCard({ className, style }: MandiCardProps) {
  const localize = useLocalize();
  const navigate = useNavigate();
  const titleId = useId();
  const { isAuthenticated } = useAuthContext();
  // Same query as the first page of the mandi prices page, so opening that page reuses this data.
  const { data, isLoading, isError, error, isRefetching, refetch } = useNearbyMandis(
    '',
    isAuthenticated,
  );

  if (!isAuthenticated) {
    return null;
  }

  const mandis = data?.pages[0]?.data ?? [];
  const featuredMandi = pickFeaturedMandi(mandis);
  const isLocationMissing = isMissingLocationError(error);

  return (
    <section
      aria-labelledby={titleId}
      style={style}
      className={cn(
        'relative flex w-full flex-col gap-4 overflow-hidden rounded-2xl p-4 text-start sm:p-5',
        LANDING_CARD_SURFACE,
        'shadow-[0_2px_6px_0_rgba(0,0,0,0.09)] dark:shadow-[0_2px_8px_0_rgba(0,0,0,0.45)]',
        className,
      )}
    >
      <RefreshProgressBar active={!!data && isRefetching} />
      <div className="flex min-w-0 items-start gap-2">
        <IconBadge className="size-8">
          <Store className="size-[18px]" aria-hidden="true" />
        </IconBadge>
        <div className="min-w-0">
          <h2 id={titleId} className="text-base font-semibold text-text-primary sm:text-lg">
            {localize('com_ui_mandi_near_you')}
          </h2>
          <p className="text-xs text-text-secondary">
            {localize('com_ui_mandi_near_you_subtitle')}
          </p>
        </div>
      </div>

      {isLoading && <MandiCardSkeleton label={localize('com_ui_mandi_loading')} />}
      {isError && !data && (
        <MandiStateMessage
          tone="error"
          icon={<WifiOff className="size-6" aria-hidden="true" />}
          message={localize(isLocationMissing ? 'com_ui_mandi_no_location' : 'com_ui_mandi_error')}
          retryLabel={localize('com_ui_retry')}
          isRetrying={isRefetching}
          onRetry={isLocationMissing ? undefined : () => refetch()}
        />
      )}
      {data && !featuredMandi && (
        <MandiStateMessage
          tone="empty"
          icon={<SearchX className="size-6" aria-hidden="true" />}
          message={localize('com_ui_mandi_no_mandis')}
        />
      )}
      {featuredMandi && <FeaturedMandi mandi={featuredMandi} />}

      {featuredMandi && (
        <button
          type="button"
          onClick={() => navigate('/mandi')}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-green-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-chat motion-reduce:transition-none dark:bg-green-500 dark:text-green-950 dark:hover:bg-green-400"
        >
          <Store className="size-4 shrink-0" aria-hidden="true" />
          {localize('com_ui_mandi_explore')}
          <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
        </button>
      )}
    </section>
  );
}
