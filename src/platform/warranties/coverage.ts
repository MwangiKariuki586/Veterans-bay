const durationPattern =
  /\b(\d{1,4})\s*(day|days|week|weeks|month|months|year|years)\b/i;
const ineligiblePattern = /\b(no warranty|not covered|warranty does not apply)\b/i;

export function deriveWarrantyCoverage(terms: string, startsAt: Date) {
  if (!terms.trim() || ineligiblePattern.test(terms)) return null;
  const match = terms.match(durationPattern);
  const amount = match ? Number(match[1]) : 30;
  const unit = match?.[2]?.toLowerCase() ?? "days";
  const days =
    unit.startsWith("week")
      ? amount * 7
      : unit.startsWith("month")
        ? amount * 30
        : unit.startsWith("year")
          ? amount * 365
          : amount;
  const boundedDays = Math.max(1, Math.min(days, 3650));
  return {
    startsAt,
    endsAt: new Date(startsAt.getTime() + boundedDays * 86_400_000),
    durationDays: boundedDays,
  };
}
