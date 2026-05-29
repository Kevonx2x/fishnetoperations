import { AuthSignInLinkForPath } from "@/components/auth/auth-sign-in-cta";

type Props = {
  title: string;
  copy: string;
  nextPath: string;
};

/** Logged-out empty state for bottom-nav tabs (Saved, Messages, Notifications). */
export function LoggedOutTabEmptyState({ title, copy, nextPath }: Props) {
  return (
    <div className="mx-auto max-w-lg px-4 py-10 pb-28 text-center">
      <h1 className="font-serif text-3xl font-bold tracking-tight text-[#2C2C2C]">{title}</h1>
      <p className="mt-3 text-sm font-medium leading-relaxed text-[#2C2C2C]/55">{copy}</p>
      <AuthSignInLinkForPath nextPath={nextPath} className="mt-6" />
    </div>
  );
}
