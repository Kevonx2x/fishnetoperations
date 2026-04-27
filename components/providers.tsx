"use client";

import { BahayGoThemeProvider } from "@/components/bahaygo-theme-provider";
import { AuthProvider } from "@/contexts/auth-context";
import { EngagementSignInProvider } from "@/contexts/engagement-signin-context";
import { GlobalAlertProvider } from "@/contexts/global-alert-context";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <BahayGoThemeProvider>
      <AuthProvider>
        <GlobalAlertProvider>
          <EngagementSignInProvider>
            <div className="flex min-h-0 flex-1 flex-col">{children}</div>
          </EngagementSignInProvider>
        </GlobalAlertProvider>
        <Toaster position="bottom-right" duration={3000} closeButton richColors />
      </AuthProvider>
    </BahayGoThemeProvider>
  );
}
