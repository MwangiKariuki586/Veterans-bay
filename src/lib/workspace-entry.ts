import type { WorkspaceSummary } from "@/modules/workspace/types";

export async function enterPrimaryWorkspace(): Promise<WorkspaceSummary> {
  const response = await fetch("/api/v1/workspaces/enter", {
    method: "POST",
    credentials: "include",
  });
  const body = (await response.json()) as {
    data?: WorkspaceSummary;
    error?: { code?: string };
  };

  if (!response.ok || !body.data?.href) {
    throw new Error(body.error?.code ?? "WORKSPACE_UNAVAILABLE");
  }

  return body.data;
}
