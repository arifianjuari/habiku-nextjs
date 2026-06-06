"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  isChildAvatarStoragePath,
  STORAGE_BUCKETS,
} from "@/lib/storage/child-avatar";
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

  useEffect(() => {
    setHasError(false);

    if (!avatarUrl) {
      setResolvedUrl(null);
      return;
    }

    if (!isChildAvatarStoragePath(avatarUrl)) {
      setResolvedUrl(avatarUrl);
      return;
    }

    let cancelled = false;
    const supabase = createClient();

    void supabase.storage
      .from(STORAGE_BUCKETS.childAvatars)
      .createSignedUrl(avatarUrl, 3600)
      .then(({ data, error }) => {
        if (!cancelled) {
          setResolvedUrl(error ? null : data?.signedUrl ?? null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [avatarUrl]);

  const showPhoto =
    avatarPreference === "photo" && resolvedUrl && !hasError;

  return (
    <div
      className={cn(
        "flex items-center justify-center font-bold text-white shadow-md overflow-hidden select-none",
        className
      )}
      style={{ backgroundColor: accentColor }}
    >
      {showPhoto ? (
        <img
          src={resolvedUrl!}
          alt={name}
          className={cn("h-full w-full object-cover", imgClassName)}
          onError={() => setHasError(true)}
        />
      ) : avatarEmoji ? (
        <span className={cn("leading-none", fallbackSizeClass)}>{avatarEmoji}</span>
      ) : (
        <span className={fallbackSizeClass}>{name ? name[0].toUpperCase() : "A"}</span>
      )}
    </div>
  );
}
