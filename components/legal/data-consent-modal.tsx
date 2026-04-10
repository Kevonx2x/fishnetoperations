"use client";

import { useCallback, useRef, useState } from "react";

export const BAHAYGO_DATA_CONSENT_KEY = "bahaygo_data_consent_agreed";

export function hasDataConsentAgreed(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(BAHAYGO_DATA_CONSENT_KEY) === "true";
}

type DataConsentModalProps = {
  open: boolean;
  onAgree: () => void;
  onCancel: () => void;
};

export function DataConsentModal({ open, onAgree, onCancel }: DataConsentModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-end justify-center bg-black/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="data-consent-title"
    >
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#2C2C2C]/10 bg-white p-5 shadow-2xl sm:p-6">
        <h2 id="data-consent-title" className="font-serif text-xl font-bold text-[#2C2C2C]">
          Data Privacy Consent
        </h2>
        <div className="mt-4 space-y-4 text-sm leading-relaxed text-[#2C2C2C]/85">
          <p>Before uploading documents, please read and agree to the following:</p>
          <section>
            <p className="font-bold text-[#2C2C2C]">📋 What we collect</p>
            <p className="mt-1">
              BahayGo collects identity documents, PRC licenses, and financial documents solely for the purpose of
              facilitating real estate transactions on this platform.
            </p>
          </section>
          <section>
            <p className="font-bold text-[#2C2C2C]">🔒 How we protect it</p>
            <p className="mt-1">
              All documents are stored in private, encrypted storage. Files are only accessible via secure time-limited
              URLs. No document is ever made publicly accessible.
            </p>
          </section>
          <section>
            <p className="font-bold text-[#2C2C2C]">👤 Who can see it</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>Your uploaded documents are only visible to you</li>
              <li>Documents shared with an agent are visible only to that specific agent</li>
              <li>BahayGo admin may access documents for verification purposes only</li>
            </ul>
          </section>
          <section>
            <p className="font-bold text-[#2C2C2C]">🗑️ Your rights</p>
            <p className="mt-1">
              You may request deletion of all your documents at any time through Settings → Account → Delete Account. You
              may also contact support@bahaygo.com.
            </p>
          </section>
          <p className="text-xs text-[#2C2C2C]/65">
            This platform complies with the Data Privacy Act of 2012 (Republic Act No. 10173).
          </p>
        </div>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-[#2C2C2C]/20 px-4 py-2.5 text-sm font-bold text-[#2C2C2C]/70 hover:bg-[#FAF8F4]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onAgree}
            className="rounded-full bg-[#6B9E6E] px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#5a8a5d]"
          >
            I Agree to Data Privacy Terms
          </button>
        </div>
      </div>
    </div>
  );
}

/** Returns modal element + ensureConsent(wrapped) — call before any document upload. */
export function useDataConsentGate() {
  const [open, setOpen] = useState(false);
  const pendingRef = useRef<(() => void) | null>(null);

  const ensureConsent = useCallback((run: () => void) => {
    if (hasDataConsentAgreed()) {
      run();
      return;
    }
    pendingRef.current = run;
    setOpen(true);
  }, []);

  const onAgree = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(BAHAYGO_DATA_CONSENT_KEY, "true");
    }
    setOpen(false);
    const fn = pendingRef.current;
    pendingRef.current = null;
    queueMicrotask(() => fn?.());
  }, []);

  const onCancel = useCallback(() => {
    setOpen(false);
    pendingRef.current = null;
  }, []);

  const modal = (
    <DataConsentModal open={open} onAgree={onAgree} onCancel={onCancel} />
  );

  return { ensureConsent, dataConsentModal: modal };
}
