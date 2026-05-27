"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, Upload, X } from "lucide-react";

import { GooglePlacesInput, type GooglePlaceSelectedPayload } from "@/components/forms/google-places-input";
import {
  DORMSPACE_AMENITIES,
  DORMSPACE_GENDER_OPTIONS,
  DORMSPACE_ROOM_TYPE_OPTIONS,
  defaultTotalBedsFromRoomType,
  type DormspacePhotoRow,
  type DormspaceRoomType,
  type DormspaceWithPhotos,
} from "@/lib/dormspaces";
import { cn } from "@/lib/utils";

const FIELD =
  "mt-1 w-full rounded-xl border border-[#2C2C2C]/12 bg-white px-3 py-2.5 text-sm font-medium text-[#2C2C2C] placeholder:text-[#888888] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6B9E6E]/25";

const LISTING_PHOTO_MIN = 3;
const LISTING_PHOTO_MAX = 10;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#DDDDDD] bg-white p-5 shadow-sm md:p-6">
      <h2 className="font-serif text-lg font-bold text-[#2C2C2C]">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function EditPhotosField({
  keptPhotos,
  newPhotos,
  onKeepChange,
  onNewPhotosChange,
}: {
  keptPhotos: DormspacePhotoRow[];
  newPhotos: File[];
  onKeepChange: (photos: DormspacePhotoRow[]) => void;
  onNewPhotosChange: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const newPreviews = useMemo(
    () => newPhotos.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [newPhotos],
  );

  useEffect(() => {
    return () => {
      for (const p of newPreviews) URL.revokeObjectURL(p.url);
    };
  }, [newPreviews]);

  const totalCount = keptPhotos.length + newPhotos.length;
  const countOk = totalCount >= LISTING_PHOTO_MIN;

  const mergeFiles = useCallback(
    (list: FileList | File[]) => {
      const incoming = Array.from(list).filter((f) => f.type.startsWith("image/"));
      if (!incoming.length) return;
      onNewPhotosChange([...newPhotos, ...incoming].slice(0, LISTING_PHOTO_MAX - keptPhotos.length));
    },
    [keptPhotos.length, newPhotos, onNewPhotosChange],
  );

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-[#525252]">
        Listing photos *
        <span className="ml-1.5 normal-case font-medium text-[#888888]">
          ({LISTING_PHOTO_MIN}–{LISTING_PHOTO_MAX} images)
        </span>
      </p>

      {(keptPhotos.length > 0 || newPreviews.length > 0) ? (
        <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {keptPhotos.map((photo) => (
            <li
              key={photo.id}
              className="group relative aspect-square overflow-hidden rounded-xl border border-[#2C2C2C]/10 bg-[#FAF8F4] shadow-sm"
            >
              <Image src={photo.url} alt="" fill className="object-cover" sizes="120px" />
              <button
                type="button"
                onClick={() => onKeepChange(keptPhotos.filter((p) => p.id !== photo.id))}
                className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-[#2C2C2C]/75 text-white opacity-0 shadow transition group-hover:opacity-100 focus-visible:opacity-100"
                aria-label="Remove photo"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
          {newPreviews.map((p, i) => (
            <li
              key={`${p.file.name}-${i}`}
              className="group relative aspect-square overflow-hidden rounded-xl border border-[#6B9E6E]/30 bg-[#FAF8F4] shadow-sm"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" className="size-full object-cover" />
              <button
                type="button"
                onClick={() => onNewPhotosChange(newPhotos.filter((_, idx) => idx !== i))}
                className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-[#2C2C2C]/75 text-white opacity-0 shadow transition group-hover:opacity-100 focus-visible:opacity-100"
                aria-label="Remove new photo"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {totalCount < LISTING_PHOTO_MAX ? (
        <label
          className={cn(
            "mt-3 flex min-h-[120px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition",
            dragOver
              ? "border-[#6B9E6E] bg-[#6B9E6E]/8"
              : "border-[#2C2C2C]/15 bg-[#FAF8F4] hover:border-[#6B9E6E]/45",
          )}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files?.length) mergeFiles(e.dataTransfer.files);
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(e) => {
              if (e.target.files?.length) mergeFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <div className="flex items-center gap-2 text-[#6B9E6E]">
            <Upload className="size-6" aria-hidden />
            <ImagePlus className="size-6" aria-hidden />
          </div>
          <span className="text-sm font-bold text-[#2C2C2C]">Add photos</span>
        </label>
      ) : null}

      <p className={cn("mt-2 text-xs font-medium", countOk ? "text-[#6B9E6E]" : "text-amber-700")}>
        {countOk
          ? `${totalCount} photos ready`
          : `Need at least ${LISTING_PHOTO_MIN - totalCount} more photo${LISTING_PHOTO_MIN - totalCount === 1 ? "" : "s"}.`}
      </p>
    </div>
  );
}

export function DormspaceEditForm({ listingId }: { listingId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reReviewNote, setReReviewNote] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [monthlyPrice, setMonthlyPrice] = useState("");
  const [depositMonths, setDepositMonths] = useState("1");
  const [roomType, setRoomType] = useState<DormspaceRoomType | "">("");
  const [totalBeds, setTotalBeds] = useState(1);
  const [genderPreference, setGenderPreference] = useState("any");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [nearSchool, setNearSchool] = useState("");
  const [curfew, setCurfew] = useState("");
  const [rulesNotes, setRulesNotes] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [amenities, setAmenities] = useState<Record<string, boolean>>({});
  const [keptPhotos, setKeptPhotos] = useState<DormspacePhotoRow[]>([]);
  const [newPhotos, setNewPhotos] = useState<File[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setLoadError("");
      try {
        const res = await fetch(`/api/dormspaces/landlord/listings/${listingId}`, {
          credentials: "include",
        });
        const json = (await res.json()) as {
          success?: boolean;
          data?: { item?: DormspaceWithPhotos };
          error?: { message?: string };
        };
        if (!res.ok || !json.data?.item) {
          if (!cancelled) setLoadError(json.error?.message ?? "Could not load listing");
          return;
        }
        const item = json.data.item;
        if (cancelled) return;

        setTitle(item.title);
        setDescription(item.description ?? "");
        setMonthlyPrice(String(item.monthly_price ?? ""));
        setDepositMonths(String(item.deposit_months ?? 1));
        setRoomType(item.room_type);
        setTotalBeds(Math.max(1, Number(item.total_beds) || 1));
        setGenderPreference(item.gender_preference ?? "any");
        setAddress(item.address);
        setCity(item.city ?? "");
        setNeighborhood(item.neighborhood ?? "");
        setNearSchool(item.near_school ?? "");
        setCurfew(item.curfew ?? "");
        setRulesNotes(item.rules_notes ?? "");
        setLat(item.latitude != null ? Number(item.latitude) : null);
        setLng(item.longitude != null ? Number(item.longitude) : null);
        setReReviewNote(item.status === "approved");

        const amenityState: Record<string, boolean> = {};
        for (const a of DORMSPACE_AMENITIES) {
          amenityState[a.key] = Boolean(item[a.key as keyof typeof item]);
        }
        setAmenities(amenityState);
        setKeptPhotos(item.dormspace_photos ?? []);
      } catch {
        if (!cancelled) setLoadError("Network error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [listingId]);

  const onPlace = useCallback((p: GooglePlaceSelectedPayload) => {
    setAddress(p.location);
    setCity(p.city);
    setNeighborhood(p.neighborhood ?? "");
    setLat(p.lat);
    setLng(p.lng);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!title.trim() || !roomType || !address.trim() || !monthlyPrice) {
      setError("Please fill in all required fields.");
      return;
    }

    const totalPhotos = keptPhotos.length + newPhotos.length;
    if (totalPhotos < LISTING_PHOTO_MIN) {
      setError(`Keep at least ${LISTING_PHOTO_MIN} listing photos.`);
      return;
    }

    const fd = new FormData();
    fd.set("title", title.trim());
    fd.set("description", description.trim());
    fd.set("monthly_price", monthlyPrice);
    fd.set("deposit_months", depositMonths);
    fd.set("room_type", roomType);
    fd.set("total_beds", String(totalBeds));
    fd.set("gender_preference", genderPreference);
    fd.set("address", address.trim());
    fd.set("city", city);
    fd.set("neighborhood", neighborhood);
    fd.set("near_school", nearSchool.trim());
    fd.set("curfew", curfew.trim());
    fd.set("rules_notes", rulesNotes.trim());
    if (lat != null) fd.set("latitude", String(lat));
    if (lng != null) fd.set("longitude", String(lng));
    fd.set("keep_photo_ids", JSON.stringify(keptPhotos.map((p) => p.id)));
    for (const file of newPhotos) fd.append("photos", file);
    for (const [key, value] of Object.entries(amenities)) {
      if (value) fd.set(key, "true");
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/dormspaces/landlord/listings/${listingId}`, {
        method: "PUT",
        body: fd,
        credentials: "include",
      });
      const json = (await res.json()) as {
        success?: boolean;
        data?: { reReview?: boolean };
        error?: { message?: string };
      };
      if (!res.ok) {
        setError(json.error?.message ?? "Could not save changes");
        return;
      }
      router.replace("/dormspaces/dashboard/listings");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-[#6B9E6E]" aria-label="Loading listing" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-red-200 bg-red-50 px-6 py-8 text-center">
        <p className="text-sm font-medium text-red-700">{loadError}</p>
        <Link
          href="/dormspaces/dashboard/listings"
          className="mt-4 inline-block text-sm font-semibold text-[#6B9E6E] hover:underline"
        >
          Back to My Listings
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="mx-auto max-w-2xl space-y-6 pb-16">
      {reReviewNote ? (
        <div className="rounded-2xl border border-[#D4A843]/35 bg-[#D4A843]/10 px-4 py-3.5 text-sm font-medium text-[#2C2C2C]">
          Saving changes to a verified listing sends it back for a quick review before it goes live again.
        </div>
      ) : null}

      <Section title="Listing details">
        <label className="block text-xs font-semibold uppercase tracking-wide text-[#525252]">
          Title *
          <input className={FIELD} required value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wide text-[#525252]">
          Description
          <textarea
            className={`${FIELD} min-h-[88px] resize-y`}
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-xs font-semibold uppercase tracking-wide text-[#525252]">
            Monthly price (₱) *
            <input
              type="number"
              min={500}
              className={FIELD}
              required
              value={monthlyPrice}
              onChange={(e) => setMonthlyPrice(e.target.value)}
            />
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wide text-[#525252]">
            Deposit (months)
            <input
              type="number"
              min={0}
              step={0.5}
              className={FIELD}
              value={depositMonths}
              onChange={(e) => setDepositMonths(e.target.value)}
            />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-xs font-semibold uppercase tracking-wide text-[#525252]">
            Room type *
            <select
              className={FIELD}
              required
              value={roomType}
              onChange={(e) => {
                const v = e.target.value as DormspaceRoomType;
                setRoomType(v);
                setTotalBeds(defaultTotalBedsFromRoomType(v));
              }}
            >
              {DORMSPACE_ROOM_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wide text-[#525252]">
            Total beds *
            <input
              type="number"
              min={1}
              max={50}
              className={FIELD}
              required
              value={totalBeds}
              onChange={(e) => setTotalBeds(Math.min(50, Math.max(1, Number(e.target.value) || 1)))}
            />
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wide text-[#525252]">
            Gender preference
            <select
              className={FIELD}
              value={genderPreference}
              onChange={(e) => setGenderPreference(e.target.value)}
            >
              {DORMSPACE_GENDER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#525252]">Address *</p>
          <GooglePlacesInput
            value={address}
            onChange={setAddress}
            onPlaceSelected={onPlace}
            addressMapPreview
            mapPreviewCenter={lat != null && lng != null ? { lat, lng } : null}
            mapPreviewInstanceId={`dormspace-edit-map-${listingId}`}
            className="mt-1"
            inputClassName={FIELD.replace("mt-1 ", "")}
            required
          />
        </div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-[#525252]">
          Near school (optional)
          <input className={FIELD} value={nearSchool} onChange={(e) => setNearSchool(e.target.value)} />
        </label>
      </Section>

      <Section title="Amenities">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {DORMSPACE_AMENITIES.map((a) => (
            <label key={a.key} className="flex cursor-pointer items-center gap-2 text-sm font-medium text-[#2C2C2C]">
              <input
                type="checkbox"
                checked={Boolean(amenities[a.key])}
                onChange={() => setAmenities((prev) => ({ ...prev, [a.key]: !prev[a.key] }))}
                className="size-4 rounded border-[#2C2C2C]/20 text-[#6B9E6E]"
              />
              {a.label}
            </label>
          ))}
        </div>
      </Section>

      <Section title="Rules">
        <label className="block text-xs font-semibold uppercase tracking-wide text-[#525252]">
          Curfew (optional)
          <input className={FIELD} value={curfew} onChange={(e) => setCurfew(e.target.value)} />
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wide text-[#525252]">
          House rules
          <textarea
            className={`${FIELD} min-h-[88px] resize-y`}
            rows={3}
            value={rulesNotes}
            onChange={(e) => setRulesNotes(e.target.value)}
          />
        </label>
      </Section>

      <Section title="Photos">
        <EditPhotosField
          keptPhotos={keptPhotos}
          newPhotos={newPhotos}
          onKeepChange={setKeptPhotos}
          onNewPhotosChange={setNewPhotos}
        />
      </Section>

      {error ? <p className="text-center text-sm font-medium text-red-600">{error}</p> : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="submit"
          disabled={busy}
          className="flex-1 rounded-xl bg-[#6B9E6E] py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-[#5d8a60] disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save changes"}
        </button>
        <Link
          href="/dormspaces/dashboard/listings"
          className="inline-flex flex-1 items-center justify-center rounded-xl border border-[#2C2C2C]/12 bg-white py-3.5 text-sm font-bold text-[#2C2C2C] transition hover:bg-[#FAF8F4]"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
