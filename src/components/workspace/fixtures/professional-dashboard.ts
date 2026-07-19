export const professionalMetrics = [
  { label: "Enquiries", value: "5", hint: "3 new" },
  { label: "Quotations", value: "3", hint: "1 awaiting response" },
  { label: "Active Jobs", value: "4", hint: "2 in progress" },
  { label: "Completed Jobs", value: "28", hint: "this month" },
  { label: "Total Earnings", value: "KSh 85,450", hint: "this month" },
] as const;

export const professionalToday = [
  { title: "New enquiry received", meta: "Leak repair · Westlands", tag: "New", tone: "purple" },
  { title: "Quotation pending response", meta: "Water heater install", tag: "Pending", tone: "blue" },
  { title: "Job in progress", meta: "Bathroom pipe repair", tag: "Active", tone: "green" },
  { title: "New review posted", meta: "5.0 from Sarah K.", tag: "Review", tone: "gold" },
] as const;

export const professionalBookings = [
  {
    id: "pb1",
    title: "Pipe Repair",
    customer: "Alex Mwangi",
    location: "Westlands",
    service: "Plumbing",
    schedule: "Today · 11:00 AM",
    status: "In Progress",
    image: "/images/category-plumbing.png",
  },
  {
    id: "pb2",
    title: "Toilet Installation",
    customer: "Grace Otieno",
    location: "Kilimani",
    service: "Plumbing",
    schedule: "Tomorrow · 9:00 AM",
    status: "Scheduled",
    image: "/images/featured-professional.png",
  },
  {
    id: "pb3",
    title: "Drain Cleaning",
    customer: "Brian Kariuki",
    location: "Lavington",
    service: "Plumbing",
    schedule: "Fri · 2:00 PM",
    status: "Scheduled",
    image: "/images/category-plumbing.png",
  },
] as const;

export const professionalReviews = [
  {
    name: "Sarah K.",
    rating: 5,
    comment: "On time, tidy work, and clear pricing. Highly recommended.",
  },
] as const;
