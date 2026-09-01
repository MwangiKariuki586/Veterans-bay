"use client";

import { Menu } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  Fragment,
  type ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { pageBackdropSurfaceClass } from "@/components/public/design";
import { SiteHeader } from "@/components/public/site-header";
import { AuthenticatedFooter } from "@/components/workspace/authenticated-footer";
import {
  WorkspaceChromeProvider,
  useWorkspaceChrome,
} from "@/components/workspace/workspace-chrome";
import type { AuthenticatedShellKind } from "@/components/workspace/workspace-nav";
import { WorkspaceSidebar } from "@/components/workspace/workspace-sidebar";
import { ClientDashboardProvider } from "@/components/workspace/client-dashboard-context";
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
import { authClient } from "@/lib/auth-client";
import { loginHrefFor, pathWithSearch } from "@/lib/auth-redirect";
import {
  clearAllClientResourceCaches,
  getCachedResource,
  setCachedResource,
} from "@/lib/client-resource-cache";
import {
  getCurrentWorkspace,
  listAvailableWorkspaces,
  selectWorkspace,
  WorkspaceEntryError,
} from "@/lib/workspace-entry";

export type { AuthenticatedShellKind };

const WORKSPACE_CACHE_NS = "workspace-shell";
const WORKSPACE_CACHE_TTL_MS = 5 * 60_000;

const WorkspaceShellContext = createContext({
  workspaceLabel: "Workspace",
});

export function useWorkspaceShell() {
  return useContext(WorkspaceShellContext);
}

function cachedLabelFor(kind: AuthenticatedShellKind) {
  return getCachedResource<string>(WORKSPACE_CACHE_NS, kind, WORKSPACE_CACHE_TTL_MS);
}

function matchesShellKind(
  kind: AuthenticatedShellKind,
  workspace: { kind: "client" | "organisation" | "platform" },
) {
  if (kind === "client") return workspace.kind === "client";
  if (kind === "professional") return workspace.kind === "organisation";
  return workspace.kind === "platform";
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
  const pathname = usePathname();
  const scrollContainerRef = useRef<HTMLElement>(null);
  const previousPathnameRef = useRef(pathname);
  const { data: session, isPending } = authClient.useSession();
  const cachedLabel = cachedLabelFor(kind);
  const [workspaceLabel, setWorkspaceLabel] = useState<string>(
    cachedLabel ?? "Workspace",
  );
  const [error, setError] = useState<string | null>(null);
  const [workspaceRevision, setWorkspaceRevision] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const sessionUserId = session?.user.id;

  useLayoutEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const previousRootOverflow = root.style.overflow;
    const previousBodyOverflow = body.style.overflow;

    root.style.overflow = "hidden";
    body.style.overflow = "hidden";
    root.scrollTop = 0;
    body.scrollTop = 0;

    return () => {
      root.style.overflow = previousRootOverflow;
      body.style.overflow = previousBodyOverflow;
    };
  }, []);

  useLayoutEffect(() => {
    if (previousPathnameRef.current === pathname) return;

    previousPathnameRef.current = pathname;
    if (!window.location.hash && scrollContainerRef.current) {
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [pathname]);

  useEffect(() => {
    if (isPending) {
      return;
    }

    if (!session) {
      clearAllClientResourceCaches();
      router.replace(
        loginHrefFor(pathWithSearch(pathname, window.location.search)),
      );
    }
  }, [isPending, pathname, router, session]);

  useEffect(() => {
    if (isPending || !sessionUserId) return;

    const controller = new AbortController();

    async function recoverWorkspace() {
      const workspaces = await listAvailableWorkspaces(controller.signal);
      const matching = workspaces.find((item) => matchesShellKind(kind, item));

      if (!matching) {
        if (kind === "professional") {
          router.replace("/professional/onboarding");
          return;
        }

        setError(
          kind === "admin"
            ? "You do not have administrator access."
            : "A client workspace is not available for this account.",
        );
        return;
      }

      const selected = await selectWorkspace(matching.id, controller.signal);
      setWorkspaceLabel(selected.label);
      setCachedResource(WORKSPACE_CACHE_NS, kind, selected.label);
      setError(null);
      setWorkspaceRevision((revision) => revision + 1);
    }

    async function bootstrapWorkspace() {
      try {
        const current = await getCurrentWorkspace(controller.signal);
        if (!matchesShellKind(kind, current)) {
          await recoverWorkspace();
          return;
        }

        setWorkspaceLabel(current.label);
        setCachedResource(WORKSPACE_CACHE_NS, kind, current.label);
        setError(null);
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        if (cause instanceof WorkspaceEntryError && cause.status === 401) {
          router.replace(
            loginHrefFor(
              pathWithSearch(window.location.pathname, window.location.search),
            ),
          );
          return;
        }

        try {
          await recoverWorkspace();
        } catch (recoveryCause) {
          if (
            recoveryCause instanceof DOMException &&
            recoveryCause.name === "AbortError"
          ) {
            return;
          }
          setError("Unable to resolve workspace access.");
        }
      }
    }

    void bootstrapWorkspace();
    return () => controller.abort();
  }, [isPending, kind, router, sessionUserId]);

  const shell = (
    <WorkspaceShellContext.Provider value={{ workspaceLabel }}>
      <div className="shrink-0 border-b border-black/8 px-4 py-3 sm:px-6 lg:h-[92px] lg:px-6 lg:py-[18px]">
        <SiteHeader
          variant="workspace"
          workspaceContext={{ kind, label: workspaceLabel }}
        />
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
        <main
          ref={scrollContainerRef}
          className="min-h-0 min-w-0 overflow-x-clip overflow-y-auto bg-[#f8fafb] p-3 sm:p-5 lg:p-6"
        >
          {error ? (
            <InlineAlert
              variant="error"
              title="Workspace unavailable"
              description={error}
            />
          ) : (
            <WorkspaceChromeProvider key={workspaceRevision}>
              <div className="flex min-h-full flex-col gap-6">
                <div>
                  {!hideIntro ? (
                    <div className="mb-6">
                      <p className="inline-flex items-center gap-2 rounded-full border border-black/7 bg-white px-4 py-2 type-caption text-[#626b75]">
                        Authenticated workspace
                      </p>
                      <h1 className="mt-5 type-public-title">{title}</h1>
                      {description ? (
                        <p className="mt-4 max-w-2xl text-base leading-7 text-[#68717b]">
                          {description}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  {children}
                </div>
                <WorkspaceFooter />
              </div>
            </WorkspaceChromeProvider>
          )}
        </main>
      </div>
    </WorkspaceShellContext.Provider>
  );

  const content = kind === "professional" ? (
    <ProfessionalDashboardProvider key={workspaceRevision} enabled={!isPending && Boolean(sessionUserId)}>
      {shell}
    </ProfessionalDashboardProvider>
  ) : kind === "client" ? (
    <ClientDashboardProvider key={workspaceRevision} enabled={!isPending && Boolean(sessionUserId)}>
      {shell}
    </ClientDashboardProvider>
  ) : (
    <Fragment key={workspaceRevision}>{shell}</Fragment>
  );

  return (
    <div className={`${pageBackdropSurfaceClass} fixed inset-0 overflow-hidden`}>
      <div className="mx-auto flex h-full w-full max-w-[1600px] flex-col overflow-hidden bg-white">
        {content}
      </div>
    </div>
  );
}

function WorkspaceFooter() {
  const { contentReady } = useWorkspaceChrome();
  if (!contentReady) {
    return null;
  }
  return <AuthenticatedFooter className="mt-auto" />;
}

function WorkspaceMenu({
  kind,
  workspaceLabel,
  open,
  onOpenChange,
}: {
  kind: AuthenticatedShellKind;
  workspaceLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          className="h-11 rounded-xl border-black/8 px-4"
          aria-label="Open workspace menu"
        >
          <Menu className="size-5" aria-hidden="true" />
          Menu
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
  );
}
