"use client";

import { useState } from "react";
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

  const showPhoto = avatarPreference === "photo" && avatarUrl && !hasError;

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
          src={avatarUrl!}
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
