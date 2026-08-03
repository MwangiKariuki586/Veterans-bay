import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Blocks,
  BriefcaseBusiness,
  CalendarDays,
  Clock3,
  ClipboardList,
  CreditCard,
  FileText,
  Heart,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Shield,
  Scale,
  ShoppingBag,
  Star,
  Store,
  Users,
  Wrench,
} from "lucide-react";

export type AuthenticatedShellKind = "client" | "professional" | "admin";

export type WorkspaceNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export type WorkspaceNavGroup = {
  id: string;
  items: ReadonlyArray<WorkspaceNavItem>;
};

const professionalNav: ReadonlyArray<WorkspaceNavGroup> = [
  {
    id: "primary",
    items: [
      { href: "/professional", label: "Dashboard", icon: LayoutDashboard },
      { href: "/professional/enquiries", label: "Enquiries", icon: ClipboardList },
      { href: "/professional/quotations", label: "Quotations", icon: FileText },
      { href: "/professional/bookings", label: "Bookings", icon: CalendarDays },
      { href: "/professional/jobs", label: "Jobs", icon: Wrench },
      { href: "/professional/customers", label: "Customers", icon: Users },
      { href: "/professional/payments", label: "Invoices & Payments", icon: CreditCard },
      { href: "/professional/reviews", label: "Reviews", icon: Star },
      { href: "/professional/team", label: "My Team", icon: Users },
      { href: "/professional/availability", label: "Availability", icon: Clock3 },
      { href: "/professional/analytics", label: "Reports", icon: BarChart3 },
      { href: "/marketplace", label: "Marketplace", icon: ShoppingBag },
    ],
  },
  {
    id: "resources",
    items: [
      { href: "/professional/services", label: "Tools & Resources", icon: Store },
      { href: "/account/profile", label: "Settings", icon: Settings },
    ],
  },
];

const clientNav: ReadonlyArray<WorkspaceNavGroup> = [
  {
    id: "primary",
    items: [
      { href: "/client", label: "Dashboard", icon: LayoutDashboard },
      { href: "/marketplace", label: "Marketplace", icon: ShoppingBag },
      { href: "/client/requests", label: "Requests", icon: ClipboardList },
      { href: "/client/quotations", label: "Quotations", icon: FileText },
      { href: "/client/bookings", label: "Bookings", icon: CalendarDays },
      { href: "/client/jobs", label: "Jobs", icon: Wrench },
      { href: "/client/saved", label: "Saved", icon: Heart },
      { href: "/client/invoices", label: "Invoices", icon: FileText },
      { href: "/client/warranties", label: "Warranties", icon: ShieldCheck },
    ],
  },
  {
    id: "system",
    items: [
      { href: "/account/profile", label: "Settings", icon: Settings },
      { href: "/help", label: "Help Center", icon: BriefcaseBusiness },
    ],
  },
];

const adminNav: ReadonlyArray<WorkspaceNavGroup> = [
  {
    id: "primary",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
      { href: "/admin/professionals", label: "Professional Reviews", icon: ShieldCheck },
      { href: "/admin/marketplace/listings", label: "Listing Moderation", icon: Store },
      { href: "/admin/categories", label: "Categories", icon: Blocks },
      { href: "/admin/reports", label: "Reports", icon: FileText },
      { href: "/admin/disputes", label: "Disputes", icon: Scale },
      { href: "/admin/warranties/escalated", label: "Escalated Warranties", icon: Shield },
      { href: "/admin/organisations", label: "Organisations", icon: BriefcaseBusiness },
      { href: "/admin/users", label: "Users", icon: Users },
      { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    id: "system",
    items: [
      { href: "/admin/audit", label: "Audit", icon: ShieldCheck },
      { href: "/admin/rules", label: "Platform Rules", icon: Settings },
      { href: "/admin/operations/async", label: "Async Operations", icon: Clock3 },
      { href: "/account/profile", label: "Settings", icon: Settings },
      { href: "/help", label: "Help Center", icon: BriefcaseBusiness },
    ],
  },
];

export function getWorkspaceNav(
  kind: AuthenticatedShellKind,
): ReadonlyArray<WorkspaceNavGroup> {
  if (kind === "client") {
    return clientNav;
  }
  if (kind === "admin") {
    return adminNav;
  }
  return professionalNav;
}

export function getAuthenticatedFooterLinks(
  kind: AuthenticatedShellKind,
): ReadonlyArray<{ href: string; label: string }> {
  if (kind === "client") {
    return [
      { href: "/client", label: "Dashboard" },
      { href: "/client/requests", label: "Requests" },
      { href: "/client/bookings", label: "Bookings" },
      { href: "/client/invoices", label: "Invoices" },
      { href: "/account/profile", label: "Settings" },
      { href: "/help", label: "Help Center" },
      { href: "/privacy", label: "Privacy" },
    ];
  }

  if (kind === "admin") {
    return [
      { href: "/admin", label: "Dashboard" },
      { href: "/admin/organisations", label: "Organisations" },
      { href: "/admin/users", label: "Users" },
      { href: "/account/profile", label: "Settings" },
      { href: "/help", label: "Help Center" },
      { href: "/privacy", label: "Privacy" },
    ];
  }

  return [
    { href: "/professional", label: "Dashboard" },
    { href: "/professional/enquiries", label: "Enquiries" },
    { href: "/professional/bookings", label: "Bookings" },
    { href: "/professional/payments", label: "Invoices" },
    { href: "/account/profile", label: "Settings" },
    { href: "/help", label: "Help Center" },
    { href: "/privacy", label: "Privacy" },
  ];
}

export const shellContextLabel: Record<AuthenticatedShellKind, string> = {
  client: "Client workspace",
  professional: "Professional workspace",
  admin: "Platform workspace",
};

export const shellHomeHref: Record<AuthenticatedShellKind, string> = {
  client: "/client",
  professional: "/professional",
  admin: "/admin",
};
