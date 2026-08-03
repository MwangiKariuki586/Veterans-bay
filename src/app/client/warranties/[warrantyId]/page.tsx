import { WarrantyDetail } from "@/components/warranties/warranty-detail";

export default async function ClientWarrantyDetailPage({
  params,
}: {
  params: Promise<{ warrantyId: string }>;
}) {
  const { warrantyId } = await params;
  return (
    <WarrantyDetail audience="client" warrantyId={warrantyId} />
  );
}
