export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

export type CloudinaryDeliveryType = "upload" | "authenticated";

export interface SignedUploadAuthorization {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  publicId: string;
  resourceType: "image" | "raw";
  type: CloudinaryDeliveryType;
  uploadUrl: string;
  expiresAt: string;
}

export interface CloudinaryResource {
  publicId: string;
  bytes: number;
  format: string | null;
  resourceType: string;
  type: string;
  secureUrl: string;
  version: number;
}

export interface StorageProvider {
  createSignedUpload(input: {
    folder: string;
    publicId: string;
    resourceType: "image" | "raw";
    type: CloudinaryDeliveryType;
    timestamp?: number;
  }): Promise<SignedUploadAuthorization>;
  getResource(input: {
    publicId: string;
    resourceType: "image" | "raw";
    type: CloudinaryDeliveryType;
  }): Promise<CloudinaryResource | null>;
  createDeliveryUrl(input: {
    publicId: string;
    resourceType: "image" | "raw";
    visibility: "public" | "private";
  }): Promise<string>;
  destroyResource(input: {
    publicId: string;
    resourceType: "image" | "raw";
    type: CloudinaryDeliveryType;
  }): Promise<void>;
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

async function sha1Digest(value: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest("SHA-1", new TextEncoder().encode(value));
}

async function sha1Hex(value: string): Promise<string> {
  return toHex(await sha1Digest(value));
}

/** First 8 chars of URL-safe base64(SHA-1), as required for Cloudinary delivery URL signatures. */
export async function createDeliverySignature(
  pathAfterSignature: string,
  apiSecret: string,
): Promise<string> {
  const digest = await sha1Digest(`${pathAfterSignature}${apiSecret}`);
  const bytes = new Uint8Array(digest);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  const base64 = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  return base64.slice(0, 8);
}

export function deliveryTypeForVisibility(
  visibility: "public" | "private",
): CloudinaryDeliveryType {
  return visibility === "private" ? "authenticated" : "upload";
}

export function parseCloudinaryConfig(env: {
  CLOUDINARY_CLOUD_NAME?: string;
  CLOUDINARY_API_KEY?: string;
  CLOUDINARY_API_SECRET?: string;
}): CloudinaryConfig | null {
  const cloudName = env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = env.CLOUDINARY_API_SECRET?.trim();

  if (!cloudName || !apiKey || !apiSecret) {
    return null;
  }

  return { cloudName, apiKey, apiSecret };
}

export class CloudinaryStorageProvider implements StorageProvider {
  constructor(private readonly config: CloudinaryConfig) {}

  async createSignedUpload(input: {
    folder: string;
    publicId: string;
    resourceType: "image" | "raw";
    type: CloudinaryDeliveryType;
    timestamp?: number;
  }): Promise<SignedUploadAuthorization> {
    const timestamp = input.timestamp ?? Math.floor(Date.now() / 1000);
    const params: Record<string, string> = {
      folder: input.folder,
      public_id: input.publicId,
      timestamp: String(timestamp),
      type: input.type,
    };

    const signature = await this.sign(params);

    return {
      cloudName: this.config.cloudName,
      apiKey: this.config.apiKey,
      timestamp,
      signature,
      folder: input.folder,
      publicId: input.publicId,
      resourceType: input.resourceType,
      type: input.type,
      uploadUrl: `https://api.cloudinary.com/v1_1/${this.config.cloudName}/${input.resourceType}/upload`,
      expiresAt: new Date((timestamp + 3600) * 1000).toISOString(),
    };
  }

  async getResource(input: {
    publicId: string;
    resourceType: "image" | "raw";
    type: CloudinaryDeliveryType;
  }): Promise<CloudinaryResource | null> {
    const url = new URL(
      `https://api.cloudinary.com/v1_1/${this.config.cloudName}/resources/${input.resourceType}/${input.type}/${encodeURIComponent(input.publicId)}`,
    );
    const response = await fetch(url, {
      headers: {
        authorization: `Basic ${btoa(`${this.config.apiKey}:${this.config.apiSecret}`)}`,
      },
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error("Cloudinary resource lookup failed.");
    }

    const body = (await response.json()) as {
      public_id: string;
      bytes: number;
      format?: string;
      resource_type: string;
      type: string;
      secure_url: string;
      version: number;
    };

    return {
      publicId: body.public_id,
      bytes: body.bytes,
      format: body.format ?? null,
      resourceType: body.resource_type,
      type: body.type,
      secureUrl: body.secure_url,
      version: body.version,
    };
  }

  async createDeliveryUrl(input: {
    publicId: string;
    resourceType: "image" | "raw";
    visibility: "public" | "private";
  }): Promise<string> {
    if (input.visibility === "public") {
      return `https://res.cloudinary.com/${this.config.cloudName}/${input.resourceType}/upload/${input.publicId}`;
    }

    const signature = await createDeliverySignature(
      input.publicId,
      this.config.apiSecret,
    );

    return `https://res.cloudinary.com/${this.config.cloudName}/${input.resourceType}/authenticated/s--${signature}--/${input.publicId}`;
  }

  async destroyResource(input: {
    publicId: string;
    resourceType: "image" | "raw";
    type: CloudinaryDeliveryType;
  }): Promise<void> {
    const timestamp = Math.floor(Date.now() / 1000);
    const params: Record<string, string> = {
      public_id: input.publicId,
      timestamp: String(timestamp),
    };

    if (input.type !== "upload") {
      params.type = input.type;
    }

    const signature = await this.sign(params);
    const body = new URLSearchParams({
      ...params,
      api_key: this.config.apiKey,
      signature,
    });

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${this.config.cloudName}/${input.resourceType}/destroy`,
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
      },
    );

    if (!response.ok) {
      throw new Error("Cloudinary destroy failed.");
    }
  }

  private async sign(params: Record<string, string>): Promise<string> {
    const toSign = Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join("&");

    return sha1Hex(`${toSign}${this.config.apiSecret}`);
  }
}
