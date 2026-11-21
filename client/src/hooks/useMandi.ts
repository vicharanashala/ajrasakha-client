import { useInfiniteQuery } from '@tanstack/react-query';
import axios from 'axios';
import { isMissingLocationError } from './useWeather';

// A mandi near the farmer, as returned by /api/mandi/nearby.
export interface NearbyMandi {
  id: string;
  name: string;
  distanceKm: number | null;
  // Date of the mandi's latest reported prices, e.g. "2026-11-17". Null when it has no recent prices.
  updatedDate: string | null;
}

// One crop price reported by a mandi, as returned by /api/mandi/:mandiId/prices.
export interface MandiPrice {
  productId: string;
  crop: string;
  variety: string | null;
  unit: string | null;
  modal: number | null;
  max: number | null;
  min: number | null;
  priceDate: string | null;
  ageDays: number | null;
  // True when the price is older than the service considers current.
  stale: boolean;
}

// Paging details sent with every mandi list response.
export interface MandiPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// One page of a mandi list response.
export interface MandiPage<T> {
  data: T[];
  pagination: MandiPagination;
}

// Sort orders the prices endpoint supports.
export type MandiPriceSort = 'crop' | 'price_high' | 'price_low' | 'newest';

// Root cache key for all mandi data. Exported so a location change can refresh everything.
export const MANDI_QUERY_KEY = ['mandi'] as const;

// How long mandi data is treated as fresh. Mandis report prices about once a day.
const MANDI_STALE_TIME = 30 * 60 * 1000;
// Attempts made after a failed request before showing the error state.
const MANDI_MAX_RETRIES = 2;
// Items requested per page. The landing card and the prices page use the same value so they share the cache.
export const MANDI_PAGE_LIMIT = 20;

// Retries failed requests unless the farmer has no saved location or the mandi does not exist.
const shouldRetry = (failureCount: number, error: unknown) =>
  !isMissingLocationError(error) && failureCount < MANDI_MAX_RETRIES;

// Returns the next page number, or undefined when the last page has been loaded.
const getNextPage = <T>(lastPage: MandiPage<T>) =>
  lastPage.pagination.page < lastPage.pagination.totalPages
    ? lastPage.pagination.page + 1
    : undefined;

// Fetches one page of mandis near the signed in farmer.
const fetchNearbyMandis = async (search: string, page: number) => {
  const { data } = await axios.get<MandiPage<NearbyMandi>>('/api/mandi/nearby', {
    params: { page, limit: MANDI_PAGE_LIMIT, ...(search ? { search } : {}) },
  });
  return data;
};

// Fetches one page of crop prices for a mandi.
const fetchMandiPrices = async (
  mandiId: string,
  search: string,
  sort: MandiPriceSort,
  page: number,
) => {
  const { data } = await axios.get<MandiPage<MandiPrice>>(
    `/api/mandi/${encodeURIComponent(mandiId)}/prices`,
    { params: { sort, page, limit: MANDI_PAGE_LIMIT, ...(search ? { search } : {}) } },
  );
  return data;
};

// Provides nearby mandis, nearest first, with paging and an optional mandi name search.
export const useNearbyMandis = (search = '', enabled = true) => {
  const trimmedSearch = search.trim();
  return useInfiniteQuery({
    queryKey: [...MANDI_QUERY_KEY, 'nearby', trimmedSearch],
    queryFn: ({ pageParam = 1 }) => fetchNearbyMandis(trimmedSearch, pageParam),
    getNextPageParam: getNextPage,
    staleTime: MANDI_STALE_TIME,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
    enabled,
  });
};

type MandiPricesOptions = { search?: string; sort?: MandiPriceSort; enabled?: boolean };

// Provides the crop prices of one mandi with paging, sorting and an optional crop search.
export const useMandiPrices = (
  mandiId: string | undefined,
  { search = '', sort = 'crop', enabled = true }: MandiPricesOptions = {},
) => {
  const trimmedSearch = search.trim();
  return useInfiniteQuery({
    queryKey: [...MANDI_QUERY_KEY, 'prices', mandiId, sort, trimmedSearch],
    queryFn: ({ pageParam = 1 }) =>
      fetchMandiPrices(mandiId as string, trimmedSearch, sort, pageParam),
    getNextPageParam: getNextPage,
    staleTime: MANDI_STALE_TIME,
    refetchOnWindowFocus: false,
    retry: shouldRetry,
    enabled: enabled && !!mandiId,
  });
};
