import type {
  CustomerBalance,
  CustomerDetail,
  CustomerPage,
} from "@/modules/customers/types";
async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const body = (await response.json().catch(() => null)) as {
    data?: T;
    error?: { message?: string };
  } | null;
  if (!response.ok || body?.data == null)
    throw new Error(
      body?.error?.message ?? "Customer records are unavailable.",
    );
  return body.data;
}
export const listCustomers = (query: string) =>
  call<CustomerPage>(`/api/v1/professional/customers?${query}`);
export const getCustomer = (id: string) =>
  call<CustomerDetail>(`/api/v1/professional/customers/${id}`);
export const getCustomerBalance = (id: string) =>
  call<CustomerBalance>(`/api/v1/professional/customers/${id}/balance`);
export const createCustomer = (values: Record<string, unknown>) =>
  call<CustomerDetail>("/api/v1/professional/customers", {
    method: "POST",
    body: JSON.stringify(values),
  });
export const customerAction = (
  id: string,
  action: string,
  values?: Record<string, unknown>,
) =>
  call<CustomerDetail>(`/api/v1/professional/customers/${id}/${action}`, {
    method: "POST",
    body: JSON.stringify(values ?? {}),
  });
export interface ReminderItem {
  id: string;
  customerId: string;
  reason: string;
  dueAt: string;
  status: "SCHEDULED" | "CANCELLED" | "SENT";
  createdAt: string;
}
export const listReminders = (customerId: string) =>
  call<ReminderItem[]>(
    `/api/v1/professional/customers/${customerId}/reminders`,
  );
export const scheduleReminder = (
  customerId: string,
  reason: string,
  dueAt: string,
) =>
  call<ReminderItem>(
    `/api/v1/professional/customers/${customerId}/reminders`,
    { method: "POST", body: JSON.stringify({ reason, dueAt }) },
  );
export const cancelReminder = (reminderId: string) =>
  call<ReminderItem>(
    `/api/v1/professional/reminders/${reminderId}/cancel`,
    { method: "POST", body: "{}" },
  );
