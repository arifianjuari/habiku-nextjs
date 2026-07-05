"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  isChildAvatarStoragePath,
  STORAGE_BUCKETS,
} from "@/lib/storage/child-avatar";
import { prefetchSignedUrls } from "@/lib/storage/signed-url-cache";
import { SIGNED_URL_TTL_SEC } from "@/lib/query/constants";

/** Prewarm signed URL cache untuk daftar avatar anak (hindari N+1 saat list render). */
export function usePrefetchChildAvatarUrls(avatarPaths: (string | null | undefined)[]) {
  useEffect(() => {
    const uniquePaths = [
      ...new Set(avatarPaths.filter((path): path is string => isChildAvatarStoragePath(path))),
    ];

    if (uniquePaths.length === 0) return;

    const supabase = createClient();
    void prefetchSignedUrls(
      uniquePaths.map((path) => ({
        cacheKey: `${STORAGE_BUCKETS.childAvatars}:${path}`,
        ttlSec: SIGNED_URL_TTL_SEC,
        createSignedUrl: async () => {
          const { data, error } = await supabase.storage
            .from(STORAGE_BUCKETS.childAvatars)
            .createSignedUrl(path, SIGNED_URL_TTL_SEC);
          return error ? null : data?.signedUrl ?? null;
        },
      })),
    );
  }, [avatarPaths]);
}
