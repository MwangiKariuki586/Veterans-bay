import { AppError } from "../../platform/errors/app-error";
import { permissionKeys } from "../../platform/permissions/keys";
import type { IdentityStore } from "../identity/repository";
import type { WorkspaceRepository } from "../workspace/repository";

export async function requirePlatformAdministrator(
  authUserId: string,
  identityStore: Pick<
    IdentityStore,
    "findProfileByAuthUserId" | "findActiveRestrictions"
  >,
  workspaceStore: Pick<
    WorkspaceRepository,
    "listActivePlatformAssignments" | "listPermissionKeysForRoleIds"
  >,
) {
  const account = await identityStore.findProfileByAuthUserId(authUserId);
  if (!account || account.status === "deactivated") {
    throw new AppError({
      code: "PERMISSION_DENIED",
      message: "Platform administration permission is required.",
      status: 403,
    });
  }
  if ((await identityStore.findActiveRestrictions(account.id)).length > 0) {
    throw new AppError({
      code: "ACCOUNT_RESTRICTED",
      message: "This account cannot perform protected actions.",
      status: 403,
    });
  }
  const assignments =
    await workspaceStore.listActivePlatformAssignments(account.id);
  const administrator = assignments.find(
    (assignment) => assignment.roleKey === "platform_admin",
  );
  if (!administrator) {
    throw new AppError({
      code: "PERMISSION_DENIED",
      message: "Platform administration permission is required.",
      status: 403,
    });
  }
  const permissions =
    await workspaceStore.listPermissionKeysForRoleIds([administrator.roleId]);
  if (
    !(permissions.get(administrator.roleId) ?? []).includes(
      permissionKeys.platformAdmin,
    )
  ) {
    throw new AppError({
      code: "PERMISSION_DENIED",
      message: "Platform administration permission is required.",
      status: 403,
    });
  }
  return account;
}
