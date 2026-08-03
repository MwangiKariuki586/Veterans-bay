import { QuotationEditor } from "@/components/quotations/quotation-editor";

export default async function NewProfessionalQuotationPage({
  searchParams,
}: {
  searchParams: Promise<{ requestId?: string }>;
}) {
  const { requestId } = await searchParams;
  return (
    <QuotationEditor requestId={requestId} mode="create" />
  );
}
