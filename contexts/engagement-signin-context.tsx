"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { SignInViewingPromptModal } from "@/components/marketplace/sign-in-viewing-prompt-modal";

const OpenSignInContext = createContext<() => void>(() => {});

export function EngagementSignInProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openSignIn = useCallback(() => setOpen(true), []);

  return (
    <OpenSignInContext.Provider value={openSignIn}>
      {children}
      <SignInViewingPromptModal open={open} onOpenChange={setOpen} />
    </OpenSignInContext.Provider>
  );
}

export function useOpenEngagementSignIn() {
  return useContext(OpenSignInContext);
}
