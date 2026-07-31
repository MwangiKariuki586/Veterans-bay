interface ApiEnvelope<T> {
  data?: T;
  error?: { message?: string };
}

export async function administrationApi<T>(
  path: string,
  init?: RequestInit,
) {
  const response = await fetch(path, {
    cache: "no-store",
    credentials: "include",
    ...init,
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const body = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok || body?.data === undefined) {
    throw new Error(
      body?.error?.message ?? "The administration request could not be completed.",
    );
  }
  return body.data;
}
