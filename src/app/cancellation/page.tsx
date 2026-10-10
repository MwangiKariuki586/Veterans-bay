import { LegalDocument } from "@/components/public/legal-document";

const sections = [
  {
    title: "Talk first",
    paragraphs: [
      "Most changes are cheaper than cancellations. Message your professional about a new date, a smaller scope, or a concern before cancelling — rescheduling and revisions keep your history intact and avoid starting over.",
    ],
  },
  {
    title: "Requests and quotations",
    paragraphs: [
      "Draft requests can still be edited. A submitted request can be updated while it is still open. Quotations can be revised by the professional at your request, declined by you with an optional reason, or left to expire — expired quotations cannot be accepted afterward.",
    ],
  },
  {
    title: "Bookings and jobs",
    paragraphs: [
      "Bookings are scheduled against the professional's real availability, so choose a new slot as early as you can when plans change. Once work has started, extra work or scope changes require an explicit additional-work approval before they become part of the job.",
      "You confirm completion when the work is actually done. If it is not right, report the unresolved issue instead of confirming — confirmation closes the fulfilment record.",
    ],
  },
  {
    title: "After completion",
    paragraphs: [
      "Eligible work carries a warranty you can claim if something fails within its terms. Where a warranty does not apply and the issue stays unresolved, submit a dispute through the Help Center so a platform operator can review the recorded engagement.",
    ],
  },
  {
    title: "What stays on record",
    paragraphs: [
      "Cancellations, revisions, variations, completions, payment records, warranty claims, and disputes remain attached to the engagement as status history. Records are never silently rewritten, so both sides keep the same evidence of what was agreed and what changed.",
    ],
  },
] as const;

export default function CancellationPage() {
  return (
    <LegalDocument
      eyebrow="Cancellation"
      title="Changes and cancellation"
      updated="10 October 2026"
      sections={sections}
    />
  );
}
