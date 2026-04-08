"use client";

import { AuthProvider } from "@/contexts/auth-context";
import { EngagementSignInProvider } from "@/contexts/engagement-signin-context";
import { GlobalAlertProvider } from "@/contexts/global-alert-context";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <GlobalAlertProvider>
        <EngagementSignInProvider>{children}</EngagementSignInProvider>
      </GlobalAlertProvider>
      <Toaster position="top-center" richColors closeButton />
    </AuthProvider>
  );
}
