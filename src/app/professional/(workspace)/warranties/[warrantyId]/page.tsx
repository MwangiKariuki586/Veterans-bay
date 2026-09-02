import { redirect } from "next/navigation";

export default async function ProfessionalWarrantyDetailPage({
  params,
}: {
  params: Promise<{ warrantyId: string }>;
}) {
  const { warrantyId } = await params;
  redirect(`/professional/warranties?warrantyId=${encodeURIComponent(warrantyId)}`);
}
