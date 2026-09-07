import { Suspense } from "react";

import { ClientSavedProfessionalsPage } from "@/components/workspace/client-saved-professionals-page";

export default function ClientSavedProfessionalsRoute() {
  return (
    <Suspense fallback={null}>
      <ClientSavedProfessionalsPage />
    </Suspense>
  );
}
