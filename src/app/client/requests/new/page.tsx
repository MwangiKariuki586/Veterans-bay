import { redirect } from "next/navigation";

export default async function NewClientRequestPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const destination = new URLSearchParams();
  destination.set(
    "editor",
    typeof query.requestId === "string" ? query.requestId : "new",
  );
  const forwarded = [
    ["source", "requestSource"],
    ["category", "requestCategory"],
    ["professional", "requestProfessional"],
    ["service", "requestService"],
  ] as const;
  for (const [sourceKey, destinationKey] of forwarded) {
    const value = query[sourceKey];
    if (typeof value === "string" && value) {
      destination.set(destinationKey, value);
    }
  }
  redirect(`/client/requests?${destination.toString()}`);
}
