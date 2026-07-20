import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  ClipboardList,
  CreditCard,
  FileText,
  LayoutDashboard,
  Settings,
  Shield,
  ShoppingBag,
  Star,
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
      { href: "/marketplace", label: "Marketplace", icon: ShoppingBag },
      { href: "/professional/requests", label: "Requests", icon: ClipboardList },
      { href: "/professional/quotations", label: "Quotations", icon: FileText },
      { href: "/professional/bookings", label: "Bookings", icon: CalendarDays },
      { href: "/professional/jobs", label: "Jobs", icon: Wrench },
    ],
  },
  {
    id: "management",
    items: [
      { href: "/professional/customers", label: "Customers", icon: Users },
      { href: "/professional/payments", label: "Payments", icon: CreditCard },
      { href: "/professional/warranties", label: "Warranties", icon: Shield },
      { href: "/professional/reviews", label: "Reviews", icon: Star },
    ],
  },
  {
    id: "system",
    items: [
      { href: "/professional/team", label: "Team", icon: Users },
      { href: "/professional/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/professional/settings/profile", label: "Business Profile", icon: Settings },
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
      { href: "/client/bookings", label: "Bookings", icon: CalendarDays },
      { href: "/client/invoices", label: "Invoices", icon: FileText },
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
      { href: "/admin/organisations", label: "Organisations", icon: BriefcaseBusiness },
      { href: "/admin/users", label: "Users", icon: Users },
      { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
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
    { href: "/professional/requests", label: "Requests" },
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
