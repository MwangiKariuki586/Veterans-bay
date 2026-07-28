import type { QuotationVersion } from "@/modules/quotations/types";

export function formatQuotationMoney(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
  }).format(amountMinor / 100);
}

export function QuotationVersionView({
  version,
}: {
  version: QuotationVersion;
}) {
  return (
    <div>
      <div className="space-y-3 sm:hidden">
        {version.lineItems.map((item) => (
          <div
            key={item.id}
            className="rounded-2xl border border-black/8 bg-[#f8fafb] p-4"
          >
            <p className="text-sm font-semibold">{item.description}</p>
            <div className="mt-3 flex items-end justify-between gap-4">
              <p className="text-xs text-[#68717b]">
                {item.category.toLowerCase()} · Qty {item.quantity}
              </p>
              <p className="shrink-0 text-sm font-bold">
                {formatQuotationMoney(item.totalMinor, version.currency)}
              </p>
            </div>
          </div>
        ))}
      </div>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-black/8 text-xs uppercase tracking-[0.08em] text-[#7a838c]">
            <tr>
              <th className="px-1 py-3">Item</th>
              <th className="px-3 py-3">Category</th>
              <th className="px-3 py-3 text-right">Qty</th>
              <th className="px-1 py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {version.lineItems.map((item) => (
              <tr key={item.id} className="border-b border-black/6">
                <td className="px-1 py-4 font-semibold">{item.description}</td>
                <td className="px-3 py-4 text-[#68717b]">
                  {item.category.toLowerCase()}
                </td>
                <td className="px-3 py-4 text-right">{item.quantity}</td>
                <td className="px-1 py-4 text-right font-semibold">
                  {formatQuotationMoney(item.totalMinor, version.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="ml-auto mt-5 grid max-w-sm gap-2 text-sm">
        <Amount
          label="Subtotal"
          value={formatQuotationMoney(version.subtotalMinor, version.currency)}
        />
        <Amount
          label="Discount"
          value={`− ${formatQuotationMoney(version.discountMinor, version.currency)}`}
        />
        <Amount
          label="Tax"
          value={formatQuotationMoney(version.taxMinor, version.currency)}
        />
        <Amount
          label="Total"
          value={formatQuotationMoney(version.totalMinor, version.currency)}
          strong
        />
        <Amount
          label="Deposit"
          value={formatQuotationMoney(version.depositMinor, version.currency)}
        />
      </dl>
      <div className="mt-6 grid gap-5 border-t border-black/8 pt-6 md:grid-cols-2">
        <Term label="Scope" value={version.scope} />
        <Term label="Exclusions" value={version.exclusions} />
        <Term label="Warranty terms" value={version.warrantyTerms} />
        <Term label="Payment terms" value={version.paymentTerms} />
      </div>
    </div>
  );
}

function Amount({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex justify-between gap-5 ${strong ? "border-t border-black/10 pt-2 text-base font-bold" : ""}`}
    >
      <dt className="text-[#68717b]">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Term({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <h3 className="text-sm font-bold">{label}</h3>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#5e6872]">
        {value}
      </p>
    </div>
  );
}
