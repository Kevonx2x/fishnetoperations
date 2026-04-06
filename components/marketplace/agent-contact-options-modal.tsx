"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { MarketplaceAgent } from "@/lib/marketplace-types";
import { smsHref, viberHref, whatsAppHref } from "@/lib/agent-contact-links";
import { cn } from "@/lib/utils";

function OptionRow({
  children,
  href,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const className = cn(
    "flex w-full items-center gap-3 rounded-xl border border-[#2C2C2C]/10 bg-white px-4 py-3 text-left text-sm font-semibold text-[#2C2C2C] transition",
    disabled ? "cursor-not-allowed opacity-45" : "cursor-pointer hover:border-[#6B9E6E]/35 hover:bg-[#6B9E6E15]",
  );

  if (href && !disabled) {
    return (
      <a href={href} className={className} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noopener noreferrer" : undefined}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" className={className} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export function AgentContactOptionsModal({
  open,
  onOpenChange,
  agent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: MarketplaceAgent | null;
}) {
  const [copied, setCopied] = useState(false);

  if (!open || !agent) return null;

  const email = agent.email?.trim();
  const phone = agent.phone?.trim();
  const mailto = email ? `mailto:${encodeURIComponent(email)}` : null;
  const sms = smsHref(phone ?? null);
  const wa = whatsAppHref(phone ?? null);
  const viber = viberHref(phone ?? null);

  const copyPhone = async () => {
    if (!phone) return;
    try {
      await navigator.clipboard.writeText(phone);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="fixed inset-0 z-[125] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/45"
        aria-label="Close"
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="agent-contact-title"
        className="relative max-h-[min(90dvh,560px)] w-full max-w-md overflow-y-auto rounded-2xl border border-[#2C2C2C]/10 bg-[#FAF8F4] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-[1] flex items-start justify-between gap-3 border-b border-[#2C2C2C]/10 bg-[#FAF8F4] px-5 py-4">
          <div>
            <h2 id="agent-contact-title" className="font-serif text-xl font-bold text-[#2C2C2C]">
              Contact Agent
            </h2>
            <p className="mt-1 text-sm font-semibold text-[#2C2C2C]/60">{agent.name}</p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="shrink-0 rounded-full p-2 text-[#2C2C2C]/55 transition hover:bg-[#2C2C2C]/10 hover:text-[#2C2C2C]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-2 px-4 pb-5 pt-3">
          <OptionRow href={mailto ?? undefined} disabled={!mailto}>
            <span className="text-lg" aria-hidden>
              📧
            </span>
            <span>Email</span>
          </OptionRow>
          <OptionRow href={sms ?? undefined} disabled={!sms}>
            <span className="text-lg" aria-hidden>
              📱
            </span>
            <span>SMS / Text</span>
          </OptionRow>
          <OptionRow href={wa ?? undefined} disabled={!wa}>
            <span className="text-lg" aria-hidden>
              💬
            </span>
            <span>WhatsApp</span>
          </OptionRow>
          <OptionRow href={viber ?? undefined} disabled={!viber}>
            <span className="text-lg" aria-hidden>
              📞
            </span>
            <span>Viber</span>
          </OptionRow>
          <OptionRow onClick={copyPhone} disabled={!phone}>
            <span className="text-lg" aria-hidden>
              📋
            </span>
            <span>{copied ? "Copied!" : "Copy phone number"}</span>
          </OptionRow>
        </div>
      </div>
    </div>
  );
}
