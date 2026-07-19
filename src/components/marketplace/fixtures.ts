export type MarketplaceService = {
  id: string;
  slug: string;
  title: string;
  serviceName: string;
  category: string;
  tag: string;
  rating: number;
  reviews: number;
  location: string;
  priceFrom: number;
  availability: "today" | "week";
  image: string;
  gallery: string[];
  description: string;
  features: string[];
  overview: string;
  idealFor: string[];
  duration: string;
  youReceive: string[];
  provider: {
    name: string;
    rating: number;
    experience: string;
    location: string;
    jobsCompleted: number;
    onTimeRate: string;
    image: string;
  };
};

export const marketplaceCategories = [
  { id: "plumbing", label: "Plumbing", count: 124 },
  { id: "electrical", label: "Electrical", count: 98 },
  { id: "cleaning", label: "Cleaning", count: 156 },
  { id: "painting", label: "Painting", count: 72 },
  { id: "appliance", label: "Appliance Repair", count: 54 },
] as const;

export const marketplaceServices: MarketplaceService[] = [
  {
    id: "1",
    slug: "plumbing-inspection",
    title: "ProLine Plumbing",
    serviceName: "Plumbing Inspection",
    category: "Plumbing",
    tag: "Inspection",
    rating: 4.8,
    reviews: 124,
    location: "Nairobi",
    priceFrom: 1200,
    availability: "today",
    image: "/images/category-plumbing.png",
    gallery: [
      "/images/category-plumbing.png",
      "/images/featured-professional.png",
      "/images/home-repair-interior.png",
      "/images/homepage-hero.png",
    ],
    description:
      "A thorough inspection of your plumbing system to catch leaks, pressure issues, and fixture problems before they become costly repairs.",
    features: [
      "Leak detection",
      "Pipe & fixture inspection",
      "Water pressure check",
      "Drain flow assessment",
      "Written findings summary",
    ],
    overview:
      "Our plumbing inspection covers supply lines, drains, fixtures, and visible valves. You receive a clear report with recommended next steps so you can prioritise repairs with confidence.",
    idealFor: ["Homeowners", "Landlords", "Property managers", "Pre-purchase checks"],
    duration: "1 – 2 hours",
    youReceive: [
      "Full plumbing system check",
      "Detailed inspection report",
      "Photo evidence of issues",
      "Priority repair recommendations",
      "Follow-up quote if needed",
    ],
    provider: {
      name: "ProLine Plumbing",
      rating: 4.8,
      experience: "5+ years experience",
      location: "Nairobi, Kenya",
      jobsCompleted: 245,
      onTimeRate: "98%",
      image: "/images/header-avatar.png",
    },
  },
  {
    id: "2",
    slug: "electrical-diagnostic",
    title: "Bright Spark Electric",
    serviceName: "Electrical Diagnostic",
    category: "Electrical",
    tag: "Diagnostic",
    rating: 4.7,
    reviews: 210,
    location: "Westlands",
    priceFrom: 1500,
    availability: "week",
    image: "/images/category-electrical.png",
    gallery: [
      "/images/category-electrical.png",
      "/images/featured-professional.png",
      "/images/homepage-hero.png",
      "/images/home-repair-interior.png",
    ],
    description:
      "Diagnose electrical faults, overloaded circuits, and unsafe wiring with a certified electrician.",
    features: [
      "Circuit testing",
      "Outlet & switch check",
      "Panel inspection",
      "Safety assessment",
      "Clear remediation plan",
    ],
    overview:
      "We identify the root cause of electrical issues and explain safe next steps in plain language, including urgency and estimated repair scope.",
    idealFor: ["Homeowners", "Landlords", "Small offices"],
    duration: "1 – 3 hours",
    youReceive: [
      "Full electrical diagnostic",
      "Safety risk summary",
      "Recommended fixes",
      "Parts estimate if needed",
      "Follow-up booking option",
    ],
    provider: {
      name: "Bright Spark Electric",
      rating: 4.7,
      experience: "8+ years experience",
      location: "Westlands, Nairobi",
      jobsCompleted: 312,
      onTimeRate: "97%",
      image: "/images/header-avatar.png",
    },
  },
  {
    id: "3",
    slug: "deep-home-cleaning",
    title: "Spotless Home Care",
    serviceName: "Deep Home Cleaning",
    category: "Cleaning",
    tag: "Cleaning",
    rating: 4.9,
    reviews: 410,
    location: "Kilimani",
    priceFrom: 800,
    availability: "today",
    image: "/images/category-cleaning.png",
    gallery: [
      "/images/category-cleaning.png",
      "/images/home-repair-interior.png",
      "/images/homepage-hero.png",
      "/images/featured-professional.png",
    ],
    description:
      "A detailed clean for kitchens, baths, floors, and high-touch surfaces—ideal after guests or before move-in.",
    features: [
      "Kitchen deep clean",
      "Bathroom sanitising",
      "Floor care",
      "Dusting & surfaces",
      "Eco-friendly options",
    ],
    overview:
      "Our team follows a room-by-room checklist so every space is left tidy, fresh, and ready to use.",
    idealFor: ["Busy households", "Move-in / move-out", "Airbnb hosts"],
    duration: "3 – 5 hours",
    youReceive: [
      "Full-home deep clean",
      "Checklist completion report",
      "Before/after notes",
      "Recurring plan options",
      "Supplies included",
    ],
    provider: {
      name: "Spotless Home Care",
      rating: 4.9,
      experience: "6+ years experience",
      location: "Kilimani, Nairobi",
      jobsCompleted: 520,
      onTimeRate: "99%",
      image: "/images/header-avatar.png",
    },
  },
  {
    id: "4",
    slug: "interior-painting",
    title: "ColourCraft Painters",
    serviceName: "Interior Painting",
    category: "Painting",
    tag: "Painting",
    rating: 4.6,
    reviews: 145,
    location: "Lavington",
    priceFrom: 2500,
    availability: "week",
    image: "/images/category-painting.png",
    gallery: [
      "/images/category-painting.png",
      "/images/home-repair-interior.png",
      "/images/homepage-hero.png",
      "/images/featured-professional.png",
    ],
    description:
      "Interior wall painting with surface prep, clean edges, and durable finishes matched to your colour choice.",
    features: [
      "Surface prep",
      "Colour matching",
      "Clean masking",
      "Two-coat finish",
      "Debris cleanup",
    ],
    overview:
      "We prepare surfaces properly, protect your floors and fittings, and deliver an even professional finish.",
    idealFor: ["Home refreshes", "Rentals", "New rooms"],
    duration: "1 – 3 days",
    youReceive: [
      "Prepared surfaces",
      "Agreed colour finish",
      "Touch-up guidance",
      "Cleanup included",
      "Warranty on workmanship",
    ],
    provider: {
      name: "ColourCraft Painters",
      rating: 4.6,
      experience: "10+ years experience",
      location: "Lavington, Nairobi",
      jobsCompleted: 198,
      onTimeRate: "96%",
      image: "/images/header-avatar.png",
    },
  },
  {
    id: "5",
    slug: "appliance-repair",
    title: "FixIt Appliance Pros",
    serviceName: "Appliance Repair",
    category: "Appliance Repair",
    tag: "Repair",
    rating: 4.5,
    reviews: 88,
    location: "Nairobi",
    priceFrom: 1800,
    availability: "today",
    image: "/images/category-plumbing.png",
    gallery: [
      "/images/category-plumbing.png",
      "/images/featured-professional.png",
      "/images/homepage-hero.png",
      "/images/home-repair-interior.png",
    ],
    description:
      "Diagnose and repair common home appliances with transparent labour and parts guidance.",
    features: [
      "On-site diagnosis",
      "Common brand coverage",
      "Parts sourcing advice",
      "Safety checks",
      "Same-day options",
    ],
    overview:
      "We start with diagnosis, confirm the fix and cost path, then repair when parts and approval are ready.",
    idealFor: ["Home kitchens", "Laundry rooms", "Small businesses"],
    duration: "1 – 4 hours",
    youReceive: [
      "Diagnostic assessment",
      "Repair quote",
      "Completed fix when approved",
      "Usage tips",
      "Follow-up support window",
    ],
    provider: {
      name: "FixIt Appliance Pros",
      rating: 4.5,
      experience: "7+ years experience",
      location: "Nairobi, Kenya",
      jobsCompleted: 176,
      onTimeRate: "95%",
      image: "/images/header-avatar.png",
    },
  },
  {
    id: "6",
    slug: "drain-cleaning",
    title: "AquaFlow Services",
    serviceName: "Drain Cleaning",
    category: "Plumbing",
    tag: "Maintenance",
    rating: 4.8,
    reviews: 190,
    location: "Karen",
    priceFrom: 1400,
    availability: "week",
    image: "/images/featured-professional.png",
    gallery: [
      "/images/featured-professional.png",
      "/images/category-plumbing.png",
      "/images/homepage-hero.png",
      "/images/home-repair-interior.png",
    ],
    description:
      "Clear slow or blocked drains using professional tools, with guidance to prevent repeat clogs.",
    features: [
      "Blockage clearing",
      "Camera check when needed",
      "Fixture protection",
      "Odour assessment",
      "Prevention tips",
    ],
    overview:
      "We restore flow safely and explain what caused the blockage so you can reduce repeat visits.",
    idealFor: ["Kitchens", "Bathrooms", "Shared drains"],
    duration: "45 – 90 minutes",
    youReceive: [
      "Cleared drain lines",
      "Cause assessment",
      "Prevention guidance",
      "Photo notes when relevant",
      "Follow-up availability",
    ],
    provider: {
      name: "AquaFlow Services",
      rating: 4.8,
      experience: "9+ years experience",
      location: "Karen, Nairobi",
      jobsCompleted: 267,
      onTimeRate: "98%",
      image: "/images/header-avatar.png",
    },
  },
];

export function getMarketplaceServiceBySlug(slug: string) {
  return marketplaceServices.find((service) => service.slug === slug) ?? null;
}
