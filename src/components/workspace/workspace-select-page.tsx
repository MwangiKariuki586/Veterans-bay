"use client";

import {
  ArrowRight,
  BriefcaseBusiness,
  House,
  ShieldCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PublicPageIntro, PublicShell } from "@/components/public/public-shell";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { StatePanel } from "@/components/ui/state-panel";
import { Surface } from "@/components/ui/surface";
import { authClient } from "@/lib/auth-client";
import { workspaceEntryContent } from "@/modules/workspace/presentation";
import type { WorkspaceSummary } from "@/modules/workspace/types";

async function fetchWorkspaces() {
  const response = await fetch("/api/v1/workspaces", { credentials: "include" });
  const body = (await response.json()) as {
    data?: { workspaces: WorkspaceSummary[] };
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
    if (isPending) return;

    if (!session) {
      router.replace("/login");
      return;
    }

    let cancelled = false;

    void fetchWorkspaces()
      .then((data) => {
        if (!cancelled) {
          setWorkspaces(data.workspaces);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Unable to load your roles. Please try again.");
          setLoading(false);
        }
      });

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

  const displayName =
    session?.user?.name?.trim().split(/\s+/)[0] ||
    session?.user?.email?.split("@")[0] ||
    "there";

  return (
    <PublicShell>
      <main>
        <PublicPageIntro
          eyebrow="Welcome back"
          title={`What would you like to do, ${displayName}?`}
          description="Choose a role below and we’ll take you to the right place with the next step already clear."
        />
        <Surface className="mx-auto mt-10 max-w-4xl p-7 sm:p-9">
          {loading ? (
            <StatePanel
              variant="loading"
              title="Preparing your account"
              description="Checking your roles and the next step for each one."
            />
          ) : error ? (
            <InlineAlert
              variant="error"
              title="Unable to prepare your account"
              description={error}
            />
          ) : workspaces.length === 0 ? (
            <StatePanel
              title="No available roles"
              description="No eligible role is available for this account yet."
            />
          ) : (
            <ul
              className={
                workspaces.length > 1
                  ? "grid gap-4 md:grid-cols-2"
                  : "grid gap-4"
              }
            >
              {workspaces.map((workspace) => {
                const content = workspaceEntryContent(workspace);
                const Icon =
                  workspace.kind === "platform"
                    ? ShieldCheck
                    : workspace.kind === "organisation"
                      ? BriefcaseBusiness
                      : House;

                return (
                  <li key={workspace.id} className="h-full">
                    <Button
                      className="h-full min-h-56 w-full items-stretch justify-between rounded-[22px] border-black/8 px-6 py-6 text-left hover:border-[#a9d41a] hover:bg-[#f8fbe9]"
                      variant="outline"
                      loading={selectingId === workspace.id}
                      type="button"
                      onClick={() => void onSelect(workspace)}
                    >
                      <span className="flex min-w-0 flex-1 flex-col items-start whitespace-normal">
                        <span className="grid size-11 place-items-center rounded-full bg-[#eef7c8] text-[#5f8d11]">
                          <Icon className="size-5" aria-hidden="true" />
                        </span>
                        <span className="mt-5 block text-xs font-bold tracking-[0.12em] text-[#5f8d11] uppercase">
                          {content.eyebrow}
                        </span>
                        <span className="mt-2 block text-lg font-bold text-foreground">
                          {content.title}
                        </span>
                        <span className="mt-2 block max-w-sm text-sm leading-6 font-normal text-[#68717b]">
                          {content.description}
                        </span>
                        <span className="mt-auto pt-5 text-sm font-bold text-foreground">
                          {content.action}
                        </span>
                      </span>
                      <span className="mt-auto grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                        <ArrowRight className="size-[1.1rem]" aria-hidden="true" />
                      </span>
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </Surface>
      </main>
    </PublicShell>
  );
}
