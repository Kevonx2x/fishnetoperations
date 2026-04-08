"use client";

import { AuthProvider } from "@/contexts/auth-context";
import { EngagementSignInProvider } from "@/contexts/engagement-signin-context";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <EngagementSignInProvider>{children}</EngagementSignInProvider>
      <Toaster position="top-center" richColors closeButton />
    </AuthProvider>
  );
}
