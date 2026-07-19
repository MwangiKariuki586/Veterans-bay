export const adminKpis = [
  { label: "Total Users", value: "24,582", trend: "12% vs last 30 days", tone: "blue" },
  { label: "Active Professionals", value: "6,348", trend: "14% vs last 30 days", tone: "green" },
  { label: "Bookings This Month", value: "3,172", trend: "18% vs last month", tone: "indigo" },
  { label: "GMV / Transactions", value: "KSh 12.4M", trend: "21% vs last month", tone: "purple" },
  { label: "Active Listings", value: "1,286", trend: "9% vs last 30 days", tone: "dark" },
] as const;

export const adminActivity = [
  { title: "New professional verified", time: "12 min ago", tone: "green" },
  { title: "Bulk payout processed", time: "48 min ago", tone: "blue" },
  { title: "Listing flagged for review", time: "1 hr ago", tone: "orange" },
  { title: "Dispute opened by client", time: "2 hr ago", tone: "red" },
] as const;

export const adminPending = [
  { title: "Professional verification queue", action: "Review" },
  { title: "Flagged marketplace listing", action: "Moderate" },
  { title: "Payout exception", action: "Take Action" },
  { title: "Support escalation", action: "View" },
] as const;

export const adminHealth = [
  "Web App",
  "Database",
  "Payments",
  "File Storage",
  "Queue Workers",
] as const;

export const adminBookings = [
  {
    id: "VB-1042",
    service: "Plumbing Inspection",
    client: "Alex Mwangi",
    professional: "ProLine Plumbing",
    location: "Nairobi",
    amount: 1200,
    status: "In Progress",
    date: "18 May",
    image: "/images/category-plumbing.png",
  },
  {
    id: "VB-1041",
    service: "Electrical Repair",
    client: "Grace Otieno",
    professional: "Bright Spark",
    location: "Westlands",
    amount: 2800,
    status: "Confirmed",
    date: "18 May",
    image: "/images/category-electrical.png",
  },
  {
    id: "VB-1040",
    service: "Deep Cleaning",
    client: "Brian Kariuki",
    professional: "Spotless Care",
    location: "Kilimani",
    amount: 4500,
    status: "Scheduled",
    date: "17 May",
    image: "/images/category-cleaning.png",
  },
  {
    id: "VB-1039",
    service: "Interior Painting",
    client: "Hannah W.",
    professional: "ColourCraft",
    location: "Lavington",
    amount: 18000,
    status: "Pending",
    date: "17 May",
    image: "/images/category-painting.png",
  },
] as const;
