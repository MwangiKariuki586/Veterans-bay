export interface SavedProfessional {
  slug: string;
  businessName: string;
  primaryCategory: string | null;
  description: string | null;
  operatingLocation: string | null;
  verified: boolean;
  logoUrl: string | null;
  serviceCount: number;
  savedAt: string;
}

export interface SavedProfessionalMutation {
  providerSlug: string;
  saved: boolean;
}
