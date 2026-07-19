"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PublicPageIntro, PublicShell } from "@/components/public/public-shell";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { StatePanel } from "@/components/ui/state-panel";
import { Surface } from "@/components/ui/surface";
import { authClient } from "@/lib/auth-client";
import type { WorkspaceSummary } from "@/modules/workspace/types";

async function fetchWorkspaces() {
  const response = await fetch("/api/v1/workspaces", { credentials: "include" });
  const body = (await response.json()) as {
    data?: { workspaces: WorkspaceSummary[]; defaultWorkspaceId: string | null };
    error?: { code?: string };
  };

  if (!response.ok || !body.data) {
    throw new Error(body.error?.code ?? "WORKSPACES_UNAVAILABLE");
  }

  return body.data;
}

async function selectWorkspaceRequest(workspaceId: string) {
  const response = await fetch("/api/v1/workspaces/select", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ workspaceId }),
  });

  return response.ok;
}

export function WorkspaceSelectPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isPending) {
      return;
    }

    if (!session) {
      router.replace("/login");
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const data = await fetchWorkspaces();
        if (cancelled) {
          return;
        }

        if (data.defaultWorkspaceId) {
          const only = data.workspaces.find(
            (item) => item.id === data.defaultWorkspaceId,
          );
          if (only) {
            const ok = await selectWorkspaceRequest(only.id);
            if (ok) {
              router.replace(only.href);
              return;
            }
          }
        }

        setWorkspaces(data.workspaces);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError("Unable to load eligible workspaces.");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isPending, router, session]);

  async function onSelect(workspace: WorkspaceSummary) {
    setSelectingId(workspace.id);
    const ok = await selectWorkspaceRequest(workspace.id);

    if (!ok) {
      setSelectingId(null);
      toast.error("Unable to open that workspace.");
      return;
    }

    router.push(workspace.href);
    router.refresh();
  }

  return (
    <PublicShell>
      <main>
        <PublicPageIntro
          eyebrow="Workspace"
          title="Choose where to work."
          description="Your identity can operate in client, professional, and platform contexts. Access is resolved from current memberships and assignments."
        />
        <Surface className="mx-auto mt-10 max-w-2xl p-7 sm:p-9">
          {loading ? (
            <StatePanel
              variant="loading"
              title="Loading workspaces"
              description="Checking memberships and platform assignments."
            />
          ) : error ? (
            <InlineAlert
              variant="error"
              title="Unable to load workspaces"
              description={error}
            />
          ) : workspaces.length === 0 ? (
            <StatePanel
              title="No eligible workspaces"
              description="No eligible workspaces are available for this account yet."
            />
          ) : (
            <ul className="space-y-3">
              {workspaces.map((workspace) => (
                <li key={workspace.id}>
                  <Button
                    className="h-auto w-full justify-between rounded-[18px] border-black/8 px-5 py-4 text-left hover:bg-[#f7f9fa]"
                    variant="outline"
                    loading={selectingId === workspace.id}
                    type="button"
                    onClick={() => void onSelect(workspace)}
                  >
                    <span>
                      <span className="block text-sm font-semibold text-foreground">
                        {workspace.label}
                      </span>
                      <span className="mt-1 block text-xs font-normal text-[#68717b]">
                        {workspace.kind}
                        {workspace.roleKey ? ` · ${workspace.roleKey}` : ""}
                      </span>
                    </span>
                    <span className="grid size-11 place-items-center rounded-full bg-primary text-primary-foreground">
                      <ArrowRight className="size-[1.1rem]" aria-hidden="true" />
                    </span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Surface>
      </main>
    </PublicShell>
  );
}
