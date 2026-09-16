export interface PublicAccountProfile {
  id: string;
  displayName: string;
  primaryEmail: string;
  phone: string | null;
  location: string | null;
  bio: string | null;
  avatarAssetId: string | null;
  avatarUrl: string | null;
  timezone: string;
  status: string;
  termsAcceptedAt: string | null;
  privacyAcceptedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PresenceSummary {
  clientWorkspace: { label: string; status: string };
  professionalWorkspaces: Array<{
    organisationId: string;
    name: string;
    slug: string;
    roleKey: string;
    status: string;
    isCurrent: boolean;
  }>;
  teamMemberships: Array<{
    organisationId: string;
    name: string;
    roleKey: string;
  }>;
  teamMembershipCount: number;
}

export interface PublicSession {
  id: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  isCurrent: boolean;
}
