"use client";

import Image from "next/image";
import { isSupabasePublicStorageUrl } from "@/lib/supabase/public-storage-url";
import { cn } from "@/lib/utils";

type Base = {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  quality?: number;
};

export type SupabasePublicImageProps = Base &
  ({ fill: true } | { fill?: false | undefined; width: number; height: number });

/**
 * Uses a plain `<img>` for Supabase public storage URLs to avoid Next.js image
 * optimizer issues (e.g. private IP); otherwise uses `next/image`.
 */
export function SupabasePublicImage(props: SupabasePublicImageProps) {
  const { src, alt, className, sizes, priority, quality } = props;
  const fill = "fill" in props && props.fill === true;

  if (isSupabasePublicStorageUrl(src)) {
    if (fill) {
      return <img src={src} alt={alt} className={cn("absolute inset-0 h-full w-full", className)} />;
    }
    const { width, height } = props;
    return <img src={src} alt={alt} width={width} height={height} className={className} />;
  }

  if (fill) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes ?? ""}
        className={className}
        priority={priority}
        quality={quality}
      />
    );
  }

  const { width, height } = props;
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      sizes={sizes}
      priority={priority}
      quality={quality}
    />
  );
}
