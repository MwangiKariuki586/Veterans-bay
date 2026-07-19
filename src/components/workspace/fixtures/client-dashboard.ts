export type ClientBookingFixture = {
  id: string;
  service: string;
  professional: string;
  date: string;
  status: "Completed" | "Ongoing" | "Confirmed" | "Pending" | "Cancelled" | "In Progress";
  amount: number;
  image: string;
  location?: string;
  time?: string;
};

export const clientDashboardStats = [
  { label: "Jobs Booked", value: "12", hint: "▲ 20% vs last month", tone: "green" },
  { label: "Ongoing Jobs", value: "5", hint: "View progress", tone: "blue" },
  { label: "Completed Jobs", value: "8", hint: "▲ 15% vs last month", tone: "gold" },
  { label: "Total Spent", value: "KSh 24,500", hint: "View transactions", tone: "purple" },
] as const;

export const clientRecentBookings: ClientBookingFixture[] = [
  {
    id: "b1",
    service: "Plumbing Inspection",
    professional: "ProLine Plumbing",
    date: "12 May 2024",
    status: "Completed",
    amount: 1200,
    image: "/images/category-plumbing.png",
  },
  {
    id: "b2",
    service: "Electrical Repair",
    professional: "Bright Spark Electric",
    date: "18 May 2024",
    status: "Ongoing",
    amount: 2800,
    image: "/images/category-electrical.png",
  },
  {
    id: "b3",
    service: "Deep Cleaning",
    professional: "Spotless Home Care",
    date: "22 May 2024",
    status: "Confirmed",
    amount: 3500,
    image: "/images/category-cleaning.png",
  },
];

export const clientUpcomingJobs = [
  {
    title: "Plumbing Inspection",
    company: "ProLine Plumbing",
    when: "Tomorrow · 10:00 AM",
    status: "Confirmed" as const,
    image: "/images/category-plumbing.png",
  },
  {
    title: "Socket Replacement",
    company: "Bright Spark Electric",
    when: "Fri · 2:30 PM",
    status: "Pending" as const,
    image: "/images/category-electrical.png",
  },
  {
    title: "Kitchen Cleaning",
    company: "Spotless Home Care",
    when: "Sat · 9:00 AM",
    status: "Confirmed" as const,
    image: "/images/category-cleaning.png",
  },
];

export const clientTopCategories = [
  { label: "Plumbing", count: 124, image: "/images/category-plumbing.png" },
  { label: "Electrical", count: 98, image: "/images/category-electrical.png" },
  { label: "Cleaning", count: 156, image: "/images/category-cleaning.png" },
  { label: "Painting", count: 72, image: "/images/category-painting.png" },
];

export const clientBookingsList: ClientBookingFixture[] = [
  {
    id: "bk1",
    service: "Plumbing Inspection",
    professional: "ProLine Plumbing",
    date: "12 May 2024",
    time: "10:00 AM – 12:00 PM",
    location: "Westlands, Nairobi",
    status: "Confirmed",
    amount: 1200,
    image: "/images/category-plumbing.png",
  },
  {
    id: "bk2",
    service: "Electrical Diagnostic",
    professional: "Bright Spark Electric",
    date: "14 May 2024",
    time: "2:00 PM – 4:00 PM",
    location: "Kilimani, Nairobi",
    status: "Pending",
    amount: 1800,
    image: "/images/category-electrical.png",
  },
  {
    id: "bk3",
    service: "Full Home Clean",
    professional: "Spotless Home Care",
    date: "16 May 2024",
    time: "9:00 AM – 1:00 PM",
    location: "Lavington, Nairobi",
    status: "In Progress",
    amount: 4500,
    image: "/images/category-cleaning.png",
  },
  {
    id: "bk4",
    service: "Interior Painting",
    professional: "ColourCraft Painters",
    date: "2 May 2024",
    time: "8:00 AM – 5:00 PM",
    location: "Karen, Nairobi",
    status: "Completed",
    amount: 18000,
    image: "/images/category-painting.png",
  },
  {
    id: "bk5",
    service: "Drain Cleaning",
    professional: "AquaFlow Services",
    date: "28 Apr 2024",
    time: "11:00 AM – 12:30 PM",
    location: "Nairobi CBD",
    status: "Cancelled",
    amount: 900,
    image: "/images/featured-professional.png",
  },
];
