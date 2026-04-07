"use client";

import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { MarketplaceAgent } from "@/lib/marketplace-types";
import { AgentAvatarFill } from "@/components/marketplace/agent-avatar";

export function ViewingAgentPickerModal({
  open,
  onOpenChange,
  agents,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agents: MarketplaceAgent[];
  onSelect: (agent: MarketplaceAgent) => void;
}) {
  if (!open) return null;

  const shell = (
    <div className="fixed inset-0 z-[190] flex items-end justify-center sm:items-center" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close"
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="viewing-agent-picker-title"
        className="relative z-[191] mx-4 w-full max-w-sm rounded-2xl border border-[#2C2C2C]/10 bg-[#FAF8F4] p-5 shadow-2xl sm:mx-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <h2 id="viewing-agent-picker-title" className="pr-2 font-serif text-lg font-bold leading-snug text-[#2C2C2C]">
            Who would you like to schedule with?
          </h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="shrink-0 rounded-full p-2 text-[#2C2C2C]/60 transition hover:bg-[#2C2C2C]/10"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <ul className="mt-4 max-h-[min(60dvh,420px)] list-none space-y-2 overflow-y-auto p-0">
          {agents.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => onSelect(a)}
                className="flex w-full items-center gap-3 rounded-xl border border-[#2C2C2C]/10 bg-white p-3 text-left transition hover:bg-[#6B9E6E]/10"
              >
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full ring-1 ring-black/10">
                  <AgentAvatarFill name={a.name} imageUrl={a.image} sizes="48px" textClassName="text-sm" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[#2C2C2C]">{a.name}</p>
                  <p className="text-xs font-bold text-[#2C2C2C]/55">Score {Math.round(a.score)}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(shell, document.body);
}
