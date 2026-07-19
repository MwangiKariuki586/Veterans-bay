import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";
import { AdminDashboard } from "@/components/workspace/admin-dashboard";

export default function AdminWorkspacePage() {
  return (
    <AuthenticatedShell
      kind="admin"
      title="Overview"
      description="Platform administration overview."
      hideIntro
    >
      <AdminDashboard />
    </AuthenticatedShell>
  );
}
