import { and, eq, inArray } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { ProfessionalOnboardingRepository } from "../../modules/professional-onboarding/repository";
import { accountProfiles } from "./schema/account-profiles";
import { auditEvents } from "./schema/audit-events";
import { organisations } from "./schema/organisations";
import { outboxEvents } from "./schema/outbox-events";
import {
  professionalOnboardingHistory,
  professionalProfiles,
} from "./schema/professional-onboarding";
import { withTestDatabase } from "./testing/helpers";

describe("professional onboarding review persistence", () => {
  it("commits approval, history, audit, and outbox atomically", async () => {
    await withTestDatabase(async ({ db }) => {
      const marker = crypto.randomUUID();
      const [administrator] = await db
        .insert(accountProfiles)
        .values({
          authUserId: `review-admin-${marker}`,
          displayName: "Review Administrator",
          primaryEmail: `review-admin-${marker}@example.com`,
        })
        .returning();
      const [organisation] = await db
        .insert(organisations)
        .values({
          name: "Review Test",
          slug: `review-test-${marker}`,
          status: "pending_review",
        })
        .returning();
      const [profile] = await db
        .insert(professionalProfiles)
        .values({
          organisationId: organisation.id,
          verificationStatus: "pending",
        })
        .returning();
      const repository = new ProfessionalOnboardingRepository(db);

      try {
        await repository.recordReviewDecision({
          organisationId: organisation.id,
          actorAccountId: administrator.id,
          fromStatus: "pending_review",
          toStatus: "active",
          verificationStatus: "verified",
          decision: "approve",
          reason: "Evidence reviewed and accepted.",
          eventType: "professional.profile_approved",
          correlationId: `review-${marker}`,
        });

        const [updatedOrganisation, updatedProfile, history, audit, outbox] =
          await Promise.all([
            db
              .select()
              .from(organisations)
              .where(eq(organisations.id, organisation.id)),
            db
              .select()
              .from(professionalProfiles)
              .where(eq(professionalProfiles.id, profile.id)),
            db
              .select()
              .from(professionalOnboardingHistory)
              .where(
                eq(
                  professionalOnboardingHistory.organisationId,
                  organisation.id,
                ),
              ),
            db
              .select()
              .from(auditEvents)
              .where(
                and(
                  eq(auditEvents.organisationId, organisation.id),
                  eq(auditEvents.action, "professional.profile_approved"),
                ),
              ),
            db
              .select()
              .from(outboxEvents)
              .where(
                and(
                  eq(outboxEvents.organisationId, organisation.id),
                  eq(outboxEvents.eventType, "professional.profile_approved"),
                ),
              ),
          ]);

        expect(updatedOrganisation[0]?.status).toBe("active");
        expect(updatedProfile[0]?.verificationStatus).toBe("verified");
        expect(history).toEqual([
          expect.objectContaining({
            fromStatus: "pending_review",
            toStatus: "active",
            actorAccountId: administrator.id,
          }),
        ]);
        expect(audit).toHaveLength(1);
        expect(outbox).toHaveLength(1);

        await expect(
          repository.recordReviewDecision({
            organisationId: organisation.id,
            actorAccountId: administrator.id,
            fromStatus: "pending_review",
            toStatus: "deactivated",
            verificationStatus: "rejected",
            decision: "reject",
            reason: "A repeated decision must not be accepted.",
            eventType: "professional.profile_rejected",
          }),
        ).rejects.toMatchObject({ code: "INVALID_REVIEW_TRANSITION" });

        expect(
          await db
            .select()
            .from(professionalOnboardingHistory)
            .where(
              eq(
                professionalOnboardingHistory.organisationId,
                organisation.id,
              ),
            ),
        ).toHaveLength(1);
      } finally {
        await db
          .delete(outboxEvents)
          .where(eq(outboxEvents.organisationId, organisation.id));
        await db
          .delete(auditEvents)
          .where(eq(auditEvents.organisationId, organisation.id));
        await db
          .delete(professionalOnboardingHistory)
          .where(
            eq(
              professionalOnboardingHistory.organisationId,
              organisation.id,
            ),
          );
        await db
          .delete(professionalProfiles)
          .where(eq(professionalProfiles.organisationId, organisation.id));
        await db
          .delete(organisations)
          .where(eq(organisations.id, organisation.id));
        await db
          .delete(accountProfiles)
          .where(inArray(accountProfiles.id, [administrator.id]));
      }
    });
  });
});
