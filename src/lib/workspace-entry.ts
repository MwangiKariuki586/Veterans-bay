import type { WorkspaceSummary } from "@/modules/workspace/types";

export class WorkspaceEntryError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
  }
}

export async function getCurrentWorkspace(
  signal?: AbortSignal,
): Promise<WorkspaceSummary> {
  const response = await fetch("/api/v1/workspaces/current", {
    credentials: "include",
    signal,
  });
  const body = (await response.json().catch(() => null)) as {
    data?: WorkspaceSummary;
    error?: { code?: string };
  } | null;

  if (!response.ok || !body?.data) {
    throw new WorkspaceEntryError(
      body?.error?.code ?? "WORKSPACE_UNAVAILABLE",
      response.status,
    );
  }

  return body.data;
}

export async function listAvailableWorkspaces(
  signal?: AbortSignal,
): Promise<WorkspaceSummary[]> {
  const response = await fetch("/api/v1/workspaces", {
    credentials: "include",
    signal,
  });
  const body = (await response.json()) as {
    data?: { workspaces: WorkspaceSummary[] };
    error?: { code?: string };
  };

  if (!response.ok || !body.data) {
    throw new Error(body.error?.code ?? "WORKSPACES_UNAVAILABLE");
  }

  return body.data.workspaces;
}

export async function selectWorkspace(
  workspaceId: string,
  signal?: AbortSignal,
): Promise<WorkspaceSummary> {
  const response = await fetch("/api/v1/workspaces/select", {
    method: "POST",
    credentials: "include",
    signal,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ workspaceId }),
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
