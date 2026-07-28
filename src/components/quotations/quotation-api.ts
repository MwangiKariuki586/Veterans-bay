"use client";

import { requestApi } from "@/components/service-requests/request-api";
import type {
  QuotationDetail,
  QuotationDraftValues,
  QuotationStatus,
  QuotationSummary,
} from "@/modules/quotations/types";

export type QuotationPage = {
  items: QuotationSummary[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
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

export function getQuotation(
  audience: "client" | "professional",
  quotationId: string,
) {
  return requestApi<QuotationDetail>(
    `/api/v1/${audience}/quotations/${encodeURIComponent(quotationId)}`,
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
