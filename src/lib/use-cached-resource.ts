"use client";

import { useEffect, useState } from "react";

import {
  getCachedResource,
  setCachedResource,
} from "@/lib/client-resource-cache";

type ResourceState<T> = {
  key: string;
  data: T | null;
  error: string | null;
  loading: boolean;
};

/**
 * Session-scoped list/detail fetch helper.
 * Shows cached data immediately and refreshes in the background.
 */
export function useCachedResource<T>({
  namespace,
  key,
  load,
  enabled = true,
  ttlMs = 60_000,
  errorMessage = "Unable to load.",
}: {
  namespace: string;
  key: string;
  load: (signal: AbortSignal) => Promise<T>;
  enabled?: boolean;
  ttlMs?: number;
  errorMessage?: string;
}) {
  const cached = enabled
    ? getCachedResource<T>(namespace, key, ttlMs)
    : null;
  const [state, setState] = useState<ResourceState<T>>({
    key,
    data: cached,
    error: null,
    loading: enabled && !cached,
  });

  if (state.key !== key) {
    setState({
      key,
      data: cached,
      error: null,
      loading: enabled && !cached,
    });
  }

  useEffect(() => {
    if (!enabled) return;

    const controller = new AbortController();
    void load(controller.signal)
      .then((next) => {
        setCachedResource(namespace, key, next);
        setState({
          key,
          data: next,
          error: null,
          loading: false,
        });
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setState((current) => ({
          ...current,
          key,
          error: cause instanceof Error ? cause.message : errorMessage,
          loading: false,
        }));
      });

    return () => controller.abort();
  }, [enabled, errorMessage, key, load, namespace, ttlMs]);

  return {
    data: state.data,
    error: state.error,
    loading: state.loading,
  };
}
