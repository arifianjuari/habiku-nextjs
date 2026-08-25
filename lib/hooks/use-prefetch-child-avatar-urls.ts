"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  isChildAvatarStoragePath,
  STORAGE_BUCKETS,
} from "@/lib/storage/child-avatar";
import {
  CHILD_AVATAR_TRANSFORM,
  childAvatarSignedCacheKey,
} from "@/lib/storage/avatar-transform";
import { getCachedSignedUrl } from "@/lib/storage/signed-url-cache";
import { SIGNED_URL_TTL_SEC } from "@/lib/query/constants";

/** Prewarm signed thumbnail URLs (transform 128px, hindari unduh foto penuh). */
export function usePrefetchChildAvatarUrls(avatarPaths: (string | null | undefined)[]) {
  useEffect(() => {
    const uniquePaths = [
      ...new Set(avatarPaths.filter((path): path is string => isChildAvatarStoragePath(path))),
    ];

    if (uniquePaths.length === 0) return;

    const supabase = createClient();
    const bucket = STORAGE_BUCKETS.childAvatars;

    void Promise.all(
      uniquePaths.map((path) =>
        getCachedSignedUrl(
          childAvatarSignedCacheKey(path, bucket),
          async () => {
            const { data, error } = await supabase.storage
              .from(bucket)
              .createSignedUrl(path, SIGNED_URL_TTL_SEC, {
                transform: CHILD_AVATAR_TRANSFORM,
              });
            return error ? null : data?.signedUrl ?? null;
          },
          SIGNED_URL_TTL_SEC,
        ),
      ),
    );
  }, [avatarPaths]);
}
