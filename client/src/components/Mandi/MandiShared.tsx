import type { ReactNode } from 'react';
import { Apple, Bean, Carrot, Clock, RefreshCw, Sprout, Wheat } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { MandiPrice } from '~/hooks/useMandi';
import { ShakeOnMount } from '~/components/Chat/WeatherStatus';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';
import {
  formatDistanceNumber,
  formatPriceNumber,
  getDisplayVariety,
  isNonQuintalUnit,
  toTitleCase,
} from './mandiFormat';

// Crop name fragments mapped to an icon group. The first matching group wins, anything else gets a sprout.
const CROP_ICON_GROUPS: Array<{ icon: LucideIcon; keywords: string[] }> = [
  {
    icon: Wheat,
    keywords: [
      'wheat',
      'paddy',
      'rice',
      'maize',
      'corn',
      'barley',
      'bajra',
      'jowar',
      'millet',
      'ragi',
    ],
  },
  {
    icon: Bean,
    keywords: ['moong', 'gram', 'dal', 'bean', 'arhar', 'tur', 'masoor', 'urad', 'pea', 'soya'],
  },
  {
    icon: Apple,
    keywords: ['apple', 'banana', 'mango', 'grape', 'orange', 'kinnow', 'guava', 'papaya', 'lemon'],
  },
  {
    icon: Carrot,
    keywords: [
      'onion',
      'potato',
      'tomato',
      'chilli',
      'carrot',
      'cabbage',
      'cauliflower',
      'brinjal',
      'garlic',
      'ginger',
      'radish',
      'okra',
      'bhindi',
      'gourd',
    ],
  },
];

// Picks an icon that roughly matches the crop type.
function getCropIcon(crop: string): LucideIcon {
  const name = crop.toLowerCase();
  return (
    CROP_ICON_GROUPS.find(({ keywords }) => keywords.some((word) => name.includes(word)))?.icon ??
    Sprout
  );
}

// Small crop icon in the brand colour.
export function CropIcon({ crop, className }: { crop: string; className?: string }) {
  const Icon = getCropIcon(crop);
  return (
    <Icon
      className={cn('shrink-0 text-green-600 dark:text-green-400', className)}
      aria-hidden="true"
    />
  );
}

// Localised distance label, e.g. "18.6 km away", or "Less than 1 km away" for very close mandis.
export function useDistanceLabel() {
  const localize = useLocalize();
  return (distanceKm: number | null) => {
    if (distanceKm === null) {
      return null;
    }
    return distanceKm < 1
      ? localize('com_ui_mandi_distance_nearby')
      : localize('com_ui_mandi_distance', { 0: formatDistanceNumber(distanceKm) });
  };
}

type MandiStateMessageProps = {
  icon: ReactNode;
  message: string;
  // Error messages shake once and are announced as alerts, empty states are announced politely.
  tone: 'error' | 'empty';
  retryLabel?: string;
  isRetrying?: boolean;
  // Left out when retrying cannot help, such as when the farmer has no saved location.
  onRetry?: () => void;
  className?: string;
};

// Inline error or empty message with an optional retry action.
export function MandiStateMessage({
  icon,
  message,
  tone,
  retryLabel,
  isRetrying = false,
  onRetry,
  className,
}: MandiStateMessageProps) {
  const content = (
    <>
      <span className="shrink-0 text-text-secondary">{icon}</span>
      <p className="flex-1 text-sm text-text-secondary">{message}</p>
      {onRetry && retryLabel && (
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
    </>
  );
  const boxClassName = cn(
    'bg-surface-tertiary/60 flex flex-col items-center gap-3 rounded-xl px-4 py-5 text-center sm:flex-row sm:text-start',
    className,
  );
  if (tone === 'error') {
    return (
      <ShakeOnMount role="alert" className={boxClassName}>
        {content}
      </ShakeOnMount>
    );
  }
  return (
    <div role="status" className={boxClassName}>
      {content}
    </div>
  );
}

// Amber label for a price older than the service considers current. Text is included so the
// warning does not rely on colour alone.
function StalePriceBadge({ ageDays }: { ageDays: number | null }) {
  const localize = useLocalize();
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-amber-700 dark:text-amber-400">
      <Clock className="size-3" aria-hidden="true" />
      {ageDays === null
        ? localize('com_ui_mandi_stale_unknown')
        : localize('com_ui_mandi_stale', { 0: String(ageDays) })}
    </span>
  );
}

// Column heading with the price unit on a second line, so the numbers stay narrow on phones.
function PriceColumnHeading({ label }: { label: string }) {
  const localize = useLocalize();
  return (
    <th scope="col" className="px-2 py-2 text-end font-medium last:pe-3 sm:px-3">
      <span className="block">{label}</span>
      <span className="block text-[10px] font-normal text-text-tertiary">
        {localize('com_ui_mandi_unit_short')}
      </span>
    </th>
  );
}

type MandiPriceTableProps = { prices: MandiPrice[]; caption: string };

// Crop price table with min, max and the highlighted modal price for each crop.
export function MandiPriceTable({ prices, caption }: MandiPriceTableProps) {
  const localize = useLocalize();
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[300px] border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="text-xs text-text-secondary">
          <tr className="border-b border-border-light">
            <th scope="col" className="py-2 pe-2 ps-3 text-start align-bottom font-medium sm:ps-4">
              {localize('com_ui_mandi_col_crop')}
            </th>
            <PriceColumnHeading label={localize('com_ui_mandi_col_min')} />
            <PriceColumnHeading label={localize('com_ui_mandi_col_max')} />
            <PriceColumnHeading label={localize('com_ui_mandi_col_modal')} />
          </tr>
        </thead>
        <tbody>
          {prices.map((price) => {
            const variety = getDisplayVariety(price.variety);
            return (
              <tr key={price.productId} className="border-b border-border-light last:border-b-0">
                <th scope="row" className="py-2.5 pe-2 ps-3 text-start font-normal sm:ps-4">
                  <div className="flex min-w-0 items-center gap-2">
                    <CropIcon crop={price.crop} className="size-4 sm:size-5" />
                    <div className="min-w-0">
                      <p className="break-words font-medium text-text-primary">
                        {toTitleCase(price.crop)}
                        {variety && (
                          <span className="ms-1 text-xs font-normal text-text-secondary">
                            ({variety})
                          </span>
                        )}
                      </p>
                      {(price.stale || isNonQuintalUnit(price.unit)) && (
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          {price.stale && <StalePriceBadge ageDays={price.ageDays} />}
                          {isNonQuintalUnit(price.unit) && (
                            <span className="text-[10px] text-text-tertiary">{price.unit}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </th>
                <td className="whitespace-nowrap px-2 py-2.5 text-end tabular-nums text-text-secondary sm:px-3">
                  {formatPriceNumber(price.min)}
                </td>
                <td className="whitespace-nowrap px-2 py-2.5 text-end tabular-nums text-text-secondary sm:px-3">
                  {formatPriceNumber(price.max)}
                </td>
                <td className="whitespace-nowrap py-2.5 pe-3 ps-2 text-end sm:pe-4 sm:ps-3">
                  <span className="inline-block min-w-[4.5rem] rounded-full bg-green-500/15 px-2.5 py-1 text-center font-semibold tabular-nums text-green-700 dark:bg-green-400/15 dark:text-green-400">
                    {formatPriceNumber(price.modal)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

type LoadMoreButtonProps = { label: string; isLoading: boolean; onClick: () => void };

// Outline button that loads the next page of a list. Disabled while a page is loading.
export function LoadMoreButton({ label, isLoading, onClick }: LoadMoreButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLoading}
      aria-busy={isLoading}
      className="mx-auto flex min-h-11 items-center gap-2 rounded-full border border-border-medium px-5 text-sm font-semibold text-text-primary transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary disabled:opacity-60 motion-reduce:transition-none"
    >
      {isLoading && (
        <RefreshCw className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      )}
      {label}
    </button>
  );
}
