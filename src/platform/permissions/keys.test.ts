import { describe, expect, it } from "vitest";

import { hasPermission, permissionKeys } from "./keys";

describe("permission helpers", () => {
  it("requires every listed permission", () => {
    expect(
      hasPermission(
        [permissionKeys.organisationView, permissionKeys.organisationManage],
        [permissionKeys.organisationView, permissionKeys.organisationManage],
      ),
    ).toBe(true);

    expect(
      hasPermission(
        [permissionKeys.organisationView],
        [permissionKeys.organisationView, permissionKeys.organisationManage],
      ),
    ).toBe(false);
  });
});
