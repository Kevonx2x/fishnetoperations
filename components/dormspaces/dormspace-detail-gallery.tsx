"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Images, LayoutGrid, Share2 } from "lucide-react";
import { toast } from "sonner";

import { DormspaceDetailHeroChrome } from "@/components/dormspaces/dormspace-detail-hero-chrome";
import { DormspaceEngagementButtons } from "@/components/dormspaces/dormspace-engagement-buttons";
import { DormspacePhotoLightbox } from "@/components/dormspaces/dormspace-photo-lightbox";
import {
  propertyPhotoDisplayUrl,
  propertyPhotoHeroUrl,
} from "@/lib/cloudinary-property-photo-url";
import { cn } from "@/lib/utils";

const HERO_SIZES = "(max-width: 768px) 100vw, (max-width: 1200px) 66vw, 900px" as const;
const SIDE_SIZES = "(max-width: 768px) 50vw, 33vw" as const;

type Props = {
  urls: string[];
  title: string;
  dormspaceId: string;
  landlordUserId?: string | null;
};

function GalleryTile({
  url,
  alt,
  sizes,
  priority,
  className,
  onClick,
  children,
}: {
  url: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
  onClick: () => void;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("group relative block h-full w-full overflow-hidden bg-[#F3F0EA]", className)}
      aria-label={alt}
    >
      <Image
        src={propertyPhotoHeroUrl(url)}
        alt=""
        fill
        sizes={sizes}
        priority={priority}
        className="object-cover transition duration-300 group-hover:scale-[1.02]"
      />
      {children}
    </button>
  );
}

export function DormspaceDetailGallery({ urls, title, dormspaceId, landlordUserId }: Props) {
  const [idx, setIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const handleShare = async () => {
    const shareUrl = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) {
        await navigator.share({ title, url: shareUrl });
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied");
    } catch {
      // user cancelled share
    }
  };

  if (urls.length === 0) {
    return (
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-[#E8F0E9] to-[#FAF8F4] md:aspect-auto md:h-[420px] md:rounded-2xl lg:h-[500px]" />
    );
  }

  const extraCount = urls.length > 3 ? urls.length - 3 : 0;

  return (
    <>
      {/* Mobile — tall single-image carousel */}
      <div className="relative md:hidden">
        <div className="relative aspect-[4/3] w-full bg-[#F3F0EA] sm:aspect-[5/4]">
          <DormspaceDetailHeroChrome
            dormspaceId={dormspaceId}
            landlordUserId={landlordUserId}
            title={title}
          />
          <button
            type="button"
            onClick={() => openLightbox(idx)}
            className="absolute inset-0 z-0 block"
            aria-label={`Open photo ${idx + 1}`}
          >
            <Image
              src={propertyPhotoHeroUrl(urls[idx]!)}
              alt={title}
              fill
              sizes="100vw"
              priority
              className="object-cover"
            />
          </button>
          {urls.length > 1 ? (
            <>
              <button
                type="button"
                onClick={() => setIdx((i) => (i - 1 + urls.length) % urls.length)}
                className="absolute left-3 top-1/2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 shadow-md ring-1 ring-black/10"
                aria-label="Previous photo"
              >
                <ChevronLeft className="size-5 text-[#2C2C2C]" />
              </button>
              <button
                type="button"
                onClick={() => setIdx((i) => (i + 1) % urls.length)}
                className="absolute right-3 top-1/2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 shadow-md ring-1 ring-black/10"
                aria-label="Next photo"
              >
                <ChevronRight className="size-5 text-[#2C2C2C]" />
              </button>
              <button
                type="button"
                onClick={() => openLightbox(idx)}
                className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm"
                aria-label="View all photos"
              >
                <Images className="size-3.5" aria-hidden />
                {urls.length}
              </button>
              <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
                {urls.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setIdx(i)}
                    className={cn(
                      "h-1.5 rounded-full transition",
                      i === idx ? "w-6 bg-white" : "w-1.5 bg-white/50",
                    )}
                    aria-label={`Photo ${i + 1}`}
                  />
                ))}
              </div>
            </>
          ) : null}
        </div>

        {urls.length > 1 ? (
          <div className="flex gap-2 overflow-x-auto bg-white px-3 py-3 scrollbar-hide">
            {urls.map((url, i) => (
              <button
                key={`${url}-${i}`}
                type="button"
                onClick={() => setIdx(i)}
                className={cn(
                  "relative h-16 w-24 shrink-0 overflow-hidden rounded-xl border-2 transition",
                  i === idx ? "border-[#6B9E6E] ring-2 ring-[#6B9E6E]/25" : "border-transparent opacity-80",
                )}
                aria-label={`View photo ${i + 1}`}
                aria-current={i === idx ? "true" : undefined}
              >
                <Image
                  src={propertyPhotoDisplayUrl(url)}
                  alt=""
                  fill
                  sizes="96px"
                  className="object-cover"
                />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Desktop — Trulia-style mosaic */}
      <div className="relative hidden md:block">
        <div className="absolute right-4 top-4 z-20 flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleShare()}
            className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#2C2C2C] shadow-md ring-1 ring-black/10 transition hover:bg-[#FAF8F4]"
            aria-label="Share listing"
          >
            <Share2 className="size-4" aria-hidden />
            Share
          </button>
          <DormspaceEngagementButtons
            dormspaceId={dormspaceId}
            landlordUserId={landlordUserId}
            signInNext={`/dormspaces/${dormspaceId}`}
            size="md"
            className="rounded-full bg-white px-1 shadow-md ring-1 ring-black/10"
          />
        </div>

        {urls.length === 1 ? (
          <div className="relative h-[420px] overflow-hidden rounded-2xl lg:h-[500px]">
            <GalleryTile
              url={urls[0]!}
              alt={`${title} — photo 1`}
              sizes={HERO_SIZES}
              priority
              className="rounded-2xl"
              onClick={() => openLightbox(0)}
            />
          </div>
        ) : urls.length === 2 ? (
          <div className="grid h-[420px] grid-cols-2 gap-2 overflow-hidden rounded-2xl lg:h-[500px]">
            {urls.map((url, i) => (
              <GalleryTile
                key={`${url}-${i}`}
                url={url}
                alt={`${title} — photo ${i + 1}`}
                sizes={HERO_SIZES}
                priority={i === 0}
                className={cn(i === 0 ? "rounded-l-2xl" : "rounded-r-2xl")}
                onClick={() => openLightbox(i)}
              />
            ))}
          </div>
        ) : (
          <div className="grid h-[420px] grid-cols-[1.95fr_1fr] gap-2 overflow-hidden rounded-2xl lg:h-[500px]">
            <GalleryTile
              url={urls[0]!}
              alt={`${title} — photo 1`}
              sizes={HERO_SIZES}
              priority
              className="rounded-l-2xl"
              onClick={() => openLightbox(0)}
            />
            <div className="grid grid-rows-2 gap-2">
              <GalleryTile
                url={urls[1]!}
                alt={`${title} — photo 2`}
                sizes={SIDE_SIZES}
                className="rounded-tr-2xl"
                onClick={() => openLightbox(1)}
              />
              <GalleryTile
                url={urls[2]!}
                alt={`${title} — photo 3`}
                sizes={SIDE_SIZES}
                className="rounded-br-2xl"
                onClick={() => openLightbox(2)}
              >
                {extraCount > 0 ? (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-lg font-bold text-white">
                    +{extraCount} more
                  </span>
                ) : null}
                <span className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm">
                  <Images className="size-3.5" aria-hidden />
                  {urls.length}
                </span>
              </GalleryTile>
            </div>
          </div>
        )}

        {urls.length > 1 ? (
          <button
            type="button"
            onClick={() => openLightbox(0)}
            className="absolute bottom-4 left-4 z-10 flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#2C2C2C] shadow-lg ring-1 ring-[#2C2C2C]/10 transition hover:bg-[#FAF8F4]"
            aria-label="View all photos"
          >
            <LayoutGrid className="size-5 shrink-0" aria-hidden />
            View all photos
          </button>
        ) : null}
      </div>

      {lightboxOpen ? (
        <DormspacePhotoLightbox
          photos={urls}
          initialIndex={lightboxIndex}
          galleryLabel={title}
          onClose={() => setLightboxOpen(false)}
        />
      ) : null}
    </>
  );
}
