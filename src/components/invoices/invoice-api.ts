import type { PageResult } from "@/platform/http/pagination";
import type {
  InvoiceBucket,
  InvoiceDetail,
  InvoicePage,
  InvoiceSort,
  InvoiceStatus,
  InvoiceSummary,
  PaymentSummary,
} from "@/modules/invoices/types";

interface ApiEnvelope<T> {
  data: T;
}

interface ApiErrorEnvelope {
  error?: { message?: string };
}

export async function invoiceApi<T>(path: string, init?: RequestInit) {
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
    throw new Error(body.error?.message ?? "Financial record action failed.");
  }
  return body.data;
}

export function listInvoices(
  audience: "client" | "professional",
  status?: InvoiceStatus,
) {
  const query = status ? `?status=${status}` : "";
  return invoiceApi<PageResult<InvoiceSummary>>(
    `/api/v1/${audience}/invoices${query}`,
  );
}

export type InvoiceListQuery = {
  page: number;
  pageSize: number;
  bucket: "all" | InvoiceBucket;
  status: "" | InvoiceStatus;
  search: string;
  sort: InvoiceSort;
};

export function listInvoicesPage(
  audience: "client" | "professional",
  query: InvoiceListQuery,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
    sort: query.sort,
  });
  if (query.bucket !== "all") params.set("bucket", query.bucket);
  if (query.status) params.set("status", query.status);
  if (query.search) params.set("search", query.search);
  return invoiceApi<InvoicePage>(
    `/api/v1/${audience}/invoices?${params.toString()}`,
    signal ? { signal } : undefined,
  );
}

export function getInvoice(
  audience: "client" | "professional",
  invoiceId: string,
  signal?: AbortSignal,
) {
  return invoiceApi<InvoiceDetail>(
    `/api/v1/${audience}/invoices/${invoiceId}`,
    signal ? { signal } : undefined,
  );
}

export function invoiceAction(
  invoiceId: string,
  action: string,
  body: Record<string, unknown>,
) {
  return invoiceApi<InvoiceDetail>(
    `/api/v1/professional/invoices/${invoiceId}/${action}`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export function createInvoiceFromJob(jobId: string) {
  return invoiceApi<InvoiceDetail>(
    `/api/v1/professional/invoices/from-job/${jobId}`,
    { method: "POST" },
  );
}

export function adjustPayment(
  paymentId: string,
  body: Record<string, unknown>,
) {
  return invoiceApi<InvoiceDetail>(
    `/api/v1/professional/payments/${paymentId}/adjustments`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export function listPayments() {
  return invoiceApi<PageResult<PaymentSummary>>(
    "/api/v1/professional/payments",
  );
}

export async function uploadPaymentEvidence(file: File) {
  const intent = await invoiceApi<{
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
      purpose: "PAYMENT_EVIDENCE",
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
    throw new Error("The payment evidence could not be uploaded.");
  }
  await invoiceApi(`/api/v1/storage/assets/${intent.assetId}/complete`, {
    method: "POST",
    body: JSON.stringify({ publicId: provider.public_id }),
  });
  return intent.assetId;
}
