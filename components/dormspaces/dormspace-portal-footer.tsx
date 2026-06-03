import Link from "next/link";

function FooterLinkDisabled({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="cursor-not-allowed text-white/40"
      aria-disabled="true"
      title="Coming soon"
    >
      {children}
    </span>
  );
}

export function DormspacePortalFooter() {
  return (
    <footer className="mt-8 bg-[#1e4d3a] text-white">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr_1fr_1fr]">
          <div>
            <p className="font-serif text-2xl font-bold">bahaygo</p>
            <p className="text-sm font-semibold text-[#A8D4AB]">dormspacers</p>
            <p className="mt-4 max-w-xs text-sm font-medium leading-relaxed text-white/75">
              Verified dorms and rooms for students, BPO workers, and young professionals across Metro
              Manila.
            </p>
            <form
              className="mt-6 flex max-w-sm flex-col gap-2 sm:flex-row"
              onSubmit={(e) => e.preventDefault()}
            >
              <label className="sr-only" htmlFor="dormspace-newsletter-email">
                Email for updates
              </label>
              <input
                id="dormspace-newsletter-email"
                type="email"
                placeholder="Email for updates"
                className="min-w-0 flex-1 rounded-full border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-medium text-white placeholder:text-white/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4A843]/50"
              />
              <button
                type="submit"
                className="shrink-0 rounded-full bg-[#D4A843] px-5 py-2.5 text-sm font-bold text-[#2C2C2C] transition hover:bg-[#c49a3d]"
              >
                Subscribe
              </button>
            </form>
            <p className="mt-2 text-[11px] font-medium text-white/45">
              Stay in the loop — new listings near your school.
            </p>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#A8D4AB]">Explore</p>
            <ul className="mt-3 space-y-2 text-sm font-semibold text-white/85">
              <li>
                <Link href="/dormspaces" className="hover:text-[#D4A843]">
                  Browse dormspaces
                </Link>
              </li>
              <li>
                <Link href="/dormspaces#listings" className="hover:text-[#D4A843]">
                  All listings
                </Link>
              </li>
              <li>
                <Link href="/dormspaces/liked" className="hover:text-[#D4A843]">
                  Saved dormspaces
                </Link>
              </li>
              <li>
                <Link href="/dormspaces/search" className="hover:text-[#D4A843]">
                  Search on map
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#A8D4AB]">Landlords</p>
            <ul className="mt-3 space-y-2 text-sm font-semibold text-white/85">
              <li>
                <Link href="/dormspaces/welcome" className="hover:text-[#D4A843]">
                  List your space
                </Link>
              </li>
              <li>
                <Link href="/dormspaces/submit" className="hover:text-[#D4A843]">
                  Add a listing
                </Link>
              </li>
              <li>
                <Link href="/dormspaces/dashboard/listings" className="hover:text-[#D4A843]">
                  Landlord dashboard
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#A8D4AB]">Help</p>
            <ul className="mt-3 space-y-2 text-sm font-semibold text-white/85">
              <li>
                <Link href="/dormspaces#dormspace-faq" className="hover:text-[#D4A843]">
                  FAQs
                </Link>
              </li>
              <li>
                <Link href="/dormspaces/more" className="hover:text-[#D4A843]">
                  Dormspacers menu
                </Link>
              </li>
              <li>
                <Link href="/auth/login?next=/dormspaces" className="hover:text-[#D4A843]">
                  Sign in
                </Link>
              </li>
              <li>
                <FooterLinkDisabled>Account settings</FooterLinkDisabled>
              </li>
            </ul>
          </div>
        </div>

        <p className="mt-10 border-t border-white/10 pt-6 text-center text-xs font-medium text-white/45">
          © {new Date().getFullYear()} BahayGo dormspacers · Filipino-built student housing
        </p>
      </div>
    </footer>
  );
}
