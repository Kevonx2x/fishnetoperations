"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type InviteAcceptClientProps = {
  token: string;
  agentName: string;
  role: string;
  inviteeName: string;
  error: "invalid" | "expired" | "used" | null;
};

export function InviteAcceptClient({ token, agentName, role, inviteeName, error }: InviteAcceptClientProps) {
  const router = useRouter();
  const [fullName, setFullName] = useState(inviteeName);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  if (error === "invalid") {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center font-sans">
        <p className="text-sm font-semibold text-red-600">Invalid or expired invitation.</p>
        <Link href="/" className="mt-6 inline-block text-sm font-semibold text-[#6B9E6E] underline">
          Back to home
        </Link>
      </div>
    );
  }
  if (error === "expired") {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center font-sans">
        <p className="text-sm font-semibold text-red-600">
          This invitation has expired. Please ask your agent to send a new one.
        </p>
        <Link href="/" className="mt-6 inline-block text-sm font-semibold text-[#6B9E6E] underline">
          Back to home
        </Link>
      </div>
    );
  }
  if (error === "used") {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center font-sans">
        <p className="text-sm font-semibold text-[#2C2C2C]/70">This invitation is no longer valid.</p>
        <Link href="/auth/login" className="mt-6 inline-block text-sm font-semibold text-[#6B9E6E] underline">
          Sign in
        </Link>
      </div>
    );
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/agent/accept-team-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          full_name: fullName.trim(),
          password,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        data?: { email?: string };
        error?: { message?: string };
      };
      if (!res.ok || json.success === false) {
        toast.error(json.error?.message ?? "Could not accept invitation");
        return;
      }
      const email = json.data?.email;
      if (email) {
        const supabase = createSupabaseBrowserClient();
        const { error: signErr } = await supabase.auth.signInWithPassword({ email, password });
        if (signErr) {
          toast.error(signErr.message);
          router.push(`/auth/login?email=${encodeURIComponent(email)}`);
          return;
        }
      }
      toast.success("Welcome to BahayGo!");
      router.push("/dashboard/agent");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F4] px-4 py-12 font-sans text-[#2C2C2C]">
      <div className="mx-auto max-w-md">
        <div className="flex justify-center">
          <Image src="/icon.png" alt="BahayGo" width={64} height={64} className="h-16 w-16 rounded-2xl" priority />
        </div>
        <h1 className="mt-8 text-center font-serif text-2xl font-bold tracking-tight text-[#2C2C2C] sm:text-3xl">
          You have been invited to join BahayGo
        </h1>
        <p className="mt-3 text-center text-sm font-medium leading-relaxed text-[#2C2C2C]/70">
          <span className="font-semibold text-[#2C2C2C]">{agentName}</span> invited you to join their team as{" "}
          <span className="font-semibold text-[#6B9E6E]">{role}</span>.
        </p>

        <form onSubmit={(e) => void onSubmit(e)} className="mt-10 space-y-4 rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-sm">
          <label className="block text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
            Full Name
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-black/10 bg-[#FAF8F4] px-3 py-2.5 text-sm font-semibold text-[#2C2C2C]"
              autoComplete="name"
            />
          </label>
          <label className="block text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-black/10 bg-[#FAF8F4] px-3 py-2.5 text-sm font-semibold text-[#2C2C2C]"
              autoComplete="new-password"
            />
          </label>
          <label className="block text-xs font-bold uppercase tracking-wider text-[#2C2C2C]/45">
            Confirm Password
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-1 w-full rounded-xl border border-black/10 bg-[#FAF8F4] px-3 py-2.5 text-sm font-semibold text-[#2C2C2C]"
              autoComplete="new-password"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="mt-2 w-full rounded-full bg-[#6B9E6E] py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#5d8a60] disabled:opacity-50"
          >
            {busy ? (
              <span className="inline-flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Working…
              </span>
            ) : (
              "Accept Invitation"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
