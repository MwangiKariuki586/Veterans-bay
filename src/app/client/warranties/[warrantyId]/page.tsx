import { redirect } from "next/navigation";

export default async function ClientWarrantyDetailPage({
  params,
}: {
  params: Promise<{ warrantyId: string }>;
}) {
  const { warrantyId } = await params;
  redirect(`/client/warranties?warrantyId=${encodeURIComponent(warrantyId)}`);
}
