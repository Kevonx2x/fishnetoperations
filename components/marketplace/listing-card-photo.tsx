"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { isPreOptimizedPropertyPhotoUrl } from "@/lib/cloudinary-property-photo-url";
import {
  supabaseObjectUrlFromRenderUrl,
  warnSupabaseRenderFallback,
} from "@/lib/supabase-image-url";
import { cn } from "@/lib/utils";

type Props = {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  eager?: boolean;
  grayscale?: boolean;
};

/** Listing card hero: defer fetch until near viewport; Supabase render fallback on error. */
export function ListingCardPhoto({ src, alt, sizes, priority = false, eager = false, grayscale }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(priority);
  const [resolvedSrc, setResolvedSrc] = useState(src);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setResolvedSrc(src);
    setLoaded(false);
    if (priority) setShouldLoad(true);
  }, [src, priority]);

  useEffect(() => {
    if (shouldLoad) return;
    const el = hostRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShouldLoad(true);
          io.disconnect();
        }
      },
      { root: null, rootMargin: "320px 0px", threshold: 0.01 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shouldLoad]);

  const markLoaded = () => setLoaded(true);

  return (
    <div ref={hostRef} className="absolute inset-0">
      <div
        className={cn(
          "absolute inset-0 bg-[#F3F0EA] transition-opacity duration-200",
          loaded && "opacity-0",
        )}
        aria-hidden
      />
      {shouldLoad && resolvedSrc ? (
        <Image
          src={resolvedSrc}
          alt={alt}
          fill
          unoptimized={isPreOptimizedPropertyPhotoUrl(resolvedSrc)}
          quality={75}
          sizes={sizes}
          priority={priority}
          fetchPriority={priority ? "high" : undefined}
          loading={priority || eager ? "eager" : "lazy"}
          decoding="async"
          className={cn("object-cover", grayscale && "grayscale")}
          onLoad={markLoaded}
          onError={() => {
            const fallback = supabaseObjectUrlFromRenderUrl(resolvedSrc);
            if (fallback && fallback !== resolvedSrc) {
              warnSupabaseRenderFallback("listing card photo");
              setResolvedSrc(fallback);
              setLoaded(false);
              return;
            }
            markLoaded();
          }}
        />
      ) : null}
    </div>
  );
}
