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

type DormspaceContactModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dormspaceId: string;
  dormspaceTitle: string;
  onSent?: () => void;
};

export function DormspaceContactModal({
  open,
  onOpenChange,
  dormspaceId,
  dormspaceTitle,
  onSent,
}: DormspaceContactModalProps) {
  const titleId = useId();
  const { user, profile } = useAuth();
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
    }
    setMessage(`Hi, I'm interested in "${dormspaceTitle}".`);
  }, [open, user, profile, dormspaceTitle]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onOpenChange]);

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
        const k = issue.path[0];
        if (typeof k === "string") errs[k] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/dormspaces/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dormspace_id: dormspaceId,
          ...parsed.data,
        }),
      });
      const json = (await res.json()) as { error?: string | { message?: string } };
      if (!res.ok) {
        const msg = typeof json.error === "string" ? json.error : json.error?.message;
        setFormError(msg ?? "Could not send message");
        return;
      }
      setSuccess(true);
      onSent?.();
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  const inputCls =
    "w-full rounded-xl border border-[#2C2C2C]/12 bg-white px-3 py-2.5 text-sm font-medium text-[#2C2C2C] placeholder:text-[#888888] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6B9E6E]/25";

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close" onClick={handleClose} />
      <div
        role="dialog"
        aria-modal
        aria-labelledby={titleId}
        className="relative z-[1] flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-[#FAF8F4] shadow-xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-[#2C2C2C]/8 px-5 py-4">
          <h2 id={titleId} className="font-serif text-lg font-bold text-[#2C2C2C]">
            Contact landlord
          </h2>
          <button type="button" onClick={handleClose} className="rounded-lg p-1.5 hover:bg-black/5" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>

        {success ? (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-[#6B9E6E]/15">
              <Check className="size-6 text-[#6B9E6E]" />
            </div>
            <p className="font-serif text-lg font-semibold text-[#2C2C2C]">Message sent</p>
            <p className="text-sm font-medium text-[#484848]">The landlord will reach out using your contact details.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto px-5 py-4">
            <p className="mb-4 text-sm font-medium text-[#484848]">
              Inquire about <span className="font-semibold text-[#2C2C2C]">{dormspaceTitle}</span>
            </p>
            <div className="space-y-3">
              <label className="block text-xs font-semibold uppercase tracking-wide text-[#525252]">
                Name
                <input className={cn(inputCls, "mt-1")} value={name} onChange={(e) => setName(e.target.value)} required />
                {fieldErrors.name ? <span className="mt-1 block text-xs text-red-600">{fieldErrors.name}</span> : null}
              </label>
              <label className="block text-xs font-semibold uppercase tracking-wide text-[#525252]">
                Email
                <input
                  type="email"
                  className={cn(inputCls, "mt-1")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                {fieldErrors.email ? <span className="mt-1 block text-xs text-red-600">{fieldErrors.email}</span> : null}
              </label>
              <label className="block text-xs font-semibold uppercase tracking-wide text-[#525252]">
                Phone (optional)
                <input className={cn(inputCls, "mt-1")} value={phone} onChange={(e) => setPhone(e.target.value)} />
              </label>
              <label className="block text-xs font-semibold uppercase tracking-wide text-[#525252]">
                Message
                <textarea
                  className={cn(inputCls, "mt-1 min-h-[100px] resize-y")}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                />
                {fieldErrors.message ? (
                  <span className="mt-1 block text-xs text-red-600">{fieldErrors.message}</span>
                ) : null}
              </label>
            </div>
            {formError ? <p className="mt-3 text-sm font-medium text-red-600">{formError}</p> : null}
            <button
              type="submit"
              disabled={busy}
              className="mt-5 h-11 w-full rounded-xl bg-[#6B9E6E] text-sm font-bold text-white transition hover:bg-[#5d8a60] disabled:opacity-60"
            >
              {busy ? "Sending…" : "Send message"}
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
