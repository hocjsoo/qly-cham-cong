import api from './api';

let cachedValue = null;
let cachedAt = 0;
let pendingRequest = null;

export async function fetchPendingCountCached({ force = false } = {}) {
  if (!force && cachedValue !== null && Date.now() - cachedAt < 30000) return cachedValue;
  if (pendingRequest) return pendingRequest;

  pendingRequest = api.get('/dashboard/pending-count')
    .then(({ data }) => {
      cachedValue = Number(data?.pending_count) || 0;
      cachedAt = Date.now();
      return cachedValue;
    })
    .finally(() => {
      pendingRequest = null;
    });
  return pendingRequest;
}
