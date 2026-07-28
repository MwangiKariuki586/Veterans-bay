import { cookies } from "next/headers";

import { NotificationCenter } from "@/components/notifications/notification-center";
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
      <NotificationCenter />
    </AuthenticatedShell>
  );
}
