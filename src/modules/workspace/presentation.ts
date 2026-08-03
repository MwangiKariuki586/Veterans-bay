import type { WorkspaceSummary } from "./types";

export interface WorkspaceEntryContent {
  eyebrow: string;
  title: string;
  description: string;
  action: string;
}

function humaniseRole(roleKey: string | null) {
  if (!roleKey) return null;
  return roleKey.replaceAll("_", " ");
}

export function workspaceEntryContent(
  workspace: WorkspaceSummary,
): WorkspaceEntryContent {
  if (workspace.kind === "platform") {
    return {
      eyebrow: "Platform administrator",
      title: "Manage Veterans Bay",
      description:
        "Review professionals, oversee marketplace activity, and manage platform operations.",
      action: "Open administration",
    };
  }

  if (workspace.kind === "organisation") {
    if (workspace.organisationStatus === "pending_review") {
      return {
        eyebrow: "Professional application",
        title: `${workspace.label} is under review`,
        description:
          "Your application has been submitted. Check its status while a platform administrator reviews it.",
        action: "View application status",
      };
    }

    if (workspace.organisationStatus === "requires_changes") {
      return {
        eyebrow: "Professional application",
        title: `Update ${workspace.label}`,
        description:
          "Your application needs changes before it can be approved. Review the feedback and resubmit it.",
        action: "Update application",
      };
    }

    if (workspace.organisationStatus === "draft") {
      return {
        eyebrow: "Professional setup",
        title: `Finish setting up ${workspace.label}`,
        description:
          "Complete your business details, service area, identity evidence, and review submission.",
        action: "Continue setup",
      };
    }

    const role = humaniseRole(workspace.roleKey);
    return {
      eyebrow: role ? `Professional ${role}` : "Professional workspace",
      title: `Run ${workspace.label}`,
      description:
        "Manage enquiries, customers, bookings, jobs, services, and your professional profile.",
      action: "Open professional workspace",
    };
  }

  return {
    eyebrow: "Client",
    title: "Hire trusted professionals",
    description:
      "Discover services, request quotes, manage bookings, and keep track of work on your home.",
    action: "Open client workspace",
  };
}
