import { describe, it, expect } from "vitest";
import { providerDefinitions, getProvider, getProvidersByRole } from "./providers";
import { providerDefinitionSchema } from "./schema";

describe("providerDefinitions", () => {
  it("every provider passes schema validation", () => {
    for (const p of providerDefinitions) {
      expect(providerDefinitionSchema.safeParse(p).success).toBe(true);
    }
  });
  it("has unique keys", () => {
    const keys = providerDefinitions.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it("includes magic as a wallet provider for all families", () => {
    const magic = getProvider("magic");
    expect(magic.role).toBe("wallet");
    expect(magic.families).toEqual(expect.arrayContaining(["evm", "solana", "bitcoin"]));
  });
});

describe("getProvider", () => {
  it("throws on an unknown key", () => {
    // @ts-expect-error deliberately invalid key
    expect(() => getProvider("nope")).toThrow();
  });
});

describe("getProvidersByRole", () => {
  it("returns only execution providers for the execution role", () => {
    const exec = getProvidersByRole("execution");
    expect(exec.length).toBeGreaterThan(0);
    expect(exec.every((p) => p.role === "execution")).toBe(true);
  });
});
