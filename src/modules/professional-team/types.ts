export const teamRoleKeys = [
  "owner",
  "manager",
  "dispatcher",
  "technician",
  "receptionist",
  "accountant",
] as const;

export type TeamRoleKey = (typeof teamRoleKeys)[number];
export type TeamMemberStatus = "active" | "deactivated";
export type TeamInvitationStatus = "pending" | "expired" | "accepted" | "revoked";

export interface TeamMemberSummary {
  id: string;
  accountProfileId: string;
  name: string;
  email: string;
  phone: string | null;
  role: TeamRoleKey;
  status: TeamMemberStatus;
  assignedJobsOnly: boolean;
  financialDataAccess: boolean;
  joinedAt: string;
  updatedAt: string;
}

export interface TeamInvitationSummary {
  id: string;
  email: string;
  role: TeamRoleKey;
  status: TeamInvitationStatus;
  assignedJobsOnly: boolean;
  financialDataAccess: boolean;
  invitedBy: string;
  expiresAt: string;
  createdAt: string;
}

export interface TeamHistoryItem {
  id: string;
  kind: "membership" | "role";
  from: string | null;
  to: string;
  actorName: string | null;
  reason: string | null;
  createdAt: string;
}

export interface TeamMemberDetail extends TeamMemberSummary {
  history: TeamHistoryItem[];
}

export interface TeamOverview {
  members: TeamMemberSummary[];
  invitations: TeamInvitationSummary[];
  canManage: boolean;
}
