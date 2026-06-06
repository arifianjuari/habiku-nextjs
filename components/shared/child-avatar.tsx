"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  isChildAvatarStoragePath,
  STORAGE_BUCKETS,
} from "@/lib/storage/child-avatar";
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
  // Data legacy: path storage ada tapi preference belum diset ke "photo"
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
    const cacheKey = `${STORAGE_BUCKETS.childAvatars}:${avatarUrl}`;

    setIsResolving(true);

    void getCachedSignedUrl(
      cacheKey,
      async () => {
        const { data, error } = await supabase.storage
          .from(STORAGE_BUCKETS.childAvatars)
          .createSignedUrl(avatarUrl, SIGNED_URL_TTL_SEC);
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

  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden font-bold text-white shadow-md select-none",
        className,
      )}
      style={{ backgroundColor: accentColor }}
    >
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed URL Supabase; img langsung lebih andal daripada next/image
        <img
          src={resolvedUrl}
          alt={name}
          className={cn("absolute inset-0 h-full w-full object-cover", imgClassName)}
          loading="lazy"
          decoding="async"
          onError={() => setHasError(true)}
        />
      ) : wantsPhoto && isResolving ? (
        <span
          className="absolute inset-0 animate-pulse bg-white/25"
          aria-hidden
        />
      ) : avatarEmoji ? (
        <span className={cn("leading-none", fallbackSizeClass)}>{avatarEmoji}</span>
      ) : (
        <span className={fallbackSizeClass}>{name ? name[0].toUpperCase() : "A"}</span>
      )}
    </div>
  );
}
