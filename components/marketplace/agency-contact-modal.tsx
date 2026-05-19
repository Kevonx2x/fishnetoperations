"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { Check, X } from "lucide-react";
import { z } from "zod";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(500),
  email: z.string().email("Enter a valid email").max(320),
  phone: z.string().max(200).optional(),
  message: z.string().min(1, "Message is required").max(10000),
});

type AgencyContactModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agencyId: string;
  agencyName: string;
  onSent?: () => void;
};

export function AgencyContactModal({
  open,
  onOpenChange,
  agencyId,
  agencyName,
  onSent,
}: AgencyContactModalProps) {
  const titleId = useId();
  const { user, profile, loading: authLoading } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);

  const resetForm = useCallback(() => {
    setName("");
    setEmail("");
    setPhone("");
    setMessage("");
    setFieldErrors({});
    setFormError(null);
    setBusy(false);
    setSuccess(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    setFieldErrors({});
    setFormError(null);
    setSuccess(false);
    if (user) {
      setEmail(user.email ?? "");
      setName(profile?.full_name?.trim() ?? "");
      setPhone(profile?.phone?.trim() ?? "");
    } else {
      setName("");
      setEmail("");
      setPhone("");
    }
    setMessage("");
  }, [open, user, profile]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open || !success) return;
    const t = window.setTimeout(() => onOpenChange(false), 5000);
    return () => window.clearTimeout(t);
  }, [open, success, onOpenChange]);

  const handleClose = () => {
    onOpenChange(false);
    window.setTimeout(resetForm, 300);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const parsed = formSchema.safeParse({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim() || undefined,
      message: message.trim(),
    });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]?.toString() ?? "form";
        if (!errs[key]) errs[key] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setBusy(true);
    try {
      const res = await fetch("/api/agency/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agency_id: agencyId,
          name: parsed.data.name,
          email: parsed.data.email,
          phone: parsed.data.phone ?? null,
          message: parsed.data.message,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        inquiry_id?: string;
        error?: { message?: string };
        success?: boolean;
      };
      const apiMessage =
        data.error?.message ??
        (typeof data.error === "object" && data.error && "message" in data.error
          ? String((data.error as { message?: string }).message)
          : undefined);
      if (!res.ok || !data.ok) {
        throw new Error(apiMessage ?? "Could not send message. Please try again.");
      }
      setSuccess(true);
      onSent?.();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  const shell = (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center sm:p-4"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close"
        onClick={handleClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "relative z-[121] flex max-h-[min(92dvh,640px)] w-full max-w-md flex-col overflow-hidden",
          "rounded-t-2xl border border-[#2C2C2C]/10 bg-[#FAF8F4] shadow-2xl",
          "sm:rounded-2xl sm:animate-in sm:fade-in sm:duration-200",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#2C2C2C]/10 px-5 py-4">
          <div>
            <h2 id={titleId} className="font-serif text-xl font-bold text-[#2C2C2C]">
              {success ? "Message sent!" : `Contact ${agencyName}`}
            </h2>
            {!success ? (
              <p className="mt-1 text-sm font-medium text-[#2C2C2C]/55">
                Send a message — the agency will respond within 24 hours
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full p-2 text-[#2C2C2C]/60 transition hover:bg-[#2C2C2C]/10 hover:text-[#2C2C2C]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {authLoading && !success ? (
            <p className="text-sm font-semibold text-[#2C2C2C]/60">Loading…</p>
          ) : success ? (
            <div className="flex flex-col items-center py-6 text-center">
              <div className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-[#6B9E6E]/15">
                <Check className="h-7 w-7 text-[#6B9E6E]" strokeWidth={2.5} />
              </div>
              <p className="font-serif text-2xl font-bold text-[#2C2C2C]">Message sent!</p>
              <p className="mt-2 max-w-xs text-sm font-medium text-[#2C2C2C]/65">
                {agencyName} will get back to you within 24 hours.
              </p>
              <button
                type="button"
                onClick={handleClose}
                className="mt-8 w-full rounded-xl border-2 border-[#6B9E6E] bg-transparent px-6 py-3 text-sm font-bold text-[#6B9E6E] transition hover:bg-[#6B9E6E]/10"
              >
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                  Name <span className="text-[#6B9E6E]">*</span>
                </span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="mt-1.5 w-full rounded-xl border border-[#2C2C2C]/15 bg-white px-3 py-2.5 text-sm font-semibold text-[#2C2C2C] outline-none ring-[#6B9E6E]/30 focus-visible:ring-2"
                />
                {fieldErrors.name ? (
                  <p className="mt-1 text-xs font-semibold text-red-600">{fieldErrors.name}</p>
                ) : null}
              </label>
              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                  Email <span className="text-[#6B9E6E]">*</span>
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="mt-1.5 w-full rounded-xl border border-[#2C2C2C]/15 bg-white px-3 py-2.5 text-sm font-semibold text-[#2C2C2C] outline-none ring-[#6B9E6E]/30 focus-visible:ring-2"
                />
                {fieldErrors.email ? (
                  <p className="mt-1 text-xs font-semibold text-red-600">{fieldErrors.email}</p>
                ) : null}
              </label>
              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                  Phone
                </span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+63 9XX XXX XXXX"
                  className="mt-1.5 w-full rounded-xl border border-[#2C2C2C]/15 bg-white px-3 py-2.5 text-sm font-semibold text-[#2C2C2C] outline-none ring-[#6B9E6E]/30 focus-visible:ring-2"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-wide text-[#2C2C2C]/45">
                  Message <span className="text-[#6B9E6E]">*</span>
                </span>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  rows={4}
                  placeholder="I'm interested in learning more about your listings"
                  className="mt-1.5 w-full resize-none rounded-xl border border-[#2C2C2C]/15 bg-white px-3 py-2.5 text-sm font-semibold text-[#2C2C2C] outline-none ring-[#6B9E6E]/30 focus-visible:ring-2"
                />
                {fieldErrors.message ? (
                  <p className="mt-1 text-xs font-semibold text-red-600">{fieldErrors.message}</p>
                ) : null}
              </label>
              {formError ? <p className="text-sm font-semibold text-red-600">{formError}</p> : null}
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-[#6B9E6E] px-6 py-3 text-sm font-bold text-white shadow-md transition hover:bg-[#5d8a60] disabled:opacity-60"
              >
                {busy ? "Sending…" : "Send message"}
              </button>
              <p className="text-center text-[11px] font-medium text-[#2C2C2C]/45">
                We&apos;ll never share your contact information without your consent
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return shell;
  return createPortal(shell, document.body);
}
