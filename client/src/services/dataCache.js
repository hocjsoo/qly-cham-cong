// client/src/services/dataCache.js
// In-flight deduplication & TTL memory cache for frontend GET requests
import api from './api';

const cache = new Map();
const inFlightRequests = new Map();
let cacheGeneration = 0;
const MUTABLE_RESOURCE_PREFIXES = [
  '/announcements',
  '/departments',
  '/holidays',
  '/locations',
  '/projects',
  '/tts-schedules',
  '/users',
];

export function getDataCacheScope() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    const userId = user?._id || user?.id || 'anonymous';
    return `${userId}:${user?.role || 'guest'}`;
  } catch {
    return 'anonymous:guest';
  }
}

function getResourceKey(url, params, key) {
  return key || (params ? `${url}?${new URLSearchParams(params).toString()}` : url);
}

function matchesResource(resourceKey, keyOrPattern) {
  if (typeof keyOrPattern === 'string') {
    return resourceKey === keyOrPattern || resourceKey.startsWith(keyOrPattern);
  }
  return keyOrPattern instanceof RegExp && keyOrPattern.test(resourceKey);
}

/**
 * Perform a cached GET request with in-flight deduplication.
 * @param {string} url - API endpoint path
 * @param {object} [options]
 * @param {number} [options.ttl=120000] - Cache validity time in ms (default: 2 mins)
 * @param {boolean} [options.force=false] - If true, bypass cache and fetch fresh
 * @param {object} [options.params] - Axios query params
 * @param {string} [options.key] - Custom cache key override
 * @returns {Promise<any>} Axios-like response object { data, status, ... }
 */
export async function cachedGet(url, options = {}) {
  const {
    ttl = 120000,
    force = false,
    params,
    key,
  } = options;

  const resourceKey = getResourceKey(url, params, key);
  const cacheKey = `${getDataCacheScope()}::${resourceKey}`;
  const now = Date.now();

  // 1. Check valid cache if not forcing fresh fetch
  if (!force && cache.has(cacheKey)) {
    const entry = cache.get(cacheKey);
    if (now - entry.timestamp < ttl) {
      return { data: entry.data, status: 200, fromCache: true };
    }
  }

  // 2. In-flight request deduplication: reuse ongoing Promise
  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey).promise;
  }

  // 3. Initiate network request
  const requestGeneration = cacheGeneration;
  const requestPromise = api.get(url, { params })
    .then((response) => {
      // A mutation/logout may invalidate this request while it is still in flight.
      if (requestGeneration === cacheGeneration) {
        cache.set(cacheKey, {
          resourceKey,
          data: response.data,
          timestamp: Date.now(),
        });
      }
      return response;
    })
    .finally(() => {
      if (inFlightRequests.get(cacheKey)?.promise === requestPromise) {
        inFlightRequests.delete(cacheKey);
      }
    });

  inFlightRequests.set(cacheKey, { resourceKey, promise: requestPromise });
  return requestPromise;
}

/**
 * Invalidate cached items matching a specific key or prefix.
 * @param {string|RegExp} [keyOrPattern] - If omitted, clears entire cache
 */
export function clearDataCache(keyOrPattern) {
  cacheGeneration += 1;
  if (!keyOrPattern) {
    cache.clear();
    inFlightRequests.clear();
    return;
  }

  for (const [cacheKey, entry] of cache.entries()) {
    if (matchesResource(entry.resourceKey, keyOrPattern)) {
      cache.delete(cacheKey);
    }
  }
  for (const [cacheKey, entry] of inFlightRequests.entries()) {
    if (matchesResource(entry.resourceKey, keyOrPattern)) {
      inFlightRequests.delete(cacheKey);
    }
  }
}

/**
 * Manually update or seed the cache.
 * @param {string} key
 * @param {any} data
 */
export function setDataCache(key, data) {
  cache.set(`${getDataCacheScope()}::${key}`, {
    resourceKey: key,
    data,
    timestamp: Date.now(),
  });
}

/**
 * Get item from cache synchronously without awaiting or triggering network.
 * @param {string} key
 * @param {number} [ttl=120000]
 * @returns {any|null}
 */
export function getSyncDataCache(key, ttl = 120000) {
  const entry = cache.get(`${getDataCacheScope()}::${key}`);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > ttl) return null;
  return entry.data;
}

// Keep read caches coherent after successful writes from any page.
api.interceptors.response.use((response) => {
  const method = String(response.config?.method || 'get').toLowerCase();
  if (!['get', 'head', 'options'].includes(method)) {
    const url = String(response.config?.url || '');
    const prefix = MUTABLE_RESOURCE_PREFIXES.find(item => url.startsWith(item));
    if (prefix) clearDataCache(prefix);
  }
  return response;
});

export default {
  cachedGet,
  clearDataCache,
  setDataCache,
  getSyncDataCache,
  getDataCacheScope,
};
