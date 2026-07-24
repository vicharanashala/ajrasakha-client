const axios = require('axios');
const { logger } = require('@librechat/data-schemas');

/**
 * Generic fetcher for LGD APIs with pagination
 * @param {string} url - The LGD API URL
 * @param {object} queryParams - Additional query parameters for filtering
 * @returns {Promise<Array>} Array of records
 */
const fetchLgdData = async (url, queryParams = {}) => {
  const apiKey = process.env.LGD_API_KEY || process.env.LGD_VILLAGES_API_KEY;
  logger.debug(`[fetchLgdData] Called with URL: ${url}`);
  logger.debug(`[fetchLgdData] Query params: ${JSON.stringify(queryParams)}`);
  logger.debug(`[fetchLgdData] API key configured: ${apiKey ? 'YES (length: ' + apiKey.length + ')' : 'NO'}`);

  let allRecords = [];
  let offset = 0;
  const limit = 1000; // Large limit to reduce number of requests

  while (true) {
    try {
      const requestParams = {
        'api-key': apiKey,
        format: 'json',
        limit,
        offset,
        ...queryParams
      };

      logger.debug(`[fetchLgdData] GET ${url} with offset=${offset}, limit=${limit}`);
      const startTime = Date.now();

      const response = await axios.get(url, {
        params: requestParams,
        timeout: 30000, // 30s timeout
      });

      const duration = Date.now() - startTime;
      logger.debug(`[fetchLgdData] Response received in ${duration}ms - status: ${response.status}`);

      const data = response.data;
      logger.debug(`[fetchLgdData] Response data type: ${typeof data}, isArray: ${Array.isArray(data)}`);
      if (data && typeof data === 'object') {
        logger.debug(`[fetchLgdData] Response data keys: ${Object.keys(data).join(', ')}`);
      }

      // Handle data.gov.in typical response format { records: [...] }
      // Or fallback to an array if the API directly returns it
      let records = [];
      if (data && Array.isArray(data.records)) {
        records = data.records;
      } else if (Array.isArray(data)) {
        records = data;
      } else if (data && data.data && Array.isArray(data.data)) {
        records = data.data;
      } else {
        logger.warn(`[fetchLgdData] Unexpected response format from ${url}`);
        logger.warn(`[fetchLgdData] Raw response (first 500 chars): ${JSON.stringify(data).substring(0, 500)}`);
      }

      logger.debug(`[fetchLgdData] Records fetched in this batch: ${records.length}`);
      allRecords = allRecords.concat(records);

      if (records.length < limit) {
        logger.debug(`[fetchLgdData] Reached end of pagination. Total records: ${allRecords.length}`);
        break; // Reached the end of the pages
      }
      offset += limit;
    } catch (error) {
      logger.error(`[fetchLgdData] ERROR fetching from ${url}`);
      logger.error(`[fetchLgdData] Error message: ${error.message}`);
      logger.error(`[fetchLgdData] Error code: ${error.code}`);
      logger.error(`[fetchLgdData] Error errno: ${error.errno}`);
      logger.error(`[fetchLgdData] Error syscall: ${error.syscall}`);
      logger.error(`[fetchLgdData] Error address: ${error.address}`);
      logger.error(`[fetchLgdData] Error port: ${error.port}`);
      logger.error(`[fetchLgdData] Error stack: ${error.stack}`);

      if (error.response) {
        // Server responded with a non-2xx status
        logger.error(`[fetchLgdData] Response status: ${error.response.status}`);
        logger.error(`[fetchLgdData] Response headers: ${JSON.stringify(error.response.headers)}`);
        logger.error(`[fetchLgdData] Response data: ${JSON.stringify(error.response.data).substring(0, 1000)}`);
      } else if (error.request) {
        // Request was made but no response received
        logger.error(`[fetchLgdData] No response received. Request details: ${JSON.stringify(error.request)}`);
        logger.error(`[fetchLgdData] This usually means: NETWORK issue, DNS failure, timeout, or unreachable host`);
      } else {
        // Something else happened
        logger.error(`[fetchLgdData] Unknown error type: ${error.toString()}`);
      }

      throw error;
    }
  }

  return allRecords;
};

const getStates = async () => {
  const url = process.env.LGD_STATES_API_URL;
  logger.debug(`[getStates] Called. LGD_STATES_API_URL env var: ${url || 'NOT SET'}`);

  if (!url) {
    logger.error('[getStates] LGD_STATES_API_URL is not defined in environment variables');
    throw new Error('LGD_STATES_API_URL is not defined in environment variables');
  }

  try {
    const records = await fetchLgdData(url);
    logger.debug(`[getStates] Successfully fetched ${records.length} states`);
    const mapped = records.map(record => ({
      code: record.state_code,
      name: record.state_name_english
    }));
    logger.debug(`[getStates] Mapped ${mapped.length} states. First 3: ${JSON.stringify(mapped.slice(0, 3))}`);
    return mapped;
  } catch (error) {
    logger.error(`[getStates] Failed to fetch states from ${url}: ${error.message}`);
    throw error;
  }
};

const getDistricts = async (stateCode) => {
  const url = process.env.LGD_DISTRICTS_API_URL;
  logger.debug(`[getDistricts] Called with stateCode=${stateCode}. URL: ${url || 'NOT SET'}`);

  if (!url) {
    logger.error('[getDistricts] LGD_DISTRICTS_API_URL is not defined in environment variables');
    throw new Error('LGD_DISTRICTS_API_URL is not defined in environment variables');
  }

  const params = {
    'filters[state_code]': stateCode
  };

  try {
    const records = await fetchLgdData(url, params);
    logger.debug(`[getDistricts] Successfully fetched ${records.length} districts for stateCode=${stateCode}`);
    return records.map(record => ({
      code: record.district_code,
      name: record.district_name_english
    }));
  } catch (error) {
    logger.error(`[getDistricts] Failed to fetch districts for stateCode=${stateCode}: ${error.message}`);
    throw error;
  }
};

const getSubdistricts = async (districtCode) => {
  const url = process.env.LGD_SUBDISTRICTS_API_URL;
  logger.debug(`[getSubdistricts] Called with districtCode=${districtCode}. URL: ${url || 'NOT SET'}`);

  if (!url) {
    logger.error('[getSubdistricts] LGD_SUBDISTRICTS_API_URL is not defined in environment variables');
    throw new Error('LGD_SUBDISTRICTS_API_URL is not defined in environment variables');
  }

  const params = {
    'filters[district_code]': districtCode
  };

  try {
    const records = await fetchLgdData(url, params);
    logger.debug(`[getSubdistricts] Successfully fetched ${records.length} subdistricts for districtCode=${districtCode}`);
    return records.map(record => ({
      code: record.subdistrict_code,
      name: record.subdistrict_name_english
    }));
  } catch (error) {
    logger.error(`[getSubdistricts] Failed to fetch subdistricts for districtCode=${districtCode}: ${error.message}`);
    throw error;
  }
};

const getVillages = async (subdistrictCode) => {
  const url = process.env.LGD_VILLAGES_API_URL;
  logger.debug(`[getVillages] Called with subdistrictCode=${subdistrictCode}. URL: ${url || 'NOT SET'}`);

  if (!url) {
    logger.error('[getVillages] LGD_VILLAGES_API_URL is not defined in environment variables');
    throw new Error('LGD_VILLAGES_API_URL is not defined in environment variables');
  }

  const params = {
    'filters[subdistrictCode]': subdistrictCode
  };

  try {
    const records = await fetchLgdData(url, params);
    logger.debug(`[getVillages] Successfully fetched ${records.length} villages for subdistrictCode=${subdistrictCode}`);
    return records.map(record => ({
      code: record.villageCode,
      name: record.villageNameEnglish
    }));
  } catch (error) {
    logger.error(`[getVillages] Failed to fetch villages for subdistrictCode=${subdistrictCode}: ${error.message}`);
    throw error;
  }
};

module.exports = {
  getStates,
  getDistricts,
  getSubdistricts,
  getVillages,
};
