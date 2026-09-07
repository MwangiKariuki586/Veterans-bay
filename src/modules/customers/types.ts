export type CustomerOrigin =
  | "MARKETPLACE_ACQUIRED"
  | "PROFESSIONAL_INVITED"
  | "PROFESSIONAL_IMPORTED"
  | "CLIENT_REFERRAL"
  | "REPEAT_CLIENT";
export type CustomerStatus =
  | "IMPORTED"
  | "INVITATION_PENDING"
  | "REGISTERED"
  | "DUPLICATE_CANDIDATE"
  | "ARCHIVED";

export interface CustomerSummary {
  id: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  acquisitionSource: CustomerOrigin;
  status: CustomerStatus;
  duplicateOfCustomerId: string | null;
  tags: string[];
  lastServiceAt: string | null;
  createdAt: string;
}
export interface CustomerPage {
  items: CustomerSummary[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface ProfessionalCustomerSummary {
  total: number;
  active: number;
  withBalance: number;
  repeat: number;
  new30d: number;
}

export type ProfessionalCustomerSort = "updated_desc" | "updated_asc" | "name_asc" | "name_desc" | "lastService_desc" | "lastService_asc";
export interface CustomerDetail extends CustomerSummary {
  accountProfileId: string | null;
  notes: Array<{
    id: string;
    body: string;
    authorName: string;
    createdAt: string;
  }>;
  history: Array<{
    id: string;
    kind: "QUOTATION" | "BOOKING" | "JOB";
    label: string;
    status: string;
    occurredAt: string;
  }>;
}
export interface CustomerBalance {
  invoiceTotalMinor: number;
  paidMinor: number;
  outstandingMinor: number;
  currency: string;
}
