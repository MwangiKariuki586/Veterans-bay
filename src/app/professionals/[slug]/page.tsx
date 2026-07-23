import { PublicProfessionalPage } from "@/components/professional-services/public-catalogue-pages";
import { PublicShell } from "@/components/public/public-shell";

export default async function ProfessionalProfileRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <PublicShell>
      <main>
        <PublicProfessionalPage slug={slug} />
      </main>
    </PublicShell>
  );
}
