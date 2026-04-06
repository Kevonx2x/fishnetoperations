"use client";

import Link from "next/link";
import { X } from "lucide-react";

export function SignInViewingPromptModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!open) return null;

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
        aria-labelledby="sign-in-viewing-title"
        className="relative w-full max-w-sm rounded-2xl border border-[#2C2C2C]/10 bg-[#FAF8F4] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute right-3 top-3 rounded-full p-2 text-[#2C2C2C]/55 transition hover:bg-[#2C2C2C]/10 hover:text-[#2C2C2C]"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
        <h2 id="sign-in-viewing-title" className="pr-10 font-serif text-xl font-bold text-[#2C2C2C]">
          Sign in to Request a Viewing
        </h2>
        <p className="mt-2 text-sm font-semibold leading-relaxed text-[#2C2C2C]/65">
          Create a free account or log in to schedule a property visit
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:gap-2">
          <Link
            href="/auth/login"
            className="inline-flex flex-1 items-center justify-center rounded-xl bg-[#2C2C2C] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#6B9E6E]"
          >
            Log In
          </Link>
          <Link
            href="/auth/register"
            className="inline-flex flex-1 items-center justify-center rounded-xl border-2 border-[#D4A843]/50 bg-white px-4 py-3 text-sm font-bold text-[#2C2C2C] transition hover:bg-[#D4A843]/15"
          >
            Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
}
