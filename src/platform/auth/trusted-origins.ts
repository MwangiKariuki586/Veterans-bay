interface TrustedOriginEnvironment {
  WEB_ORIGIN: string;
  ADDITIONAL_WEB_ORIGINS?: readonly string[];
}

export function parseWebOrigin(value: string): string {
  const url = new URL(value);

  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error("Web origins must not include credentials, paths, queries, or fragments.");
  }

  return url.origin;
}

export function parseAdditionalWebOrigins(value: string): string[] {
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map(parseWebOrigin);
}

export function getTrustedWebOrigins(
  environment: TrustedOriginEnvironment,
): string[] {
  return [
    ...new Set([
      environment.WEB_ORIGIN,
      ...(environment.ADDITIONAL_WEB_ORIGINS ?? []),
    ]),
  ];
}
