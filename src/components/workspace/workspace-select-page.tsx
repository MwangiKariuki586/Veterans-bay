"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { PublicShell } from "@/components/public/public-shell";
import { InlineAlert } from "@/components/ui/inline-alert";
import { StatePanel } from "@/components/ui/state-panel";
import { Surface } from "@/components/ui/surface";
import { authClient } from "@/lib/auth-client";
import { enterPrimaryWorkspace } from "@/lib/workspace-entry";

export function WorkspaceSelectPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isPending) return;

    if (!session) {
      router.replace("/login");
      return;
    }

    let cancelled = false;

    void enterPrimaryWorkspace()
      .then((workspace) => {
        if (cancelled) return;
        router.replace(workspace.href);
        router.refresh();
      })
      .catch(() => {
        if (!cancelled) {
          setError("Unable to open your workspace. Please try again.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isPending, router, session]);

  return (
    <PublicShell>
      <main>
        <Surface className="mx-auto mt-10 max-w-2xl p-7 sm:p-9">
          {error ? (
            <InlineAlert
              variant="error"
              title="Unable to open your workspace"
              description={error}
            />
          ) : (
            <StatePanel
              variant="loading"
              title="Opening your workspace"
              description="Taking you to your dashboard."
            />
          )}
        </Surface>
      </main>
    </PublicShell>
  );
}
