import { relations } from "drizzle-orm";

import { accountProfiles } from "./account-profiles";
import { accountRestrictions } from "./account-restrictions";
import { auditEvents } from "./audit-events";
import { fileAssets } from "./file-assets";
import { organisations } from "./organisations";
import { outboxEvents } from "./outbox-events";
import {
  professionalOnboardingHistory,
  professionalProfiles,
  professionalVerificationDocuments,
} from "./professional-onboarding";
import {
  organisationInvitations,
  organisationMembershipHistory,
  organisationMembershipRoleHistory,
  organisationMemberships,
  permissions,
  platformRoleAssignments,
  rolePermissions,
  roles,
} from "./roles";

export const accountProfilesRelations = relations(accountProfiles, ({ many }) => ({
  restrictions: many(accountRestrictions),
  memberships: many(organisationMemberships),
  platformRoleAssignments: many(platformRoleAssignments),
  ownedFiles: many(fileAssets),
  auditEvents: many(auditEvents),
}));

export const accountRestrictionsRelations = relations(
  accountRestrictions,
  ({ one }) => ({
    accountProfile: one(accountProfiles, {
      fields: [accountRestrictions.accountProfileId],
      references: [accountProfiles.id],
    }),
    createdBy: one(accountProfiles, {
      fields: [accountRestrictions.createdByAccountId],
      references: [accountProfiles.id],
    }),
  }),
);

export const organisationsRelations = relations(organisations, ({ many }) => ({
  memberships: many(organisationMemberships),
  invitations: many(organisationInvitations),
  membershipHistory: many(organisationMembershipHistory),
  membershipRoleHistory: many(organisationMembershipRoleHistory),
  files: many(fileAssets),
  auditEvents: many(auditEvents),
  outboxEvents: many(outboxEvents),
  professionalProfiles: many(professionalProfiles),
  onboardingHistory: many(professionalOnboardingHistory),
}));

export const professionalProfilesRelations = relations(
  professionalProfiles,
  ({ one, many }) => ({
    organisation: one(organisations, {
      fields: [professionalProfiles.organisationId],
      references: [organisations.id],
    }),
    logo: one(fileAssets, {
      fields: [professionalProfiles.logoAssetId],
      references: [fileAssets.id],
    }),
    verificationDocuments: many(professionalVerificationDocuments),
  }),
);

export const professionalVerificationDocumentsRelations = relations(
  professionalVerificationDocuments,
  ({ one }) => ({
    profile: one(professionalProfiles, {
      fields: [professionalVerificationDocuments.professionalProfileId],
      references: [professionalProfiles.id],
    }),
    asset: one(fileAssets, {
      fields: [professionalVerificationDocuments.assetId],
      references: [fileAssets.id],
    }),
  }),
);

export const professionalOnboardingHistoryRelations = relations(
  professionalOnboardingHistory,
  ({ one }) => ({
    organisation: one(organisations, {
      fields: [professionalOnboardingHistory.organisationId],
      references: [organisations.id],
    }),
    actor: one(accountProfiles, {
      fields: [professionalOnboardingHistory.actorAccountId],
      references: [accountProfiles.id],
    }),
  }),
);

export const rolesRelations = relations(roles, ({ many }) => ({
  rolePermissions: many(rolePermissions),
  memberships: many(organisationMemberships),
  platformAssignments: many(platformRoleAssignments),
  invitations: many(organisationInvitations),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolePermissions: many(rolePermissions),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, {
    fields: [rolePermissions.roleId],
    references: [roles.id],
  }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionId],
    references: [permissions.id],
  }),
}));

export const organisationMembershipsRelations = relations(
  organisationMemberships,
  ({ one, many }) => ({
    organisation: one(organisations, {
      fields: [organisationMemberships.organisationId],
      references: [organisations.id],
    }),
    accountProfile: one(accountProfiles, {
      fields: [organisationMemberships.accountProfileId],
      references: [accountProfiles.id],
    }),
    role: one(roles, {
      fields: [organisationMemberships.roleId],
      references: [roles.id],
    }),
    history: many(organisationMembershipHistory),
    roleHistory: many(organisationMembershipRoleHistory),
  }),
);

export const organisationInvitationsRelations = relations(
  organisationInvitations,
  ({ one }) => ({
    organisation: one(organisations, {
      fields: [organisationInvitations.organisationId],
      references: [organisations.id],
    }),
    role: one(roles, {
      fields: [organisationInvitations.roleId],
      references: [roles.id],
    }),
    invitedBy: one(accountProfiles, {
      fields: [organisationInvitations.invitedByAccountId],
      references: [accountProfiles.id],
    }),
  }),
);

export const organisationMembershipHistoryRelations = relations(
  organisationMembershipHistory,
  ({ one }) => ({
    membership: one(organisationMemberships, {
      fields: [organisationMembershipHistory.membershipId],
      references: [organisationMemberships.id],
    }),
    organisation: one(organisations, {
      fields: [organisationMembershipHistory.organisationId],
      references: [organisations.id],
    }),
  }),
);

export const organisationMembershipRoleHistoryRelations = relations(
  organisationMembershipRoleHistory,
  ({ one }) => ({
    membership: one(organisationMemberships, {
      fields: [organisationMembershipRoleHistory.membershipId],
      references: [organisationMemberships.id],
    }),
    organisation: one(organisations, {
      fields: [organisationMembershipRoleHistory.organisationId],
      references: [organisations.id],
    }),
  }),
);

export const platformRoleAssignmentsRelations = relations(
  platformRoleAssignments,
  ({ one }) => ({
    accountProfile: one(accountProfiles, {
      fields: [platformRoleAssignments.accountProfileId],
      references: [accountProfiles.id],
    }),
    role: one(roles, {
      fields: [platformRoleAssignments.roleId],
      references: [roles.id],
    }),
  }),
);

export const auditEventsRelations = relations(auditEvents, ({ one }) => ({
  actor: one(accountProfiles, {
    fields: [auditEvents.actorAccountId],
    references: [accountProfiles.id],
  }),
  organisation: one(organisations, {
    fields: [auditEvents.organisationId],
    references: [organisations.id],
  }),
}));

export const fileAssetsRelations = relations(fileAssets, ({ one }) => ({
  owner: one(accountProfiles, {
    fields: [fileAssets.ownerAccountId],
    references: [accountProfiles.id],
  }),
  organisation: one(organisations, {
    fields: [fileAssets.organisationId],
    references: [organisations.id],
  }),
}));

export const outboxEventsRelations = relations(outboxEvents, ({ one }) => ({
  organisation: one(organisations, {
    fields: [outboxEvents.organisationId],
    references: [organisations.id],
  }),
  actor: one(accountProfiles, {
    fields: [outboxEvents.actorAccountId],
    references: [accountProfiles.id],
  }),
}));
