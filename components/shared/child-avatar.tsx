"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
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
import { cn } from "@/lib/utils";

interface ChildAvatarProps {
  name: string;
  avatarUrl: string | null;
  avatarPreference?: string;
  avatarEmoji?: string | null;
  accentColor?: string;
  className?: string;
  imgClassName?: string;
  fallbackSizeClass?: string;
}

function prefersPhoto(avatarPreference: string | undefined, avatarUrl: string | null) {
  if (!avatarUrl) return false;
  if (avatarPreference === "emoji") return false;
  if (avatarPreference === "photo") return true;
  return isChildAvatarStoragePath(avatarUrl);
}

export function ChildAvatar({
  name,
  avatarUrl,
  avatarPreference = "emoji",
  avatarEmoji,
  accentColor = "#8B5CF6",
  className,
  imgClassName,
  fallbackSizeClass = "text-xl",
}: ChildAvatarProps) {
  const [hasError, setHasError] = useState(false);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);

  const wantsPhoto = prefersPhoto(avatarPreference, avatarUrl);

  useEffect(() => {
    setHasError(false);

    if (!avatarUrl) {
      setResolvedUrl(null);
      setIsResolving(false);
      return;
    }

    if (!isChildAvatarStoragePath(avatarUrl)) {
      setResolvedUrl(avatarUrl);
      setIsResolving(false);
      return;
    }

    let cancelled = false;
    const supabase = createClient();
    const cacheKey = childAvatarSignedCacheKey(avatarUrl, STORAGE_BUCKETS.childAvatars);

    setIsResolving(true);

    void getCachedSignedUrl(
      cacheKey,
      async () => {
        const { data, error } = await supabase.storage
          .from(STORAGE_BUCKETS.childAvatars)
          .createSignedUrl(avatarUrl, SIGNED_URL_TTL_SEC, {
            transform: CHILD_AVATAR_TRANSFORM,
          });
        return error ? null : data?.signedUrl ?? null;
      },
      SIGNED_URL_TTL_SEC,
    )
      .then((url) => {
        if (!cancelled) {
          setResolvedUrl(url);
          setIsResolving(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResolvedUrl(null);
          setIsResolving(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [avatarUrl]);

  const showPhoto = wantsPhoto && resolvedUrl && !hasError;
  const useNextImage =
    showPhoto &&
    resolvedUrl != null &&
    (resolvedUrl.includes("/storage/v1/render/image/") ||
      resolvedUrl.includes("/storage/v1/object/sign/"));

  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden font-bold text-white shadow-md select-none",
        className,
      )}
      style={{ backgroundColor: accentColor }}
    >
      {useNextImage ? (
        <Image
          src={resolvedUrl}
          alt={name}
          fill
          sizes="128px"
          className={cn("object-cover", imgClassName)}
          onError={() => setHasError(true)}
        />
      ) : showPhoto ? (
        <img
          src={resolvedUrl}
          alt={name}
          className={cn("absolute inset-0 h-full w-full object-cover", imgClassName)}
          loading="lazy"
          decoding="async"
          onError={() => setHasError(true)}
        />
      ) : wantsPhoto && isResolving ? (
        <span className="absolute inset-0 animate-pulse bg-white/25" aria-hidden />
      ) : avatarEmoji ? (
        <span className={cn("leading-none", fallbackSizeClass)}>{avatarEmoji}</span>
      ) : (
        <span className={fallbackSizeClass}>{name ? name[0].toUpperCase() : "A"}</span>
      )}
    </div>
  );
}
