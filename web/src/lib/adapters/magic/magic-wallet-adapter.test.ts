import { describe, it, expect, vi } from "vitest";
import { MagicWalletAdapter, MagicApiError } from "./magic-wallet-adapter";
import type { IdentityAttestation } from "../../ports/types";

const identity: IdentityAttestation = { uid: "u1", email: "u1@example.com", idToken: "firebase-jwt-abc" };

function makeFetchMock(responseBody: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => responseBody,
    text: async () => JSON.stringify(responseBody),
  });
}

describe("MagicWalletAdapter.provision", () => {
  it("calls the TEE endpoint with correct headers for an evm family", async () => {
    const fetchMock = makeFetchMock({ public_address: "0xABC", wallet_type: "eoa" });
    const adapter = new MagicWalletAdapter({ secretKey: "sk_test", oidcProviderId: "oidc_test", fetchImpl: fetchMock });

    const record = await adapter.provision(identity, "evm");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://tee.express.magiclabs.com/v1/wallet",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "Authorization": "Bearer firebase-jwt-abc",
          "X-Magic-Secret-Key": "sk_test",
          "X-OIDC-Provider-ID": "oidc_test",
          "X-Magic-Chain": "ETH",
        }),
      }),
    );
    expect(record).toEqual({ address: "0xABC", family: "evm", provider: "magic", providerRef: "0xABC" });
  });

  it("maps solana family to X-Magic-Chain: SOL", async () => {
    const fetchMock = makeFetchMock({ public_address: "SoLanaAddr", wallet_type: "eoa" });
    const adapter = new MagicWalletAdapter({ secretKey: "sk", oidcProviderId: "oidc", fetchImpl: fetchMock });
    await adapter.provision(identity, "solana");
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>)["X-Magic-Chain"]).toBe("SOL");
  });

  it("maps bitcoin family to X-Magic-Chain: BTC", async () => {
    const fetchMock = makeFetchMock({ public_address: "bc1qabc", wallet_type: "eoa" });
    const adapter = new MagicWalletAdapter({ secretKey: "sk", oidcProviderId: "oidc", fetchImpl: fetchMock });
    await adapter.provision(identity, "bitcoin");
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>)["X-Magic-Chain"]).toBe("BTC");
  });

  it("throws with detail when the TEE API responds with an error", async () => {
    const fetchMock = makeFetchMock({ error: "boom" }, false, 500);
    const adapter = new MagicWalletAdapter({ secretKey: "sk", oidcProviderId: "oidc", fetchImpl: fetchMock });
    await expect(adapter.provision(identity, "evm")).rejects.toThrow(/Wallet creation failed/);
  });

  it("throws a MagicApiError carrying the original TEE status code", async () => {
    const fetchMock = makeFetchMock({ error: "rate limited" }, false, 429);
    const adapter = new MagicWalletAdapter({ secretKey: "sk", oidcProviderId: "oidc", fetchImpl: fetchMock });
    await expect(adapter.provision(identity, "evm")).rejects.toMatchObject({ status: 429 });
    await expect(adapter.provision(identity, "evm")).rejects.toBeInstanceOf(MagicApiError);
  });
});

describe("MagicWalletAdapter.getAddress", () => {
  it("calls the TEE endpoint with GET and returns the address", async () => {
    const fetchMock = makeFetchMock({ public_address: "0xDEF", wallet_type: "eoa" });
    const adapter = new MagicWalletAdapter({ secretKey: "sk", oidcProviderId: "oidc", fetchImpl: fetchMock });
    const address = await adapter.getAddress(identity, "evm");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://tee.express.magiclabs.com/v1/wallet",
      expect.objectContaining({ method: "GET" }),
    );
    expect(address).toBe("0xDEF");
  });

  it("returns null when the TEE API 404s (no wallet yet)", async () => {
    const fetchMock = makeFetchMock({ error: "not found" }, false, 404);
    const adapter = new MagicWalletAdapter({ secretKey: "sk", oidcProviderId: "oidc", fetchImpl: fetchMock });
    expect(await adapter.getAddress(identity, "evm")).toBeNull();
  });
});

describe("MagicWalletAdapter.healthcheck", () => {
  it("reports healthy when a lightweight probe succeeds", async () => {
    const fetchMock = makeFetchMock({ public_address: "0x0", wallet_type: "eoa" }, true, 401);
    const adapter = new MagicWalletAdapter({ secretKey: "sk", oidcProviderId: "oidc", fetchImpl: fetchMock });
    const health = await adapter.healthcheck();
    expect(health.provider).toBe("magic");
    expect(["healthy", "degraded", "down"]).toContain(health.status);
  });
});
