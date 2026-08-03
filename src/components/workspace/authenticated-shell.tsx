"use client";

import { Menu } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";

import {
  pageBackdropClass,
  pageFrameClass,
} from "@/components/public/design";
import { SiteHeader } from "@/components/public/site-header";
import { AuthenticatedFooter } from "@/components/workspace/authenticated-footer";
import {
  WorkspaceChromeProvider,
  useWorkspaceChrome,
} from "@/components/workspace/workspace-chrome";
import type { AuthenticatedShellKind } from "@/components/workspace/workspace-nav";
import { WorkspaceSidebar } from "@/components/workspace/workspace-sidebar";
import { ProfessionalDashboardProvider } from "@/components/workspace/professional-dashboard-context";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Surface } from "@/components/ui/surface";
import { WorkspaceMainSkeleton } from "@/components/ui/workspace-skeletons";
import { authClient } from "@/lib/auth-client";
import {
  clearAllClientResourceCaches,
  getCachedResource,
  setCachedResource,
} from "@/lib/client-resource-cache";
import type { WorkspaceSummary } from "@/modules/workspace/types";

export type { AuthenticatedShellKind };

const WORKSPACE_CACHE_NS = "workspace-shell";
const WORKSPACE_CACHE_TTL_MS = 5 * 60_000;

const WorkspaceShellContext = createContext({
  workspaceLabel: "Workspace",
});

export function useWorkspaceShell() {
  return useContext(WorkspaceShellContext);
}

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

function cachedLabelFor(kind: AuthenticatedShellKind) {
  return getCachedResource<string>(WORKSPACE_CACHE_NS, kind, WORKSPACE_CACHE_TTL_MS);
}

export function AuthenticatedShell({
  kind,
  title = "Workspace",
  description = "",
  children,
  hideIntro = false,
}: {
  kind: AuthenticatedShellKind;
  title?: string;
  description?: string;
  children: ReactNode;
  hideIntro?: boolean;
}) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const cachedLabel = cachedLabelFor(kind);
  const [workspaceLabel, setWorkspaceLabel] = useState<string>(
    cachedLabel ?? "Workspace",
  );
  const [ready, setReady] = useState(Boolean(cachedLabel));
  const [error, setError] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (isPending) {
      return;
    }

    if (!session) {
      clearAllClientResourceCaches();
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
          setCachedResource(WORKSPACE_CACHE_NS, kind, matching.label);
          await fetch("/api/v1/workspaces/select", {
            method: "POST",
            credentials: "include",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ workspaceId: matching.id }),
          });
        } else if (data.workspaces[0]) {
          setWorkspaceLabel(data.workspaces[0].label);
          setCachedResource(WORKSPACE_CACHE_NS, kind, data.workspaces[0].label);
        }

        setError(null);
        setReady(true);
      })
      .catch(() => {
        setError("Unable to resolve workspace access.");
        setReady(true);
      });
  }, [isPending, kind, router, session]);

  if (kind === "professional") {
    return (
      <div className={`${pageBackdropClass} h-dvh max-h-dvh overflow-hidden`}>
        <div className="mx-auto flex h-full w-full max-w-[1600px] flex-col overflow-hidden bg-white">
          <ProfessionalDashboardProvider enabled={ready}>
            <WorkspaceShellContext.Provider value={{ workspaceLabel }}>
              <div className="shrink-0 border-b border-black/8 px-4 py-3 sm:px-6 lg:h-[92px] lg:px-6 lg:py-[18px]">
                <SiteHeader workspaceContext={{ kind, label: workspaceLabel }} />
              </div>
              <div className="flex shrink-0 items-center justify-end border-b border-black/8 bg-white px-4 py-2 lg:hidden">
                <WorkspaceMenu
                  kind={kind}
                  workspaceLabel={workspaceLabel}
                  open={mobileOpen}
                  onOpenChange={setMobileOpen}
                />
              </div>
              <div className="grid min-h-0 flex-1 lg:grid-cols-[228px_minmax(0,1fr)]">
                <WorkspaceSidebar
                  kind={kind}
                  workspaceLabel={workspaceLabel}
                  className="hidden min-h-0 overflow-hidden rounded-none border-y-0 border-l-0 shadow-none lg:flex"
                />
                <main className="min-h-0 min-w-0 overflow-x-clip overflow-y-auto bg-[#f8fafb] p-3 sm:p-5 lg:p-6">
                  {!ready ? (
                    <WorkspaceMainSkeleton />
                  ) : error ? (
                    <InlineAlert
                      variant="error"
                      title="Workspace unavailable"
                      description={error}
                    />
                  ) : (
                    <WorkspaceChromeProvider>
                      {children}
                      <WorkspaceFooter kind={kind} />
                    </WorkspaceChromeProvider>
                  )}
                </main>
              </div>
            </WorkspaceShellContext.Provider>
          </ProfessionalDashboardProvider>
        </div>
      </div>
    );
  }

  return (
    <div className={pageBackdropClass}>
      <div className={pageFrameClass()}>
        <SiteHeader />
        <div className="mt-4 mb-4 flex items-center justify-end lg:hidden">
          <WorkspaceMenu kind={kind} workspaceLabel={workspaceLabel} open={mobileOpen} onOpenChange={setMobileOpen} />
        </div>
        <div className="grid gap-5 lg:mt-5 lg:grid-cols-[272px_minmax(0,1fr)] lg:items-start">
          <WorkspaceSidebar kind={kind} workspaceLabel={workspaceLabel} className="sticky top-6 hidden max-h-[calc(100vh-3rem)] lg:flex" />
          <main className="min-w-0">
            <Surface className={hideIntro ? "overflow-hidden p-5 sm:p-7" : "overflow-hidden p-7 sm:p-9"}>
              {!hideIntro ? <><p className="inline-flex items-center gap-2 rounded-full border border-black/7 bg-[#f7f9fa] px-4 py-2 type-caption text-[#626b75]">Authenticated workspace</p><h1 className="mt-5 type-public-title">{title}</h1><p className="mt-4 max-w-2xl text-base leading-7 text-[#68717b]">{description}</p></> : null}
              <div className={hideIntro ? undefined : "mt-8"}>{!ready ? <WorkspaceMainSkeleton /> : error ? <InlineAlert variant="error" title="Workspace unavailable" description={error} /> : children}</div>
            </Surface>
          </main>
        </div>
        <AuthenticatedFooter kind={kind} />
      </div>
    </div>
  );
}

function WorkspaceFooter({ kind }: { kind: AuthenticatedShellKind }) {
  const { contentReady } = useWorkspaceChrome();
  if (!contentReady) {
    return null;
  }
  return <AuthenticatedFooter kind={kind} />;
}

function WorkspaceMenu({ kind, workspaceLabel, open, onOpenChange }: { kind: AuthenticatedShellKind; workspaceLabel: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  return <Sheet open={open} onOpenChange={onOpenChange}><SheetTrigger asChild><Button variant="outline" className="h-11 rounded-xl border-black/8 px-4" aria-label="Open workspace menu"><Menu className="size-5" aria-hidden="true" />Menu</Button></SheetTrigger><SheetContent side="left" className="w-[min(100%,20rem)] border-r border-black/8 bg-[#f7f9fa] p-0" aria-describedby="workspace-menu-description"><SheetTitle className="sr-only">Workspace navigation</SheetTitle><SheetDescription id="workspace-menu-description" className="sr-only">Switch workspace and open app destinations.</SheetDescription><WorkspaceSidebar kind={kind} workspaceLabel={workspaceLabel} className="h-full rounded-none border-0" /></SheetContent></Sheet>;
}
