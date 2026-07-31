import { AdminDashboard } from "@/components/workspace/admin-dashboard";
import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";

export default function AdminAnalyticsPage() {
  return (
    <AuthenticatedShell
      kind="admin"
      title="Platform analytics"
      description="Bounded marketplace engagement and completion reporting."
      hideIntro
    >
      <AdminDashboard />
    </AuthenticatedShell>
  );
}
