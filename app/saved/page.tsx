"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Heart } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { MaddenTopNav } from "@/components/marketplace/madden-top-nav";
import { useSavedPropertyIds } from "@/lib/saved-properties";
import { FinnMascot } from "@/components/marketplace/mascots/finn-mascot";

type PropertyCard = {
  id: string;
  location: string;
  price: string;
  beds: number;
  baths: number;
  sqft: string;
  image_url: string;
};

export default function SavedPage() {
  const saved = useSavedPropertyIds();
  const [rows, setRows] = useState<PropertyCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ids = saved.ids;
      if (!ids.length) {
        setRows([]);
        return;
      }
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from("properties")
        .select("id, location, price, beds, baths, sqft, image_url")
        .in("id", ids);
      if (cancelled) return;
      if (error) {
        setError(error.message);
        setRows([]);
      } else {
        const list = (data ?? []) as unknown as PropertyCard[];
        // preserve localStorage order
        const byId = new Map(list.map((p) => [p.id, p]));
        setRows(ids.map((id) => byId.get(id)).filter(Boolean) as PropertyCard[]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [saved.ids]);

  const content = useMemo(() => {
    if (!saved.ids.length) {
      return (
        <div className="rounded-2xl border border-dashed border-[#2C2C2C]/20 bg-white p-10 text-center">
          <FinnMascot mood="still" size={72} className="mx-auto" />
          <p className="mt-4 font-serif text-xl font-bold text-[#2C2C2C]">No saved homes yet</p>
          <p className="mt-1 text-sm text-[#2C2C2C]/55">
            Tap the heart on any listing to save it here.
          </p>
          <Link
            href="/"
            className="mt-5 inline-flex rounded-full bg-[#2C2C2C] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#7C9A7E]"
          >
            Browse listings
          </Link>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((p) => (
          <div
            key={p.id}
            className="overflow-hidden rounded-2xl border border-[#2C2C2C]/10 bg-white shadow-sm"
          >
            <div className="relative aspect-[4/3] w-full bg-black/5">
              <Image src={p.image_url} alt={p.location} fill sizes="420px" className="object-cover" />
              <button
                type="button"
                onClick={() => saved.toggle(p.id)}
                className="absolute right-3 top-3 rounded-full bg-white/90 p-2 shadow-sm"
                aria-label="Unsave"
              >
                <Heart className="h-5 w-5 fill-red-500 text-red-500" />
              </button>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent p-3">
                <p className="font-serif text-xl font-bold text-white">{p.price}</p>
              </div>
            </div>
            <div className="p-4">
              <p className="font-semibold text-[#2C2C2C]">{p.location}</p>
              <p className="mt-1 text-sm font-semibold text-[#2C2C2C]/60">
                {p.beds} bd · {p.baths} ba · {p.sqft} sqft
              </p>
              <Link
                href={`/properties/${encodeURIComponent(p.id)}`}
                className="mt-3 inline-flex text-sm font-semibold text-[#2C2C2C]/70 underline decoration-[#C9A84C]/60 underline-offset-4 hover:text-[#2C2C2C]"
              >
                View details →
              </Link>
            </div>
          </div>
        ))}
      </div>
    );
  }, [rows, saved]);

  return (
    <div className="min-h-screen bg-[#FAF8F4] pb-12">
      <MaddenTopNav />
      <main className="mx-auto max-w-6xl px-4 pt-4 pb-12">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#2C2C2C]/55">
              Saved
            </p>
            <h1 className="mt-1 font-serif text-3xl font-bold tracking-tight text-[#2C2C2C]">
              Saved Properties
            </h1>
          </div>
          <div className="rounded-full bg-[#7C9A7E]/12 px-3 py-1 text-xs font-semibold text-[#2C2C2C]/70">
            {saved.ids.length} saved
          </div>
        </div>

        {loading && <div className="h-40 rounded-2xl animate-pulse bg-black/5" />}
        {!loading && error && (
          <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-6">
            <p className="font-semibold text-[#2C2C2C]">Couldn’t load saved homes</p>
            <p className="mt-1 text-sm text-[#2C2C2C]/60">{error}</p>
          </div>
        )}
        {!loading && !error && content}
      </main>
    </div>
  );
}

