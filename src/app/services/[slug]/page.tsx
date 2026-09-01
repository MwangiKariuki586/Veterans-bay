import { PublicServicePage } from "@/components/professional-services/public-catalogue-pages";
import { PublicShell } from "@/components/public/public-shell";

export default async function ServiceDetailRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <PublicShell marketplace>
      <main>
        <PublicServicePage slug={slug} />
      </main>
    </PublicShell>
  );
}
