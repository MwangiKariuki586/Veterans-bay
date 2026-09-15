/** Session-scoped in-memory cache for authenticated client reads. Not authoritative. */

type CacheEntry<T> = {
  data: T;
  at: number;
};

const stores = new Map<string, Map<string, CacheEntry<unknown>>>();

function storeFor(namespace: string) {
  let store = stores.get(namespace);
  if (!store) {
    store = new Map();
    stores.set(namespace, store);
  }
  return store;
}

export function getCachedResource<T>(
  namespace: string,
  key: string,
  ttlMs = 60_000,
): T | null {
  const entry = storeFor(namespace).get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() - entry.at > ttlMs) {
    storeFor(namespace).delete(key);
    return null;
  }
  return entry.data;
}

export function setCachedResource<T>(
  namespace: string,
  key: string,
  data: T,
): void {
  storeFor(namespace).set(key, { data, at: Date.now() });
}

export function invalidateCachedResource(
  namespace: string,
  keyPrefix?: string,
): void {
  const store = storeFor(namespace);
  if (!keyPrefix) {
    store.clear();
    return;
  }
  for (const key of store.keys()) {
    if (key === keyPrefix || key.startsWith(keyPrefix)) {
      store.delete(key);
    }
  }
}

export function clearAllClientResourceCaches(): void {
  stores.clear();
}
