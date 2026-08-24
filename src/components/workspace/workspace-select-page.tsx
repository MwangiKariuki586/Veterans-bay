"use client";

import { Building2, ShieldCheck, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { PublicShell } from "@/components/public/public-shell";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { StatePanel } from "@/components/ui/state-panel";
import { Surface } from "@/components/ui/surface";
import { authClient } from "@/lib/auth-client";
import { loginHrefFor } from "@/lib/auth-redirect";
import {
  listAvailableWorkspaces,
  selectWorkspace,
} from "@/lib/workspace-entry";
import type { WorkspaceSummary } from "@/modules/workspace/types";

const workspaceIcon = {
  client: UserRound,
  organisation: Building2,
  platform: ShieldCheck,
} as const;

const workspaceDescription = {
  client: "Book services and manage your household work.",
  organisation: "Manage enquiries, jobs, customers, and your team.",
  platform: "Open platform administration and moderation.",
} as const;

export function WorkspaceSelectPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[] | null>(null);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isPending) return;

    if (!session) {
      router.replace(loginHrefFor("/workspace/select"));
      return;
    }

    let cancelled = false;

    void listAvailableWorkspaces()
      .then(async (available) => {
        if (cancelled) return;
        if (available.length === 0) {
          setError("No workspace is available for this account.");
          return;
        }
        if (available.length === 1) {
          const workspace = await selectWorkspace(available[0].id);
          if (cancelled) return;
          router.replace(workspace.href);
          router.refresh();
          return;
        }
        setWorkspaces(available);
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

  async function chooseWorkspace(workspace: WorkspaceSummary) {
    if (selectingId) return;
    setSelectingId(workspace.id);
    setError(null);
    try {
      const selected = await selectWorkspace(workspace.id);
      router.replace(selected.href);
      router.refresh();
    } catch {
      setError("Unable to open that workspace. Please try again.");
      setSelectingId(null);
    }
  }

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
          ) : workspaces ? (
            <div>
              <p className="type-caption font-semibold uppercase tracking-[0.12em] text-[#7cb518]">
                Your workspaces
              </p>
              <h1 className="mt-3 text-2xl font-bold tracking-title text-[#0b1c33]">
                Choose where you want to continue
              </h1>
              <p className="mt-2 text-sm leading-6 text-[#68717b]">
                This account has more than one workspace. Your selection can be
                changed later from the account menu.
              </p>
              <div className="mt-6 grid gap-3">
                {workspaces.map((workspace) => {
                  const Icon = workspaceIcon[workspace.kind];
                  return (
                    <Button
                      key={workspace.id}
                      type="button"
                      variant="outline"
                      className="h-auto justify-start gap-4 rounded-2xl border-black/8 p-4 text-left hover:border-[#a8cf2a] hover:bg-[#f8fce9]"
                      loading={selectingId === workspace.id}
                      disabled={Boolean(selectingId)}
                      onClick={() => void chooseWorkspace(workspace)}
                    >
                      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#eef8c8] text-[#5f8d11]">
                        <Icon className="size-5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-semibold text-[#0b1c33]">
                          {workspace.label}
                        </span>
                        <span className="mt-1 block whitespace-normal text-xs font-normal leading-5 text-[#68717b]">
                          {workspaceDescription[workspace.kind]}
                        </span>
                      </span>
                    </Button>
                  );
                })}
              </div>
            </div>
          ) : (
            <StatePanel
              variant="loading"
              title="Checking your workspaces"
              description="Finding the destinations available to your account."
            />
          )}
        </Surface>
      </main>
    </PublicShell>
  );
}
