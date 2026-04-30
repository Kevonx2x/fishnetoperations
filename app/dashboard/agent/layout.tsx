import { PostLoginModal } from "@/components/onboarding/post-login-modal";

/**
 * Single mount point for the post-login / what's-new modal on agent routes.
 * (Avoid duplicating `<PostLoginModal />` inside `AgentDashboard` and elsewhere.)
 */
export default function AgentDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PostLoginModal />
      {children}
    </>
  );
}
