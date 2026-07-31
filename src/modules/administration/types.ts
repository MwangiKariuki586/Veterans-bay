export interface PageResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface ModerationReport {
  id: string;
  category: string;
  subjectType: string;
  subjectId: string;
  summary: string;
  details: string;
  status: string;
  createdAt: string;
}

export interface ModerationCase {
  id: string;
  reportId: string | null;
  caseType: string;
  subjectType: string;
  subjectId: string;
  subjectAccountId: string | null;
  status: string;
  priority: string;
  resolution: string | null;
  decisionReason: string | null;
  evidenceSummary: string | null;
  openedAt: string;
}

export interface ModerationCaseDetail {
  case: ModerationCase;
  history: Array<{
    id: string;
    action: string;
    fromStatus: string | null;
    toStatus: string;
    reason: string;
    createdAt: string;
  }>;
  evidence: Array<{
    assetId: string;
    purpose: string;
    mimeType: string;
    status: string;
    createdAt: string;
  }>;
}

export interface AdminDispute {
  id: string;
  jobId: string;
  status: string;
  reason: string;
  resolution: string | null;
  openedAt: string;
}

export interface EscalatedWarranty {
  id: string;
  warrantyId: string;
  serviceName: string;
  subject: string;
  description: string;
  status: string;
  escalatedAt: string;
}

export interface AuditEvent {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorAccountId: string | null;
  correlationId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface PlatformRule {
  id: string;
  key: string;
  name: string;
  description: string;
  value: Record<string, unknown>;
  status: string;
  reason: string;
  updatedAt: string;
}
