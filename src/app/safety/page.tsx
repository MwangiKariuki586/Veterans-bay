import { LegalDocument } from "@/components/public/legal-document";

const sections = [
  {
    title: "Verified reputation",
    paragraphs: [
      "Ratings, completed-job counts, and reviews on Veterans Bay derive from eligible platform-recorded engagements. Only clients with a qualifying completed job can submit a verified review, and reviews cannot be rewritten silently once published.",
      "A professional's public profile shows published services alongside this recorded history, so what you see reflects work that actually happened through the platform.",
    ],
  },
  {
    title: "Who can see what",
    paragraphs: [
      "Access is organisation-scoped and enforced on the server. Professionals see only enquiries and records addressed to their organisation or assigned to them; clients see only their own engagements. There is no public browsing of private records.",
    ],
    items: [
      "Messages and files you upload as request, job, payment, warranty, dispute, or verification evidence stay attached to that engagement.",
      "Private evidence is delivered through authorised, time-limited access rather than public links.",
    ],
  },
  {
    title: "Moderation and disputes",
    paragraphs: [
      "Platform administrators review professional applications, moderate listings and reported content, and resolve disputes. Material decisions require a reason and evidence summary, are audited, and do not silently rewrite transaction history.",
      "If work goes wrong, first message your professional. If the issue stays unresolved, file a warranty claim where one applies, or submit a dispute through the Help Center so a platform operator can review the recorded engagement.",
    ],
  },
  {
    title: "Payments without surprises",
    paragraphs: [
      "Veterans Bay records manual payment information but does not process payments in the MVP. A payment record is evidence entered by an authorised user, not a guarantee that funds settled. Agree amounts in the quotation before work starts, and confirm that invoices match the accepted terms.",
    ],
  },
  {
    title: "Your part in staying safe",
    paragraphs: [
      "Provide accurate requirements, arrange access as agreed, approve changes and extra work explicitly, and confirm completion only when the work is actually done. Report impersonation, misleading listings, manipulated reviews, or abusive content through the Help Center.",
    ],
  },
] as const;

export default function SafetyPage() {
  return (
    <LegalDocument
      eyebrow="Safety & Trust"
      title="Safety and trust standards"
      updated="10 October 2026"
      sections={sections}
    />
  );
}
