export const permissionKeys = {
  organisationView: "organisation.view",
  organisationManage: "organisation.manage",
  organisationMembersManage: "organisation.members.manage",
  platformAdmin: "platform.admin",
} as const;

export type PermissionKey =
  (typeof permissionKeys)[keyof typeof permissionKeys];

export function hasPermission(
  granted: readonly string[],
  required: PermissionKey | PermissionKey[],
): boolean {
  const requiredKeys = Array.isArray(required) ? required : [required];
  return requiredKeys.every((key) => granted.includes(key));
}
