import { LegalDocument } from "@/components/public/legal-document";

const sections = [
  {
    title: "Browsing is free",
    paragraphs: [
      "Discovering professionals, browsing published services, and sending a service request on Veterans Bay is free for clients. There are no browsing fees and no charges for comparing quotations.",
    ],
  },
  {
    title: "How professionals charge",
    paragraphs: [
      "Each professional sets their own prices, shown on their published services before you request anything. You may see fixed prices, starting-from prices, hourly or daily rates, or services priced by custom quotation.",
      "The quotation is the agreement. Review the line items, quantities, and totals, and accept the current version only when the terms are right. Submitted quotation versions and accepted terms are preserved.",
    ],
  },
  {
    title: "Changes to agreed prices",
    paragraphs: [
      "Prices cannot change silently. Any change after acceptance requires an explicit revision or an additional-work variation that you approve. If an invoice does not match the accepted terms, raise it with the professional or through the Help Center before confirming completion.",
    ],
  },
  {
    title: "How payments work in the MVP",
    paragraphs: [
      "Veterans Bay records manual payment information but does not process M-Pesa, cards, payouts, subscriptions, or commissions in the MVP. A payment record is evidence entered by an authorised user and is not a guarantee that funds settled.",
      "Agree the payment method and timing directly with your professional, keep your own transfer confirmations, and check that every record attached to your engagement matches what you actually paid.",
    ],
  },
] as const;

export default function PricingPage() {
  return (
    <LegalDocument
      eyebrow="Pricing"
      title="Pricing and fees"
      updated="10 October 2026"
      sections={sections}
    />
  );
}
