import type { PageResult } from "@/platform/http/pagination";
import type {
  JobDetail,
  JobStatus,
  JobSummary,
} from "@/modules/jobs/types";

interface ApiEnvelope<T> {
  data: T;
}

interface ApiErrorEnvelope {
  error?: { message?: string };
}

export async function jobApi<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
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
    throw new Error(body.error?.message ?? "Job action failed.");
  }
  return body.data;
}

export function listJobs(
  audience: "client" | "professional",
  status?: JobStatus,
) {
  const query = status ? `?status=${status}` : "";
  return jobApi<PageResult<JobSummary>>(`/api/v1/${audience}/jobs${query}`);
}

export function getJob(
  audience: "client" | "professional",
  jobId: string,
) {
  return jobApi<JobDetail>(`/api/v1/${audience}/jobs/${jobId}`);
}

export function professionalJobAction(
  jobId: string,
  action: string,
  body?: Record<string, unknown>,
) {
  return jobApi<JobDetail>(
    `/api/v1/professional/jobs/${jobId}/${action}`,
    {
      method: "POST",
      ...(body ? { body: JSON.stringify(body) } : {}),
    },
  );
}

export function clientJobAction(
  jobId: string,
  action: string,
  body: Record<string, unknown>,
) {
  return jobApi<JobDetail>(`/api/v1/client/jobs/${jobId}/${action}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function uploadJobEvidence(file: File): Promise<string> {
  const intent = await jobApi<{
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
      purpose: "JOB_EVIDENCE",
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
    throw new Error("The evidence could not be uploaded.");
  }
  await jobApi(`/api/v1/storage/assets/${intent.assetId}/complete`, {
    method: "POST",
    body: JSON.stringify({ publicId: provider.public_id }),
  });
  return intent.assetId;
}
