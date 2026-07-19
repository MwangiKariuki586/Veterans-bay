export const workspacePermissions = {
  list: "workspace.list",
  select: "workspace.select",
  membersManage: "organisation.members.manage",
} as const;

export const workspaceEvents = {
  memberRoleChanged: "organization.member_role_changed",
  memberRemoved: "organization.member_removed",
} as const;
