import { WorkspaceUnavailablePage } from "@/components/workspace/workspace-unavailable-page";

export default function ClientInvoicesPage() {
  return (
    <WorkspaceUnavailablePage
      kind="client"
      title="Invoices"
      description="Client invoices will arrive with the financial phase."
    />
  );
}
