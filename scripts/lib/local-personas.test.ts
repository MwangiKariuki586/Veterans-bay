import { describe, expect, it } from "vitest";

// @ts-expect-error The production seed helper is plain ESM for direct Node execution.
import { localPersonaSpecs } from "./local-personas.mjs";

describe("local seeded personas", () => {
  it("defines exactly two clients, two professionals, and one administrator", () => {
    expect(localPersonaSpecs).toHaveLength(5);
    expect(localPersonaSpecs.map((persona: { kind: string }) => persona.kind).sort()).toEqual([
      "administrator",
      "client",
      "client",
      "professional",
      "professional",
    ]);
  });

  it("gives every persona a unique login and account-profile identity", () => {
    for (const field of ["email", "fallbackAuthUserId", "fallbackProfileId"] as const) {
      const values = localPersonaSpecs.map(
        (persona: Record<(typeof field), string>) => persona[field],
      );
      expect(new Set(values).size).toBe(5);
    }
    expect(localPersonaSpecs.every((persona: { password?: string }) => persona.password)).toBe(true);
  });
});
