import type { Metadata } from "next";
import { LegalPageShell } from "@/components/legal/legal-page-shell";

export const metadata: Metadata = {
  title: "Terms of Service — BahayGo",
  description:
    "Terms governing use of BahayGo’s Philippine real estate marketplace, including PRC licensing expectations for professionals.",
};

export default function TermsOfServicePage() {
  return (
    <LegalPageShell title="Terms of Service" current="terms">
      <section className="space-y-4">
        <h2>Agreement to these terms</h2>
        <p>
          These Terms of Service (&quot;Terms&quot;) govern your access to and use of BahayGo
          (&quot;BahayGo,&quot; the &quot;Platform&quot;), including our websites, applications, and
          related services offered in connection with real property listings, agent and broker
          discovery, and lead management in the Philippines. By creating an account, browsing
          listings, or otherwise using the Platform, you agree to these Terms and our Privacy
          Policy.
        </p>
        <p>
          If you use BahayGo on behalf of a company or brokerage, you represent that you have
          authority to bind that entity, and &quot;you&quot; includes that entity.
        </p>
      </section>

      <section className="space-y-4">
        <h2>Eligibility and accounts</h2>
        <p>
          You must be at least eighteen (18) years old and capable of entering into a binding
          contract under Philippine law. You agree to provide accurate, current, and complete
          registration information and to update it promptly. You are responsible for safeguarding
          your password and for all activity under your account.
        </p>
      </section>

      <section className="space-y-4">
        <h2>Licensed professionals: PRC and brokerage rules</h2>
        <p>
          Real estate service practitioners in the Philippines are regulated under{" "}
          <strong>Republic Act No. 9646</strong> (Real Estate Service Act) and related issuances of
          the Professional Regulation Commission (PRC). If you register as a real estate agent or
          broker on BahayGo, you represent and warrant that:
        </p>
        <ul>
          <li>
            You hold a valid, unexpired PRC license for the real estate service appropriate to your
            role (e.g., real estate salesperson or broker), or you are operating under a lawful
            exemption that still permits your participation on the Platform, as disclosed to us.
          </li>
          <li>
            You will maintain your license in good standing, comply with continuing professional
            development requirements, and notify us promptly of suspension, revocation, or
            material change in your professional status.
          </li>
          <li>
            If you are a real estate salesperson, your activities align with applicable rules on
            supervision by a licensed real estate broker, including any accreditation requirements
            with your supervising broker or brokerage.
          </li>
        </ul>
        <p>
          BahayGo may display license numbers, verification badges, and related information to help
          users assess credentials. Verification on the Platform does not replace official PRC or
          government records; users should independently confirm licensure where material to a
          transaction.
        </p>
      </section>

      <section className="space-y-4">
        <h2>Listings, accuracy, and conduct</h2>
        <p>
          Sellers, agents, and brokers are responsible for the accuracy of listing information,
          including price, availability, title status (where represented), and property condition.
          You must not post misleading, fraudulent, or discriminatory content, or use the Platform
          to circumvent applicable laws (including those on anti-money laundering, consumer
          protection, and fair housing principles as they apply in the Philippines).
        </p>
        <p>
          You grant BahayGo a non-exclusive license to host, display, reproduce, and distribute
          content you submit for the purpose of operating and promoting the Platform.
        </p>
      </section>

      <section className="space-y-4">
        <h2>Platform as facilitator</h2>
        <p>
          BahayGo is a real estate technology platform only. We are not a licensed real estate broker,
          agent, or brokerage. We do not represent any party in any transaction. All listings are
          posted by independent PRC-licensed professionals who are solely responsible for accuracy.
        </p>
      </section>

      <section className="space-y-4">
        <h2>Document accuracy</h2>
        <p>
          Users who upload documents to BahayGo are solely responsible for the legality, accuracy, and
          authenticity of those documents. BahayGo assumes no liability for fraudulent or inaccurate
          documents.
        </p>
      </section>

      <section className="space-y-4">
        <h2>PRC verification disclaimer</h2>
        <p>
          Agent verification is based on public PRC records at the time of registration. BahayGo does
          not guarantee the future conduct of any verified agent.
        </p>
      </section>

      <section className="space-y-4">
        <h2>No brokerage or legal advice</h2>
        <p>
          BahayGo is a technology platform. We are not a party to sales, leases, or other agreements
          between users, and we do not provide legal, tax, or investment advice. Transactions,
          contracts, due diligence, and compliance with{" "}
          <strong>Republic Act No. 6657</strong> (CARL) and other land laws, tax rules, and local
          ordinances remain solely your responsibility. Consult qualified professionals for
          conveyancing and regulatory matters.
        </p>
      </section>

      <section className="space-y-4">
        <h2>Fees and payments</h2>
        <p>
          Certain features may be subject to fees or subscriptions as described on the Platform.
          Unless stated otherwise, fees are quoted in Philippine pesos. Taxes and third-party
          charges may apply. Failure to pay may result in suspension of paid features.
        </p>
      </section>

      <section className="space-y-4">
        <h2>Intellectual property</h2>
        <p>
          The BahayGo name, logos, and Platform software are protected by intellectual property laws.
          You may not copy, reverse engineer, or scrape the Platform in violation of these Terms or
          applicable law. Listing photos and descriptions remain subject to the rights of their
          respective owners; you must have permission to upload media you provide.
        </p>
      </section>

      <section className="space-y-4">
        <h2>Disclaimer of warranties</h2>
        <p>
          The Platform is provided on an &quot;as is&quot; and &quot;as available&quot; basis. To the
          fullest extent permitted by the <strong>Civil Code of the Philippines</strong> and other
          applicable law, we disclaim warranties of merchantability, fitness for a particular
          purpose, and non-infringement. We do not warrant uninterrupted or error-free operation.
        </p>
      </section>

      <section className="space-y-4">
        <h2>Limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, BahayGo and its affiliates, officers, directors,
          employees, and suppliers shall not be liable for any indirect, incidental, special,
          consequential, or punitive damages, or for loss of profits, data, or goodwill, arising
          from your use of the Platform or interactions with other users. Our aggregate liability
          for claims arising out of these Terms shall not exceed the greater of (a) the amounts you
          paid to BahayGo in the twelve (12) months preceding the claim, or (b) five thousand
          Philippine pesos (PHP 5,000), except where liability cannot be limited under mandatory
          Philippine law (including certain provisions on consumer rights).
        </p>
      </section>

      <section className="space-y-4">
        <h2>Indemnity</h2>
        <p>
          You agree to indemnify and hold harmless BahayGo from claims, damages, losses, and
          expenses (including reasonable attorneys&apos; fees) arising from your content, your use
          of the Platform, your violation of these Terms, or your violation of third-party rights.
        </p>
      </section>

      <section className="space-y-4">
        <h2>Suspension and termination</h2>
        <p>
          We may suspend or terminate your account if you breach these Terms, pose a risk to other
          users, or if required by law or regulatory order. You may stop using the Platform at any
          time. Provisions that by nature should survive (including intellectual property,
          disclaimers, limitations, and indemnity) will survive termination.
        </p>
      </section>

      <section className="space-y-4">
        <h2>Governing law and disputes</h2>
        <p>
          These Terms are governed by the laws of the Republic of the Philippines, without regard
          to conflict-of-law rules. You agree to the exclusive jurisdiction of the courts of Metro
          Manila (or another forum we specify in writing) for disputes arising from these Terms,
          subject to any mandatory arbitration or small-claims provisions we may adopt and notify
          you of.
        </p>
      </section>

      <section className="space-y-4">
        <h2>Changes</h2>
        <p>
          We may modify these Terms from time to time. We will post the updated Terms on this page
          and update the &quot;Last updated&quot; date. Continued use after changes constitutes
          acceptance, except where your explicit consent is required by law.
        </p>
      </section>

      <section className="space-y-4">
        <h2>Contact</h2>
        <p>
          Questions about these Terms? Visit our{" "}
          <a href="/contact" className="font-semibold text-[#2C2C2C] underline underline-offset-4">
            Contact
          </a>{" "}
          page.
        </p>
      </section>
    </LegalPageShell>
  );
}
