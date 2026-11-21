const express = require('express');
const axios = require('axios');
const { logger } = require('@librechat/data-schemas');
const { requireJwtAuth } = require('~/server/middleware');
const {
  cleanEnvValue,
  getProxyOptions,
  isUsingProxy,
  getAgentServiceBaseUrl,
  getFarmerCoordinates,
  toNumberOrNull,
} = require('~/server/utils/agentService');

const router = express.Router();

// How long to wait for the mandi service before giving up.
const MANDI_REQUEST_TIMEOUT_MS = 10000;

// Port the mandi service listens on when MANDI_SERVICE_URL is not set.
const MANDI_SERVICE_PORT = 8000;

// Paging and search limits accepted by the mandi service.
const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 100;
const DEFAULT_RADIUS_KM = 40;
const MAX_RADIUS_KM = 100;
const MAX_SEARCH_LENGTH = 100;

// Sort orders the prices endpoint supports. Anything else falls back to crop name.
const PRICE_SORT_OPTIONS = new Set(['crop', 'price_high', 'price_low', 'newest']);

// Mandi ids are Mongo object ids. Checked before they are placed in the upstream URL path.
const MANDI_ID_PATTERN = /^[a-f0-9]{24}$/i;

// Returns the mandi service base URL from MANDI_SERVICE_URL, or AGENT_HOST_IP with the default port.
function getMandiServiceBaseUrl() {
  const explicitUrl = cleanEnvValue(process.env.MANDI_SERVICE_URL).replace(/\/+$/, '');
  return explicitUrl || getAgentServiceBaseUrl(MANDI_SERVICE_PORT);
}

// Parses a whole number query value within the given range, or returns the fallback when it is missing.
// Returns null when the value is present but invalid.
function parseIntegerParam(value, { min, max, fallback }) {
  if (value === undefined || value === '') {
    return fallback;
  }
  const number = Number(value);
  return Number.isInteger(number) && number >= min && number <= max ? number : null;
}

// Parses a positive number query value up to max, or returns the fallback when it is missing.
// Returns null when the value is present but invalid.
function parseRadiusParam(value) {
  if (value === undefined || value === '') {
    return DEFAULT_RADIUS_KM;
  }
  const number = Number(value);
  return Number.isFinite(number) && number > 0 && number <= MAX_RADIUS_KM ? number : null;
}

// Trims the search text and caps its length. Returns an empty string when there is nothing to search.
const parseSearchParam = (value) =>
  typeof value === 'string' ? value.trim().slice(0, MAX_SEARCH_LENGTH) : '';

// Reads page and limit from the query. Returns null when either is invalid.
function parsePaging(query) {
  const page = parseIntegerParam(query.page, { min: 1, max: 10000, fallback: 1 });
  const limit = parseIntegerParam(query.limit, {
    min: 1,
    max: MAX_PAGE_LIMIT,
    fallback: DEFAULT_PAGE_LIMIT,
  });
  return page === null || limit === null ? null : { page, limit };
}

// Keeps only the pagination fields the app needs, with safe defaults.
function toPagination(pagination, paging) {
  return {
    total: toNumberOrNull(pagination?.total) ?? 0,
    page: toNumberOrNull(pagination?.page) ?? paging.page,
    limit: toNumberOrNull(pagination?.limit) ?? paging.limit,
    totalPages: toNumberOrNull(pagination?.total_pages) ?? 0,
  };
}

// Returns the string value or null, so unexpected types never reach the browser.
const toStringOrNull = (value) => (typeof value === 'string' && value ? value : null);

// Keeps only the mandi fields the app shows.
function toMandi(item) {
  return {
    id: String(item.id),
    name: typeof item.name === 'string' ? item.name : '',
    distanceKm: toNumberOrNull(item.distance_km),
    updatedDate: toStringOrNull(item.updated_time),
  };
}

// Keeps only the price fields the app shows.
function toMandiPrice(item) {
  return {
    productId: String(item.product_id),
    crop: typeof item.crop === 'string' ? item.crop : '',
    variety: toStringOrNull(item.variety),
    unit: toStringOrNull(item.unit),
    modal: toNumberOrNull(item.modal),
    max: toNumberOrNull(item.max),
    min: toNumberOrNull(item.min),
    priceDate: toStringOrNull(item.price_date),
    ageDays: toNumberOrNull(item.age_days),
    stale: item.stale === true,
  };
}

// Maps a list response, dropping entries without an id.
function toListResponse(data, idField, mapItem, paging) {
  const items = Array.isArray(data?.data) ? data.data : [];
  return {
    data: items.filter((item) => item && item[idField] != null).map(mapItem),
    pagination: toPagination(data?.pagination, paging),
  };
}

// Calls the mandi service and returns its JSON body. Errors are thrown to the caller.
async function fetchFromMandiService(url, params) {
  const { data } = await axios.get(url, {
    params,
    headers: { accept: 'application/json' },
    timeout: MANDI_REQUEST_TIMEOUT_MS,
    ...getProxyOptions(),
  });
  return data;
}

// Logs a failed upstream call. Upstream details stay in the server log, they are never sent to the browser.
function logUpstreamError(label, url, params, error) {
  logger.error(`[mandi] Failed to fetch ${label} from ${url}`, {
    params,
    viaProxy: isUsingProxy(),
    code: error.code,
    status: error.response?.status,
    data: error.response?.data,
    message: error.message,
  });
}

// Lists mandis near the signed in farmer's saved location, nearest first.
router.get('/nearby', requireJwtAuth, async (req, res) => {
  const baseUrl = getMandiServiceBaseUrl();
  if (!baseUrl) {
    logger.error('[mandi] MANDI_SERVICE_URL and AGENT_HOST_IP are not set');
    return res.status(500).json({ message: 'Mandi service is not configured' });
  }

  const coordinates = getFarmerCoordinates(req.user);
  if (!coordinates) {
    return res.status(404).json({ message: 'Farmer location is not set' });
  }

  const paging = parsePaging(req.query);
  const radiusKm = parseRadiusParam(req.query.radius_km);
  if (!paging || radiusKm === null) {
    return res.status(400).json({ message: 'Invalid search parameters' });
  }

  const search = parseSearchParam(req.query.search);
  const params = {
    lat: coordinates.lat,
    lng: coordinates.long,
    radius_km: radiusKm,
    page: paging.page,
    limit: paging.limit,
    ...(search ? { search } : {}),
  };
  const url = `${baseUrl}/v1/mandis/nearby`;

  try {
    const data = await fetchFromMandiService(url, params);
    // No browser caching: the app caches this itself and must refetch right after a location change.
    res.set('Cache-Control', 'no-store');
    return res.status(200).json(toListResponse(data, 'id', toMandi, paging));
  } catch (error) {
    logUpstreamError('nearby mandis', url, params, error);
    return res.status(502).json({ message: 'Mandi prices are unavailable right now' });
  }
});

// Lists the latest crop prices reported by one mandi.
router.get('/:mandiId/prices', requireJwtAuth, async (req, res) => {
  const baseUrl = getMandiServiceBaseUrl();
  if (!baseUrl) {
    logger.error('[mandi] MANDI_SERVICE_URL and AGENT_HOST_IP are not set');
    return res.status(500).json({ message: 'Mandi service is not configured' });
  }

  const { mandiId } = req.params;
  const paging = parsePaging(req.query);
  if (!MANDI_ID_PATTERN.test(mandiId) || !paging) {
    return res.status(400).json({ message: 'Invalid search parameters' });
  }

  const search = parseSearchParam(req.query.search);
  const sort = PRICE_SORT_OPTIONS.has(req.query.sort) ? req.query.sort : 'crop';
  const params = {
    sort,
    page: paging.page,
    limit: paging.limit,
    ...(search ? { search } : {}),
  };
  const url = `${baseUrl}/v1/mandi/${mandiId}/prices/nearby`;

  try {
    const data = await fetchFromMandiService(url, params);
    res.set('Cache-Control', 'no-store');
    return res.status(200).json(toListResponse(data, 'product_id', toMandiPrice, paging));
  } catch (error) {
    if (error.response?.status === 404) {
      return res.status(404).json({ message: 'Mandi not found' });
    }
    logUpstreamError('mandi prices', url, params, error);
    return res.status(502).json({ message: 'Mandi prices are unavailable right now' });
  }
});

module.exports = router;
