import { ClientSavedProfessionalsPage } from "@/components/workspace/client-saved-professionals-page";
import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";

export default function ClientSavedProfessionalsRoute() {
  return (
    <AuthenticatedShell
      kind="client"
      title="Saved professionals"
      description="Return to professionals you trust."
      hideIntro
    >
      <ClientSavedProfessionalsPage />
    </AuthenticatedShell>
  );
}
