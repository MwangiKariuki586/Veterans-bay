export type WorkspaceKind = "client" | "organisation" | "platform";

export interface WorkspaceSummary {
  id: string;
  kind: WorkspaceKind;
  label: string;
  href: string;
  organisationId: string | null;
  membershipId: string | null;
  roleKey: string | null;
  permissions: string[];
}

export interface WorkspaceSelection {
  workspace: WorkspaceSummary;
  accountProfileId: string;
  authUserId: string;
}

export function buildClientWorkspaceId(accountProfileId: string): string {
  return `client:${accountProfileId}`;
}

export function buildOrganisationWorkspaceId(organisationId: string): string {
  return `organisation:${organisationId}`;
}

export function buildPlatformWorkspaceId(): string {
  return "platform:admin";
}

export function parseWorkspaceId(workspaceId: string): {
  kind: WorkspaceKind;
  referenceId: string;
} | null {
  const [kind, ...rest] = workspaceId.split(":");
  const referenceId = rest.join(":");

  if (!referenceId) {
    return null;
  }

  if (kind === "client" || kind === "organisation" || kind === "platform") {
    return { kind, referenceId };
  }

  return null;
}
