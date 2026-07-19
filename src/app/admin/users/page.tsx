import { WorkspaceUnavailablePage } from "@/components/workspace/workspace-unavailable-page";

export default function AdminUsersPage() {
  return (
    <WorkspaceUnavailablePage
      kind="admin"
      title="Users"
      description="Platform user administration will arrive with admin tooling."
    />
  );
}
