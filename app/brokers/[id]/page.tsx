"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { MaddenTopNav } from "@/components/marketplace/madden-top-nav";

type BrokerRow = {
  id: string;
  company_name: string;
  license_number: string;
  email: string;
  phone: string | null;
  website: string | null;
  logo_url: string | null;
  created_at: string;
};

export default function BrokerProfilePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [row, setRow] = useState<BrokerRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!id) return;
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from("brokers")
        .select("id, company_name, license_number, email, phone, website, logo_url, created_at")
        .eq("id", id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setError(error.message);
        setRow(null);
      } else {
        setRow((data ?? null) as unknown as BrokerRow | null);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div className="min-h-screen bg-[#FAF8F4] pb-12">
      <MaddenTopNav />
      <main className="mx-auto max-w-6xl px-4 pt-6 pb-12">
        <div className="mb-4 text-sm font-semibold text-[#2C2C2C]/65">
          <Link href="/" className="hover:text-[#2C2C2C]">Home</Link> <span>·</span>{" "}
          <Link href="/brokers" className="hover:text-[#2C2C2C]">Brokers</Link> <span>·</span>{" "}
          <span className="text-[#2C2C2C]">Profile</span>
        </div>

        {loading ? <div className="h-40 rounded-2xl animate-pulse bg-black/5" /> : null}
        {!loading && error ? (
          <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-6">
            <p className="font-semibold text-[#2C2C2C]">Couldn’t load broker</p>
            <p className="mt-1 text-sm text-[#2C2C2C]/60">{error}</p>
          </div>
        ) : null}

        {!loading && !error && row ? (
          <div className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="relative h-16 w-16 overflow-hidden rounded-2xl bg-[#FAF8F4] ring-1 ring-black/10">
                {row.logo_url ? (
                  <Image src={row.logo_url} alt={row.company_name} fill sizes="64px" className="object-cover" />
                ) : null}
              </div>
              <div className="min-w-0">
                <h1 className="truncate font-serif text-3xl font-bold tracking-tight text-[#2C2C2C]">
                  {row.company_name}
                </h1>
                <p className="mt-1 text-sm font-semibold text-[#2C2C2C]/60">
                  License {row.license_number}
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-2 text-sm font-semibold text-[#2C2C2C]/70">
              <div>Email: {row.email}</div>
              {row.phone ? <div>Phone: {row.phone}</div> : null}
              {row.website ? (
                <a
                  href={row.website}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex text-[#2C2C2C]/70 underline decoration-[#D4A843]/60 underline-offset-4 hover:text-[#2C2C2C]"
                >
                  Website →
                </a>
              ) : null}
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

