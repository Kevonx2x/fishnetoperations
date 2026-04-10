"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText } from "lucide-react";
import { MaddenTopNav } from "@/components/marketplace/madden-top-nav";
import { useAuth } from "@/contexts/auth-context";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatNotificationTimeAgo } from "@/components/notifications/notification-list";

type DocRow = {
  id: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

export default function MyDocumentsPage() {
  const { user, loading: authLoading } = useAuth();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [rows, setRows] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("notifications")
      .select("id, created_at, metadata")
      .eq("user_id", user.id)
      .eq("type", "document_shared")
      .order("created_at", { ascending: false })
      .limit(200);
    if (!error && data) {
      const filtered = (data as DocRow[]).filter((r) => {
        const url = r.metadata && typeof r.metadata.signed_url === "string" ? r.metadata.signed_url : null;
        return Boolean(url?.trim());
      });
      setRows(filtered);
    } else {
      setRows([]);
    }
    setLoading(false);
  }, [user?.id, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#FAF8F4]">
        <MaddenTopNav />
        <div className="mx-auto max-w-2xl px-4 py-16 text-center text-sm font-semibold text-[#2C2C2C]/55">
          Loading…
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#FAF8F4]">
        <MaddenTopNav />
        <div className="mx-auto max-w-2xl px-4 py-16 text-center">
          <p className="font-semibold text-[#2C2C2C]">Sign in to view documents shared with you.</p>
          <Link href="/auth/login?next=/my-documents" className="mt-4 inline-block font-semibold text-[#6B9E6E] underline">
            Log in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F4] text-[#2C2C2C]">
      <MaddenTopNav />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <h1 className="font-serif text-2xl font-bold text-[#2C2C2C]">Documents Shared With Me</h1>
        <p className="mt-2 text-sm font-semibold text-[#2C2C2C]/60">
          Deal documents your agents have sent you. Links expire after about one hour.
        </p>

        {loading ? (
          <p className="mt-10 text-sm font-semibold text-[#2C2C2C]/50">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="mt-10 rounded-2xl border border-[#2C2C2C]/10 bg-white px-4 py-8 text-center text-sm font-semibold text-[#2C2C2C]/55">
            No shared documents yet. When an agent sends you a file, it will appear here.
          </p>
        ) : (
          <ul className="mt-8 space-y-4">
            {rows.map((r) => {
              const meta = r.metadata ?? {};
              const signedUrl = typeof meta.signed_url === "string" ? meta.signed_url : "";
              const docType =
                typeof meta.document_type === "string" ? meta.document_type : "Document";
              const fileName =
                typeof meta.file_name === "string" && meta.file_name.trim()
                  ? meta.file_name
                  : "File";
              const agentName =
                typeof meta.agent_name === "string" && meta.agent_name.trim()
                  ? meta.agent_name
                  : "Agent";

              return (
                <li
                  key={r.id}
                  className="rounded-2xl border border-[#2C2C2C]/10 bg-white p-4 shadow-sm"
                >
                  <div className="flex gap-3">
                    <span className="mt-0.5 shrink-0 text-[#6B9E6E]">
                      <FileText className="h-5 w-5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
                        {docType}
                      </p>
                      <p className="mt-1 font-semibold text-[#2C2C2C]">{fileName}</p>
                      <p className="mt-1 text-sm text-[#2C2C2C]/65">
                        From <span className="font-semibold text-[#2C2C2C]">{agentName}</span>
                        {" · "}
                        {formatNotificationTimeAgo(r.created_at)}
                      </p>
                      <button
                        type="button"
                        onClick={() => window.open(signedUrl, "_blank", "noopener,noreferrer")}
                        className="mt-3 rounded-full bg-[#6B9E6E] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#5a8a5d]"
                      >
                        View Document
                      </button>
                      <p className="mt-2 text-[11px] font-semibold text-amber-800/90">
                        This link expires after 1 hour. Contact your agent if expired.
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
