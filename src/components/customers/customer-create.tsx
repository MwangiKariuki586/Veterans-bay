"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Input } from "@/components/ui/input";
import { Surface } from "@/components/ui/surface";
import { createCustomer } from "./customer-api";

export function CustomerCreate() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState({
    displayName: "",
    email: "",
    phone: "",
    acquisitionSource: "PROFESSIONAL_IMPORTED",
  });
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const customer = await createCustomer({
        ...values,
        email: values.email || undefined,
        phone: values.phone || undefined,
      });
      router.push(`/professional/customers/${customer.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Customer could not be added.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <p className="text-sm font-semibold text-[#5f8d11]">Customers</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-title">
        Add a customer
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#68717b]">
        Add an existing customer to keep their contact details and future
        service history organised.
      </p>

      <Surface className="mt-6 max-w-2xl p-6 shadow-none">
        <form className="space-y-4" onSubmit={submit}>
          <label className="block text-sm font-semibold">
            Customer name
            <Input
              className="mt-1"
              required
              minLength={2}
              value={values.displayName}
              onChange={(e) =>
                setValues((v) => ({ ...v, displayName: e.target.value }))
              }
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold">
              Email
              <Input
                className="mt-1"
                type="email"
                value={values.email}
                onChange={(e) =>
                  setValues((v) => ({ ...v, email: e.target.value }))
                }
              />
            </label>
            <label className="block text-sm font-semibold">
              Phone
              <Input
                className="mt-1"
                value={values.phone}
                onChange={(e) =>
                  setValues((v) => ({ ...v, phone: e.target.value }))
                }
              />
            </label>
          </div>
          <label className="block text-sm font-semibold">
            Acquisition source
            <select
              className="mt-1 min-h-11 w-full rounded-2xl border border-black/8 bg-white px-4"
              value={values.acquisitionSource}
              onChange={(e) =>
                setValues((v) => ({
                  ...v,
                  acquisitionSource: e.target.value,
                }))
              }
            >
              <option value="PROFESSIONAL_IMPORTED">Existing customer</option>
              <option value="PROFESSIONAL_INVITED">Professional invited</option>
              <option value="CLIENT_REFERRAL">Client referral</option>
              <option value="REPEAT_CLIENT">Repeat client</option>
            </select>
          </label>
          {error ? (
            <InlineAlert variant="error" title="Customer not added">
              {error}
            </InlineAlert>
          ) : null}
          <Button type="submit" loading={busy}>
            Add customer
          </Button>
        </form>
      </Surface>
    </div>
  );
}
