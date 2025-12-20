/**
 * CacheManager.gs
 * Centralized caching system to reduce spreadsheet reads and improve performance
 */

const CACHE_CONFIG = {
  // Cache keys
  KEYS: {
    VOLUNTEER_LIST: 'volunteer_list',
    QUEUE: 'client_queue',
    HELP_REQUESTS: 'help_requests',
    REVIEW_REQUESTS: 'review_requests',
    AVAILABILITY_DATA: 'availability_data',
    RETURN_SUMMARY: 'return_summary'
  },
  // Cache TTLs in seconds
  TTL: {
    VOLUNTEER_LIST: 30,      // 30 seconds - changes frequently during sign-in/out
    QUEUE: 20,               // 20 seconds - high priority, changes often
    HELP_REQUESTS: 15,       // 15 seconds - real-time updates needed
    REVIEW_REQUESTS: 15,     // 15 seconds - real-time updates needed
    AVAILABILITY_DATA: 300,  // 5 minutes - rarely changes during operation
    RETURN_SUMMARY: 60       // 1 minute - summary data changes less frequently
  }
};

/**
 * Gets cached data or executes fetchFunction if cache miss/expired
 * @param {string} cacheKey - Cache key
 * @param {Function} fetchFunction - Function to fetch fresh data
 * @param {number} ttl - Time to live in seconds (optional, uses default if not provided)
 * @returns {*} Cached or fresh data
 */
function getCachedOrFetch(cacheKey, fetchFunction, ttl = null) {
  const cache = CacheService.getScriptCache();

  try {
    // Try to get from cache
    const cached = cache.get(cacheKey);
    if (cached !== null) {
      Logger.log(`Cache HIT: ${cacheKey}`);
      return JSON.parse(cached);
    }
  } catch (e) {
    Logger.log(`Cache read error for ${cacheKey}: ${e.message}`);
  }

  // Cache miss - fetch fresh data
  Logger.log(`Cache MISS: ${cacheKey}`);
  const freshData = fetchFunction();

  // Store in cache
  try {
    const ttlSeconds = ttl || CACHE_CONFIG.TTL[cacheKey] || 30;
    cache.put(cacheKey, JSON.stringify(freshData), ttlSeconds);
    Logger.log(`Cached ${cacheKey} for ${ttlSeconds}s`);
  } catch (e) {
    // Cache storage failed (data too large or other error)
    Logger.log(`Cache write error for ${cacheKey}: ${e.message}`);
    // Return data anyway - cache failure shouldn't break functionality
  }

  return freshData;
}

/**
 * Invalidates (clears) a specific cache entry
 * @param {string} cacheKey - Cache key to invalidate
 */
function invalidateCache(cacheKey) {
  const cache = CacheService.getScriptCache();
  cache.remove(cacheKey);
  Logger.log(`Cache invalidated: ${cacheKey}`);
}

/**
 * Invalidates multiple cache entries
 * @param {Array<string>} cacheKeys - Array of cache keys to invalidate
 */
function invalidateMultiple(cacheKeys) {
  const cache = CacheService.getScriptCache();
  cache.removeAll(cacheKeys);
  Logger.log(`Cache invalidated: ${cacheKeys.join(', ')}`);
}

/**
 * Clears all cache entries
 */
function clearAllCache() {
  const cache = CacheService.getScriptCache();
  cache.removeAll(Object.values(CACHE_CONFIG.KEYS));
  Logger.log('All cache cleared');
}

/**
 * Batch read optimization - reads multiple sheets in one call
 * @param {Array<Object>} requests - Array of {sheetName, startRow, numRows, numCols}
 * @returns {Object} Object with sheetName as key and data array as value
 */
function batchReadSheets(requests) {
  const ss = getSpreadsheet();
  const results = {};

  for (const request of requests) {
    try {
      const sheet = ss.getSheetByName(request.sheetName);
      if (!sheet) {
        results[request.sheetName] = { error: 'Sheet not found' };
        continue;
      }

      const lastRow = sheet.getLastRow();
      const lastCol = sheet.getLastColumn();

      if (lastRow < request.startRow) {
        results[request.sheetName] = [];
        continue;
      }

      const numRows = request.numRows || (lastRow - request.startRow + 1);
      const numCols = request.numCols || lastCol;

      results[request.sheetName] = sheet.getRange(
        request.startRow,
        1,
        numRows,
        numCols
      ).getValues();
    } catch (e) {
      results[request.sheetName] = { error: e.message };
    }
  }

  return results;
}

/**
 * Pre-warms critical caches - call this periodically (e.g., every minute via trigger)
 * to ensure cache is always fresh
 */
function prewarmCache() {
  Logger.log('Cache prewarm started');

  try {
    // Prewarm volunteer list
    getCachedOrFetch(CACHE_CONFIG.KEYS.VOLUNTEER_LIST, () => {
      return getSignedInVolunteers(); // From existing function
    });

    // Prewarm help requests
    getCachedOrFetch(CACHE_CONFIG.KEYS.HELP_REQUESTS, () => {
      return getLiveHelpRequests(); // From existing function
    });

    // Prewarm review requests
    getCachedOrFetch(CACHE_CONFIG.KEYS.REVIEW_REQUESTS, () => {
      return getLiveReviewRequests(); // From existing function
    });

    Logger.log('Cache prewarm completed');
  } catch (e) {
    Logger.log('Cache prewarm error: ' + e.message);
  }
}
