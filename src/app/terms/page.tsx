import { LegalDocument } from "@/components/public/legal-document";

const sections = [
  {
    title: "Using Veterans Bay",
    paragraphs: [
      "These terms govern access to the Veterans Bay service marketplace and professional operations platform. You must provide accurate registration information, protect your account, accept the privacy notice, and use only workspaces and records you are authorised to access.",
    ],
  },
  {
    title: "Marketplace role",
    paragraphs: [
      "Veterans Bay helps clients and independent professionals discover, agree, schedule, document, and follow up on services. Professionals remain responsible for their services, licences, team members, quotations, conduct, warranties, and applicable obligations. Clients remain responsible for accurate requirements, access arrangements, approvals, and agreed payment.",
    ],
  },
  {
    title: "Quotations, bookings, and records",
    paragraphs: [
      "Submitted quotation versions and accepted terms are preserved. Changes require an explicit revision or variation. Booking, job, completion, warranty, review, and dispute actions must be recorded through their intended workflow.",
      "Veterans Bay records manual payment information but does not process M-Pesa, cards, payouts, subscriptions, or commissions in the MVP. A payment record is evidence entered by an authorised user and is not a guarantee that funds settled.",
    ],
  },
  {
    title: "Acceptable conduct",
    paragraphs: ["You must not misuse Veterans Bay or put other users at risk."],
    items: [
      "Do not impersonate another person, submit misleading listings, manipulate reviews, or provide false verification evidence.",
      "Do not send abusive, threatening, unlawful, fraudulent, or unsolicited content.",
      "Do not seek unauthorised access, bypass permissions or rate limits, scrape private records, or disrupt the service.",
      "Do not use engagement data for unrelated purposes or disclose another person's private evidence.",
    ],
  },
  {
    title: "Moderation and account restrictions",
    paragraphs: [
      "Veterans Bay may investigate reports, hide content, restrict or restore access, and resolve platform cases when needed for safety, integrity, legal compliance, or these terms. Material decisions require a reason and evidence summary, are audited, and do not silently rewrite transaction history. Affected users receive an appropriate status without private investigation details.",
    ],
  },
  {
    title: "Availability and changes",
    paragraphs: [
      "The service may be interrupted by maintenance, internet, hosting, or third-party dependencies. Deferred features are not part of the active service. We may make proportionate changes to protect security, reliability, or legal compliance and will update these terms when a material user obligation changes.",
    ],
  },
  {
    title: "Account deactivation and preserved records",
    paragraphs: [
      "You may deactivate your account from account settings. Protected access ends and removable Veterans Bay profile data is replaced with a deactivated placeholder. Records needed for accepted work, payments, warranties, reviews, disputes, fraud prevention, audit, and other participants remain preserved.",
    ],
  },
  {
    title: "Concerns and support",
    paragraphs: [
      "Use the Help Center to report safety, privacy, account, or service concerns. Formal operator identity, physical notice address, governing-law language, and dispute forum must be confirmed by the delivery owner before production launch.",
    ],
  },
] as const;

export default function TermsPage() {
  return (
    <LegalDocument
      eyebrow="Terms"
      title="Terms of use"
      updated="28 July 2026"
      sections={sections}
    />
  );
}
