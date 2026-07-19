import type { Database } from "../database/client";
import { auditEvents } from "../database/schema/audit-events";

export interface AuditEventInput {
  actorAccountId: string;
  action: string;
  entityType: string;
  entityId: string;
  organisationId?: string | null;
  correlationId?: string | null;
  /** Safe metadata only — never passwords, tokens, or private file contents. */
  metadata?: Record<string, unknown>;
}

/**
 * Baseline audit helper for high-risk administrative and financial actions.
 * Callers must strip secrets before passing metadata.
 */
export async function recordAuditEvent(
  db: Database,
  input: AuditEventInput,
): Promise<void> {
  await db.insert(auditEvents).values({
    actorAccountId: input.actorAccountId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    organisationId: input.organisationId ?? null,
    correlationId: input.correlationId ?? null,
    metadata: sanitizeAuditMetadata(input.metadata ?? {}),
  });
}

const blockedMetadataKeys = [
  "password",
  "token",
  "secret",
  "authorization",
  "cookie",
  "session",
  "apikey",
  "apisecret",
];

export function sanitizeAuditMetadata(
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    const normalized = key.toLowerCase().replace(/[_-]/g, "");
    if (blockedMetadataKeys.some((blocked) => normalized.includes(blocked))) {
      continue;
    }
    if (typeof value === "string" && value.length > 500) {
      sanitized[key] = `${value.slice(0, 500)}…`;
      continue;
    }
    sanitized[key] = value;
  }

  return sanitized;
}
