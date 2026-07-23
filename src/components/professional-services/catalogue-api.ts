export class CatalogueApiError extends Error {
  constructor(
    message: string,
    readonly issues: Array<{ path: string }>,
  ) {
    super(message);
  }
}

export async function catalogueApi<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(path, { credentials: "include", ...init });
  const body = (await response.json().catch(() => null)) as {
    data?: T;
    error?: { message?: string; issues?: Array<{ path: string }> };
  } | null;
  if (!response.ok || body?.data === undefined) {
    throw new CatalogueApiError(
      body?.error?.message ?? "The request could not be completed.",
      body?.error?.issues ?? [],
    );
  }
  return body.data;
}

export async function uploadCatalogueImage(input: {
  file: File;
  purpose: "PROFESSIONAL_LOGO" | "PORTFOLIO_IMAGE" | "SERVICE_IMAGE";
  organisationId: string;
}): Promise<string> {
  const intent = await catalogueApi<{
    assetId: string;
    authorization: {
      uploadUrl: string;
      apiKey: string;
      timestamp: number;
      signature: string;
      folder: string;
      publicId: string;
      type: string;
    };
  }>("/api/v1/storage/upload-intent", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-workspace-id": `organisation:${input.organisationId}`,
    },
    body: JSON.stringify({
      purpose: input.purpose,
      mimeType: input.file.type,
      sizeBytes: input.file.size,
      organisationId: input.organisationId,
    }),
  });

  const form = new FormData();
  form.append("file", input.file);
  form.append("api_key", intent.authorization.apiKey);
  form.append("timestamp", String(intent.authorization.timestamp));
  form.append("signature", intent.authorization.signature);
  form.append("folder", intent.authorization.folder);
  form.append("public_id", intent.authorization.publicId);
  form.append("type", intent.authorization.type);
  const response = await fetch(intent.authorization.uploadUrl, {
    method: "POST",
    body: form,
  });
  const providerBody = (await response.json().catch(() => null)) as {
    public_id?: string;
  } | null;
  if (!response.ok || !providerBody?.public_id) {
    throw new Error("The image could not be uploaded. Please try again.");
  }
  await catalogueApi(`/api/v1/storage/assets/${intent.assetId}/complete`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ publicId: providerBody.public_id }),
  });
  return intent.assetId;
}
