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

export type TeamActivity = {
  id: string;
  action: string;
  detail: string;
  occurredAt: string;
};

export type RoleHistoryItem = {
  id: string;
  role: TeamRoleKey;
  changedBy: string;
  changedAt: string;
};

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  initials: string;
  role: TeamRoleKey;
  status: TeamMemberStatus;
  joinedAt: string;
  lastActiveAt: string;
  phone: string;
  financialAccess: boolean;
  assignedJobsOnly: boolean;
  activity: TeamActivity[];
  roleHistory: RoleHistoryItem[];
};

export type TeamInvitation = {
  id: string;
  email: string;
  role: TeamRoleKey;
  status: TeamInvitationStatus;
  invitedBy: string;
  sentAt: string;
  expiresAt: string;
  assignedJobsOnly?: boolean;
  financialAccess?: boolean;
};

export type TeamRoleDefinition = {
  key: TeamRoleKey;
  label: string;
  summary: string;
  permissions: string[];
};

export const teamRoleDefinitions: TeamRoleDefinition[] = [
  {
    key: "owner",
    label: "Owner",
    summary: "Full organisation control, including ownership transfer.",
    permissions: ["All services and jobs", "All financial data", "Team management", "Business settings"],
  },
  {
    key: "manager",
    label: "Manager",
    summary: "Runs daily operations and manages the team without ownership control.",
    permissions: ["Services and enquiries", "Quotes and bookings", "Jobs and customers", "Team management"],
  },
  {
    key: "dispatcher",
    label: "Dispatcher",
    summary: "Coordinates requests, schedules, bookings, and assignments.",
    permissions: ["Enquiries", "Bookings", "Assignments", "Customer contacts"],
  },
  {
    key: "technician",
    label: "Technician",
    summary: "Completes assigned field work with restricted customer access.",
    permissions: ["Assigned jobs", "Job updates", "Assigned customer contacts", "Completion evidence"],
  },
  {
    key: "receptionist",
    label: "Receptionist",
    summary: "Handles incoming enquiries, customers, and appointment coordination.",
    permissions: ["Enquiries", "Customers", "Bookings", "Messages"],
  },
  {
    key: "accountant",
    label: "Accountant",
    summary: "Manages payment records and reports with explicit financial access.",
    permissions: ["Payments", "Invoices", "Financial reports", "Customer balances"],
  },
];

export const teamMembersFixture: TeamMember[] = [
  {
    id: "member-owner",
    name: "Alex Veteran",
    email: "alex@digitalqatalyst.co.ke",
    initials: "AV",
    role: "owner",
    status: "active",
    joinedAt: "20 Jul 2026",
    lastActiveAt: "Active now",
    phone: "+254 700 123 456",
    financialAccess: true,
    assignedJobsOnly: false,
    activity: [
      { id: "activity-1", action: "Created the organisation", detail: "Professional onboarding started.", occurredAt: "20 Jul 2026, 17:57" },
      { id: "activity-2", action: "Updated business details", detail: "Saved the latest onboarding draft.", occurredAt: "20 Jul 2026, 18:12" },
    ],
    roleHistory: [{ id: "role-1", role: "owner", changedBy: "System", changedAt: "20 Jul 2026, 17:57" }],
  },
  {
    id: "member-manager",
    name: "Nadia Kamau",
    email: "nadia@digitalqatalyst.co.ke",
    initials: "NK",
    role: "manager",
    status: "active",
    joinedAt: "12 Jul 2026",
    lastActiveAt: "18 minutes ago",
    phone: "+254 711 204 880",
    financialAccess: false,
    assignedJobsOnly: false,
    activity: [
      { id: "activity-3", action: "Assigned a technician", detail: "Job VB-204 moved to Brian Otieno.", occurredAt: "Today, 09:42" },
      { id: "activity-4", action: "Updated a booking", detail: "Confirmed the client appointment window.", occurredAt: "Yesterday, 16:20" },
    ],
    roleHistory: [{ id: "role-2", role: "manager", changedBy: "Alex Veteran", changedAt: "12 Jul 2026, 11:05" }],
  },
  {
    id: "member-technician",
    name: "Brian Otieno",
    email: "brian@digitalqatalyst.co.ke",
    initials: "BO",
    role: "technician",
    status: "active",
    joinedAt: "15 Jul 2026",
    lastActiveAt: "1 hour ago",
    phone: "+254 722 615 305",
    financialAccess: false,
    assignedJobsOnly: true,
    activity: [
      { id: "activity-5", action: "Completed a site visit", detail: "Uploaded completion evidence for VB-198.", occurredAt: "Yesterday, 14:08" },
    ],
    roleHistory: [{ id: "role-3", role: "technician", changedBy: "Nadia Kamau", changedAt: "15 Jul 2026, 08:30" }],
  },
  {
    id: "member-receptionist",
    name: "Faith Mwangi",
    email: "faith@digitalqatalyst.co.ke",
    initials: "FM",
    role: "receptionist",
    status: "deactivated",
    joinedAt: "02 Jun 2026",
    lastActiveAt: "Deactivated 18 Jul 2026",
    phone: "+254 733 420 110",
    financialAccess: false,
    assignedJobsOnly: false,
    activity: [
      { id: "activity-6", action: "Access deactivated", detail: "Workspace access ended immediately.", occurredAt: "18 Jul 2026, 17:10" },
    ],
    roleHistory: [{ id: "role-4", role: "receptionist", changedBy: "Alex Veteran", changedAt: "02 Jun 2026, 10:15" }],
  },
];

export const teamInvitationsFixture: TeamInvitation[] = [
  {
    id: "invite-dispatcher",
    email: "samuel@digitalqatalyst.co.ke",
    role: "dispatcher",
    status: "pending",
    invitedBy: "Alex Veteran",
    sentAt: "19 Jul 2026",
    expiresAt: "26 Jul 2026",
  },
  {
    id: "invite-accountant",
    email: "accounts@digitalqatalyst.co.ke",
    role: "accountant",
    status: "expired",
    invitedBy: "Alex Veteran",
    sentAt: "07 Jul 2026",
    expiresAt: "14 Jul 2026",
  },
];

export function getTeamRole(role: TeamRoleKey) {
  return teamRoleDefinitions.find((item) => item.key === role)!;
}

export function getTeamMember(memberId: string) {
  return teamMembersFixture.find((item) => item.id === memberId);
}
