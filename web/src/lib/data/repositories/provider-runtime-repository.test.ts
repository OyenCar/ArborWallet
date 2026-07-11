import { describe, it, expect } from "vitest";
import { ProviderRuntimeRepository } from "./provider-runtime-repository";

describe("ProviderRuntimeRepository", () => {
  it("upsertStatus creates then updates a single record per provider", async () => {
    const repo = new ProviderRuntimeRepository();
    await repo.upsertStatus("magic", "active");
    await repo.upsertStatus("magic", "degraded", "elevated latency");

    const found = await repo.findByProviderKey("magic");
    expect(found?.status).toBe("degraded");
    expect(found?.notes).toBe("elevated latency");
  });
});
