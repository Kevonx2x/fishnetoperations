"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown, Plus } from "lucide-react";

import type { VacancyModalListing } from "@/components/dormspaces/update-vacancy-modal";
import { dormspaceBedAvailability, dormspacePrimaryPhotoUrl, type DormspaceWithPhotos } from "@/lib/dormspaces";
import { cn } from "@/lib/utils";

type Props = {
  listings: DormspaceWithPhotos[];
  onUpdateVacancy: (listing: VacancyModalListing) => void;
};

export function DormspaceAddListingSplitButton({ listings, onUpdateVacancy }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  if (listings.length === 0) {
    return (
      <Link
        href="/dormspaces/submit"
        className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#6B9E6E] px-4 text-sm font-bold text-white hover:bg-[#5d8a60]"
      >
        <Plus className="size-4" aria-hidden />
        Add your first dormspace
      </Link>
    );
  }

  return (
    <div ref={rootRef} className="relative inline-flex">
      <Link
        href="/dormspaces/submit"
        className="inline-flex h-10 items-center gap-1.5 rounded-l-xl bg-[#6B9E6E] pl-4 pr-3 text-sm font-bold text-white hover:bg-[#5d8a60]"
      >
        <Plus className="size-4" aria-hidden />
        Create new dormspace
      </Link>
      <button
        type="button"
        onClick={() => setMenuOpen((o) => !o)}
        className={cn(
          "inline-flex h-10 items-center justify-center rounded-r-xl border-l border-white/25 bg-[#6B9E6E] px-2.5 text-white hover:bg-[#5d8a60]",
          menuOpen && "bg-[#5d8a60]",
        )}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        aria-label="Update vacancy on existing dormspace"
      >
        <ChevronDown className={cn("size-4 transition", menuOpen && "rotate-180")} aria-hidden />
      </button>

      {menuOpen ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-2 w-[min(100vw-2rem,22rem)] overflow-hidden rounded-2xl border border-[#2C2C2C]/10 bg-white py-2 shadow-lg"
        >
          <p className="px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-[#888888]">
            Or update an existing dormspace:
          </p>
          <ul className="max-h-72 overflow-y-auto">
            {listings.map((row) => {
              const thumb = dormspacePrimaryPhotoUrl(row.dormspace_photos ?? null);
              const avail = dormspaceBedAvailability(row);
              return (
                <li key={row.id} className="border-t border-[#2C2C2C]/6 first:border-t-0">
                  <div className="flex items-center gap-3 px-3 py-2.5">
                    <div className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-[#F3F0EA]">
                      {thumb ? (
                        <Image src={thumb} alt="" fill className="object-cover" sizes="44px" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[#2C2C2C]">{row.title}</p>
                      <p className="text-xs font-medium text-[#484848]">{avail.shortLine}</p>
                    </div>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        onUpdateVacancy({
                          id: row.id,
                          title: row.title,
                          room_type: row.room_type,
                          total_beds: row.total_beds,
                          available_beds: row.available_beds,
                          vacancy_notes: row.vacancy_notes,
                        });
                      }}
                      className="shrink-0 rounded-lg border border-[#6B9E6E]/30 px-2.5 py-1 text-[11px] font-bold text-[#4a7a4d] hover:bg-[#6B9E6E]/10"
                    >
                      Update vacancy
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
