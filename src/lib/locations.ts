export const MARKETPLACE_LOCATION_OPTIONS = [
  { value: "Nairobi", label: "Nairobi, Kenya" },
  { value: "Westlands", label: "Westlands, Nairobi" },
  { value: "Kilimani", label: "Kilimani, Nairobi" },
  { value: "Karen", label: "Karen, Nairobi" },
  { value: "Lavington", label: "Lavington, Nairobi" },
  { value: "Runda", label: "Runda, Nairobi" },
  { value: "Langata", label: "Langata, Nairobi" },
  { value: "South B", label: "South B, Nairobi" },
  { value: "Kasarani", label: "Kasarani, Nairobi" },
  { value: "Embakasi", label: "Embakasi, Nairobi" },
] as const;

export type MarketplaceLocationValue = (typeof MARKETPLACE_LOCATION_OPTIONS)[number]["value"];

export const LOCATION_VALUE_SET = new Set<string>(
  MARKETPLACE_LOCATION_OPTIONS.map((o) => o.value),
);

export const LOCATION_LABEL_MAP = new Map<string, string>(
  MARKETPLACE_LOCATION_OPTIONS.map((o) => [o.value, o.label]),
);

export function locationLabel(value: string): string {
  return LOCATION_LABEL_MAP.get(value) ?? value;
}
