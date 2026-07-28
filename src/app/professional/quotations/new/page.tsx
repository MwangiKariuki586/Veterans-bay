import { QuotationEditor } from "@/components/quotations/quotation-editor";
import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";

export default async function NewProfessionalQuotationPage({
  searchParams,
}: {
  searchParams: Promise<{ requestId?: string }>;
}) {
  const { requestId } = await searchParams;
  return (
    <AuthenticatedShell
      kind="professional"
      title="Prepare quotation"
      description="Define formal scope, pricing, timing, warranty, and payment terms."
      hideIntro
    >
      <QuotationEditor requestId={requestId} mode="create" />
    </AuthenticatedShell>
  );
}
