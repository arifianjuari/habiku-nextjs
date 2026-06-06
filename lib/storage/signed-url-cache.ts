type CacheEntry = {
  url: string;
  expiresAt: number;
};

const signedUrlCache = new Map<string, CacheEntry>();
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

  const url = await createSignedUrl();
  if (url) {
    signedUrlCache.set(cacheKey, { url, expiresAt: now + ttlSec * 1000 });
  }

  return url;
}

export function invalidateSignedUrlCache(cacheKey: string) {
  signedUrlCache.delete(cacheKey);
}
