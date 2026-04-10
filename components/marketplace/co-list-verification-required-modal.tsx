"use client";

import { useRouter } from "next/navigation";

export function CoListVerificationRequiredModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="presentation">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="co-list-verification-title"
        className="relative z-[201] w-full max-w-md rounded-2xl border border-[#2C2C2C]/10 bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="co-list-verification-title" className="font-serif text-lg font-bold text-[#2C2C2C]">
          Verification Required
        </h2>
        <p className="mt-3 text-sm font-semibold leading-relaxed text-[#2C2C2C]/75">
          You need to be a verified agent to co-list properties. Please upload your verification documents to get
          started.
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[#2C2C2C]/15 bg-transparent px-5 py-2.5 text-sm font-semibold text-[#2C2C2C]/75"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              router.push("/settings?tab=verification");
            }}
            className="rounded-full bg-[#6B9E6E] px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#5d8a60]"
          >
            Go to Verification
          </button>
        </div>
      </div>
    </div>
  );
}
