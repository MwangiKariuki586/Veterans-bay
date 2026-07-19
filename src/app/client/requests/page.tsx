import { WorkspaceUnavailablePage } from "@/components/workspace/workspace-unavailable-page";

export default function ClientRequestsPage() {
  return (
    <WorkspaceUnavailablePage
      kind="client"
      title="Your requests"
      description="Client request tracking will arrive with the request workflow."
    />
  );
}
