import { describe, expect, it } from "vitest";

import { CloudinaryStorageProvider } from "./cloudinary";
import { getStoragePurposePolicy, storagePurposes } from "./policies";

describe("storage policies", () => {
  it("defines every required purpose with bounded types and sizes", () => {
    for (const purpose of storagePurposes) {
      const policy = getStoragePurposePolicy(purpose);
      expect(policy.maxBytes).toBeGreaterThan(0);
      expect(policy.allowedMimeTypes.length).toBeGreaterThan(0);
      expect(policy.folder.startsWith("veterans-bay/")).toBe(true);
    }
  });
});

describe("CloudinaryStorageProvider signing", () => {
  it("creates signed upload authorization without exposing the api secret", async () => {
    const provider = new CloudinaryStorageProvider({
      cloudName: "demo",
      apiKey: "key",
      apiSecret: "secret",
    });

    const authorization = await provider.createSignedUpload({
      folder: "veterans-bay/avatars",
      publicId: "asset-1",
      resourceType: "image",
      type: "upload",
      timestamp: 1_700_000_000,
    });

    expect(authorization.apiKey).toBe("key");
    expect(authorization.cloudName).toBe("demo");
    expect(authorization.signature).toMatch(/^[a-f0-9]{40}$/);
    expect(JSON.stringify(authorization)).not.toContain("secret");
  });
});
