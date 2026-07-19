export interface PublicAccountProfile {
  id: string;
  displayName: string;
  primaryEmail: string;
  phone: string | null;
  timezone: string;
  status: string;
  termsAcceptedAt: string | null;
  privacyAcceptedAt: string | null;
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
