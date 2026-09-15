"use client";

import type {
  ClientServiceRequest,
  ServiceRequestOptions,
} from "@/modules/service-requests/types";

export class RequestApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly issues: Array<{ path: string }>,
  ) {
    super(message);
  }
}

export async function requestApi<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(path, { credentials: "include", ...init });
  const body = (await response.json().catch(() => null)) as {
    data?: T;
    error?: {
      code?: string;
      message?: string;
      issues?: Array<{ path: string }>;
    };
  } | null;
  if (!response.ok || body?.data === undefined) {
    throw new RequestApiError(
      body?.error?.message ?? "The request could not be completed.",
      body?.error?.code ?? "REQUEST_FAILED",
      body?.error?.issues ?? [],
    );
  }
  return body.data;
}

export function getRequestOptions() {
  return requestApi<ServiceRequestOptions>("/api/v1/client/requests/options");
}

export function getClientRequest(requestId: string) {
  return requestApi<ClientServiceRequest>(
    `/api/v1/client/requests/${encodeURIComponent(requestId)}`,
  );
}

export async function uploadRequestAttachment(file: File): Promise<string> {
  return uploadAttachment(file, "REQUEST_ATTACHMENT");
}

export async function uploadMessageAttachment(file: File): Promise<string> {
  return uploadAttachment(file, "MESSAGE_ATTACHMENT");
}

async function uploadAttachment(
  file: File,
  purpose: "REQUEST_ATTACHMENT" | "MESSAGE_ATTACHMENT",
): Promise<string> {
  const intent = await requestApi<{
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
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      purpose,
      mimeType: file.type,
      sizeBytes: file.size,
    }),
  });
  const form = new FormData();
  form.append("file", file);
  form.append("api_key", intent.authorization.apiKey);
  form.append("timestamp", String(intent.authorization.timestamp));
  form.append("signature", intent.authorization.signature);
  form.append("folder", intent.authorization.folder);
  form.append("public_id", intent.authorization.publicId);
  form.append("type", intent.authorization.type);
  const provider = await fetch(intent.authorization.uploadUrl, {
    method: "POST",
    body: form,
  });
  const providerBody = (await provider.json().catch(() => null)) as {
    public_id?: string;
  } | null;
  if (!provider.ok || !providerBody?.public_id) {
    throw new Error("The attachment could not be uploaded.");
  }
  await requestApi(`/api/v1/storage/assets/${intent.assetId}/complete`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ publicId: providerBody.public_id }),
  });
  return intent.assetId;
}
