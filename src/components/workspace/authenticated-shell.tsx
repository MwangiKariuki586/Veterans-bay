"use client";

import { Menu } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import {
  pageBackdropClass,
  pageFrameClass,
} from "@/components/public/design";
import { SiteHeader } from "@/components/public/site-header";
import { AuthenticatedFooter } from "@/components/workspace/authenticated-footer";
import type { AuthenticatedShellKind } from "@/components/workspace/workspace-nav";
import { WorkspaceSidebar } from "@/components/workspace/workspace-sidebar";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { StatePanel } from "@/components/ui/state-panel";
import { Surface } from "@/components/ui/surface";
import { authClient } from "@/lib/auth-client";
import type { WorkspaceSummary } from "@/modules/workspace/types";

export type { AuthenticatedShellKind };

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

export function AuthenticatedShell({
  kind,
  title,
  description,
  children,
  hideIntro = false,
}: {
  kind: AuthenticatedShellKind;
  title: string;
  description: string;
  children: ReactNode;
  hideIntro?: boolean;
}) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [workspaceLabel, setWorkspaceLabel] = useState<string>("Workspace");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (isPending) {
      return;
    }

    if (!session) {
      router.replace("/login");
      return;
    }

    void fetchWorkspaces()
      .then(async (data) => {
        const matching = data.workspaces.find((item) => {
          if (kind === "client") {
            return item.kind === "client";
          }
          if (kind === "professional") {
            return item.kind === "organisation";
          }
          return item.kind === "platform";
        });

        if (!matching && kind !== "client") {
          router.replace("/workspace/select");
          return;
        }

        if (matching) {
          setWorkspaceLabel(matching.label);
          await fetch("/api/v1/workspaces/select", {
            method: "POST",
            credentials: "include",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ workspaceId: matching.id }),
          });
        } else if (data.workspaces[0]) {
          setWorkspaceLabel(data.workspaces[0].label);
        }

        setReady(true);
      })
      .catch(() => {
        setError("Unable to resolve workspace access.");
        setReady(true);
      });
  }, [isPending, kind, router, session]);

  return (
    <div className={pageBackdropClass}>
      <div className={pageFrameClass()}>
        <SiteHeader />

        <div className="mt-4 mb-4 flex items-center justify-end gap-3 lg:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                className="h-11 rounded-full border-black/8 px-4"
                aria-label="Open workspace menu"
              >
                <Menu className="size-5" aria-hidden="true" />
                Workspace menu
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-[min(100%,20rem)] border-r border-black/8 bg-[#f7f9fa] p-0"
              aria-describedby="workspace-menu-description"
            >
              <SheetTitle className="sr-only">Workspace navigation</SheetTitle>
              <SheetDescription id="workspace-menu-description" className="sr-only">
                Switch workspace and open app destinations.
              </SheetDescription>
              <WorkspaceSidebar
                kind={kind}
                workspaceLabel={workspaceLabel}
                className="h-full rounded-none border-0"
              />
            </SheetContent>
          </Sheet>
        </div>

        <div className="grid gap-5 lg:mt-5 lg:grid-cols-[272px_minmax(0,1fr)] lg:items-start">
          <WorkspaceSidebar
            kind={kind}
            workspaceLabel={workspaceLabel}
            className="sticky top-6 hidden max-h-[calc(100vh-3rem)] lg:flex"
          />

          <main className="min-w-0">
            <Surface
              className={
                hideIntro
                  ? "overflow-hidden p-5 sm:p-7"
                  : "overflow-hidden p-7 sm:p-9"
              }
            >
              {!hideIntro ? (
                <>
                  <p className="inline-flex items-center gap-2 rounded-full border border-black/7 bg-[#f7f9fa] px-4 py-2 text-[0.78rem] text-[#626b75]">
                    Authenticated workspace
                  </p>
                  <h1 className="mt-5 text-3xl font-bold tracking-[-0.045em] sm:text-4xl">
                    {title}
                  </h1>
                  <p className="mt-4 max-w-2xl text-base leading-7 text-[#68717b]">
                    {description}
                  </p>
                </>
              ) : null}
              <div className={hideIntro ? undefined : "mt-8"}>
                {!ready ? (
                  <StatePanel
                    variant="loading"
                    title="Loading workspace"
                    description="Resolving your session and eligible workspace access."
                  />
                ) : error ? (
                  <InlineAlert
                    variant="error"
                    title="Workspace unavailable"
                    description={error}
                  />
                ) : (
                  children
                )}
              </div>
            </Surface>
          </main>
        </div>

        <AuthenticatedFooter kind={kind} />
      </div>
    </div>
  );
}
