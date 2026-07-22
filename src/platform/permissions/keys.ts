export const permissionKeys = {
  organisationView: "organisation.view",
  organisationManage: "organisation.manage",
  organisationMembersManage: "organisation.members.manage",
  servicesView: "services.view",
  servicesManage: "services.manage",
  enquiriesView: "enquiries.view",
  enquiriesManage: "enquiries.manage",
  quotationsView: "quotations.view",
  quotationsManage: "quotations.manage",
  bookingsView: "bookings.view",
  bookingsManage: "bookings.manage",
  assignmentsManage: "assignments.manage",
  jobsView: "jobs.view",
  jobsManage: "jobs.manage",
  customersView: "customers.view",
  customersManage: "customers.manage",
  paymentsView: "payments.view",
  paymentsManage: "payments.manage",
  reportsView: "reports.view",
  reportsFinancialView: "reports.financial.view",
  platformAdmin: "platform.admin",
} as const;

export type PermissionKey =
  (typeof permissionKeys)[keyof typeof permissionKeys];

export function hasPermission(
  granted: readonly string[],
  required: PermissionKey | PermissionKey[],
): boolean {
  const requiredKeys = Array.isArray(required) ? required : [required];
  return requiredKeys.every((key) => granted.includes(key));
}
