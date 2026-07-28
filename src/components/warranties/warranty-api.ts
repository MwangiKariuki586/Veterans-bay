import type { PageResult } from "@/platform/http/pagination";
import type {
  WarrantyDetail,
  WarrantyStatus,
  WarrantySummary,
} from "@/modules/warranties/types";

interface ApiEnvelope<T> {
  data: T;
}

interface ApiErrorEnvelope {
  error?: { message?: string };
}

export async function warrantyApi<T>(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    cache: "no-store",
    credentials: "include",
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const body = (await response.json()) as ApiEnvelope<T> & ApiErrorEnvelope;
  if (!response.ok) {
    throw new Error(body.error?.message ?? "Warranty action failed.");
  }
  return body.data;
}

export function listWarranties(
  audience: "client" | "professional",
  status?: WarrantyStatus,
) {
  const query = status ? `?status=${status}` : "";
  return warrantyApi<PageResult<WarrantySummary>>(
    `/api/v1/${audience}/warranties${query}`,
  );
}

export function getWarranty(
  audience: "client" | "professional",
  warrantyId: string,
) {
  return warrantyApi<WarrantyDetail>(
    `/api/v1/${audience}/warranties/${warrantyId}`,
  );
}

export function ensureWarrantyFromJob(jobId: string) {
  return warrantyApi<WarrantyDetail>(
    `/api/v1/professional/warranties/from-job/${jobId}`,
    { method: "POST" },
  );
}

export function submitWarrantyClaim(
  warrantyId: string,
  body: Record<string, unknown>,
) {
  return warrantyApi<WarrantyDetail>(
    `/api/v1/client/warranties/${warrantyId}/claims`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export function professionalClaimAction(
  claimId: string,
  path: "action" | "return-visit" | "resolve",
  body: Record<string, unknown>,
) {
  return warrantyApi<WarrantyDetail>(
    `/api/v1/professional/warranty-claims/${claimId}/${path}`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export function escalateWarrantyClaim(
  warrantyId: string,
  claimId: string,
  body: Record<string, unknown>,
) {
  return warrantyApi<WarrantyDetail>(
    `/api/v1/client/warranties/${warrantyId}/claims/${claimId}/escalate`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export async function uploadWarrantyEvidence(file: File) {
  const intent = await warrantyApi<{
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
    body: JSON.stringify({
      purpose: "WARRANTY_EVIDENCE",
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
  const response = await fetch(intent.authorization.uploadUrl, {
    method: "POST",
    body: form,
  });
  const provider = (await response.json().catch(() => null)) as {
    public_id?: string;
  } | null;
  if (!response.ok || !provider?.public_id) {
    throw new Error("The warranty evidence could not be uploaded.");
  }
  await warrantyApi(`/api/v1/storage/assets/${intent.assetId}/complete`, {
    method: "POST",
    body: JSON.stringify({ publicId: provider.public_id }),
  });
  return intent.assetId;
}
