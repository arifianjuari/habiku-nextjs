type CacheEntry = {
  url: string;
  expiresAt: number;
};

const signedUrlCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<string | null>>();
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

export async function getCachedSignedUrl(
  cacheKey: string,
  createSignedUrl: () => Promise<string | null>,
  ttlSec: number,
): Promise<string | null> {
  const now = Date.now();
  const cached = signedUrlCache.get(cacheKey);

  if (cached && cached.expiresAt - REFRESH_BUFFER_MS > now) {
    return cached.url;
  }

  const inFlight = inFlightRequests.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const request = createSignedUrl()
    .then((url) => {
      if (url) {
        signedUrlCache.set(cacheKey, { url, expiresAt: now + ttlSec * 1000 });
      }
      return url;
    })
    .finally(() => {
      inFlightRequests.delete(cacheKey);
    });

  inFlightRequests.set(cacheKey, request);
  return request;
}

export function invalidateSignedUrlCache(cacheKey: string) {
  signedUrlCache.delete(cacheKey);
  inFlightRequests.delete(cacheKey);
}

export async function prefetchSignedUrls(
  entries: Array<{
    cacheKey: string;
    createSignedUrl: () => Promise<string | null>;
    ttlSec: number;
  }>,
): Promise<void> {
  await Promise.all(
    entries.map(({ cacheKey, createSignedUrl, ttlSec }) =>
      getCachedSignedUrl(cacheKey, createSignedUrl, ttlSec),
    ),
  );
}
