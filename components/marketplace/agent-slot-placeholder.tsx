"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";

/** Logged-in agents see a CTA to claim slots; everyone else sees muted "No agent assigned". */
export function useShowListingAgentPlaceholderLink(): boolean {
  const { role } = useAuth();
  return role === "agent";
}

type AgentSlotPlaceholderProps = {
  /** Card carousel: stop click from opening property zoom */
  onLinkClick?: (e: React.MouseEvent) => void;
};

/** Two-line placeholder for property cards and zoom modal agent lists (sage ? circle is separate). */
export function AgentSlotPlaceholder({ onLinkClick }: AgentSlotPlaceholderProps) {
  const showLink = useShowListingAgentPlaceholderLink();

  if (showLink) {
    return (
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-[#2C2C2C]">Agent Slot Available</p>
        <Link
          href="/register/agent"
          className="text-[10px] font-medium text-[#6B9E6E] hover:underline"
          onClick={onLinkClick}
        >
          Become a listing agent →
        </Link>
      </div>
    );
  }

  return (
    <div className="min-w-0 flex-1">
      <p className="text-xs text-[#2C2C2C]/45">No agent assigned</p>
    </div>
  );
}

/** Zoom modal: slightly larger second line */
export function AgentSlotPlaceholderModal({ onLinkClick }: AgentSlotPlaceholderProps) {
  const showLink = useShowListingAgentPlaceholderLink();

  if (showLink) {
    return (
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-[#2C2C2C]/70">Agent Slot Available</p>
        <Link
          href="/register/agent"
          onClick={onLinkClick}
          className="mt-1 inline-block text-xs font-semibold text-[#6B9E6E] hover:underline"
        >
          Become a listing agent →
        </Link>
      </div>
    );
  }

  return (
    <div className="min-w-0 flex-1">
      <p className="text-sm text-[#2C2C2C]/45">No agent assigned</p>
    </div>
  );
}

/** Empty connected-agents section on /properties/[id] */
export function PropertyPageEmptyAgents() {
  const showLink = useShowListingAgentPlaceholderLink();

  if (showLink) {
    return (
      <div className="mt-4 rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 text-center shadow-sm">
        <p className="text-sm font-semibold text-[#2C2C2C]/70">No agents currently listed for this property.</p>
        <Link href="/register/agent" className="mt-3 inline-block text-sm font-semibold text-[#6B9E6E] hover:underline">
          Become a listing agent →
        </Link>
      </div>
    );
  }

  return (
    <p className="mt-4 rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 text-center text-sm text-[#2C2C2C]/45 shadow-sm">
      No agent assigned
    </p>
  );
}
