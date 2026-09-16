export const DEFAULT_POST_AUTH_PATH = "/workspace/select";

const AUTH_ENTRY_PATHS = new Set(["/login", "/register"]);
const INTERNAL_ORIGIN = "https://veterans-bay.local";

export function safeReturnPath(
  candidate: string | null | undefined,
  fallback = DEFAULT_POST_AUTH_PATH,
) {
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) {
    return fallback;
  }

  try {
    const parsed = new URL(candidate, INTERNAL_ORIGIN);
    if (parsed.origin !== INTERNAL_ORIGIN || AUTH_ENTRY_PATHS.has(parsed.pathname)) {
      return fallback;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function loginHrefFor(returnPath: string) {
  const destination = safeReturnPath(returnPath, "");
  return destination
    ? `/login?redirect=${encodeURIComponent(destination)}`
    : "/login";
}

export function pathWithSearch(
  pathname: string,
  search: string | { toString(): string },
) {
  const query = String(search).replace(/^\?/, "");
  return query ? `${pathname}?${query}` : pathname;
}
