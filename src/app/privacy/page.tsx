import { LegalDocument } from "@/components/public/legal-document";

const sections = [
  {
    title: "What this notice covers",
    paragraphs: [
      "This notice explains how Veterans Bay uses personal data when clients, professionals, team members, and platform operators use the marketplace and operational workspace.",
      "Veterans Bay is designed for the Kenyan market and applies privacy controls consistent with the principles and data-subject rights described by Kenya's Office of the Data Protection Commissioner.",
    ],
  },
  {
    title: "Data we use",
    paragraphs: [
      "We use the information needed to provide accounts, marketplace discovery, service requests, quotations, bookings, jobs, conversations, manual payment records, warranties, reviews, support, safety, and platform administration.",
    ],
    items: [
      "Account and contact information, consent timestamps, organisation membership, roles, and permissions.",
      "Service requirements, locations, schedules, quotations, accepted terms, job updates, invoices, and manual payment records.",
      "Messages and files intentionally uploaded as request, job, payment, warranty, dispute, or verification evidence.",
      "Security, session, audit, notification, reliability, and diagnostic records needed to operate and protect the service.",
    ],
  },
  {
    title: "Why we use data",
    paragraphs: [
      "We use data to provide requested services, perform platform agreements, protect users and the marketplace, meet legal obligations, maintain required transaction and audit history, and improve reliable operation. We do not present deferred advertising, payment-processing, location-tracking, or AI features as active processing purposes.",
    ],
  },
  {
    title: "Sharing and service providers",
    paragraphs: [
      "Information is shared only with participants and authorised organisation members who need it for the relevant engagement, and with authorised platform operators for safety, support, and governance.",
      "Neon stores relational records, Cloudflare runs the web/API and asynchronous processing, Better Auth supports authentication, and Cloudinary stores approved images and documents. Private evidence is delivered through authorised, time-limited access rather than public links.",
    ],
  },
  {
    title: "Retention and account deactivation",
    paragraphs: [
      "We keep information only as long as needed for the stated purpose and applicable obligations. Account deactivation removes editable profile identifiers from the Veterans Bay profile and ends protected access. Required transaction, commercial, payment, warranty, dispute, moderation, and audit history remains linked to a deactivated placeholder so records cannot be silently rewritten.",
    ],
  },
  {
    title: "Your choices and rights",
    paragraphs: [
      "Depending on the circumstances, you may ask to be informed about use, access your data, object to processing, correct inaccurate data, or request deletion of data that is not required to be retained. Some requests cannot remove records that must be preserved for another participant, fraud prevention, dispute handling, or legal obligations.",
      "You may also raise a complaint with Kenya's Office of the Data Protection Commissioner.",
    ],
  },
  {
    title: "Security and changes",
    paragraphs: [
      "Veterans Bay uses server-enforced permissions, organisation and participant checks, private file delivery, rate limits, audit records, and restricted logs. No internet service can promise absolute security.",
      "Material changes to this notice require a new effective date and renewed acceptance when appropriate.",
    ],
  },
] as const;

export default function PrivacyPage() {
  return (
    <LegalDocument
      eyebrow="Privacy"
      title="Privacy notice"
      updated="28 July 2026"
      sections={sections}
    />
  );
}
