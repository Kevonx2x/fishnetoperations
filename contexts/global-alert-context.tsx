"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  GlobalAlertBanner,
  type GlobalAlertVariant,
} from "@/components/ui/global-alert-banner";

export type { GlobalAlertVariant };

type GlobalAlertContextValue = {
  showAlert: (message: string, variant?: GlobalAlertVariant) => void;
  dismissAlert: () => void;
};

const GlobalAlertContext = createContext<GlobalAlertContextValue | null>(null);

export function GlobalAlertProvider({ children }: { children: ReactNode }) {
  const [payload, setPayload] = useState<{
    message: string;
    variant: GlobalAlertVariant;
    key: number;
  } | null>(null);

  const showAlert = useCallback((message: string, variant: GlobalAlertVariant = "success") => {
    setPayload((prev) => ({
      message,
      variant,
      key: (prev?.key ?? 0) + 1,
    }));
  }, []);

  const dismissAlert = useCallback(() => {
    setPayload(null);
  }, []);

  const value = useMemo(
    () => ({ showAlert, dismissAlert }),
    [showAlert, dismissAlert],
  );

  return (
    <GlobalAlertContext.Provider value={value}>
      {children}
      {payload ? (
        <GlobalAlertBanner
          key={payload.key}
          message={payload.message}
          variant={payload.variant}
          onDismiss={dismissAlert}
        />
      ) : null}
    </GlobalAlertContext.Provider>
  );
}

export function useGlobalAlert(): GlobalAlertContextValue {
  const ctx = useContext(GlobalAlertContext);
  if (!ctx) {
    throw new Error("useGlobalAlert must be used within GlobalAlertProvider");
  }
  return ctx;
}
