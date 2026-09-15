import { redirect } from "next/navigation";

export default async function ClientRequestDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  redirect(`/client/requests?requestId=${encodeURIComponent(requestId)}`);
}
