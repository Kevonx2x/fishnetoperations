"use client";

import { Suspense } from "react";
import { BahayGoThemeProvider } from "@/components/bahaygo-theme-provider";
import { AuthProvider } from "@/contexts/auth-context";
import { EngagementSignInProvider } from "@/contexts/engagement-signin-context";
import { GlobalAlertProvider } from "@/contexts/global-alert-context";
import { Toaster } from "@/components/ui/sonner";
import { StreamChatProvider } from "@/features/messaging/components/stream-chat-provider";
import { AgentTourOverlay } from "@/components/onboarding/agent-tour-overlay";
import { AgentTourBootstrap } from "@/components/onboarding/agent-tour-trigger";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <BahayGoThemeProvider>
      <AuthProvider>
        <StreamChatProvider>
          <GlobalAlertProvider>
            <EngagementSignInProvider>
              <Suspense fallback={null}>
                <AgentTourBootstrap />
                <AgentTourOverlay />
              </Suspense>
              <div className="flex min-h-0 flex-1 flex-col">{children}</div>
            </EngagementSignInProvider>
          </GlobalAlertProvider>
        </StreamChatProvider>
        <Toaster position="bottom-right" duration={3000} closeButton richColors />
      </AuthProvider>
    </BahayGoThemeProvider>
  );
}
