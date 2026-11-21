import { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Info, MapPin, Search, SearchX, Store, WifiOff } from 'lucide-react';
import type { IFarmerProfile } from 'librechat-data-provider';
import { useNearbyMandis } from '~/hooks/useMandi';
import { isMissingLocationError } from '~/hooks/useWeather';
import { useDebounce } from '~/hooks/Input';
import { useAuthContext, useLocalize } from '~/hooks';
import { Shimmer } from '~/components/Chat/WeatherStatus';
import { IconBadge } from '~/components/Chat/WeatherCard';
import MandiAccordionItem from './MandiAccordionItem';
import { LoadMoreButton, MandiStateMessage } from './MandiShared';

// Delay before a typed mandi search is sent, so each keystroke does not trigger a request.
const SEARCH_DEBOUNCE_MS = 350;

// Placeholder list shown while the nearby mandis load.
function MandiListSkeleton({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true">
      <span className="sr-only">{label}</span>
      {[0, 1, 2].map((item) => (
        <Shimmer key={item} className="h-16 rounded-2xl" />
      ))}
    </div>
  );
}

// Page listing mandis near the farmer's saved location, each with its latest crop prices.
export default function MandiPricesPage() {
  const localize = useLocalize();
  const navigate = useNavigate();
  const searchId = useId();
  const { user, isAuthenticated } = useAuthContext();
  const profile = user?.farmerProfile as IFarmerProfile | undefined;
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, SEARCH_DEBOUNCE_MS);
  // Mandis the farmer opened or closed. Mandis not listed here use the default open state.
  const [openState, setOpenState] = useState<Record<string, boolean>>({});
  const {
    data,
    isLoading,
    isError,
    error,
    isRefetching,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useNearbyMandis(debouncedSearch, isAuthenticated);

  const mandis = data?.pages.flatMap((page) => page.data) ?? [];
  const totalMandis = data?.pages[0]?.pagination.total ?? 0;
  // The nearest mandi with recent prices opens by default, so prices show without an extra tap.
  const defaultOpenId = (mandis.find((mandi) => mandi.updatedDate) ?? mandis[0])?.id;
  const isLocationMissing = isMissingLocationError(error);
  const trimmedSearch = debouncedSearch.trim();
  const locationLabel = [profile?.district, profile?.state].filter(Boolean).join(', ');

  // Opens or closes one mandi without changing the others.
  const toggleMandi = (mandiId: string, isOpen: boolean) =>
    setOpenState((previous) => ({ ...previous, [mandiId]: !isOpen }));

  return (
    <div className="h-full w-full overflow-y-auto bg-surface-primary">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-5 sm:px-6 sm:py-8 lg:max-w-4xl">
        <header className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="-ml-2 flex w-fit items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {localize('com_ui_back_to_chat')}
          </button>
          <div className="flex items-center gap-3">
            <IconBadge className="size-10">
              <Store className="size-5" aria-hidden="true" />
            </IconBadge>
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold text-text-primary sm:text-3xl">
                {localize('com_ui_mandi_title')}
              </h1>
              {locationLabel && (
                <p className="flex items-center gap-1 text-sm capitalize text-text-secondary">
                  <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{locationLabel}</span>
                </p>
              )}
            </div>
          </div>
        </header>

        <div className="relative">
          <label htmlFor={searchId} className="sr-only">
            {localize('com_ui_mandi_search_mandis')}
          </label>
          <Search
            className="pointer-events-none absolute start-4 top-1/2 size-4 -translate-y-1/2 text-text-tertiary"
            aria-hidden="true"
          />
          <input
            id={searchId}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={localize('com_ui_mandi_search_mandis')}
            maxLength={100}
            autoComplete="off"
            className="min-h-12 w-full rounded-full border border-border-light bg-surface-chat pe-4 ps-11 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary dark:border-white/[0.07]"
          />
        </div>

        <section aria-labelledby={`${searchId}-heading`} className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2
              id={`${searchId}-heading`}
              className="text-base font-semibold text-text-primary sm:text-lg"
            >
              {localize('com_ui_mandi_nearby_heading')}
            </h2>
            {data && totalMandis > 0 && (
              <p className="shrink-0 text-xs text-text-secondary" aria-live="polite">
                {localize('com_ui_mandi_count', { 0: String(totalMandis) })}
              </p>
            )}
          </div>

          {isLoading && <MandiListSkeleton label={localize('com_ui_mandi_loading')} />}
          {isError && !data && (
            <MandiStateMessage
              tone="error"
              icon={<WifiOff className="size-6" aria-hidden="true" />}
              message={localize(
                isLocationMissing ? 'com_ui_mandi_no_location' : 'com_ui_mandi_error',
              )}
              retryLabel={localize('com_ui_retry')}
              isRetrying={isRefetching}
              onRetry={isLocationMissing ? undefined : () => refetch()}
            />
          )}
          {data && mandis.length === 0 && (
            <MandiStateMessage
              tone="empty"
              icon={<SearchX className="size-6" aria-hidden="true" />}
              message={
                trimmedSearch
                  ? localize('com_ui_mandi_no_search_results', { 0: trimmedSearch })
                  : localize('com_ui_mandi_no_mandis')
              }
            />
          )}
          {mandis.length > 0 && (
            <ul className="flex flex-col gap-3">
              {mandis.map((mandi) => {
                const isOpen = openState[mandi.id] ?? mandi.id === defaultOpenId;
                return (
                  <MandiAccordionItem
                    key={mandi.id}
                    mandi={mandi}
                    isOpen={isOpen}
                    onToggle={() => toggleMandi(mandi.id, isOpen)}
                  />
                );
              })}
            </ul>
          )}
          {hasNextPage && (
            <LoadMoreButton
              label={localize('com_ui_mandi_load_more_mandis')}
              isLoading={isFetchingNextPage}
              onClick={() => fetchNextPage()}
            />
          )}
        </section>

        <p className="flex items-start gap-3 rounded-2xl border border-border-light bg-surface-chat p-4 text-sm text-text-secondary dark:border-white/[0.07]">
          <Info
            className="mt-0.5 size-4 shrink-0 text-green-600 dark:text-green-400"
            aria-hidden="true"
          />
          {localize('com_ui_mandi_note')}
        </p>
      </div>
    </div>
  );
}
