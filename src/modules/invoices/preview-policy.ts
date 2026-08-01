import { AppError } from "../../platform/errors/app-error";
import type { PaymentMethod } from "./types";

interface PreviewPaymentInput {
  evidenceAssetId?: string;
  method: PaymentMethod;
  transactionReference?: string;
}

export function enforcePreviewPaymentPolicy(
  appEnvironment: string,
  input: PreviewPaymentInput,
) {
  if (appEnvironment !== "preview") return;

  if (
    input.method !== "OTHER" ||
    !input.transactionReference?.startsWith("PREVIEW-") ||
    input.evidenceAssetId
  ) {
    throw new AppError({
      code: "PREVIEW_PAYMENT_MUST_BE_SIMULATED",
      message:
        "Preview payment records must use Other, a PREVIEW- reference, and no payment evidence. No real funds are recorded.",
      status: 422,
    });
  }
}
