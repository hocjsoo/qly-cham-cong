import api from './api';
import { getDataCacheScope } from './dataCache';

const cachedByScope = new Map();
const pendingByScope = new Map();
let cacheGeneration = 0;

export async function fetchPendingCountCached({ force = false } = {}) {
  const scope = getDataCacheScope();
  const cached = cachedByScope.get(scope);
  if (!force && cached && Date.now() - cached.cachedAt < 30000) return cached.value;
  if (pendingByScope.has(scope)) return pendingByScope.get(scope);

  const requestGeneration = cacheGeneration;
  const pendingRequest = api.get('/dashboard/pending-count')
    .then(({ data }) => {
      const value = Number(data?.pending_count) || 0;
      if (requestGeneration === cacheGeneration) {
        cachedByScope.set(scope, { value, cachedAt: Date.now() });
      }
      return value;
    })
    .finally(() => {
      if (pendingByScope.get(scope) === pendingRequest) {
        pendingByScope.delete(scope);
      }
    });
  pendingByScope.set(scope, pendingRequest);
  return pendingRequest;
}

export function clearPendingCountCache() {
  cacheGeneration += 1;
  cachedByScope.clear();
  pendingByScope.clear();
}
