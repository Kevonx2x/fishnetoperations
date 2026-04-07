import type { Metadata } from "next";
import { LegalPageShell } from "@/components/legal/legal-page-shell";

export const metadata: Metadata = {
  title: "Anti-Scam Policy — BahayGo",
  description:
    "How BahayGo helps protect users from real estate fraud in the Philippines and what to watch for.",
};

export default function AntiScamPolicyPage() {
  return (
    <LegalPageShell title="Anti-Scam Policy" current="anti-scam">
      <section className="space-y-4">
        <h2>Our commitment</h2>
        <p>
          BahayGo exists to make finding a home in the Philippines safer and more transparent.
          Real estate transactions involve large sums of money and sensitive personal information,
          which makes the sector a target for fraud. This Anti-Scam Policy describes how we work to
          reduce risk, what we expect from users, and how Philippine legal frameworks—including the{" "}
          <strong>Cybercrime Prevention Act (Republic Act No. 10175)</strong>, the{" "}
          <strong>Data Privacy Act of 2012 (Republic Act No. 10173)</strong>, and professional
          licensing rules administered by the <strong>Professional Regulation Commission (PRC)</strong>
          —inform our approach. It does not replace vigilance on your part or advice from lawyers
          and licensed professionals.
        </p>
      </section>

      <section className="space-y-4">
        <h2>Common scams in Philippine real estate</h2>
        <p>Users should be aware of schemes that frequently appear in online property marketplaces:</p>
        <ul>
          <li>
            <strong>Fake or cloned listings:</strong> Photos and addresses copied from legitimate
            listings, with fraudsters posing as owners or agents to collect deposits or
            &quot;reservation fees.&quot;
          </li>
          <li>
            <strong>Title and identity fraud:</strong> Offers to sell or lease property without
            lawful authority, sometimes supported by forged documents or impersonation of licensed
            practitioners.
          </li>
          <li>
            <strong>Advance-fee and overpayment scams:</strong> Requests to wire money before a
            viewing, or to return &quot;accidental&quot; overpayments through untraceable channels.
          </li>
          <li>
            <strong>Phishing:</strong> Emails or SMS pretending to be BahayGo, banks, or government
            agencies to steal passwords or one-time PINs.
          </li>
          <li>
            <strong>Unlicensed practice:</strong> Individuals offering brokerage or appraisal
            services without valid PRC credentials or proper brokerage affiliation.
          </li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2>What BahayGo does to reduce risk</h2>
        <p>We continuously improve safeguards, which may include:</p>
        <ul>
          <li>
            <strong>Professional verification:</strong> Collecting and displaying PRC license
            information and broker relationships for agents and brokers who complete our verification
            steps, to help users distinguish credentialed practitioners from anonymous posters.
          </li>
          <li>
            <strong>Platform integrity tools:</strong> Monitoring for suspicious patterns, enforcing
            our Terms of Service, and removing listings or accounts that violate our policies.
          </li>
          <li>
            <strong>Secure communication channels:</strong> Encouraging users to keep substantive
            negotiations and payment discussions within documented, traceable processes—not rushed
            instructions delivered only through chat apps from unknown numbers.
          </li>
          <li>
            <strong>Education:</strong> Publishing guidance (such as this policy) on red flags and
            safe practices for buyers, renters, and property professionals.
          </li>
        </ul>
        <p>
          No online platform can eliminate all fraud. Verification badges and in-app tools are aids,
          not guarantees of title, solvency, or the outcome of any transaction.
        </p>
      </section>

      <section className="space-y-4">
        <h2>Red flags: when to pause and verify</h2>
        <p>Exercise extra caution if someone you met through BahayGo:</p>
        <ul>
          <li>Pressures you to send money immediately—especially via cryptocurrency, gift cards, or remittance to unrelated third parties.</li>
          <li>Refuses an in-person or video viewing of the property or will not meet at a verifiable brokerage office.</li>
          <li>Cannot produce consistent identification, signed authority to sell or lease, or coherent chain of title documentation.</li>
          <li>Asks you to &quot;pay BahayGo&quot; through personal GCash, bank accounts, or links that do not match our official channels.</li>
          <li>Offers terms that are far below market without a credible explanation.</li>
        </ul>
        <p>
          When in doubt, verify licenses on the PRC website, confirm ownership and encumbrances with a
          reputable lawyer or the relevant Registry of Deeds, and use escrow or supervised closing
          arrangements for material payments.
        </p>
      </section>

      <section className="space-y-4">
        <h2>Reporting suspected scams</h2>
        <p>
          If you believe a listing, user, or message on BahayGo is fraudulent or violates our
          policies, report it to us immediately through{" "}
          <a href="/contact" className="font-semibold text-[#2C2C2C] underline underline-offset-4">
            Contact
          </a>{" "}
          with as much detail as possible (screenshots, URLs, phone numbers used). We may suspend
          accounts, preserve records, and cooperate with law enforcement or regulators where
          permitted by the{" "}
          <strong>Data Privacy Act</strong> and other applicable law.
        </p>
        <p>
          Criminal cybercrime and estafa cases may be reported to the Philippine National Police
          Anti-Cybercrime Group (PNP-ACG), the National Bureau of Investigation (NBI) Cybercrime
          Division, or other competent authorities. Civil remedies may also be available under the
          Civil Code and related statutes.
        </p>
      </section>

      <section className="space-y-4">
        <h2>Responsibilities of agents and brokers</h2>
        <p>
          Licensed professionals must comply with RESA, PRC regulations, and the rules of their
          accredited organizations. Misrepresenting listings, double-selling, or facilitating money
          laundering may result in removal from BahayGo, professional discipline, and criminal
          liability. Brokers are expected to supervise salespersons in line with Philippine law.
        </p>
      </section>

      <section className="space-y-4">
        <h2>Limitation</h2>
        <p>
          BahayGo is not liable for losses arising from transactions between users or from
          third-party conduct beyond our reasonable control. This policy is informational and forms
          part of our broader Terms of Service and Privacy Policy.
        </p>
      </section>

      <section className="space-y-4">
        <h2>Updates</h2>
        <p>
          We may update this Anti-Scam Policy as threats and regulations evolve. The &quot;Last
          updated&quot; date at the top of this page reflects the latest revision.
        </p>
      </section>
    </LegalPageShell>
  );
}
