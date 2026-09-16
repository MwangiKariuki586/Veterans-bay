"use client";

import { useQueryClient } from "@tanstack/react-query";

export function useOptionalQueryClient() {
  try {
    return useQueryClient();
  } catch {
    return null;
  }
}
