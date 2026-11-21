import { useId, useState } from 'react';
import { ChevronDown, MapPin, Search, SearchX, WifiOff } from 'lucide-react';
import { useMandiPrices } from '~/hooks/useMandi';
import type { MandiPriceSort, NearbyMandi } from '~/hooks/useMandi';
import { useDebounce } from '~/hooks/Input';
import { useLocalize } from '~/hooks';
import type { TranslationKeys } from '~/hooks';
import { Shimmer } from '~/components/Chat/WeatherStatus';
import { IconBadge } from '~/components/Chat/WeatherCard';
import { cn } from '~/utils';
import { formatMandiName, formatReportDate } from './mandiFormat';
import {
  LoadMoreButton,
  MandiPriceTable,
  MandiStateMessage,
  useDistanceLabel,
} from './MandiShared';

// Delay before a typed crop search is sent, so each keystroke does not trigger a request.
const SEARCH_DEBOUNCE_MS = 350;

// Sort choices offered above the price table, in display order.
const SORT_OPTIONS: Array<{ value: MandiPriceSort; labelKey: TranslationKeys }> = [
  { value: 'crop', labelKey: 'com_ui_mandi_sort_crop' },
  { value: 'price_high', labelKey: 'com_ui_mandi_sort_price_high' },
  { value: 'price_low', labelKey: 'com_ui_mandi_sort_price_low' },
  { value: 'newest', labelKey: 'com_ui_mandi_sort_newest' },
];

// Shared styles for the small search and sort controls inside an open mandi.
const CONTROL_CLASS =
  'min-h-10 rounded-lg border border-border-light bg-surface-primary text-sm text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary';

// Placeholder rows shown while a mandi's prices load.
function PriceTableSkeleton({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-2 px-3 py-3 sm:px-4" aria-busy="true">
      <span className="sr-only">{label}</span>
      <Shimmer className="h-8 rounded-md" />
      <Shimmer className="h-8 rounded-md" />
      <Shimmer className="h-8 rounded-md" />
    </div>
  );
}

// Prices of one mandi with crop search, sorting and paging. Mounted only while the mandi is open,
// so prices are fetched only for mandis the farmer looks at.
function MandiPricesPanel({ mandi }: { mandi: NearbyMandi }) {
  const localize = useLocalize();
  const searchId = useId();
  const sortId = useId();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<MandiPriceSort>('crop');
  const debouncedSearch = useDebounce(search, SEARCH_DEBOUNCE_MS);
  const {
    data,
    isLoading,
    isError,
    isRefetching,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useMandiPrices(mandi.id, { search: debouncedSearch, sort });
  const prices = data?.pages.flatMap((page) => page.data) ?? [];
  const trimmedSearch = debouncedSearch.trim();
  const mandiName = formatMandiName(mandi.name);

  return (
    <div className="flex flex-col gap-3 border-t border-border-light pb-3">
      <div className="flex flex-col gap-2 px-3 pt-3 sm:flex-row sm:px-4">
        <div className="relative flex-1">
          <label htmlFor={searchId} className="sr-only">
            {localize('com_ui_mandi_search_crops')}
          </label>
          <Search
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-text-tertiary"
            aria-hidden="true"
          />
          <input
            id={searchId}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={localize('com_ui_mandi_search_crops')}
            maxLength={100}
            autoComplete="off"
            className={cn(CONTROL_CLASS, 'w-full pe-3 ps-9 placeholder:text-text-tertiary')}
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor={sortId} className="shrink-0 text-xs text-text-secondary">
            {localize('com_ui_mandi_sort_label')}
          </label>
          <select
            id={sortId}
            value={sort}
            onChange={(event) => setSort(event.target.value as MandiPriceSort)}
            className={cn(CONTROL_CLASS, 'flex-1 px-2 sm:flex-none')}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {localize(option.labelKey)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading && <PriceTableSkeleton label={localize('com_ui_mandi_loading')} />}
      {isError && !data && (
        <MandiStateMessage
          tone="error"
          className="mx-3 sm:mx-4"
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
          className="mx-3 sm:mx-4"
          icon={<SearchX className="size-6" aria-hidden="true" />}
          message={
            trimmedSearch
              ? localize('com_ui_mandi_no_crop_results', { 0: trimmedSearch })
              : localize('com_ui_mandi_no_prices')
          }
        />
      )}
      {prices.length > 0 && (
        <div
          className={cn('transition-opacity', isRefetching && !isFetchingNextPage && 'opacity-60')}
        >
          <MandiPriceTable
            prices={prices}
            caption={localize('com_ui_mandi_table_caption', { 0: mandiName })}
          />
        </div>
      )}
      {hasNextPage && (
        <LoadMoreButton
          label={localize('com_ui_mandi_load_more_prices')}
          isLoading={isFetchingNextPage}
          onClick={() => fetchNextPage()}
        />
      )}
    </div>
  );
}

type MandiAccordionItemProps = {
  mandi: NearbyMandi;
  isOpen: boolean;
  onToggle: () => void;
};

// One mandi in the prices page list. The header shows its name, distance and report date, and
// opens a panel with its crop prices.
export default function MandiAccordionItem({ mandi, isOpen, onToggle }: MandiAccordionItemProps) {
  const localize = useLocalize();
  const getDistanceLabel = useDistanceLabel();
  const panelId = useId();
  const distanceLabel = getDistanceLabel(mandi.distanceKm);
  const reportDate = formatReportDate(mandi.updatedDate);
  const statusLabel = reportDate
    ? localize('com_ui_mandi_updated', { 0: reportDate })
    : localize('com_ui_mandi_not_updated');

  return (
    <li className="overflow-hidden rounded-2xl border border-border-light bg-surface-chat shadow-[0_1px_3px_0_rgba(0,0,0,0.06)] dark:border-white/[0.07]">
      <h3>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-controls={panelId}
          className="flex w-full items-center gap-3 px-3 py-3 text-start transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring-primary motion-reduce:transition-none sm:px-4"
        >
          <IconBadge className="size-9">
            <MapPin className="size-4" aria-hidden="true" />
          </IconBadge>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="break-words font-semibold text-text-primary">
              {formatMandiName(mandi.name)}
            </span>
            <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-text-secondary">
              {distanceLabel && <span>{distanceLabel}</span>}
              {distanceLabel && <span aria-hidden="true">·</span>}
              <span className={cn(!reportDate && 'text-text-tertiary')}>{statusLabel}</span>
            </span>
          </span>
          <ChevronDown
            className={cn(
              'size-5 shrink-0 text-text-secondary transition-transform duration-200 motion-reduce:transition-none',
              isOpen && 'rotate-180',
            )}
            aria-hidden="true"
          />
        </button>
      </h3>
      <div id={panelId} hidden={!isOpen}>
        {isOpen && <MandiPricesPanel mandi={mandi} />}
      </div>
    </li>
  );
}
