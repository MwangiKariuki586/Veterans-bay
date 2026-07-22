import { describe, expect, it } from "vitest";

import {
  CloudinaryStorageProvider,
  createDeliverySignature,
  deliveryTypeForVisibility,
  parseCloudinaryConfig,
} from "./cloudinary";

describe("cloudinary storage provider", () => {
  it("parses complete config only", () => {
    expect(
      parseCloudinaryConfig({
        CLOUDINARY_CLOUD_NAME: "demo",
        CLOUDINARY_API_KEY: "key",
      }),
    ).toBeNull();

    expect(
      parseCloudinaryConfig({
        CLOUDINARY_CLOUD_NAME: "demo",
        CLOUDINARY_API_KEY: "key",
        CLOUDINARY_API_SECRET: "secret",
      }),
    ).toEqual({
      cloudName: "demo",
      apiKey: "key",
      apiSecret: "secret",
    });
  });

  it("maps visibility to Cloudinary delivery types", () => {
    expect(deliveryTypeForVisibility("public")).toBe("upload");
    expect(deliveryTypeForVisibility("private")).toBe("authenticated");
  });

  it("builds signed public and authenticated delivery URLs", async () => {
    const provider = new CloudinaryStorageProvider({
      cloudName: "demo",
      apiKey: "key",
      apiSecret: "secret",
    });

    await expect(
      provider.createDeliveryUrl({
        publicId: "veterans-bay/avatars/asset-1",
        resourceType: "image",
        visibility: "public",
      }),
    ).resolves.toBe(
      "https://res.cloudinary.com/demo/image/upload/veterans-bay/avatars/asset-1",
    );

    const signature = await createDeliverySignature(
      "veterans-bay/jobs/asset-2",
      "secret",
    );
    await expect(
      provider.createDeliveryUrl({
        publicId: "veterans-bay/jobs/asset-2",
        resourceType: "image",
        visibility: "private",
      }),
    ).resolves.toBe(
      `https://res.cloudinary.com/demo/image/authenticated/s--${signature}--/veterans-bay/jobs/asset-2`,
    );
  });

  it("includes authenticated type in signed upload parameters", async () => {
    const provider = new CloudinaryStorageProvider({
      cloudName: "demo",
      apiKey: "123",
      apiSecret: "abcd",
    });

    const authorization = await provider.createSignedUpload({
      folder: "veterans-bay/jobs",
      publicId: "asset-1",
      resourceType: "image",
      type: "authenticated",
      timestamp: 1_700_000_000,
    });

    expect(authorization.type).toBe("authenticated");
    expect(authorization.uploadUrl).toContain("/image/upload");
    expect(authorization.signature).toHaveLength(40);
  });

  it("signs the public upload type that the browser submits", async () => {
    const provider = new CloudinaryStorageProvider({
      cloudName: "demo",
      apiKey: "123",
      apiSecret: "abcd",
    });

    const authorization = await provider.createSignedUpload({
      folder: "veterans-bay/logos",
      publicId: "asset-1",
      resourceType: "image",
      type: "upload",
      timestamp: 1_700_000_000,
    });

    expect(authorization.type).toBe("upload");
    expect(authorization.signature).toBe(
      "1e44584fe5730060455555b120a811c3531f8cc5",
    );
  });
});
