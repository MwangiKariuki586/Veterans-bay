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

export type TeamAvailabilityStatus = "available" | "on_job" | "unavailable";

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
  availabilityStatus: TeamAvailabilityStatus;
  availabilityLabel: string;
  availabilityDetail: string | null;
  activeJobs: number;
  bookingsToday: number;
}

export interface TeamRecentAssignment {
  id: string;
  bookingId: string | null;
  serviceName: string;
  status: string;
  scheduledAt: string | null;
  displayLabel: string;
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
  recentAssignments: TeamRecentAssignment[];
  permissions: string[];
}

export interface TeamRoleSummary {
  key: TeamRoleKey;
  label: string;
  description: string | null;
  memberCount: number;
  permissions: string[];
}

export interface TeamRolesOverview {
  roles: TeamRoleSummary[];
}

export interface TeamOverview {
  members: TeamMemberSummary[];
  invitations: TeamInvitationSummary[];
  canManage: boolean;
}

export type TeamMemberSort = "name_asc" | "name_desc" | "joined_desc" | "joined_asc" | "updated_desc" | "updated_asc";
export type TeamInvitationSort = "created_desc" | "created_asc" | "expires_desc" | "expires_asc";

export interface TeamMemberPage {
  items: TeamMemberSummary[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface TeamInvitationPage {
  items: TeamInvitationSummary[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export type TeamMemberListQuery = {
  page: number;
  pageSize: number;
  search?: string;
  role?: TeamRoleKey;
  status?: TeamMemberStatus;
  availability?: TeamAvailabilityStatus;
  sort: TeamMemberSort;
};

export type TeamInvitationListQuery = {
  page: number;
  pageSize: number;
  search?: string;
  status?: TeamInvitationStatus;
  sort: TeamInvitationSort;
};
