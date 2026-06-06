"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

type SupabaseImageProps = {
  src: string;
  alt: string;
  className?: string;
  fill?: boolean;
  width?: number;
  height?: number;
  sizes?: string;
  priority?: boolean;
};

export function SupabaseImage({
  src,
  alt,
  className,
  fill,
  width,
  height,
  sizes = "(max-width: 768px) 100vw, 50vw",
  priority = false,
}: SupabaseImageProps) {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) return null;

  const needsDirectLoad =
    src.includes("/object/sign/") || src.includes("token=");

  return (
    <Image
      src={src}
      alt={alt}
      className={cn(className)}
      fill={fill}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      sizes={sizes}
      priority={priority}
      unoptimized={needsDirectLoad}
      loading={priority ? undefined : "lazy"}
      onError={() => setHasError(true)}
    />
  );
}
