import { WarrantyDetail } from "@/components/warranties/warranty-detail";

export default async function ProfessionalWarrantyDetailPage({
  params,
}: {
  params: Promise<{ warrantyId: string }>;
}) {
  const { warrantyId } = await params;
  return (
    <WarrantyDetail audience="professional" warrantyId={warrantyId} />
  );
}
