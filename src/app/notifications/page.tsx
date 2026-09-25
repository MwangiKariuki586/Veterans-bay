import { cookies } from "next/headers";
import { Suspense } from "react";

import { NotificationCenter } from "@/components/notifications/notification-center";
import { ListPageSkeleton } from "@/components/ui/workspace-skeletons";
import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";

export default async function NotificationsPage() {
  const workspaceId = (await cookies()).get("vb_workspace")?.value ?? "";
  const kind = workspaceId.startsWith("organisation:")
    ? "professional"
    : workspaceId.startsWith("platform:")
      ? "admin"
      : "client";
  return (
    <AuthenticatedShell
      kind={kind}
      title="Notifications"
      description="Important account activity."
      hideIntro
    >
      <Suspense
        fallback={
          <div className="mx-auto w-full max-w-[1370px] pb-3">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-[#6b9f16]">Account activity</p>
                <h1 className="mt-1 text-[1.75rem] font-semibold leading-tight tracking-title sm:text-[2rem]">
                  Notifications
                </h1>
                <p className="mt-1.5 max-w-2xl text-[0.78rem] text-muted-foreground">
                  Important request, quotation, conversation, and booking activity appears here.
                </p>
              </div>
            </div>
            <ListPageSkeleton className="mt-4" />
          </div>
        }
      >
        <NotificationCenter />
      </Suspense>
    </AuthenticatedShell>
  );
}
