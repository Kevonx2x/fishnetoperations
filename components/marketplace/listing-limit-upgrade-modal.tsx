"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { formatLimitN, normalizeListingTier, TIER_LABEL } from "@/lib/agent-listing-limits";

export function ListingLimitUpgradeModal({
  onClose,
  limitKind,
  tier,
  ownedLimit,
  coListLimit,
}: {
  onClose: () => void;
  /** Which limit was hit when opening this modal */
  limitKind: "owned" | "coList";
  tier: string | null | undefined;
  ownedLimit: number;
  coListLimit: number;
}) {
  const t = normalizeListingTier(tier);
  const tierName = TIER_LABEL[t];

  const title =
    limitKind === "owned"
      ? Number.isFinite(ownedLimit)
        ? `You've reached your plan limit of ${ownedLimit} owned listing${ownedLimit === 1 ? "" : "s"}`
        : "You've reached a listing limit on your plan"
      : Number.isFinite(coListLimit)
        ? `You've reached your co-listing limit (${formatLimitN(coListLimit)} slot${coListLimit === 1 ? "" : "s"})`
        : "You've reached a co-listing limit on your plan";

  const body =
    limitKind === "owned" ? (
      <p className="mt-3 text-sm font-semibold leading-relaxed text-[#2C2C2C]/70">
        Your <span className="text-[#2C2C2C]">{tierName}</span> plan includes{" "}
        <span className="text-[#2C2C2C]">{formatLimitN(ownedLimit)}</span> owned listings and{" "}
        <span className="text-[#2C2C2C]">{formatLimitN(coListLimit)}</span> co-listing slots. Remove or archive a
        listing, or upgrade for a higher cap.
      </p>
    ) : (
      <p className="mt-3 text-sm font-semibold leading-relaxed text-[#2C2C2C]/70">
        Co-listings are properties where you appear as a co-agent but are not the listing owner. Your{" "}
        <span className="text-[#2C2C2C]">{tierName}</span> plan allows up to{" "}
        <span className="text-[#2C2C2C]">{formatLimitN(coListLimit)}</span> co-listed properties. Leave a co-listing
        you no longer need, or upgrade for more slots and owned listings.
      </p>
    );

  const showUpgrade = t !== "broker";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 p-4 sm:items-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 32, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-[#D4A843]/35 bg-[#FAF8F4] p-6 shadow-2xl"
      >
        <h2 className="font-serif text-xl font-bold text-[#2C2C2C]">{title}</h2>
        {body}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="order-2 rounded-full border border-[#2C2C2C]/15 bg-white px-5 py-2.5 text-sm font-bold text-[#2C2C2C] hover:bg-[#FAF8F4] sm:order-1"
          >
            Cancel
          </button>
          {showUpgrade ? (
            <Link
              href="/pricing"
              onClick={onClose}
              className="order-1 inline-flex items-center justify-center rounded-full bg-[#D4A843] px-5 py-2.5 text-sm font-bold text-[#2C2C2C] shadow-sm hover:brightness-95 sm:order-2"
            >
              View plans
            </Link>
          ) : (
            <p className="order-1 text-sm font-semibold text-[#2C2C2C]/60 sm:order-2">
              If this looks wrong, contact support via{" "}
              <Link href="/contact" className="font-bold text-[#2C2C2C] underline underline-offset-2">
                Contact
              </Link>
              .
            </p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
