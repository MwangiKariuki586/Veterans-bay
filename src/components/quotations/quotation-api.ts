"use client";

import { requestApi } from "@/components/service-requests/request-api";
import type {
  ClientQuotationBucket,
  ClientQuotationSort,
  ClientQuotationSummary,
  ClientQuotationValidity,
  QuotationDetail,
  QuotationDraftValues,
  QuotationStatus,
  QuotationSummary,
} from "@/modules/quotations/types";
import type { PublicProfessionalProfile } from "@/modules/professional-services/types";
import type { ClientServiceRequest } from "@/modules/service-requests/types";

export type QuotationPage = {
  items: QuotationSummary[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type ClientQuotationPage = QuotationPage & {
  summary: ClientQuotationSummary;
  categories: string[];
};

export type ClientQuotationQuery = {
  page: number;
  pageSize: number;
  bucket: "all" | ClientQuotationBucket;
  category: string;
  status: string;
  validity: "" | ClientQuotationValidity;
  search: string;
  sort: ClientQuotationSort;
};

export function listQuotations(
  audience: "client" | "professional",
  status?: QuotationStatus,
) {
  const query = new URLSearchParams({ pageSize: "50" });
  if (status) query.set("status", status);
  return requestApi<QuotationPage>(
    `/api/v1/${audience}/quotations?${query.toString()}`,
  );
}

export function listClientQuotations(
  query: ClientQuotationQuery,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
    sort: query.sort,
  });
  if (query.bucket !== "all") params.set("bucket", query.bucket);
  if (query.category) params.set("category", query.category);
  if (query.status) params.set("status", query.status);
  if (query.validity) params.set("validity", query.validity);
  if (query.search) params.set("search", query.search);
  return requestApi<ClientQuotationPage>(
    `/api/v1/client/quotations?${params.toString()}`,
    { signal },
  );
}

export function getQuotation(
  audience: "client" | "professional",
  quotationId: string,
  signal?: AbortSignal,
) {
  return requestApi<QuotationDetail>(
    `/api/v1/${audience}/quotations/${encodeURIComponent(quotationId)}`,
    { signal },
  );
}

export function getQuotationRequest(requestId: string, signal?: AbortSignal) {
  return requestApi<ClientServiceRequest>(
    `/api/v1/client/requests/${encodeURIComponent(requestId)}`,
    { signal },
  );
}

export function getQuotationProfessional(slug: string, signal?: AbortSignal) {
  return requestApi<PublicProfessionalProfile>(
    `/api/v1/public/professionals/${encodeURIComponent(slug)}`,
    { signal },
  );
}

export function getQuotationAttachment(assetId: string) {
  return requestApi<{ url: string; visibility: "public" | "private" }>(
    `/api/v1/storage/assets/${encodeURIComponent(assetId)}/delivery`,
  );
}

export function createQuotation(
  requestId: string,
  values: QuotationDraftValues,
) {
  return requestApi<QuotationDetail>("/api/v1/professional/quotations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ requestId, ...values }),
  });
}

export function updateQuotation(
  quotationId: string,
  lockVersion: number,
  values: QuotationDraftValues,
) {
  return requestApi<QuotationDetail>(
    `/api/v1/professional/quotations/${encodeURIComponent(quotationId)}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lockVersion, ...values }),
    },
  );
}

export function createQuotationRevision(
  quotationId: string,
  lockVersion: number,
  values: QuotationDraftValues,
) {
  return requestApi<QuotationDetail>(
    `/api/v1/professional/quotations/${encodeURIComponent(quotationId)}/revisions`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lockVersion, ...values }),
    },
  );
}

export function quotationAction(
  audience: "client" | "professional",
  quotationId: string,
  action: "submit" | "accept" | "decline" | "request-revision",
  lockVersion: number,
  note?: string,
) {
  return requestApi<QuotationDetail>(
    `/api/v1/${audience}/quotations/${encodeURIComponent(quotationId)}/${action}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        lockVersion,
        ...(note?.trim() ? { note: note.trim() } : {}),
      }),
    },
  );
}
